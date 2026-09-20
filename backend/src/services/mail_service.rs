use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::notification::{
    MailSettings, NotificationEvent, NotificationTemplate, NotificationTemplateRenderer,
};
use crate::error::AppError;

pub struct MailService;

impl MailService {
    /// Dispatches a notification event by rendering the template and inserting into notification_queue
    pub async fn dispatch_event(
        pool: &PgPool,
        event_key: &str,
        ticket_id: Uuid,
        followup_id: Option<Uuid>,
    ) -> Result<usize, AppError> {
        // 1. Fetch Global Mail Settings
        let settings: Option<MailSettings> = sqlx::query_as(
            r#"
            SELECT * FROM mail_settings
            WHERE entity_id IS NULL
            ORDER BY created_at ASC
            LIMIT 1
            "#,
        )
        .fetch_optional(pool)
        .await?;

        let settings = match settings {
            Some(s) if s.notifications_enabled => s,
            _ => {
                tracing::info!("Mail notifications are disabled or settings not found");
                return Ok(0);
            }
        };

        // 2. Fetch Notification Event definition
        let event: Option<NotificationEvent> = sqlx::query_as(
            r#"
            SELECT * FROM notification_events
            WHERE event_key = $1 AND is_active = TRUE
            LIMIT 1
            "#,
        )
        .bind(event_key)
        .fetch_optional(pool)
        .await?;

        let event = match event {
            Some(e) => e,
            None => {
                tracing::debug!("No active notification event found for key: {}", event_key);
                return Ok(0);
            }
        };

        // 3. Fetch Associated Notification Template
        let template: Option<NotificationTemplate> = sqlx::query_as(
            r#"
            SELECT * FROM notification_templates
            WHERE id = $1 AND is_active = TRUE
            LIMIT 1
            "#,
        )
        .bind(event.template_id)
        .fetch_optional(pool)
        .await?;

        let template = match template {
            Some(t) => t,
            None => {
                tracing::warn!("Notification template not found for event: {}", event_key);
                return Ok(0);
            }
        };

        // 4. Fetch Ticket Details with Assigned Group
        let ticket_row = sqlx::query!(
            r#"
            SELECT 
                t.ticket_number,
                t.name,
                t.content,
                t.ticket_type,
                t.priority,
                t.status,
                t.category,
                t.assigned_group_id,
                req.email as "requester_email?",
                COALESCE(NULLIF(TRIM(req.firstname || ' ' || req.realname), ''), req.username) as "requester_name?",
                tech.email as "technician_email?",
                COALESCE(NULLIF(TRIM(tech.firstname || ' ' || tech.realname), ''), tech.username) as "technician_name?",
                ag.name as "assigned_group_name?"
            FROM tickets t
            LEFT JOIN users req ON t.requester_id = req.id
            LEFT JOIN users tech ON t.assigned_technician_id = tech.id
            LEFT JOIN groups ag ON t.assigned_group_id = ag.id
            WHERE t.id = $1
            "#,
            ticket_id
        )
        .fetch_optional(pool)
        .await?;

        let ticket = match ticket_row {
            Some(r) => r,
            None => return Err(AppError::NotFound(format!("Ticket {} no encontrado", ticket_id))),
        };

        // 5. Fetch Followup Details if provided
        let (followup_content, author_name) = if let Some(fid) = followup_id {
            let frow = sqlx::query!(
                r#"
                SELECT f.content,
                       COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username) as "author_name?"
                FROM ticket_followups f
                LEFT JOIN users u ON f.author_id = u.id
                WHERE f.id = $1
                "#,
                fid
            )
            .fetch_optional(pool)
            .await?;

            if let Some(fr) = frow {
                (fr.content, fr.author_name.unwrap_or_else(|| "Especialista".to_string()))
            } else {
                ("".to_string(), "Sistema".to_string())
            }
        } else {
            ("".to_string(), "Sistema".to_string())
        };

        // 6. Build Variable Substitution Map
        let priority_str = ticket.priority.to_string();
        let cat_str = ticket.category.unwrap_or_else(|| "General".to_string());
        let req_name = ticket.requester_name.unwrap_or_else(|| "Usuario".to_string());
        let tech_name = ticket.technician_name.unwrap_or_else(|| "Sin Asignar".to_string());
        let group_name = ticket.assigned_group_name.unwrap_or_else(|| "Sin Grupo".to_string());

        let vars = [
            ("ticket.number", ticket.ticket_number.as_str()),
            ("ticket.name", ticket.name.as_str()),
            ("ticket.content", ticket.content.as_str()),
            ("ticket.type", ticket.ticket_type.as_str()),
            ("ticket.priority", priority_str.as_str()),
            ("ticket.status", ticket.status.as_str()),
            ("ticket.category", cat_str.as_str()),
            ("ticket.requester_name", req_name.as_str()),
            ("ticket.technician_name", tech_name.as_str()),
            ("ticket.group_name", group_name.as_str()),
            ("followup.content", followup_content.as_str()),
            ("author.name", author_name.as_str()),
        ];

        // 7. Render Subject and Bodies
        let raw_subject = NotificationTemplateRenderer::render_tags(&template.subject_template, &vars);
        let subject = if !settings.subject_prefix.is_empty() && !raw_subject.contains(&settings.subject_prefix) {
            format!("{} {}", settings.subject_prefix, raw_subject)
        } else {
            raw_subject
        };

        let mut body_html = NotificationTemplateRenderer::render_tags(&template.html_template, &vars);
        let mut body_text = NotificationTemplateRenderer::render_tags(&template.text_template, &vars);

        if !settings.email_signature.is_empty() {
            body_html.push_str(&format!("<br><br><pre style=\"font-family:sans-serif; color:#64748b;\">{}</pre>", settings.email_signature));
            body_text.push_str(&format!("\n\n{}", settings.email_signature));
        }

        // 8. Resolve Recipients from JSON definition + Transversal Group Roster
        let recipients_array = event.recipients.as_array();
        let mut targets: Vec<(String, Option<String>)> = Vec::new();

        if let Some(arr) = recipients_array {
            for role in arr {
                let role_str = role.as_str().unwrap_or("");
                match role_str {
                    "requester" => {
                        if let Some(ref re) = ticket.requester_email {
                            if !re.trim().is_empty() {
                                targets.push((re.clone(), Some(req_name.clone())));
                            }
                        }
                    }
                    "technician" => {
                        if let Some(ref te) = ticket.technician_email {
                            if !te.trim().is_empty() {
                                targets.push((te.clone(), Some(tech_name.clone())));
                            }
                        }
                    }
                    "group" | "assigned_group" => {
                        if let Some(gid) = ticket.assigned_group_id {
                            let g_members = sqlx::query!(
                                r#"
                                SELECT u.email, COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username) as "name!"
                                FROM group_users gu
                                JOIN users u ON gu.user_id = u.id
                                WHERE gu.group_id = $1 AND u.is_active = TRUE
                                "#,
                                gid
                            )
                            .fetch_all(pool)
                            .await?;

                            for gm in g_members {
                                if !gm.email.trim().is_empty() && !targets.iter().any(|(e, _)| e == &gm.email) {
                                    targets.push((gm.email, Some(gm.name)));
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        }

        // Also if ticket has an assigned group and the event is ticket_created or ticket_assigned, notify group members
        if (event_key == "ticket_created" || event_key == "ticket_assigned") && targets.is_empty() {
            if let Some(gid) = ticket.assigned_group_id {
                let g_members = sqlx::query!(
                    r#"
                    SELECT u.email, COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username) as "name!"
                    FROM group_users gu
                    JOIN users u ON gu.user_id = u.id
                    WHERE gu.group_id = $1 AND u.is_active = TRUE
                    "#,
                    gid
                )
                .fetch_all(pool)
                .await?;

                for gm in g_members {
                    if !gm.email.trim().is_empty() && !targets.iter().any(|(e, _)| e == &gm.email) {
                        targets.push((gm.email, Some(gm.name)));
                    }
                }
            }
        }

        // Fallback default: if no targets resolved, send to admin email
        if targets.is_empty() && !settings.admin_email.is_empty() {
            targets.push((settings.admin_email.clone(), Some(settings.admin_name.clone())));
        }

        let mut inserted_count = 0;
        for (email, name) in targets {
            sqlx::query!(
                r#"
                INSERT INTO notification_queue (
                    event_key, ticket_id, recipient_email, recipient_name,
                    subject, body_html, body_text, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
                "#,
                event_key,
                ticket_id,
                email,
                name,
                subject,
                body_html,
                body_text
            )
            .execute(pool)
            .await?;

            inserted_count += 1;
        }

        tracing::info!(
            "Dispatched notification event '{}' for ticket {} (queued {} messages)",
            event_key, ticket.ticket_number, inserted_count
        );

        Ok(inserted_count)
    }

    /// Processes pending items in the notification_queue
    pub async fn process_queue_batch(pool: &PgPool) -> Result<usize, AppError> {
        let pending = sqlx::query!(
            r#"
            SELECT id, recipient_email, subject, body_html, body_text, attempts
            FROM notification_queue
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 20
            "#
        )
        .fetch_all(pool)
        .await?;

        if pending.is_empty() {
            return Ok(0);
        }

        let count = pending.len();

        for item in pending {
            // Simulated local SMTP delivery
            sqlx::query!(
                r#"
                UPDATE notification_queue
                SET status = 'sent', last_attempt_at = NOW(), attempts = attempts + 1
                WHERE id = $1
                "#,
                item.id
            )
            .execute(pool)
            .await?;

            tracing::debug!(
                "Processed notification id={} to={}",
                item.id, item.recipient_email
            );
        }

        Ok(count)
    }
}
