use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use uuid::Uuid;

use crate::domain::notification::{
    CollectResultDto, CreateMailReceiverDto, MailBlacklist, MailReceiver,
    SimulateIncomingMailDto, UpdateMailReceiverDto,
};
use crate::error::AppError;
use crate::services::receiver_service::ReceiverService;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/receivers", get(list_receivers).post(create_receiver))
        .route("/receivers/:id", get(get_receiver).put(update_receiver).delete(delete_receiver))
        .route("/receivers/:id/collect", post(collect_receiver))
        .route("/receivers/blacklists", get(list_blacklists).post(create_blacklist))
        .route("/receivers/blacklists/:id", delete(delete_blacklist))
        .route("/receivers/simulate-incoming", post(simulate_incoming_mail))
}

#[utoipa::path(
    get,
    path = "/api/v1/receivers",
    tag = "Mail Receivers (Collectors)",
    responses((status = 200, description = "List of configured mail receivers", body = Vec<MailReceiver>))
)]
pub async fn list_receivers(
    State(state): State<AppState>,
) -> Result<Json<Vec<MailReceiver>>, AppError> {
    let receivers: Vec<MailReceiver> = sqlx::query_as(
        r#"
        SELECT r.*, e.name as entity_name
        FROM mail_receivers r
        JOIN entities e ON e.id = r.entity_id
        ORDER BY r.name ASC
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(receivers))
}

#[utoipa::path(
    post,
    path = "/api/v1/receivers",
    tag = "Mail Receivers (Collectors)",
    request_body = CreateMailReceiverDto,
    responses((status = 201, description = "Created mail receiver", body = MailReceiver))
)]
pub async fn create_receiver(
    State(state): State<AppState>,
    Json(dto): Json<CreateMailReceiverDto>,
) -> Result<(StatusCode, Json<MailReceiver>), AppError> {
    let receiver: MailReceiver = sqlx::query_as(
        r#"
        INSERT INTO mail_receivers (
            entity_id, name, protocol, host, port, ssl_mode,
            username, password, mail_folder, archive_folder, refused_folder,
            max_attachment_mb, is_active, sync_interval_seconds
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        RETURNING *, (SELECT name FROM entities WHERE id = $1) as entity_name
        "#
    )
    .bind(dto.entity_id)
    .bind(dto.name)
    .bind(dto.protocol)
    .bind(dto.host)
    .bind(dto.port)
    .bind(dto.ssl_mode)
    .bind(dto.username)
    .bind(dto.password.unwrap_or_default())
    .bind(dto.mail_folder.unwrap_or_else(|| "INBOX".to_string()))
    .bind(dto.archive_folder)
    .bind(dto.refused_folder)
    .bind(dto.max_attachment_mb.unwrap_or(10))
    .bind(dto.is_active.unwrap_or(true))
    .bind(dto.sync_interval_seconds.unwrap_or(300))
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(receiver)))
}

#[utoipa::path(
    get,
    path = "/api/v1/receivers/{id}",
    tag = "Mail Receivers (Collectors)",
    responses((status = 200, description = "Mail receiver details", body = MailReceiver))
)]
pub async fn get_receiver(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<MailReceiver>, AppError> {
    let receiver: Option<MailReceiver> = sqlx::query_as(
        r#"
        SELECT r.*, e.name as entity_name
        FROM mail_receivers r
        JOIN entities e ON e.id = r.entity_id
        WHERE r.id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?;

    let r = receiver.ok_or_else(|| AppError::NotFound("Mail receiver not found".to_string()))?;
    Ok(Json(r))
}

#[utoipa::path(
    put,
    path = "/api/v1/receivers/{id}",
    tag = "Mail Receivers (Collectors)",
    request_body = UpdateMailReceiverDto,
    responses((status = 200, description = "Updated mail receiver", body = MailReceiver))
)]
pub async fn update_receiver(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateMailReceiverDto>,
) -> Result<Json<MailReceiver>, AppError> {
    let current: Option<MailReceiver> = sqlx::query_as(
        r#"
        SELECT r.*, e.name as entity_name
        FROM mail_receivers r
        JOIN entities e ON e.id = r.entity_id
        WHERE r.id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?;

    let current = current.ok_or_else(|| AppError::NotFound("Mail receiver not found".to_string()))?;

    let name = dto.name.unwrap_or(current.name);
    let protocol = dto.protocol.unwrap_or(current.protocol);
    let host = dto.host.unwrap_or(current.host);
    let port = dto.port.unwrap_or(current.port);
    let ssl_mode = dto.ssl_mode.unwrap_or(current.ssl_mode);
    let username = dto.username.unwrap_or(current.username);
    let mail_folder = dto.mail_folder.unwrap_or(current.mail_folder);
    let archive_folder = dto.archive_folder.or(current.archive_folder);
    let refused_folder = dto.refused_folder.or(current.refused_folder);
    let max_attachment_mb = dto.max_attachment_mb.unwrap_or(current.max_attachment_mb);
    let is_active = dto.is_active.unwrap_or(current.is_active);
    let sync_interval_seconds = dto.sync_interval_seconds.unwrap_or(current.sync_interval_seconds);

    let updated: MailReceiver = sqlx::query_as(
        r#"
        UPDATE mail_receivers
        SET name = $1,
            protocol = $2,
            host = $3,
            port = $4,
            ssl_mode = $5,
            username = $6,
            mail_folder = $7,
            archive_folder = $8,
            refused_folder = $9,
            max_attachment_mb = $10,
            is_active = $11,
            sync_interval_seconds = $12,
            updated_at = NOW()
        WHERE id = $13
        RETURNING *, (SELECT name FROM entities WHERE id = mail_receivers.entity_id) as entity_name
        "#
    )
    .bind(name)
    .bind(protocol)
    .bind(host)
    .bind(port)
    .bind(ssl_mode)
    .bind(username)
    .bind(mail_folder)
    .bind(archive_folder)
    .bind(refused_folder)
    .bind(max_attachment_mb)
    .bind(is_active)
    .bind(sync_interval_seconds)
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(updated))
}

#[utoipa::path(
    delete,
    path = "/api/v1/receivers/{id}",
    tag = "Mail Receivers (Collectors)",
    responses((status = 204, description = "Receiver deleted"))
)]
pub async fn delete_receiver(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    sqlx::query!("DELETE FROM mail_receivers WHERE id = $1", id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/receivers/{id}/collect",
    tag = "Mail Receivers (Collectors)",
    responses((status = 200, description = "Collection execution result", body = CollectResultDto))
)]
pub async fn collect_receiver(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CollectResultDto>, AppError> {
    let result = ReceiverService::collect_from_receiver(&state.pool, id).await?;
    Ok(Json(result))
}

#[utoipa::path(
    get,
    path = "/api/v1/receivers/blacklists",
    tag = "Mail Receivers (Collectors)",
    responses((status = 200, description = "List of blacklist rules", body = Vec<MailBlacklist>))
)]
pub async fn list_blacklists(
    State(state): State<AppState>,
) -> Result<Json<Vec<MailBlacklist>>, AppError> {
    let rules: Vec<MailBlacklist> = sqlx::query_as(
        r#"
        SELECT * FROM mail_blacklists
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rules))
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
pub struct CreateBlacklistDto {
    pub rule_type: String,
    pub pattern: String,
    pub reason: Option<String>,
}

#[utoipa::path(
    post,
    path = "/api/v1/receivers/blacklists",
    tag = "Mail Receivers (Collectors)",
    request_body = CreateBlacklistDto,
    responses((status = 201, description = "Blacklist rule created", body = MailBlacklist))
)]
pub async fn create_blacklist(
    State(state): State<AppState>,
    Json(dto): Json<CreateBlacklistDto>,
) -> Result<(StatusCode, Json<MailBlacklist>), AppError> {
    let rule: MailBlacklist = sqlx::query_as(
        r#"
        INSERT INTO mail_blacklists (rule_type, pattern, reason, is_active)
        VALUES ($1, $2, $3, TRUE)
        RETURNING *
        "#
    )
    .bind(dto.rule_type)
    .bind(dto.pattern)
    .bind(dto.reason)
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(rule)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/receivers/blacklists/{id}",
    tag = "Mail Receivers (Collectors)",
    responses((status = 204, description = "Blacklist rule deleted"))
)]
pub async fn delete_blacklist(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    sqlx::query!("DELETE FROM mail_blacklists WHERE id = $1", id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/receivers/simulate-incoming",
    tag = "Mail Receivers (Collectors)",
    request_body = SimulateIncomingMailDto,
    responses((status = 200, description = "Simulated mail ingestion result"))
)]
pub async fn simulate_incoming_mail(
    State(state): State<AppState>,
    Json(dto): Json<SimulateIncomingMailDto>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = ReceiverService::simulate_incoming(&state.pool, dto).await?;
    Ok(Json(serde_json::json!({
        "status": "ok",
        "result": result
    })))
}
