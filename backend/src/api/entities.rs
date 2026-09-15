use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use crate::domain::auth::Claims;
use crate::domain::entity::{build_entity_tree, CreateEntityDto, Entity, EntityTreeNode};
use crate::error::AppError;
use crate::state::AppState;

#[derive(sqlx::FromRow)]
struct ParentEntityInfo {
    completeness: String,
    level: i32,
}

#[utoipa::path(
    get,
    path = "/api/v1/entities",
    tag = "Entities",
    responses(
        (status = 200, description = "Hierarchical entity tree", body = Vec<EntityTreeNode>)
    )
)]
pub async fn list_entities(
    State(state): State<AppState>,
) -> Result<Json<Vec<EntityTreeNode>>, AppError> {
    let entities: Vec<Entity> = sqlx::query_as(
        r#"
        SELECT id, parent_id, name, completeness, level, created_at, updated_at
        FROM entities
        ORDER BY level ASC, name ASC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to retrieve entities: {}", e)))?;

    let tree = build_entity_tree(&entities);
    Ok(Json(tree))
}

#[utoipa::path(
    post,
    path = "/api/v1/entities",
    tag = "Entities",
    request_body = CreateEntityDto,
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 201, description = "Entity successfully created", body = Entity),
        (status = 400, description = "Invalid payload or parent entity not found", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn create_entity(
    State(state): State<AppState>,
    _claims: Claims, // Requires valid authentication
    Json(payload): Json<CreateEntityDto>,
) -> Result<(StatusCode, Json<Entity>), AppError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Entity name cannot be empty".to_string()));
    }

    let (completeness, level) = if let Some(parent_id) = payload.parent_id {
        let parent: Option<ParentEntityInfo> = sqlx::query_as(
            "SELECT completeness, level FROM entities WHERE id = $1"
        )
        .bind(parent_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Database query error: {}", e)))?;

        let parent = parent.ok_or_else(|| AppError::NotFound("Parent entity does not exist".to_string()))?;

        (format!("{} > {}", parent.completeness, name), parent.level + 1)
    } else {
        (name.to_string(), 0)
    };

    let new_id = Uuid::new_v4();
    let entity: Entity = sqlx::query_as(
        r#"
        INSERT INTO entities (id, name, parent_id, completeness, level)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, parent_id, name, completeness, level, created_at, updated_at
        "#
    )
    .bind(new_id)
    .bind(name)
    .bind(payload.parent_id)
    .bind(&completeness)
    .bind(level)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to insert entity: {}", e)))?;

    Ok((StatusCode::CREATED, Json(entity)))
}
