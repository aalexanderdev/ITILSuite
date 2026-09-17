use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct MailSettings {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub notifications_enabled: bool,
    pub email_followups_enabled: bool,
    pub admin_email: String,
    pub admin_name: String,
    pub from_email: String,
    pub from_name: String,
    pub reply_to_email: String,
    pub smtp_host: String,
    pub smtp_port: i32,
    pub smtp_encryption: String,
    pub smtp_username: String,
    #[serde(skip_serializing)]
    pub smtp_password: Option<String>,
    pub subject_prefix: String,
    pub email_signature: String,
    pub max_retries: i32,
    pub retry_interval_minutes: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateMailSettingsDto {
    pub notifications_enabled: Option<bool>,
    pub email_followups_enabled: Option<bool>,
    pub admin_email: Option<String>,
    pub admin_name: Option<String>,
    pub from_email: Option<String>,
    pub from_name: Option<String>,
    pub reply_to_email: Option<String>,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<i32>,
    pub smtp_encryption: Option<String>,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    pub subject_prefix: Option<String>,
    pub email_signature: Option<String>,
    pub max_retries: Option<i32>,
    pub retry_interval_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct NotificationTemplate {
    pub id: Uuid,
    pub name: String,
    pub item_type: String,
    pub subject_template: String,
    pub html_template: String,
    pub text_template: String,
    pub css_styles: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateNotificationTemplateDto {
    pub subject_template: Option<String>,
    pub html_template: Option<String>,
    pub text_template: Option<String>,
    pub css_styles: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct NotificationEvent {
    pub id: Uuid,
    pub event_key: String,
    pub name: String,
    pub template_id: Uuid,
    pub is_active: bool,
    pub recipients: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct NotificationQueueItem {
    pub id: Uuid,
    pub event_key: String,
    pub ticket_id: Option<Uuid>,
    pub recipient_email: String,
    pub recipient_name: Option<String>,
    pub subject: String,
    pub body_html: String,
    pub body_text: String,
    pub status: String, // pending, sending, sent, failed
    pub attempts: i32,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct MailReceiver {
    pub id: Uuid,
    pub entity_id: Uuid,
    #[sqlx(default)]
    pub entity_name: Option<String>,
    pub name: String,
    pub protocol: String, // imap, pop3
    pub host: String,
    pub port: i32,
    pub ssl_mode: String, // none, ssl, tls
    pub username: String,
    pub mail_folder: String,
    pub archive_folder: Option<String>,
    pub refused_folder: Option<String>,
    pub max_attachment_mb: i32,
    pub is_active: bool,
    pub sync_interval_seconds: i32,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub consecutive_errors: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateMailReceiverDto {
    pub entity_id: Uuid,
    pub name: String,
    pub protocol: String,
    pub host: String,
    pub port: i32,
    pub ssl_mode: String,
    pub username: String,
    pub password: Option<String>,
    pub mail_folder: Option<String>,
    pub archive_folder: Option<String>,
    pub refused_folder: Option<String>,
    pub max_attachment_mb: Option<i32>,
    pub is_active: Option<bool>,
    pub sync_interval_seconds: Option<i32>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateMailReceiverDto {
    pub name: Option<String>,
    pub protocol: Option<String>,
    pub host: Option<String>,
    pub port: Option<i32>,
    pub ssl_mode: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub mail_folder: Option<String>,
    pub archive_folder: Option<String>,
    pub refused_folder: Option<String>,
    pub max_attachment_mb: Option<i32>,
    pub is_active: Option<bool>,
    pub sync_interval_seconds: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct MailBlacklist {
    pub id: Uuid,
    pub rule_type: String, // sender_email, domain, subject_regex
    pub pattern: String,
    pub reason: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct TestSmtpDto {
    pub to_email: String,
    pub custom_smtp_host: Option<String>,
    pub custom_smtp_port: Option<i32>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SimulateIncomingMailDto {
    pub from_email: String,
    pub from_name: Option<String>,
    pub subject: String,
    pub body: String,
    pub receiver_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CollectResultDto {
    pub receiver_id: Uuid,
    pub receiver_name: String,
    pub emails_checked: i32,
    pub tickets_created: i32,
    pub followups_added: i32,
    pub rejected_blacklisted: i32,
    pub message: String,
}

pub struct NotificationTemplateRenderer;

impl NotificationTemplateRenderer {
    pub fn render_tags(template_text: &str, vars: &[(&str, &str)]) -> String {
        let mut result = template_text.to_string();
        for (tag, value) in vars {
            let pattern = format!("##{}##", tag);
            result = result.replace(&pattern, value);
        }
        result
    }

    /// Extract ticket number (e.g. INC-2026-0001 or REQ-2026-0002) from email subject or body
    pub fn extract_ticket_code(text: &str) -> Option<String> {
        let text_upper = text.to_uppercase();
        // Look for patterns like [#INC-2026-0001], #INC-2026-0001, [INC-2026-0001], INC-2026-0001
        for prefix in &["INC-", "REQ-"] {
            if let Some(pos) = text_upper.find(prefix) {
                let candidate = &text_upper[pos..];
                let parts: Vec<&str> = candidate.split(|c: char| !c.is_alphanumeric() && c != '-').collect();
                if let Some(code) = parts.first() {
                    // Check if format is PREFIX-YYYY-NNNN (e.g. len 13: INC-2026-0001)
                    if code.len() == 13 && code.starts_with(prefix) {
                        return Some(code.to_string());
                    }
                }
            }
        }
        None
    }

    /// Strip quoted reply text in incoming email bodies (e.g., lines starting with > or ## Reply above ##)
    pub fn clean_reply_body(body: &str) -> String {
        let mut clean_lines = Vec::new();
        for line in body.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('>')
                || trimmed.starts_with("On ") && trimmed.ends_with("wrote:")
                || trimmed.starts_with("El ") && trimmed.contains("escribió:")
                || trimmed.contains("## Reply above this line ##")
                || trimmed.contains("--- Mensaje original ---")
                || trimmed.contains("-----Original Message-----")
            {
                break;
            }
            clean_lines.push(line);
        }
        clean_lines.join("\n").trim().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_tags() {
        let tpl = "Ticket ##ticket.number## (P##ticket.priority##) creado para ##ticket.requester_name##";
        let rendered = NotificationTemplateRenderer::render_tags(
            tpl,
            &[
                ("ticket.number", "INC-2026-0001"),
                ("ticket.priority", "4"),
                ("ticket.requester_name", "Carlos Gómez"),
            ],
        );
        assert_eq!(
            rendered,
            "Ticket INC-2026-0001 (P4) creado para Carlos Gómez"
        );
    }

    #[test]
    fn test_extract_ticket_code() {
        let subj1 = "Re: [#INC-2026-0001] Falla de impresora";
        assert_eq!(
            NotificationTemplateRenderer::extract_ticket_code(subj1),
            Some("INC-2026-0001".to_string())
        );

        let subj2 = "Consulta de requerimiento REQ-2026-0089 urgente";
        assert_eq!(
            NotificationTemplateRenderer::extract_ticket_code(subj2),
            Some("REQ-2026-0089".to_string())
        );

        let subj3 = "Nuevo incidente sin ticket en asunto";
        assert_eq!(NotificationTemplateRenderer::extract_ticket_code(subj3), None);
    }

    #[test]
    fn test_clean_reply_body() {
        let email_body = "Hola, ya reinicié el equipo y sigue saliendo el error.\n\nEl 16 sep 2026 a las 14:00 Soporte escribió:\n> ¿Podrías confirmar si reiniciaste el equipo?\n> Saludos.";
        let cleaned = NotificationTemplateRenderer::clean_reply_body(email_body);
        assert_eq!(
            cleaned,
            "Hola, ya reinicié el equipo y sigue saliendo el error."
        );
    }
}
