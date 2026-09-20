use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::sla::{calculate_target_time, CalendarHoliday, CalendarSegment, Sla};
use crate::error::AppError;

pub struct SlaService;

impl SlaService {
    /// Calculate TTO (Time to Own) and TTR (Time to Resolve) deadlines for a ticket
    /// based on assigned or inferred SLA and working calendar rules.
    pub async fn calculate_deadlines(
        pool: &PgPool,
        sla_id: Option<Uuid>,
        priority: i32,
        start_time: DateTime<Utc>,
    ) -> Result<(Option<Uuid>, DateTime<Utc>, DateTime<Utc>), AppError> {
        // 1. Resolve SLA: explicit ID, matching priority, or fallback default
        let resolved_sla: Option<Sla> = if let Some(id) = sla_id {
            sqlx::query_as("SELECT * FROM slas WHERE id = $1 AND is_active = TRUE")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Error fetching SLA: {}", e)))?
        } else {
            // Priority match fallback
            let by_prio: Option<Sla> = sqlx::query_as(
                "SELECT * FROM slas WHERE priority_override = $1 AND is_active = TRUE LIMIT 1",
            )
            .bind(priority)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error fetching SLA by priority: {}", e)))?;

            if by_prio.is_some() {
                by_prio
            } else {
                // First active SLA as fallback
                sqlx::query_as("SELECT * FROM slas WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1")
                    .fetch_optional(pool)
                    .await
                    .map_err(|e| AppError::InternalServerError(format!("Error fetching fallback SLA: {}", e)))?
            }
        };

        let Some(sla) = resolved_sla else {
            // Naive fallback if no SLA is configured in DB
            let hours_to_resolve = match priority {
                5 => 4,
                4 => 8,
                3 => 24,
                2 => 48,
                _ => 72,
            };
            return Ok((
                None,
                start_time + Duration::minutes(60),
                start_time + Duration::hours(hours_to_resolve),
            ));
        };

        // 2. Fetch calendar rules if calendar is assigned
        let (segments, holidays) = if let Some(cal_id) = sla.calendar_id {
            let segs: Vec<CalendarSegment> = sqlx::query_as(
                "SELECT * FROM calendar_segments WHERE calendar_id = $1 ORDER BY day_of_week, start_time",
            )
            .bind(cal_id)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

            let hols: Vec<CalendarHoliday> = sqlx::query_as(
                "SELECT * FROM calendar_holidays WHERE calendar_id = $1 ORDER BY holiday_date",
            )
            .bind(cal_id)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

            let dates: Vec<chrono::NaiveDate> = hols.into_iter().map(|h| h.holiday_date).collect();
            (segs, dates)
        } else {
            (Vec::new(), Vec::new())
        };

        // 3. Compute dynamic working calendar deadlines
        let tto = calculate_target_time(start_time, sla.tto_duration_minutes as i64, &segments, &holidays);
        let ttr = calculate_target_time(start_time, sla.ttr_duration_minutes as i64, &segments, &holidays);

        Ok((Some(sla.id), tto, ttr))
    }

    /// Background tick evaluation executed periodically by Tokio worker.
    /// Updates real-time risk/breach statuses, fires pending escalation rules,
    /// and logs executions idempotently.
    pub async fn process_sla_tick(pool: &PgPool) -> Result<(), AppError> {
        let now = Utc::now();

        // 1. Update SLA TTO Status for active tickets
        // If unacknowledged and past time_to_own -> 'breached'
        let _ = sqlx::query(
            r#"
            UPDATE tickets
            SET sla_tto_status = 'breached'
            WHERE acknowledged_at IS NULL
              AND time_to_own IS NOT NULL
              AND time_to_own < $1
              AND sla_tto_status != 'breached'
              AND status NOT IN ('solved', 'closed')
            "#
        )
        .bind(now)
        .execute(pool)
        .await;

        // 2. Update SLA TTR Status for active tickets
        // Breached:
        let _ = sqlx::query(
            r#"
            UPDATE tickets
            SET sla_ttr_status = 'breached'
            WHERE time_to_resolve IS NOT NULL
              AND time_to_resolve < $1
              AND sla_ttr_status != 'breached'
              AND status NOT IN ('solved', 'closed')
            "#
        )
        .bind(now)
        .execute(pool)
        .await;

        // At risk: within 1 hour or remaining time <= 25% of total
        let _ = sqlx::query(
            r#"
            UPDATE tickets
            SET sla_ttr_status = 'at_risk'
            WHERE time_to_resolve IS NOT NULL
              AND time_to_resolve >= $1
              AND time_to_resolve <= ($1 + INTERVAL '1 hour')
              AND sla_ttr_status = 'within_sla'
              AND status NOT IN ('solved', 'closed')
            "#
        )
        .bind(now)
        .execute(pool)
        .await;

        // 3. Evaluate Escalation Levels
        // Candidate query: active tickets with SLA that have pending escalation levels not in log
        #[derive(sqlx::FromRow)]
        struct PendingEscalationRow {
            ticket_id: Uuid,
            ticket_number: String,
            ticket_name: String,
            ticket_priority: i32,
            sla_level_id: Uuid,
            level_name: String,
            target_type: String,
            execution_offset_minutes: i32,
            action_type: String,
            action_value: String,
            time_to_own: Option<DateTime<Utc>>,
            time_to_resolve: Option<DateTime<Utc>>,
        }

        let pending_escalations: Vec<PendingEscalationRow> = sqlx::query_as(
            r#"
            SELECT 
                t.id AS ticket_id,
                t.ticket_number,
                t.name AS ticket_name,
                t.priority AS ticket_priority,
                l.id AS sla_level_id,
                l.name AS level_name,
                l.target_type,
                l.execution_offset_minutes,
                l.action_type,
                l.action_value,
                t.time_to_own,
                t.time_to_resolve
            FROM tickets t
            JOIN sla_levels l ON l.sla_id = t.sla_id AND l.is_active = TRUE
            LEFT JOIN ticket_sla_escalations_log elog ON elog.ticket_id = t.id AND elog.sla_level_id = l.id
            WHERE t.status NOT IN ('solved', 'closed')
              AND elog.id IS NULL
            "#
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        for esc in pending_escalations {
            let base_time = if esc.target_type == "tto" {
                esc.time_to_own
            } else {
                esc.time_to_resolve
            };

            let Some(base) = base_time else { continue };
            let trigger_time = base + Duration::minutes(esc.execution_offset_minutes as i64);

            if now >= trigger_time {
                // Trigger condition met! Execute escalation action
                let mut action_details = String::new();

                match esc.action_type.as_str() {
                    "escalate_priority" => {
                        if let Ok(new_prio) = esc.action_value.parse::<i32>() {
                            let clamped_prio = new_prio.clamp(1, 5);
                            let _ = sqlx::query("UPDATE tickets SET priority = $1, updated_at = NOW() WHERE id = $2")
                                .bind(clamped_prio)
                                .bind(esc.ticket_id)
                                .execute(pool)
                                .await;
                            action_details = format!("Prioridad elevada a P{}", clamped_prio);
                        }
                    }
                    "reassign_group" => {
                        if let Ok(group_id) = Uuid::parse_str(&esc.action_value) {
                            let _ = sqlx::query("UPDATE tickets SET assigned_group_id = $1, status = 'assigned', updated_at = NOW() WHERE id = $2")
                                .bind(group_id)
                                .bind(esc.ticket_id)
                                .execute(pool)
                                .await;
                            action_details = format!("Ticket reasignado al grupo transversal {}", group_id);
                        }
                    }
                    "reassign_technician" => {
                        if let Ok(tech_id) = Uuid::parse_str(&esc.action_value) {
                            let _ = sqlx::query("UPDATE tickets SET assigned_technician_id = $1, status = 'assigned', updated_at = NOW() WHERE id = $2")
                                .bind(tech_id)
                                .bind(esc.ticket_id)
                                .execute(pool)
                                .await;
                            action_details = format!("Ticket reasignado al técnico {}", tech_id);
                        }
                    }
                    "send_alert" => {
                        // Dispatch SLA warning or breach notification
                        let event_key = if esc.execution_offset_minutes <= 0 {
                            "sla_warning_ttr"
                        } else {
                            "sla_breached_ttr"
                        };
                        let _ = crate::services::mail_service::MailService::dispatch_event(
                            pool,
                            event_key,
                            esc.ticket_id,
                            None,
                        )
                        .await;
                        action_details = format!("Notificación de alerta enviada ({}) a destinatarios {}", event_key, esc.action_value);
                    }
                    _ => {
                        action_details = "Acción de escalamiento desconocida".to_string();
                    }
                }

                // Add audit followup record
                let audit_note = format!(
                    "⚡ [Matriz de Escalamiento SLA] Regla activada: '{}'. {}",
                    esc.level_name, action_details
                );
                let _ = sqlx::query(
                    r#"
                    INSERT INTO ticket_followups (id, ticket_id, author_id, content, item_type, is_private, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1, NULL, $2, 'task', FALSE, NOW(), NOW())
                    "#
                )
                .bind(esc.ticket_id)
                .bind(audit_note)
                .execute(pool)
                .await;

                // Log escalation execution idempotently
                let _ = sqlx::query(
                    r#"
                    INSERT INTO ticket_sla_escalations_log (id, ticket_id, sla_level_id, executed_at, action_type, action_details)
                    VALUES (gen_random_uuid(), $1, $2, NOW(), $3, $4)
                    ON CONFLICT (ticket_id, sla_level_id) DO NOTHING
                    "#
                )
                .bind(esc.ticket_id)
                .bind(esc.sla_level_id)
                .bind(&esc.action_type)
                .bind(&action_details)
                .execute(pool)
                .await;

                tracing::info!(
                    "🚨 SLA Escalation applied to ticket {}: rule '{}', action '{}'",
                    esc.ticket_number,
                    esc.level_name,
                    action_details
                );
            }
        }

        Ok(())
    }
}
