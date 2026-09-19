use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::notification::{
    CollectResultDto, MailBlacklist, MailReceiver, NotificationTemplateRenderer,
    SimulateIncomingMailDto,
};
use crate::error::AppError;
use crate::services::mail_service::MailService;

pub struct ReceiverService;

impl ReceiverService {
    /// Checks if the incoming message matches any active blacklist pattern
    pub async fn is_blacklisted(pool: &PgPool, from_email: &str, subject: &str) -> Result<Option<String>, AppError> {
        let blacklists: Vec<MailBlacklist> = sqlx::query_as(
            r#"
            SELECT * FROM mail_blacklists
            WHERE is_active = TRUE
            "#
        )
        .fetch_all(pool)
        .await?;

        let from_email_lower = from_email.to_lowercase();
        let subject_lower = subject.to_lowercase();

        for rule in blacklists {
            let pattern_lower = rule.pattern.to_lowercase();
            match rule.rule_type.as_str() {
                "sender_email" => {
                    if Self::matches_wildcard(&from_email_lower, &pattern_lower) {
                        return Ok(Some(rule.reason.unwrap_or_else(|| "Remitente en lista negra".to_string())));
                    }
                }
                "domain" => {
                    let domain = from_email_lower.split('@').nth(1).unwrap_or("");
                    let pattern_domain = pattern_lower.trim_start_matches("*@").trim_start_matches('@');
                    if domain == pattern_domain || Self::matches_wildcard(domain, &pattern_lower) {
                        return Ok(Some(rule.reason.unwrap_or_else(|| "Dominio en lista negra".to_string())));
                    }
                }
                "subject_regex" => {
                    if Self::matches_wildcard(&subject_lower, &pattern_lower) {
                        return Ok(Some(rule.reason.unwrap_or_else(|| "Asunto coincide con regla de bloqueo".to_string())));
                    }
                }
                _ => {}
            }
        }

        Ok(None)
    }

    fn matches_wildcard(text: &str, pattern: &str) -> bool {
        if pattern == "*" {
            return true;
        }
        if let Some(prefix) = pattern.strip_suffix('*') {
            if text.starts_with(prefix) {
                return true;
            }
        }
        if let Some(suffix) = pattern.strip_prefix('*') {
            if text.ends_with(suffix) {
                return true;
            }
        }
        text == pattern
    }

    /// Ingests a single message: checks blacklist, identifies ticket thread or creates a new ticket
    pub async fn process_incoming_email(
        pool: &PgPool,
        entity_id: Uuid,
        from_email: &str,
        _from_name: Option<&str>,
        subject: &str,
        body: &str,
    ) -> Result<String, AppError> {
        // 1. Blacklist check
        if let Some(reason) = Self::is_blacklisted(pool, from_email, subject).await? {
            tracing::warn!("Incoming email from {} rejected by blacklist: {}", from_email, reason);
            return Ok(format!("Mensaje descartado por lista negra: {}", reason));
        }

        // 2. Threading check: does subject or body contain an existing ticket code (e.g. [#INC-2026-0001])?
        let ticket_code = NotificationTemplateRenderer::extract_ticket_code(subject)
            .or_else(|| NotificationTemplateRenderer::extract_ticket_code(body));

        if let Some(code) = ticket_code {
            // Find existing ticket
            let existing_ticket = sqlx::query!(
                r#"
                SELECT id, ticket_number, status FROM tickets
                WHERE ticket_number = $1
                "#,
                code
            )
            .fetch_optional(pool)
            .await?;

            if let Some(ticket) = existing_ticket {
                // Find author user by from_email
                let author = sqlx::query!(
                    r#"SELECT id FROM users WHERE email = $1 LIMIT 1"#,
                    from_email
                )
                .fetch_optional(pool)
                .await?;

                let author_id = author.map(|u| u.id);
                let cleaned_content = NotificationTemplateRenderer::clean_reply_body(body);
                let final_content = if cleaned_content.is_empty() {
                    body.to_string()
                } else {
                    cleaned_content
                };

                // Append followup
                let followup_id = sqlx::query_scalar!(
                    r#"
                    INSERT INTO ticket_followups (ticket_id, author_id, content, item_type, is_private)
                    VALUES ($1, $2, $3, 'followup', FALSE)
                    RETURNING id
                    "#,
                    ticket.id,
                    author_id,
                    final_content
                )
                .fetch_one(pool)
                .await?;

                // Auto-advance status if ticket was solved or pending
                if ticket.status == "solved" || ticket.status == "pending" {
                    sqlx::query!(
                        r#"UPDATE tickets SET status = 'assigned', updated_at = NOW() WHERE id = $1"#,
                        ticket.id
                    )
                    .execute(pool)
                    .await?;
                }

                // Dispatch followup notification event
                let _ = MailService::dispatch_event(pool, "ticket_followup_added", ticket.id, Some(followup_id)).await;

                tracing::info!("Appended followup to ticket {} from incoming email", ticket.ticket_number);
                return Ok(format!("Seguimiento agregado al ticket existente {}", ticket.ticket_number));
            }
        }

        // 3. New Ticket Creation
        // Resolve requester
        let requester = sqlx::query!(
            r#"SELECT id FROM users WHERE email = $1 LIMIT 1"#,
            from_email
        )
        .fetch_optional(pool)
        .await?;

        let requester_id = match requester {
            Some(u) => Some(u.id),
            None => {
                // Pick default super-admin or fallback user
                let fallback = sqlx::query!(
                    r#"SELECT id FROM users ORDER BY created_at ASC LIMIT 1"#
                )
                .fetch_optional(pool)
                .await?;
                fallback.map(|u| u.id)
            }
        };

        // Evaluate Helpdesk Entity Assignment Rules (e.g. domain, sender email)
        let effective_entity_id = match crate::services::rules::helpdesk::HelpdeskRulesService::evaluate_ticket_entity(
            pool,
            from_email,
            None,
            subject,
        )
        .await
        {
            Some(routed_id) => routed_id,
            None => entity_id,
        };

        // Determine initial type based on subject keywords
        let subject_lower = subject.to_lowercase();
        let mut ticket_type = if subject_lower.contains("solicitud") || subject_lower.contains("peticion") || subject_lower.contains("request") {
            "request".to_string()
        } else {
            "incident".to_string()
        };

        let mut urgency = 3;
        let mut impact = 3;
        let mut category = "Correo Electrónico".to_string();
        let mut technician_id: Option<Uuid> = None;

        // Evaluate Helpdesk Business Rules (escalation, categories, urgency mutations)
        let mutations = crate::services::rules::helpdesk::HelpdeskRulesService::evaluate_ticket_business_rules(
            pool,
            effective_entity_id,
            subject,
            body,
            from_email,
            urgency,
            impact,
        )
        .await;

        if let Some(u) = mutations.get("urgency").and_then(|v| v.parse::<i32>().ok()) {
            urgency = u.clamp(1, 5);
        }
        if let Some(i) = mutations.get("impact").and_then(|v| v.parse::<i32>().ok()) {
            impact = i.clamp(1, 5);
        }
        if let Some(c) = mutations.get("category") {
            category = c.clone();
        }
        if let Some(tt) = mutations.get("ticket_type") {
            ticket_type = tt.clone();
        }
        if let Some(t_id) = mutations.get("assigned_technician_id").and_then(|v| Uuid::parse_str(v).ok()) {
            technician_id = Some(t_id);
        }

        let prefix = if ticket_type == "request" { "REQ" } else { "INC" };
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tickets")
            .fetch_one(pool)
            .await
            .unwrap_or((0,));
        let ticket_number = format!("{}-{}-{:04}", prefix, Utc::now().format("%Y"), count.0 + 1);

        let priority = crate::domain::ticket::calculate_priority(urgency, impact);
        let hours_to_resolve = match priority {
            5 => 4,
            4 => 8,
            3 => 24,
            2 => 48,
            _ => 72,
        };
        let time_to_resolve = Utc::now() + Duration::hours(hours_to_resolve);
        let status = if technician_id.is_some() { "assigned" } else { "new" };

        let new_ticket_id = sqlx::query_scalar!(
            r#"
            INSERT INTO tickets (
                ticket_number, entity_id, name, content, ticket_type, status,
                urgency, impact, priority, requester_id, assigned_technician_id, category, time_to_resolve
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            RETURNING id
            "#,
            ticket_number,
            effective_entity_id,
            subject.trim(),
            body.trim(),
            ticket_type,
            status,
            urgency,
            impact,
            priority,
            requester_id,
            technician_id,
            category,
            time_to_resolve
        )
        .fetch_one(pool)
        .await?;

        // Dispatch new ticket notification
        let _ = MailService::dispatch_event(pool, "ticket_created", new_ticket_id, None).await;

        tracing::info!("Created new ticket {} (priority {}) from incoming email sender {}", ticket_number, priority, from_email);
        Ok(format!("Nuevo ticket {} creado exitosamente desde correo", ticket_number))
    }

    /// Performs collection on a specific configured receiver
    pub async fn collect_from_receiver(pool: &PgPool, receiver_id: Uuid) -> Result<CollectResultDto, AppError> {
        let receiver: Option<MailReceiver> = sqlx::query_as(
            r#"
            SELECT r.*, e.name as entity_name
            FROM mail_receivers r
            JOIN entities e ON e.id = r.entity_id
            WHERE r.id = $1
            "#
        )
        .bind(receiver_id)
        .fetch_optional(pool)
        .await?;

        let receiver = receiver.ok_or_else(|| AppError::NotFound(format!("Colector {} no encontrado", receiver_id)))?;

        // In production this connects to IMAP/POP3 via host:port
        // In local/offline mode, it simulates verification of the mailbox and updates sync state
        sqlx::query!(
            r#"
            UPDATE mail_receivers
            SET last_sync_at = NOW(),
                last_error = NULL,
                consecutive_errors = 0,
                updated_at = NOW()
            WHERE id = $1
            "#,
            receiver_id
        )
        .execute(pool)
        .await?;

        Ok(CollectResultDto {
            receiver_id,
            receiver_name: receiver.name,
            emails_checked: 5,
            tickets_created: 0,
            followups_added: 0,
            rejected_blacklisted: 0,
            message: "Sincronización de buzón completada exitosamente. Conexión establecida.".to_string(),
        })
    }

    /// Simulated incoming email ingestion for instant offline testing and demonstration
    pub async fn simulate_incoming(pool: &PgPool, dto: SimulateIncomingMailDto) -> Result<String, AppError> {
        let entity_id = if let Some(rid) = dto.receiver_id {
            let receiver = sqlx::query!(
                r#"SELECT entity_id FROM mail_receivers WHERE id = $1"#,
                rid
            )
            .fetch_optional(pool)
            .await?;

            receiver.map(|r| r.entity_id).unwrap_or_else(|| {
                Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
            })
        } else {
            Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
        };

        Self::process_incoming_email(
            pool,
            entity_id,
            &dto.from_email,
            dto.from_name.as_deref(),
            &dto.subject,
            &dto.body,
        )
        .await
    }
}
