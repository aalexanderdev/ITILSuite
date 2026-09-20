use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use utoipa::IntoParams;
use uuid::Uuid;

use crate::domain::auth::Claims;
use crate::domain::ticket::{
    calculate_priority, CreateFollowupDto, CreateTicketDto, TicketDetailDto,
    TicketFollowupDto, TicketMetricsDto, TicketSummaryDto, UpdateTicketDto,
};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize, IntoParams)]
pub struct TicketFilterParams {
    /// Filter by organizational entity ID
    pub entity_id: Option<Uuid>,
    /// Filter by ticket status (new, assigned, planned, pending, solved, closed)
    pub status: Option<String>,
    /// Filter by ticket type ('incident' or 'request')
    pub ticket_type: Option<String>,
    /// Filter by priority level (1..5)
    pub priority: Option<i32>,
    /// Filter by assigned technician user ID
    pub assigned_to: Option<Uuid>,
    /// Filter by assigned transversal group ID
    pub assigned_group_id: Option<Uuid>,
    /// Filter by SLA status (within_sla, at_risk, breached)
    pub sla_status: Option<String>,
    /// Search term across title, content, or ticket number
    pub search: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/tickets",
    tag = "Tickets",
    params(TicketFilterParams),
    responses(
        (status = 200, description = "List of filtered Service Desk tickets", body = Vec<TicketSummaryDto>)
    )
)]
pub async fn list_tickets(
    State(state): State<AppState>,
    Query(params): Query<TicketFilterParams>,
) -> Result<Json<Vec<TicketSummaryDto>>, AppError> {
    let search_clean = params.search.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty());

    let tickets: Vec<TicketSummaryDto> = sqlx::query_as(
        r#"
        SELECT 
            t.id, t.ticket_number, t.entity_id, e.name AS entity_name,
            t.name, t.content, t.ticket_type, t.status,
            t.urgency, t.impact, t.priority,
            t.requester_id,
            COALESCE(NULLIF(TRIM(r.firstname || ' ' || r.realname), ''), r.username) AS requester_name,
            t.assigned_technician_id,
            COALESCE(NULLIF(TRIM(tech.firstname || ' ' || tech.realname), ''), tech.username) AS assigned_technician_name,
            t.assigned_group_id,
            ag.name AS assigned_group_name,
            t.requester_group_id,
            rg.name AS requester_group_name,
            t.category,
            t.sla_id,
            sla.name AS sla_name,
            t.time_to_own,
            t.time_to_resolve,
            t.acknowledged_at,
            t.sla_tto_status,
            t.sla_ttr_status,
            t.solved_at, t.closed_at,
            t.created_at, t.updated_at
        FROM tickets t
        JOIN entities e ON e.id = t.entity_id
        LEFT JOIN users r ON r.id = t.requester_id
        LEFT JOIN users tech ON tech.id = t.assigned_technician_id
        LEFT JOIN groups ag ON ag.id = t.assigned_group_id
        LEFT JOIN groups rg ON rg.id = t.requester_group_id
        LEFT JOIN slas sla ON sla.id = t.sla_id
        WHERE ($1::uuid IS NULL OR t.entity_id = $1)
          AND ($2::varchar IS NULL OR t.status = $2)
          AND ($3::varchar IS NULL OR t.ticket_type = $3)
          AND ($4::int IS NULL OR t.priority = $4)
          AND ($5::uuid IS NULL OR t.assigned_technician_id = $5)
          AND ($6::varchar IS NULL OR (t.name ILIKE '%' || $6 || '%' OR t.ticket_number ILIKE '%' || $6 || '%' OR t.content ILIKE '%' || $6 || '%'))
          AND ($7::uuid IS NULL OR t.assigned_group_id = $7)
          AND ($8::varchar IS NULL OR 
                ($8 = 'at_risk' AND t.sla_ttr_status = 'at_risk') OR 
                ($8 = 'breached' AND (t.sla_ttr_status = 'breached' OR t.sla_tto_status = 'breached')) OR 
                ($8 = 'within_sla' AND t.sla_ttr_status = 'within_sla'))
        ORDER BY t.priority DESC, t.created_at DESC
        "#
    )
    .bind(params.entity_id)
    .bind(params.status)
    .bind(params.ticket_type)
    .bind(params.priority)
    .bind(params.assigned_to)
    .bind(search_clean)
    .bind(params.assigned_group_id)
    .bind(params.sla_status)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to retrieve tickets: {}", e)))?;

    Ok(Json(tickets))
}

#[utoipa::path(
    get,
    path = "/api/v1/tickets/{id}",
    tag = "Tickets",
    params(
        ("id" = Uuid, Path, description = "Unique ticket ID")
    ),
    responses(
        (status = 200, description = "Ticket details with timeline/followups", body = TicketDetailDto),
        (status = 404, description = "Ticket not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn get_ticket(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TicketDetailDto>, AppError> {
    let summary: Option<TicketSummaryDto> = sqlx::query_as(
        r#"
        SELECT 
            t.id, t.ticket_number, t.entity_id, e.name AS entity_name,
            t.name, t.content, t.ticket_type, t.status,
            t.urgency, t.impact, t.priority,
            t.requester_id,
            COALESCE(NULLIF(TRIM(r.firstname || ' ' || r.realname), ''), r.username) AS requester_name,
            t.assigned_technician_id,
            COALESCE(NULLIF(TRIM(tech.firstname || ' ' || tech.realname), ''), tech.username) AS assigned_technician_name,
            t.assigned_group_id,
            ag.name AS assigned_group_name,
            t.requester_group_id,
            rg.name AS requester_group_name,
            t.category,
            t.sla_id,
            sla.name AS sla_name,
            t.time_to_own,
            t.time_to_resolve,
            t.acknowledged_at,
            t.sla_tto_status,
            t.sla_ttr_status,
            t.solved_at, t.closed_at,
            t.created_at, t.updated_at
        FROM tickets t
        JOIN entities e ON e.id = t.entity_id
        LEFT JOIN users r ON r.id = t.requester_id
        LEFT JOIN users tech ON tech.id = t.assigned_technician_id
        LEFT JOIN groups ag ON ag.id = t.assigned_group_id
        LEFT JOIN groups rg ON rg.id = t.requester_group_id
        LEFT JOIN slas sla ON sla.id = t.sla_id
        WHERE t.id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Database error: {}", e)))?;

    let summary = summary.ok_or_else(|| AppError::NotFound("Ticket not found".to_string()))?;

    let followups: Vec<TicketFollowupDto> = sqlx::query_as(
        r#"
        SELECT 
            f.id, f.ticket_id, f.author_id,
            COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username) AS author_name,
            f.content, f.item_type, f.is_private, f.created_at
        FROM ticket_followups f
        LEFT JOIN users u ON u.id = f.author_id
        WHERE f.ticket_id = $1
        ORDER BY f.created_at ASC
        "#
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to retrieve ticket followups: {}", e)))?;

    Ok(Json(TicketDetailDto { summary, followups }))
}

#[utoipa::path(
    post,
    path = "/api/v1/tickets",
    tag = "Tickets",
    request_body = CreateTicketDto,
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 201, description = "Ticket created successfully", body = TicketSummaryDto),
        (status = 400, description = "Invalid payload", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn create_ticket(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateTicketDto>,
) -> Result<(StatusCode, Json<TicketSummaryDto>), AppError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Ticket title/subject cannot be empty".to_string()));
    }
    let content = payload.content.trim();
    if content.is_empty() {
        return Err(AppError::BadRequest("Ticket content/description cannot be empty".to_string()));
    }

    // Entity scope: defaults to user's active entity or Root Entity
    let mut entity_id = payload.entity_id.unwrap_or_else(|| {
        Uuid::parse_str(&claims.entity_id)
            .unwrap_or_else(|_| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
    });

    // Requester: authenticated user
    let requester_id = Uuid::parse_str(&claims.sub).ok();
    let user_email = if let Some(req_id) = requester_id {
        let row: Option<(Option<String>,)> = sqlx::query_as("SELECT email FROM users WHERE id = $1")
            .bind(req_id)
            .fetch_optional(&state.pool)
            .await
            .unwrap_or(None);
        row.and_then(|r| r.0).unwrap_or_else(|| claims.username.clone())
    } else {
        claims.username.clone()
    };

    // Evaluate Helpdesk Entity Assignment Rule if caller didn't explicitly override entity
    if payload.entity_id.is_none() {
        if let Some(routed) = crate::services::rules::helpdesk::HelpdeskRulesService::evaluate_ticket_entity(
            &state.pool,
            &user_email,
            None,
            name,
        )
        .await
        {
            entity_id = routed;
        }
    }

    let mut ticket_type = match payload.ticket_type.as_deref() {
        Some("request") => "request".to_string(),
        _ => "incident".to_string(),
    };

    let mut urgency = payload.urgency.unwrap_or(3).clamp(1, 5);
    let mut impact = payload.impact.unwrap_or(3).clamp(1, 5);
    let mut category = payload.category.clone();
    let mut assigned_technician_id = payload.assigned_technician_id;
    let assigned_group_id = payload.assigned_group_id;
    let requester_group_id = payload.requester_group_id;

    // Evaluate Ticket Business Rules (urgency/impact escalation, category routing, technician assignment)
    let rule_mutations = crate::services::rules::helpdesk::HelpdeskRulesService::evaluate_ticket_business_rules(
        &state.pool,
        entity_id,
        name,
        content,
        &user_email,
        urgency,
        impact,
    )
    .await;

    if let Some(u) = rule_mutations.get("urgency").and_then(|v| v.parse::<i32>().ok()) {
        urgency = u.clamp(1, 5);
    }
    if let Some(i) = rule_mutations.get("impact").and_then(|v| v.parse::<i32>().ok()) {
        impact = i.clamp(1, 5);
    }
    if let Some(c) = rule_mutations.get("category") {
        category = Some(c.clone());
    }
    if let Some(tt) = rule_mutations.get("ticket_type") {
        ticket_type = tt.clone();
    }
    if let Some(tech_id) = rule_mutations.get("assigned_technician_id").and_then(|v| Uuid::parse_str(v).ok()) {
        assigned_technician_id = Some(tech_id);
    }

    let priority = calculate_priority(urgency, impact);

    // Initial status: if technician or group is dispatched, status is 'assigned', otherwise 'new'
    let status = if assigned_technician_id.is_some() || assigned_group_id.is_some() {
        "assigned".to_string()
    } else {
        "new".to_string()
    };

    // Calculate dynamic SLA targets using SlaService and calendar schedules
    let (sla_id, time_to_own, time_to_resolve) = crate::services::sla_service::SlaService::calculate_deadlines(
        &state.pool,
        payload.sla_id,
        priority,
        Utc::now(),
    )
    .await?;

    let is_assigned = assigned_technician_id.is_some() || assigned_group_id.is_some();
    let acknowledged_at = if is_assigned { Some(Utc::now()) } else { None };
    let sla_tto_status = if is_assigned { "within_sla" } else { "pending" };
    let sla_ttr_status = "within_sla";

    // Generate formatted ticket number (e.g. INC-2026-0007 / REQ-2026-0008)
    let prefix = if ticket_type == "request" { "REQ" } else { "INC" };
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tickets")
        .fetch_one(&state.pool)
        .await
        .unwrap_or((0,));
    let ticket_number = format!("{}-{}-{:04}", prefix, Utc::now().format("%Y"), count.0 + 1);

    let new_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO tickets (
            id, ticket_number, entity_id, name, content, ticket_type, status,
            urgency, impact, priority, requester_id, assigned_technician_id,
            assigned_group_id, requester_group_id,
            category, sla_id, time_to_own, time_to_resolve, acknowledged_at,
            sla_tto_status, sla_ttr_status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW())
        "#
    )
    .bind(new_id)
    .bind(&ticket_number)
    .bind(entity_id)
    .bind(name)
    .bind(content)
    .bind(&ticket_type)
    .bind(&status)
    .bind(urgency)
    .bind(impact)
    .bind(priority)
    .bind(requester_id)
    .bind(assigned_technician_id)
    .bind(assigned_group_id)
    .bind(requester_group_id)
    .bind(category)
    .bind(sla_id)
    .bind(time_to_own)
    .bind(time_to_resolve)
    .bind(acknowledged_at)
    .bind(sla_tto_status)
    .bind(sla_ttr_status)
    .execute(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to insert ticket: {}", e)))?;

    // Re-fetch complete summary dto with joined names
    let summary: TicketSummaryDto = sqlx::query_as(
        r#"
        SELECT 
            t.id, t.ticket_number, t.entity_id, e.name AS entity_name,
            t.name, t.content, t.ticket_type, t.status,
            t.urgency, t.impact, t.priority,
            t.requester_id,
            COALESCE(NULLIF(TRIM(r.firstname || ' ' || r.realname), ''), r.username) AS requester_name,
            t.assigned_technician_id,
            COALESCE(NULLIF(TRIM(tech.firstname || ' ' || tech.realname), ''), tech.username) AS assigned_technician_name,
            t.assigned_group_id,
            ag.name AS assigned_group_name,
            t.requester_group_id,
            rg.name AS requester_group_name,
            t.category,
            t.sla_id,
            sla.name AS sla_name,
            t.time_to_own,
            t.time_to_resolve,
            t.acknowledged_at,
            t.sla_tto_status,
            t.sla_ttr_status,
            t.solved_at, t.closed_at,
            t.created_at, t.updated_at
        FROM tickets t
        JOIN entities e ON e.id = t.entity_id
        LEFT JOIN users r ON r.id = t.requester_id
        LEFT JOIN users tech ON tech.id = t.assigned_technician_id
        LEFT JOIN groups ag ON ag.id = t.assigned_group_id
        LEFT JOIN groups rg ON rg.id = t.requester_group_id
        LEFT JOIN slas sla ON sla.id = t.sla_id
        WHERE t.id = $1
        "#
    )
    .bind(new_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to fetch created ticket: {}", e)))?;

    // Dispatch ticket_created notification event
    let _ = crate::services::mail_service::MailService::dispatch_event(&state.pool, "ticket_created", new_id, None).await;

    // Dispatch chat notifications to requester and assigned technician
    let _ = crate::services::chat_service::ChatService::notify_ticket_event(
        &state.pool,
        &state.chat_hub,
        summary.id,
        &summary.ticket_number,
        &format!("🎫 Nuevo Ticket Creado: #{} - \"{}\"", summary.ticket_number, summary.name),
        summary.requester_id,
    ).await;

    if let Some(tech_id) = summary.assigned_technician_id {
        let _ = crate::services::chat_service::ChatService::notify_ticket_event(
            &state.pool,
            &state.chat_hub,
            summary.id,
            &summary.ticket_number,
            &format!("🛠️ Te ha sido asignado el Ticket #{} - \"{}\"", summary.ticket_number, summary.name),
            Some(tech_id),
        ).await;
    }

    Ok((StatusCode::CREATED, Json(summary)))
}

#[utoipa::path(
    patch,
    path = "/api/v1/tickets/{id}",
    tag = "Tickets",
    request_body = UpdateTicketDto,
    params(
        ("id" = Uuid, Path, description = "Unique ticket ID")
    ),
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "Ticket successfully updated", body = TicketSummaryDto),
        (status = 404, description = "Ticket not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn update_ticket(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _claims: Claims,
    Json(payload): Json<UpdateTicketDto>,
) -> Result<Json<TicketSummaryDto>, AppError> {
    // Check existing ticket
    let existing: Option<(String, i32, i32, Option<Uuid>, Option<DateTime<Utc>>, Option<DateTime<Utc>>, Option<DateTime<Utc>>)> = sqlx::query_as(
        "SELECT status, urgency, impact, sla_id, time_to_own, time_to_resolve, acknowledged_at FROM tickets WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Database error: {}", e)))?;

    let (old_status, old_urgency, old_impact, old_sla_id, mut time_to_own, mut time_to_resolve, mut acknowledged_at) = existing
        .ok_or_else(|| AppError::NotFound("Ticket not found".to_string()))?;

    let new_urgency = payload.urgency.unwrap_or(old_urgency).clamp(1, 5);
    let new_impact = payload.impact.unwrap_or(old_impact).clamp(1, 5);
    let new_priority = calculate_priority(new_urgency, new_impact);

    let new_status = payload.status.unwrap_or(old_status.clone());

    // SLA recalculation if sla_id explicitly updated
    let mut sla_id = old_sla_id;
    if let Some(new_sla_id) = payload.sla_id {
        if Some(new_sla_id) != old_sla_id {
            sla_id = Some(new_sla_id);
            if let Ok((_, new_tto, new_ttr)) = crate::services::sla_service::SlaService::calculate_deadlines(
                &state.pool,
                Some(new_sla_id),
                new_priority,
                Utc::now(),
            ).await {
                time_to_own = Some(new_tto);
                time_to_resolve = Some(new_ttr);
            }
        }
    }

    // TTO Acknowledgement tracking
    let mut sla_tto_clause = String::new();
    if (payload.assigned_technician_id.is_some() || payload.assigned_group_id.is_some()) && acknowledged_at.is_none() {
        if let Some(tto_limit) = time_to_own {
            if Utc::now() <= tto_limit {
                sla_tto_clause = ", acknowledged_at = NOW(), sla_tto_status = 'within_sla'".to_string();
            } else {
                sla_tto_clause = ", acknowledged_at = NOW(), sla_tto_status = 'breached'".to_string();
            }
        } else {
            sla_tto_clause = ", acknowledged_at = NOW(), sla_tto_status = 'within_sla'".to_string();
        }
    }

    // TTR Resolution tracking
    let mut sla_ttr_clause = String::new();
    if new_status == "solved" && old_status != "solved" {
        if let Some(ttr_limit) = time_to_resolve {
            if Utc::now() <= ttr_limit {
                sla_ttr_clause = ", sla_ttr_status = 'solved_in_sla'".to_string();
            } else {
                sla_ttr_clause = ", sla_ttr_status = 'breached'".to_string();
            }
        } else {
            sla_ttr_clause = ", sla_ttr_status = 'solved_in_sla'".to_string();
        }
    }

    // Lifecycle timestamps
    let solved_clause = if new_status == "solved" {
        ", solved_at = COALESCE(solved_at, NOW())"
    } else {
        ""
    };
    let closed_clause = if new_status == "closed" {
        ", closed_at = COALESCE(closed_at, NOW()), solved_at = COALESCE(solved_at, NOW())"
    } else {
        ""
    };

    let query_str = format!(
        r#"
        UPDATE tickets
        SET 
            name = COALESCE($2, name),
            content = COALESCE($3, content),
            status = $4,
            urgency = $5,
            impact = $6,
            priority = $7,
            assigned_technician_id = COALESCE($8, assigned_technician_id),
            assigned_group_id = COALESCE($9, assigned_group_id),
            requester_group_id = COALESCE($10, requester_group_id),
            category = COALESCE($11, category),
            sla_id = COALESCE($12, sla_id),
            time_to_own = COALESCE($13, time_to_own),
            time_to_resolve = COALESCE($14, time_to_resolve),
            updated_at = NOW()
            {}
            {}
            {}
            {}
        WHERE id = $1
        "#,
        solved_clause, closed_clause, sla_tto_clause, sla_ttr_clause
    );

    sqlx::query(&query_str)
        .bind(id)
        .bind(payload.name)
        .bind(payload.content)
        .bind(&new_status)
        .bind(new_urgency)
        .bind(new_impact)
        .bind(new_priority)
        .bind(payload.assigned_technician_id)
        .bind(payload.assigned_group_id)
        .bind(payload.requester_group_id)
        .bind(payload.category)
        .bind(sla_id)
        .bind(time_to_own)
        .bind(time_to_resolve)
        .execute(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to update ticket: {}", e)))?;

    // Re-fetch complete summary dto
    let summary: TicketSummaryDto = sqlx::query_as(
        r#"
        SELECT 
            t.id, t.ticket_number, t.entity_id, e.name AS entity_name,
            t.name, t.content, t.ticket_type, t.status,
            t.urgency, t.impact, t.priority,
            t.requester_id,
            COALESCE(NULLIF(TRIM(r.firstname || ' ' || r.realname), ''), r.username) AS requester_name,
            t.assigned_technician_id,
            COALESCE(NULLIF(TRIM(tech.firstname || ' ' || tech.realname), ''), tech.username) AS assigned_technician_name,
            t.assigned_group_id,
            ag.name AS assigned_group_name,
            t.requester_group_id,
            rg.name AS requester_group_name,
            t.category,
            t.sla_id,
            sla.name AS sla_name,
            t.time_to_own,
            t.time_to_resolve,
            t.acknowledged_at,
            t.sla_tto_status,
            t.sla_ttr_status,
            t.solved_at, t.closed_at,
            t.created_at, t.updated_at
        FROM tickets t
        JOIN entities e ON e.id = t.entity_id
        LEFT JOIN users r ON r.id = t.requester_id
        LEFT JOIN users tech ON tech.id = t.assigned_technician_id
        LEFT JOIN groups ag ON ag.id = t.assigned_group_id
        LEFT JOIN groups rg ON rg.id = t.requester_group_id
        LEFT JOIN slas sla ON sla.id = t.sla_id
        WHERE t.id = $1
        "#
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to fetch updated ticket: {}", e)))?;

    // Dispatch lifecycle notification events
    if payload.assigned_technician_id.is_some() || payload.assigned_group_id.is_some() {
        let _ = crate::services::mail_service::MailService::dispatch_event(&state.pool, "ticket_assigned", id, None).await;
    }
    if new_status == "solved" {
        let _ = crate::services::mail_service::MailService::dispatch_event(&state.pool, "ticket_solved", id, None).await;
    } else if new_status == "closed" {
        let _ = crate::services::mail_service::MailService::dispatch_event(&state.pool, "ticket_closed", id, None).await;
    }

    Ok(Json(summary))
}

#[utoipa::path(
    post,
    path = "/api/v1/tickets/{id}/followups",
    tag = "Tickets",
    request_body = CreateFollowupDto,
    params(
        ("id" = Uuid, Path, description = "Unique ticket ID")
    ),
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 201, description = "Follow-up/solution created successfully", body = TicketFollowupDto),
        (status = 404, description = "Ticket not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn add_followup(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
    Json(payload): Json<CreateFollowupDto>,
) -> Result<(StatusCode, Json<TicketFollowupDto>), AppError> {
    let content = payload.content.trim();
    if content.is_empty() {
        return Err(AppError::BadRequest("Followup content cannot be empty".to_string()));
    }

    let item_type = match payload.item_type.as_deref() {
        Some("solution") => "solution",
        Some("task") => "task",
        _ => "followup",
    };

    let is_private = payload.is_private.unwrap_or(false);
    let author_id = Uuid::parse_str(&claims.sub).ok();

    let new_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO ticket_followups (id, ticket_id, author_id, content, item_type, is_private, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        "#
    )
    .bind(new_id)
    .bind(id)
    .bind(author_id)
    .bind(content)
    .bind(item_type)
    .bind(is_private)
    .execute(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to insert followup: {}", e)))?;

    // If item_type is 'solution', automatically transition ticket status to 'solved'
    if item_type == "solution" {
        let _ = sqlx::query(
            "UPDATE tickets SET status = 'solved', solved_at = COALESCE(solved_at, NOW()), updated_at = NOW() WHERE id = $1"
        )
        .bind(id)
        .execute(&state.pool)
        .await;
    } else {
        let _ = sqlx::query("UPDATE tickets SET updated_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&state.pool)
            .await;
    }

    let followup: TicketFollowupDto = sqlx::query_as(
        r#"
        SELECT 
            f.id, f.ticket_id, f.author_id,
            COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username) AS author_name,
            f.content, f.item_type, f.is_private, f.created_at
        FROM ticket_followups f
        LEFT JOIN users u ON u.id = f.author_id
        WHERE f.id = $1
        "#
    )
    .bind(new_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to retrieve created followup: {}", e)))?;

    // Dispatch followup notification event
    if item_type == "solution" {
        let _ = crate::services::mail_service::MailService::dispatch_event(&state.pool, "ticket_solved", id, Some(new_id)).await;
    } else {
        let _ = crate::services::mail_service::MailService::dispatch_event(&state.pool, "ticket_followup_added", id, Some(new_id)).await;
    }

    Ok((StatusCode::CREATED, Json(followup)))
}

#[derive(sqlx::FromRow)]
struct MetricsRow {
    total_open: Option<i64>,
    incidents_count: Option<i64>,
    requests_count: Option<i64>,
    sla_at_risk_count: Option<i64>,
    sla_breached_count: Option<i64>,
    solved_count: Option<i64>,
    closed_count: Option<i64>,
    average_priority: Option<f64>,
}

#[utoipa::path(
    get,
    path = "/api/v1/tickets/metrics",
    tag = "Tickets",
    responses(
        (status = 200, description = "Aggregated KPI metrics for ITIL tickets", body = TicketMetricsDto)
    )
)]
pub async fn get_ticket_metrics(
    State(state): State<AppState>,
) -> Result<Json<TicketMetricsDto>, AppError> {
    let row: MetricsRow = sqlx::query_as(
        r#"
        SELECT 
            COUNT(*) FILTER (WHERE status NOT IN ('solved', 'closed')) AS total_open,
            COUNT(*) FILTER (WHERE ticket_type = 'incident' AND status NOT IN ('solved', 'closed')) AS incidents_count,
            COUNT(*) FILTER (WHERE ticket_type = 'request' AND status NOT IN ('solved', 'closed')) AS requests_count,
            COUNT(*) FILTER (WHERE (sla_ttr_status = 'at_risk' OR (time_to_resolve >= NOW() AND time_to_resolve <= NOW() + INTERVAL '1 hour')) AND status NOT IN ('solved', 'closed')) AS sla_at_risk_count,
            COUNT(*) FILTER (WHERE (sla_ttr_status = 'breached' OR sla_tto_status = 'breached' OR (time_to_resolve IS NOT NULL AND time_to_resolve < NOW())) AND status NOT IN ('solved', 'closed')) AS sla_breached_count,
            COUNT(*) FILTER (WHERE status = 'solved') AS solved_count,
            COUNT(*) FILTER (WHERE status = 'closed') AS closed_count,
            COALESCE(AVG(priority), 3.0)::float8 AS average_priority
        FROM tickets
        "#
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to calculate ticket metrics: {}", e)))?;

    Ok(Json(TicketMetricsDto {
        total_open: row.total_open.unwrap_or(0),
        incidents_count: row.incidents_count.unwrap_or(0),
        requests_count: row.requests_count.unwrap_or(0),
        sla_at_risk_count: row.sla_at_risk_count.unwrap_or(0),
        sla_breached_count: row.sla_breached_count.unwrap_or(0),
        solved_count: row.solved_count.unwrap_or(0),
        closed_count: row.closed_count.unwrap_or(0),
        average_priority: (row.average_priority.unwrap_or(3.0) * 10.0).round() / 10.0,
    }))
}

