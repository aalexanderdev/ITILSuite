use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use utoipa::IntoParams;
use uuid::Uuid;

use crate::domain::auth::Claims;
use crate::domain::template::{
    CreateTicketTemplateDto, TicketTemplate, UpdateTicketTemplateDto,
};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize, IntoParams)]
pub struct TemplateFilterParams {
    /// Filter by organizational entity ID
    pub entity_id: Option<Uuid>,
    /// Filter by ITIL category
    pub category: Option<String>,
    /// Filter by ticket type ('incident' or 'request')
    pub ticket_type: Option<String>,
    /// Filter active templates (default: true)
    pub is_active: Option<bool>,
}

#[utoipa::path(
    get,
    path = "/api/v1/ticket-templates",
    tag = "Templates",
    params(TemplateFilterParams),
    responses(
        (status = 200, description = "List of ticket templates", body = Vec<TicketTemplate>)
    )
)]
pub async fn list_templates(
    State(state): State<AppState>,
    Query(params): Query<TemplateFilterParams>,
) -> Result<Json<Vec<TicketTemplate>>, AppError> {
    let is_active = params.is_active.unwrap_or(true);

    let templates: Vec<TicketTemplate> = sqlx::query_as(
        r#"
        SELECT 
            tt.id, tt.entity_id, e.name AS entity_name,
            tt.name, tt.description, tt.ticket_type, tt.category,
            tt.predefined_title, tt.predefined_content,
            tt.predefined_urgency, tt.predefined_impact,
            tt.default_technician_id,
            COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username) AS default_technician_name,
            tt.mandatory_fields, tt.hidden_fields,
            tt.is_active, tt.created_at, tt.updated_at
        FROM ticket_templates tt
        JOIN entities e ON e.id = tt.entity_id
        LEFT JOIN users u ON u.id = tt.default_technician_id
        WHERE ($1::uuid IS NULL OR tt.entity_id = $1)
          AND ($2::varchar IS NULL OR tt.category = $2)
          AND ($3::varchar IS NULL OR tt.ticket_type = $3)
          AND tt.is_active = $4
        ORDER BY tt.name ASC
        "#
    )
    .bind(params.entity_id)
    .bind(params.category)
    .bind(params.ticket_type)
    .bind(is_active)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch ticket templates: {:?}", e);
        AppError::InternalServerError("Failed to query ticket templates from database".to_string())
    })?;

    Ok(Json(templates))
}

#[utoipa::path(
    get,
    path = "/api/v1/ticket-templates/{id}",
    tag = "Templates",
    params(
        ("id" = Uuid, Path, description = "Template unique ID")
    ),
    responses(
        (status = 200, description = "Template details", body = TicketTemplate),
        (status = 404, description = "Template not found")
    )
)]
pub async fn get_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TicketTemplate>, AppError> {
    let template: Option<TicketTemplate> = sqlx::query_as(
        r#"
        SELECT 
            tt.id, tt.entity_id, e.name AS entity_name,
            tt.name, tt.description, tt.ticket_type, tt.category,
            tt.predefined_title, tt.predefined_content,
            tt.predefined_urgency, tt.predefined_impact,
            tt.default_technician_id,
            COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username) AS default_technician_name,
            tt.mandatory_fields, tt.hidden_fields,
            tt.is_active, tt.created_at, tt.updated_at
        FROM ticket_templates tt
        JOIN entities e ON e.id = tt.entity_id
        LEFT JOIN users u ON u.id = tt.default_technician_id
        WHERE tt.id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch template by id {}: {:?}", id, e);
        AppError::InternalServerError("Database error while fetching template".to_string())
    })?;

    match template {
        Some(t) => Ok(Json(t)),
        None => Err(AppError::NotFound(format!("Ticket template with ID {} not found", id))),
    }
}

#[utoipa::path(
    post,
    path = "/api/v1/ticket-templates",
    tag = "Templates",
    request_body = CreateTicketTemplateDto,
    responses(
        (status = 201, description = "Ticket template created successfully", body = TicketTemplate),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Unauthorized")
    )
)]
pub async fn create_template(
    State(state): State<AppState>,
    _claims: Claims,
    Json(payload): Json<CreateTicketTemplateDto>,
) -> Result<(StatusCode, Json<TicketTemplate>), AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("Template name cannot be empty".to_string()));
    }

    let entity_id = match payload.entity_id {
        Some(eid) => eid,
        None => {
            let root_id: Option<Uuid> = sqlx::query_scalar("SELECT id FROM entities WHERE parent_id IS NULL LIMIT 1")
                .fetch_optional(&state.pool)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Database error: {:?}", e)))?;
            root_id.unwrap_or_else(Uuid::new_v4)
        }
    };

    let ticket_type = payload.ticket_type.unwrap_or_else(|| "incident".to_string());
    if ticket_type != "incident" && ticket_type != "request" {
        return Err(AppError::BadRequest("ticket_type must be either 'incident' or 'request'".to_string()));
    }

    let mandatory_json = serde_json::to_value(payload.mandatory_fields.unwrap_or_default())
        .unwrap_or_else(|_| serde_json::json!([]));
    let hidden_json = serde_json::to_value(payload.hidden_fields.unwrap_or_default())
        .unwrap_or_else(|_| serde_json::json!([]));

    let template_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO ticket_templates (
            id, entity_id, name, description, ticket_type, category,
            predefined_title, predefined_content, predefined_urgency, predefined_impact,
            default_technician_id, mandatory_fields, hidden_fields, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)
        "#
    )
    .bind(template_id)
    .bind(entity_id)
    .bind(payload.name.trim())
    .bind(payload.description)
    .bind(ticket_type)
    .bind(payload.category)
    .bind(payload.predefined_title)
    .bind(payload.predefined_content)
    .bind(payload.predefined_urgency)
    .bind(payload.predefined_impact)
    .bind(payload.default_technician_id)
    .bind(mandatory_json)
    .bind(hidden_json)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to insert ticket template: {:?}", e);
        AppError::InternalServerError("Failed to create ticket template in database".to_string())
    })?;

    let created: TicketTemplate = sqlx::query_as(
        r#"
        SELECT 
            tt.id, tt.entity_id, e.name AS entity_name,
            tt.name, tt.description, tt.ticket_type, tt.category,
            tt.predefined_title, tt.predefined_content,
            tt.predefined_urgency, tt.predefined_impact,
            tt.default_technician_id,
            COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username) AS default_technician_name,
            tt.mandatory_fields, tt.hidden_fields,
            tt.is_active, tt.created_at, tt.updated_at
        FROM ticket_templates tt
        JOIN entities e ON e.id = tt.entity_id
        LEFT JOIN users u ON u.id = tt.default_technician_id
        WHERE tt.id = $1
        "#
    )
    .bind(template_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to retrieve created template: {:?}", e)))?;

    Ok((StatusCode::CREATED, Json(created)))
}

#[utoipa::path(
    patch,
    path = "/api/v1/ticket-templates/{id}",
    tag = "Templates",
    params(
        ("id" = Uuid, Path, description = "Template unique ID")
    ),
    request_body = UpdateTicketTemplateDto,
    responses(
        (status = 200, description = "Ticket template updated successfully", body = TicketTemplate),
        (status = 404, description = "Template not found")
    )
)]
pub async fn update_template(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTicketTemplateDto>,
) -> Result<Json<TicketTemplate>, AppError> {
    let existing: Option<TicketTemplate> = sqlx::query_as(
        "SELECT tt.*, e.name as entity_name, u.username as default_technician_name 
         FROM ticket_templates tt 
         JOIN entities e ON e.id = tt.entity_id 
         LEFT JOIN users u ON u.id = tt.default_technician_id 
         WHERE tt.id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Database error: {:?}", e)))?;

    if existing.is_none() {
        return Err(AppError::NotFound(format!("Template with ID {} not found", id)));
    }

    let mandatory_json = payload.mandatory_fields.map(|v| serde_json::to_value(v).unwrap_or_default());
    let hidden_json = payload.hidden_fields.map(|v| serde_json::to_value(v).unwrap_or_default());

    sqlx::query(
        r#"
        UPDATE ticket_templates
        SET
            name = COALESCE($2, name),
            description = COALESCE($3, description),
            ticket_type = COALESCE($4, ticket_type),
            category = COALESCE($5, category),
            predefined_title = COALESCE($6, predefined_title),
            predefined_content = COALESCE($7, predefined_content),
            predefined_urgency = COALESCE($8, predefined_urgency),
            predefined_impact = COALESCE($9, predefined_impact),
            default_technician_id = COALESCE($10, default_technician_id),
            mandatory_fields = COALESCE($11, mandatory_fields),
            hidden_fields = COALESCE($12, hidden_fields),
            is_active = COALESCE($13, is_active),
            updated_at = NOW()
        WHERE id = $1
        "#
    )
    .bind(id)
    .bind(payload.name.map(|n| n.trim().to_string()))
    .bind(payload.description)
    .bind(payload.ticket_type)
    .bind(payload.category)
    .bind(payload.predefined_title)
    .bind(payload.predefined_content)
    .bind(payload.predefined_urgency)
    .bind(payload.predefined_impact)
    .bind(payload.default_technician_id)
    .bind(mandatory_json)
    .bind(hidden_json)
    .bind(payload.is_active)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update template: {:?}", e);
        AppError::InternalServerError("Failed to update template in database".to_string())
    })?;

    let updated: TicketTemplate = sqlx::query_as(
        r#"
        SELECT 
            tt.id, tt.entity_id, e.name AS entity_name,
            tt.name, tt.description, tt.ticket_type, tt.category,
            tt.predefined_title, tt.predefined_content,
            tt.predefined_urgency, tt.predefined_impact,
            tt.default_technician_id,
            COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username) AS default_technician_name,
            tt.mandatory_fields, tt.hidden_fields,
            tt.is_active, tt.created_at, tt.updated_at
        FROM ticket_templates tt
        JOIN entities e ON e.id = tt.entity_id
        LEFT JOIN users u ON u.id = tt.default_technician_id
        WHERE tt.id = $1
        "#
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to retrieve updated template: {:?}", e)))?;

    Ok(Json(updated))
}

#[utoipa::path(
    delete,
    path = "/api/v1/ticket-templates/{id}",
    tag = "Templates",
    params(
        ("id" = Uuid, Path, description = "Template unique ID")
    ),
    responses(
        (status = 204, description = "Template deleted successfully"),
        (status = 404, description = "Template not found")
    )
)]
pub async fn delete_template(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM ticket_templates WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Database error: {:?}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Template with ID {} not found", id)));
    }

    Ok(StatusCode::NO_CONTENT)
}
