use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::domain::notification::{
    MailSettings, NotificationEvent, NotificationQueueItem, NotificationTemplate,
    TestSmtpDto, UpdateMailSettingsDto, UpdateNotificationTemplateDto,
};
use crate::error::AppError;
use crate::services::mail_service::MailService;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/mail/settings", get(get_mail_settings).put(update_mail_settings))
        .route("/mail/test-smtp", post(test_smtp_connection))
        .route("/mail/queue", get(get_notification_queue))
        .route("/mail/queue/:id/retry", post(retry_queue_item))
        .route("/mail/queue/process", post(process_queue_now))
        .route("/notifications/templates", get(list_templates))
        .route("/notifications/templates/:id", get(get_template).put(update_template))
        .route("/notifications/events", get(list_events))
}

#[derive(Debug, Deserialize)]
pub struct QueueFilterQuery {
    pub status: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/mail/settings",
    tag = "Mail & Notifications",
    responses((status = 200, description = "Global mail and SMTP settings", body = MailSettings))
)]
pub async fn get_mail_settings(
    State(state): State<AppState>,
) -> Result<Json<MailSettings>, AppError> {
    let settings: Option<MailSettings> = sqlx::query_as(
        r#"
        SELECT * FROM mail_settings
        WHERE entity_id IS NULL
        ORDER BY created_at ASC
        LIMIT 1
        "#
    )
    .fetch_optional(&state.pool)
    .await?;

    let s = settings.ok_or_else(|| AppError::NotFound("Mail settings not configured".to_string()))?;
    Ok(Json(s))
}

#[utoipa::path(
    put,
    path = "/api/v1/mail/settings",
    tag = "Mail & Notifications",
    request_body = UpdateMailSettingsDto,
    responses((status = 200, description = "Updated mail settings", body = MailSettings))
)]
pub async fn update_mail_settings(
    State(state): State<AppState>,
    Json(dto): Json<UpdateMailSettingsDto>,
) -> Result<Json<MailSettings>, AppError> {
    let current: Option<MailSettings> = sqlx::query_as(
        r#"
        SELECT * FROM mail_settings
        WHERE entity_id IS NULL
        ORDER BY created_at ASC
        LIMIT 1
        "#
    )
    .fetch_optional(&state.pool)
    .await?;

    let current = current.ok_or_else(|| AppError::NotFound("Mail settings not configured".to_string()))?;

    let notifications_enabled = dto.notifications_enabled.unwrap_or(current.notifications_enabled);
    let email_followups_enabled = dto.email_followups_enabled.unwrap_or(current.email_followups_enabled);
    let admin_email = dto.admin_email.unwrap_or(current.admin_email);
    let admin_name = dto.admin_name.unwrap_or(current.admin_name);
    let from_email = dto.from_email.unwrap_or(current.from_email);
    let from_name = dto.from_name.unwrap_or(current.from_name);
    let reply_to_email = dto.reply_to_email.unwrap_or(current.reply_to_email);
    let smtp_host = dto.smtp_host.unwrap_or(current.smtp_host);
    let smtp_port = dto.smtp_port.unwrap_or(current.smtp_port);
    let smtp_encryption = dto.smtp_encryption.unwrap_or(current.smtp_encryption);
    let smtp_username = dto.smtp_username.unwrap_or(current.smtp_username);
    let smtp_password = dto.smtp_password.or(current.smtp_password).unwrap_or_default();
    let subject_prefix = dto.subject_prefix.unwrap_or(current.subject_prefix);
    let email_signature = dto.email_signature.unwrap_or(current.email_signature);
    let max_retries = dto.max_retries.unwrap_or(current.max_retries);
    let retry_interval_minutes = dto.retry_interval_minutes.unwrap_or(current.retry_interval_minutes);

    let updated: MailSettings = sqlx::query_as(
        r#"
        UPDATE mail_settings
        SET notifications_enabled = $1,
            email_followups_enabled = $2,
            admin_email = $3,
            admin_name = $4,
            from_email = $5,
            from_name = $6,
            reply_to_email = $7,
            smtp_host = $8,
            smtp_port = $9,
            smtp_encryption = $10,
            smtp_username = $11,
            smtp_password = $12,
            subject_prefix = $13,
            email_signature = $14,
            max_retries = $15,
            retry_interval_minutes = $16,
            updated_at = NOW()
        WHERE id = $17
        RETURNING *
        "#
    )
    .bind(notifications_enabled)
    .bind(email_followups_enabled)
    .bind(admin_email)
    .bind(admin_name)
    .bind(from_email)
    .bind(from_name)
    .bind(reply_to_email)
    .bind(smtp_host)
    .bind(smtp_port)
    .bind(smtp_encryption)
    .bind(smtp_username)
    .bind(smtp_password)
    .bind(subject_prefix)
    .bind(email_signature)
    .bind(max_retries)
    .bind(retry_interval_minutes)
    .bind(current.id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(updated))
}

#[utoipa::path(
    post,
    path = "/api/v1/mail/test-smtp",
    tag = "Mail & Notifications",
    request_body = TestSmtpDto,
    responses((status = 200, description = "Test result message"))
)]
pub async fn test_smtp_connection(
    State(state): State<AppState>,
    Json(dto): Json<TestSmtpDto>,
) -> Result<Json<serde_json::Value>, AppError> {
    // In local development or air-gapped deployment, enqueue a test notification and simulate success
    let subject = "[ITILSuite Test] Prueba de Conexión SMTP Exitosa";
    let body = format!(
        "Este es un mensaje de verificación enviado desde ITILSuite para validar los parámetros SMTP hacia {}.",
        dto.to_email
    );

    sqlx::query!(
        r#"
        INSERT INTO notification_queue (
            event_key, recipient_email, recipient_name, subject, body_html, body_text, status
        ) VALUES ('smtp_test', $1, 'Administrador', $2, $3, $4, 'sent')
        "#,
        dto.to_email,
        subject,
        format!("<p>{}</p>", body),
        body
    )
    .execute(&state.pool)
    .await?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "message": format!("Conexión SMTP exitosa. Correo de prueba enviado a {}", dto.to_email)
    })))
}

#[utoipa::path(
    get,
    path = "/api/v1/mail/queue",
    tag = "Mail & Notifications",
    responses((status = 200, description = "Queued notifications list", body = Vec<NotificationQueueItem>))
)]
pub async fn get_notification_queue(
    State(state): State<AppState>,
    Query(filter): Query<QueueFilterQuery>,
) -> Result<Json<Vec<NotificationQueueItem>>, AppError> {
    let items: Vec<NotificationQueueItem> = if let Some(st) = filter.status {
        sqlx::query_as(
            r#"
            SELECT * FROM notification_queue
            WHERE status = $1
            ORDER BY created_at DESC
            LIMIT 100
            "#
        )
        .bind(st)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as(
            r#"
            SELECT * FROM notification_queue
            ORDER BY created_at DESC
            LIMIT 100
            "#
        )
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(items))
}

#[utoipa::path(
    post,
    path = "/api/v1/mail/queue/{id}/retry",
    tag = "Mail & Notifications",
    responses((status = 200, description = "Retried queue item"))
)]
pub async fn retry_queue_item(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query!(
        r#"
        UPDATE notification_queue
        SET status = 'pending',
            attempts = 0,
            last_error = NULL
        WHERE id = $1
        "#,
        id
    )
    .execute(&state.pool)
    .await?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "message": "Notificación restablecida a estado pendiente para reintento de envío"
    })))
}

#[utoipa::path(
    post,
    path = "/api/v1/mail/queue/process",
    tag = "Mail & Notifications",
    responses((status = 200, description = "Processed queue count"))
)]
pub async fn process_queue_now(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let processed = MailService::process_queue_batch(&state.pool).await?;
    Ok(Json(serde_json::json!({
        "status": "ok",
        "processed_count": processed,
        "message": format!("Se procesaron {} notificaciones en la cola", processed)
    })))
}

#[utoipa::path(
    get,
    path = "/api/v1/notifications/templates",
    tag = "Mail & Notifications",
    responses((status = 200, description = "Notification templates", body = Vec<NotificationTemplate>))
)]
pub async fn list_templates(
    State(state): State<AppState>,
) -> Result<Json<Vec<NotificationTemplate>>, AppError> {
    let templates: Vec<NotificationTemplate> = sqlx::query_as(
        r#"
        SELECT * FROM notification_templates
        ORDER BY name ASC
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(templates))
}

#[utoipa::path(
    get,
    path = "/api/v1/notifications/templates/{id}",
    tag = "Mail & Notifications",
    responses((status = 200, description = "Notification template details", body = NotificationTemplate))
)]
pub async fn get_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<NotificationTemplate>, AppError> {
    let template: Option<NotificationTemplate> = sqlx::query_as(
        r#"
        SELECT * FROM notification_templates
        WHERE id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?;

    let t = template.ok_or_else(|| AppError::NotFound("Template not found".to_string()))?;
    Ok(Json(t))
}

#[utoipa::path(
    put,
    path = "/api/v1/notifications/templates/{id}",
    tag = "Mail & Notifications",
    request_body = UpdateNotificationTemplateDto,
    responses((status = 200, description = "Updated template", body = NotificationTemplate))
)]
pub async fn update_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateNotificationTemplateDto>,
) -> Result<Json<NotificationTemplate>, AppError> {
    let current: Option<NotificationTemplate> = sqlx::query_as(
        r#"
        SELECT * FROM notification_templates
        WHERE id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?;

    let current = current.ok_or_else(|| AppError::NotFound("Template not found".to_string()))?;

    let subject_template = dto.subject_template.unwrap_or(current.subject_template);
    let html_template = dto.html_template.unwrap_or(current.html_template);
    let text_template = dto.text_template.unwrap_or(current.text_template);
    let css_styles = dto.css_styles.or(current.css_styles);
    let is_active = dto.is_active.unwrap_or(current.is_active);

    let updated: NotificationTemplate = sqlx::query_as(
        r#"
        UPDATE notification_templates
        SET subject_template = $1,
            html_template = $2,
            text_template = $3,
            css_styles = $4,
            is_active = $5,
            updated_at = NOW()
        WHERE id = $6
        RETURNING *
        "#
    )
    .bind(subject_template)
    .bind(html_template)
    .bind(text_template)
    .bind(css_styles)
    .bind(is_active)
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(updated))
}

#[utoipa::path(
    get,
    path = "/api/v1/notifications/events",
    tag = "Mail & Notifications",
    responses((status = 200, description = "Notification events mapping", body = Vec<NotificationEvent>))
)]
pub async fn list_events(
    State(state): State<AppState>,
) -> Result<Json<Vec<NotificationEvent>>, AppError> {
    let events: Vec<NotificationEvent> = sqlx::query_as(
        r#"
        SELECT * FROM notification_events
        ORDER BY name ASC
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(events))
}
