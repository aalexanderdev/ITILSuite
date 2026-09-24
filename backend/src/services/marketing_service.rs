use sqlx::{PgPool, Row};
use tracing::{info, warn};
use uuid::Uuid;

use crate::domain::marketing::{
    render_marketing_email, CampaignDelivery, CreateCampaignDto, CreateContactDto,
    CreateEmailTemplateDto, CreateSegmentDto, MarketingCampaign, MarketingContact, MarketingEmail,
    MarketingMetricsSummary, MarketingSegment,
};

pub struct MarketingService;

impl MarketingService {
    // -------------------------------------------------------------------------
    // Contacts Management
    // -------------------------------------------------------------------------

    pub async fn list_contacts(
        pool: &PgPool,
        entity_id: Option<Uuid>,
        stage_filter: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<MarketingContact>, sqlx::Error> {
        let contacts = match (entity_id, stage_filter) {
            (Some(ent_id), Some(stage)) if !stage.is_empty() && stage != "all" => {
                sqlx::query_as::<_, MarketingContact>(
                    "SELECT * FROM marketing_contacts 
                     WHERE entity_id = $1 AND stage = $2 
                     ORDER BY created_at DESC LIMIT $3 OFFSET $4",
                )
                .bind(ent_id)
                .bind(stage)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?
            }
            (Some(ent_id), _) => {
                sqlx::query_as::<_, MarketingContact>(
                    "SELECT * FROM marketing_contacts 
                     WHERE entity_id = $1 
                     ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                )
                .bind(ent_id)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?
            }
            (None, Some(stage)) if !stage.is_empty() && stage != "all" => {
                sqlx::query_as::<_, MarketingContact>(
                    "SELECT * FROM marketing_contacts 
                     WHERE stage = $1 
                     ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                )
                .bind(stage)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?
            }
            (None, _) => {
                sqlx::query_as::<_, MarketingContact>(
                    "SELECT * FROM marketing_contacts 
                     ORDER BY created_at DESC LIMIT $1 OFFSET $2",
                )
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?
            }
        };

        Ok(contacts)
    }

    pub async fn get_contact_by_id(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<Option<MarketingContact>, sqlx::Error> {
        sqlx::query_as::<_, MarketingContact>("SELECT * FROM marketing_contacts WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

    pub async fn create_contact(
        pool: &PgPool,
        dto: CreateContactDto,
    ) -> Result<MarketingContact, sqlx::Error> {
        let root_ent_id = match dto.entity_id {
            Some(id) => id,
            None => {
                let ent: Option<(Uuid,)> =
                    sqlx::query_as("SELECT id FROM entities WHERE parent_id IS NULL LIMIT 1")
                        .fetch_optional(pool)
                        .await?;
                ent.map(|(id,)| id)
                    .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
            }
        };

        let first_name = dto.first_name.unwrap_or_default();
        let last_name = dto.last_name.unwrap_or_default();
        let company = dto.company.unwrap_or_default();
        let phone = dto.phone.unwrap_or_default();
        let stage = dto.stage.unwrap_or_else(|| "lead".to_string());
        let points = dto.points.unwrap_or(0);
        let tags = dto.tags.unwrap_or_default();

        let contact = sqlx::query_as::<_, MarketingContact>(
            "INSERT INTO marketing_contacts (entity_id, email, first_name, last_name, company, phone, stage, points, tags)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *",
        )
        .bind(root_ent_id)
        .bind(&dto.email)
        .bind(first_name)
        .bind(last_name)
        .bind(company)
        .bind(phone)
        .bind(stage)
        .bind(points)
        .bind(tags)
        .fetch_one(pool)
        .await?;

        Ok(contact)
    }

    pub async fn adjust_contact_points(
        pool: &PgPool,
        contact_id: Uuid,
        delta: i32,
    ) -> Result<i32, sqlx::Error> {
        let row = sqlx::query(
            "UPDATE marketing_contacts 
             SET points = points + $1, updated_at = NOW() 
             WHERE id = $2 
             RETURNING points",
        )
        .bind(delta)
        .bind(contact_id)
        .fetch_one(pool)
        .await?;

        Ok(row.get("points"))
    }

    pub async fn add_contact_tag(
        pool: &PgPool,
        contact_id: Uuid,
        tag: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE marketing_contacts 
             SET tags = array_append(tags, $1), updated_at = NOW() 
             WHERE id = $2 AND NOT ($1 = ANY(tags))",
        )
        .bind(tag)
        .bind(contact_id)
        .execute(pool)
        .await?;

        Ok(())
    }

    // -------------------------------------------------------------------------
    // Segments Management
    // -------------------------------------------------------------------------

    pub async fn list_segments(
        pool: &PgPool,
        entity_id: Option<Uuid>,
    ) -> Result<Vec<MarketingSegment>, sqlx::Error> {
        let segments = match entity_id {
            Some(ent_id) => {
                sqlx::query_as::<_, MarketingSegment>(
                    "SELECT * FROM marketing_segments WHERE entity_id = $1 ORDER BY created_at DESC",
                )
                .bind(ent_id)
                .fetch_all(pool)
                .await?
            }
            None => {
                sqlx::query_as::<_, MarketingSegment>(
                    "SELECT * FROM marketing_segments ORDER BY created_at DESC",
                )
                .fetch_all(pool)
                .await?
            }
        };

        Ok(segments)
    }

    pub async fn get_segment_by_id(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<Option<MarketingSegment>, sqlx::Error> {
        sqlx::query_as::<_, MarketingSegment>("SELECT * FROM marketing_segments WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

    pub async fn create_segment(
        pool: &PgPool,
        dto: CreateSegmentDto,
    ) -> Result<MarketingSegment, sqlx::Error> {
        let root_ent_id = match dto.entity_id {
            Some(id) => id,
            None => {
                let ent: Option<(Uuid,)> =
                    sqlx::query_as("SELECT id FROM entities WHERE parent_id IS NULL LIMIT 1")
                        .fetch_optional(pool)
                        .await?;
                ent.map(|(id,)| id)
                    .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
            }
        };

        let description = dto.description.unwrap_or_default();
        let is_dynamic = dto.is_dynamic.unwrap_or(true);
        let filter_criteria = dto.filter_criteria.unwrap_or_else(|| serde_json::json!([]));

        let segment = sqlx::query_as::<_, MarketingSegment>(
            "INSERT INTO marketing_segments (entity_id, name, description, is_dynamic, filter_criteria)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *",
        )
        .bind(root_ent_id)
        .bind(&dto.name)
        .bind(description)
        .bind(is_dynamic)
        .bind(filter_criteria)
        .fetch_one(pool)
        .await?;

        // Immediately evaluate and cache count
        let _ = Self::evaluate_segment_contacts(pool, segment.id).await;

        Ok(segment)
    }

    pub async fn evaluate_segment_contacts(
        pool: &PgPool,
        segment_id: Uuid,
    ) -> Result<Vec<MarketingContact>, sqlx::Error> {
        let segment = Self::get_segment_by_id(pool, segment_id).await?;
        if segment.is_none() {
            return Ok(vec![]);
        }
        let seg = segment.unwrap();

        // For simplicity and high speed, evaluate filter criteria in SQL/in-memory
        // Default: contacts for entity who are not unsubscribed
        let mut contacts = sqlx::query_as::<_, MarketingContact>(
            "SELECT * FROM marketing_contacts WHERE entity_id = $1 AND is_unsubscribed = FALSE",
        )
        .bind(seg.entity_id)
        .fetch_all(pool)
        .await?;

        if let Some(rules) = seg.filter_criteria.as_array() {
            for rule in rules {
                if let (Some(field), Some(op), Some(val)) = (
                    rule.get("field").and_then(|v| v.as_str()),
                    rule.get("operator").and_then(|v| v.as_str()),
                    rule.get("value").and_then(|v| v.as_str()),
                ) {
                    contacts.retain(|c| match field {
                        "points" => {
                            let target_val = val.parse::<i32>().unwrap_or(0);
                            match op {
                                "gte" => c.points >= target_val,
                                "lte" => c.points <= target_val,
                                "equals" => c.points == target_val,
                                _ => true,
                            }
                        }
                        "stage" => match op {
                            "equals" => c.stage.eq_ignore_ascii_case(val),
                            "not_equals" => !c.stage.eq_ignore_ascii_case(val),
                            _ => true,
                        },
                        "tags" => match op {
                            "contains" => c.tags.iter().any(|t| t.eq_ignore_ascii_case(val)),
                            _ => true,
                        },
                        "company" => match op {
                            "contains" => c.company.to_lowercase().contains(&val.to_lowercase()),
                            "equals" => c.company.eq_ignore_ascii_case(val),
                            _ => true,
                        },
                        _ => true,
                    });
                }
            }
        }

        // Cache count in database
        let count = contacts.len() as i32;
        let _ = sqlx::query("UPDATE marketing_segments SET cached_count = $1, updated_at = NOW() WHERE id = $2")
            .bind(count)
            .bind(segment_id)
            .execute(pool)
            .await;

        Ok(contacts)
    }

    // -------------------------------------------------------------------------
    // Email Templates Management
    // -------------------------------------------------------------------------

    pub async fn list_email_templates(
        pool: &PgPool,
        entity_id: Option<Uuid>,
    ) -> Result<Vec<MarketingEmail>, sqlx::Error> {
        let templates = match entity_id {
            Some(ent_id) => {
                sqlx::query_as::<_, MarketingEmail>(
                    "SELECT * FROM marketing_emails WHERE entity_id = $1 ORDER BY created_at DESC",
                )
                .bind(ent_id)
                .fetch_all(pool)
                .await?
            }
            None => {
                sqlx::query_as::<_, MarketingEmail>(
                    "SELECT * FROM marketing_emails ORDER BY created_at DESC",
                )
                .fetch_all(pool)
                .await?
            }
        };

        Ok(templates)
    }

    pub async fn get_email_template_by_id(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<Option<MarketingEmail>, sqlx::Error> {
        sqlx::query_as::<_, MarketingEmail>("SELECT * FROM marketing_emails WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

    pub async fn create_email_template(
        pool: &PgPool,
        dto: CreateEmailTemplateDto,
    ) -> Result<MarketingEmail, sqlx::Error> {
        let root_ent_id = match dto.entity_id {
            Some(id) => id,
            None => {
                let ent: Option<(Uuid,)> =
                    sqlx::query_as("SELECT id FROM entities WHERE parent_id IS NULL LIMIT 1")
                        .fetch_optional(pool)
                        .await?;
                ent.map(|(id,)| id)
                    .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
            }
        };

        let body_text = dto.body_text.unwrap_or_default();
        let from_name = dto.from_name.unwrap_or_else(|| "ITILSuite Communications".to_string());
        let from_email = dto.from_email.unwrap_or_else(|| "no-reply@itilsuite.local".to_string());
        let reply_to = dto.reply_to.unwrap_or_else(|| "soporte@itilsuite.local".to_string());

        let email = sqlx::query_as::<_, MarketingEmail>(
            "INSERT INTO marketing_emails (entity_id, name, subject, body_html, body_text, from_name, from_email, reply_to)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *",
        )
        .bind(root_ent_id)
        .bind(&dto.name)
        .bind(&dto.subject)
        .bind(&dto.body_html)
        .bind(body_text)
        .bind(from_name)
        .bind(from_email)
        .bind(reply_to)
        .fetch_one(pool)
        .await?;

        Ok(email)
    }

    // -------------------------------------------------------------------------
    // Campaigns Management & Dispatch
    // -------------------------------------------------------------------------

    pub async fn list_campaigns(
        pool: &PgPool,
        entity_id: Option<Uuid>,
    ) -> Result<Vec<MarketingCampaign>, sqlx::Error> {
        let campaigns = match entity_id {
            Some(ent_id) => {
                sqlx::query_as::<_, MarketingCampaign>(
                    "SELECT * FROM marketing_campaigns WHERE entity_id = $1 ORDER BY created_at DESC",
                )
                .bind(ent_id)
                .fetch_all(pool)
                .await?
            }
            None => {
                sqlx::query_as::<_, MarketingCampaign>(
                    "SELECT * FROM marketing_campaigns ORDER BY created_at DESC",
                )
                .fetch_all(pool)
                .await?
            }
        };

        Ok(campaigns)
    }

    pub async fn get_campaign_by_id(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<Option<MarketingCampaign>, sqlx::Error> {
        sqlx::query_as::<_, MarketingCampaign>("SELECT * FROM marketing_campaigns WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

    pub async fn create_campaign(
        pool: &PgPool,
        dto: CreateCampaignDto,
    ) -> Result<MarketingCampaign, sqlx::Error> {
        let root_ent_id = match dto.entity_id {
            Some(id) => id,
            None => {
                let ent: Option<(Uuid,)> =
                    sqlx::query_as("SELECT id FROM entities WHERE parent_id IS NULL LIMIT 1")
                        .fetch_optional(pool)
                        .await?;
                ent.map(|(id,)| id)
                    .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
            }
        };

        let description = dto.description.unwrap_or_default();
        let campaign_type = dto.campaign_type.unwrap_or_else(|| "broadcast".to_string());
        let status = if dto.scheduled_at.is_some() { "scheduled" } else { "draft" };

        let campaign = sqlx::query_as::<_, MarketingCampaign>(
            "INSERT INTO marketing_campaigns (entity_id, name, description, segment_id, email_id, campaign_type, status, scheduled_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *",
        )
        .bind(root_ent_id)
        .bind(&dto.name)
        .bind(description)
        .bind(dto.segment_id)
        .bind(dto.email_id)
        .bind(campaign_type)
        .bind(status)
        .bind(dto.scheduled_at)
        .fetch_one(pool)
        .await?;

        Ok(campaign)
    }

    /// Dispatches a campaign to all contacts in its segment
    pub async fn dispatch_campaign(
        pool: &PgPool,
        campaign_id: Uuid,
        base_url: &str,
    ) -> Result<usize, Box<dyn std::error::Error>> {
        let campaign = match Self::get_campaign_by_id(pool, campaign_id).await? {
            Some(c) => c,
            None => return Err("Campaign not found".into()),
        };

        let segment_id = match campaign.segment_id {
            Some(id) => id,
            None => return Err("Campaign has no segment assigned".into()),
        };

        let email_id = match campaign.email_id {
            Some(id) => id,
            None => return Err("Campaign has no email template assigned".into()),
        };

        let email_template = match Self::get_email_template_by_id(pool, email_id).await? {
            Some(e) => e,
            None => return Err("Email template not found".into()),
        };

        let contacts = Self::evaluate_segment_contacts(pool, segment_id).await?;
        if contacts.is_empty() {
            info!("No eligible contacts found for campaign {}", campaign.name);
            return Ok(0);
        }

        let total_recipients = contacts.len() as i32;

        // Transition campaign to active/started
        sqlx::query(
            "UPDATE marketing_campaigns 
             SET status = 'active', started_at = NOW(), total_recipients = $1, updated_at = NOW() 
             WHERE id = $2",
        )
        .bind(total_recipients)
        .bind(campaign_id)
        .execute(pool)
        .await?;

        let mut deliveries_created = 0;

        for contact in &contacts {
            // Generate unique 64-char crypto tracking token
            let tracking_token = format!("{:032x}{:032x}", Uuid::new_v4().as_u128(), Uuid::new_v4().as_u128());

            let rendered_html = render_marketing_email(&email_template.body_html, contact, &tracking_token, base_url);

            // Record delivery in marketing_campaign_deliveries
            sqlx::query(
                "INSERT INTO marketing_campaign_deliveries 
                 (campaign_id, contact_id, tracking_token, status, sent_at)
                 VALUES ($1, $2, $3, 'sent', NOW())",
            )
            .bind(campaign_id)
            .bind(contact.id)
            .bind(&tracking_token)
            .execute(pool)
            .await?;

            // Enqueue into notification_queue for background SMTP transmission
            let _ = sqlx::query(
                "INSERT INTO notification_queue 
                 (event_name, recipient_email, recipient_name, subject, body_html, body_text, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'pending')",
            )
            .bind(format!("campaign:{}", campaign.name))
            .bind(&contact.email)
            .bind(format!("{} {}", contact.first_name, contact.last_name))
            .bind(&email_template.subject)
            .bind(&rendered_html)
            .bind(&email_template.body_text)
            .execute(pool)
            .await;

            deliveries_created += 1;
        }

        // Complete campaign
        sqlx::query(
            "UPDATE marketing_campaigns 
             SET status = 'completed', completed_at = NOW(), total_delivered = $1, updated_at = NOW() 
             WHERE id = $2",
        )
        .bind(deliveries_created as i32)
        .bind(campaign_id)
        .execute(pool)
        .await?;

        info!(
            "Successfully dispatched campaign '{}' to {} contacts",
            campaign.name, deliveries_created
        );

        Ok(deliveries_created)
    }

    // -------------------------------------------------------------------------
    // Tracking Engine (Pixel, Click, Unsubscribe)
    // -------------------------------------------------------------------------

    pub async fn record_open(pool: &PgPool, tracking_token: &str) -> Result<bool, sqlx::Error> {
        let delivery: Option<CampaignDelivery> = sqlx::query_as(
            "SELECT * FROM marketing_campaign_deliveries WHERE tracking_token = $1",
        )
        .bind(tracking_token)
        .fetch_optional(pool)
        .await?;

        if let Some(del) = delivery {
            let is_first_open = del.opened_at.is_none();

            sqlx::query(
                "UPDATE marketing_campaign_deliveries 
                 SET status = CASE WHEN status = 'clicked' THEN 'clicked' ELSE 'opened' END,
                     opened_at = COALESCE(opened_at, NOW()),
                     open_count = open_count + 1,
                     updated_at = NOW()
                 WHERE id = $1",
            )
            .bind(del.id)
            .execute(pool)
            .await?;

            if is_first_open {
                // Increment campaign total_opened
                let _ = sqlx::query(
                    "UPDATE marketing_campaigns 
                     SET total_opened = total_opened + 1, updated_at = NOW() 
                     WHERE id = $1",
                )
                .bind(del.campaign_id)
                .execute(pool)
                .await;

                // Award engagement points for email opening (+2 points)
                let _ = Self::adjust_contact_points(pool, del.contact_id, 2).await;
            }

            return Ok(true);
        }

        Ok(false)
    }

    pub async fn record_click(
        pool: &PgPool,
        tracking_token: &str,
        target_url: &str,
        ip: &str,
        user_agent: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let delivery: Option<CampaignDelivery> = sqlx::query_as(
            "SELECT * FROM marketing_campaign_deliveries WHERE tracking_token = $1",
        )
        .bind(tracking_token)
        .fetch_optional(pool)
        .await?;

        if let Some(del) = delivery {
            let is_first_click = del.clicked_at.is_none();

            sqlx::query(
                "UPDATE marketing_campaign_deliveries 
                 SET status = 'clicked',
                     opened_at = COALESCE(opened_at, NOW()),
                     clicked_at = COALESCE(clicked_at, NOW()),
                     click_count = click_count + 1,
                     updated_at = NOW()
                 WHERE id = $1",
            )
            .bind(del.id)
            .execute(pool)
            .await?;

            // Record click audit
            let _ = sqlx::query(
                "INSERT INTO marketing_link_clicks (delivery_id, target_url, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4)",
            )
            .bind(del.id)
            .bind(target_url)
            .bind(ip)
            .bind(user_agent)
            .execute(pool)
            .await;

            if is_first_click {
                // Increment campaign total_clicked
                let _ = sqlx::query(
                    "UPDATE marketing_campaigns 
                     SET total_clicked = total_clicked + 1, updated_at = NOW() 
                     WHERE id = $1",
                )
                .bind(del.campaign_id)
                .execute(pool)
                .await;

                // Award engagement points for clicking link (+5 points)
                let _ = Self::adjust_contact_points(pool, del.contact_id, 5).await;
            }

            return Ok(Some(target_url.to_string()));
        }

        Ok(None)
    }

    pub async fn unsubscribe_by_token(
        pool: &PgPool,
        tracking_token: &str,
    ) -> Result<Option<MarketingContact>, sqlx::Error> {
        let delivery: Option<CampaignDelivery> = sqlx::query_as(
            "SELECT * FROM marketing_campaign_deliveries WHERE tracking_token = $1",
        )
        .bind(tracking_token)
        .fetch_optional(pool)
        .await?;

        if let Some(del) = delivery {
            let contact = sqlx::query_as::<_, MarketingContact>(
                "UPDATE marketing_contacts 
                 SET is_unsubscribed = TRUE, unsubscribed_at = NOW(), updated_at = NOW() 
                 WHERE id = $1 
                 RETURNING *",
            )
            .bind(del.contact_id)
            .fetch_optional(pool)
            .await?;

            // Mark delivery as unsubscribed
            let _ = sqlx::query(
                "UPDATE marketing_campaign_deliveries 
                 SET status = 'unsubscribed', updated_at = NOW() 
                 WHERE id = $1",
            )
            .bind(del.id)
            .execute(pool)
            .await;

            return Ok(contact);
        }

        Ok(None)
    }

    // -------------------------------------------------------------------------
    // Analytics & Metrics
    // -------------------------------------------------------------------------

    pub async fn get_metrics_summary(
        pool: &PgPool,
        entity_id: Option<Uuid>,
    ) -> Result<MarketingMetricsSummary, sqlx::Error> {
        let (total_campaigns, active_campaigns): (i64, i64) = match entity_id {
            Some(ent_id) => {
                let r = sqlx::query(
                    "SELECT 
                        COUNT(*)::bigint AS total,
                        COUNT(CASE WHEN status = 'active' THEN 1 END)::bigint AS active
                     FROM marketing_campaigns WHERE entity_id = $1",
                )
                .bind(ent_id)
                .fetch_one(pool)
                .await?;
                (r.get("total"), r.get("active"))
            }
            None => {
                let r = sqlx::query(
                    "SELECT 
                        COUNT(*)::bigint AS total,
                        COUNT(CASE WHEN status = 'active' THEN 1 END)::bigint AS active
                     FROM marketing_campaigns",
                )
                .fetch_one(pool)
                .await?;
                (r.get("total"), r.get("active"))
            }
        };

        let total_contacts: i64 = match entity_id {
            Some(ent_id) => {
                sqlx::query_scalar("SELECT COUNT(*)::bigint FROM marketing_contacts WHERE entity_id = $1")
                    .bind(ent_id)
                    .fetch_one(pool)
                    .await?
            }
            None => {
                sqlx::query_scalar("SELECT COUNT(*)::bigint FROM marketing_contacts")
                    .fetch_one(pool)
                    .await?
            }
        };

        let delivery_row = match entity_id {
            Some(ent_id) => {
                sqlx::query(
                    "SELECT 
                        COALESCE(SUM(c.total_delivered), 0)::bigint AS delivered,
                        COALESCE(SUM(c.total_opened), 0)::bigint AS opened,
                        COALESCE(SUM(c.total_clicked), 0)::bigint AS clicked
                     FROM marketing_campaigns c WHERE c.entity_id = $1",
                )
                .bind(ent_id)
                .fetch_one(pool)
                .await?
            }
            None => {
                sqlx::query(
                    "SELECT 
                        COALESCE(SUM(total_delivered), 0)::bigint AS delivered,
                        COALESCE(SUM(total_opened), 0)::bigint AS opened,
                        COALESCE(SUM(total_clicked), 0)::bigint AS clicked
                     FROM marketing_campaigns",
                )
                .fetch_one(pool)
                .await?
            }
        };

        let total_sent: i64 = delivery_row.get("delivered");
        let total_opened: i64 = delivery_row.get("opened");
        let total_clicked: i64 = delivery_row.get("clicked");

        let avg_open_rate = if total_sent > 0 {
            (total_opened as f64 / total_sent as f64) * 100.0
        } else {
            0.0
        };

        let avg_click_rate = if total_sent > 0 {
            (total_clicked as f64 / total_sent as f64) * 100.0
        } else {
            0.0
        };

        Ok(MarketingMetricsSummary {
            total_campaigns,
            active_campaigns,
            total_contacts,
            total_sent,
            total_opened,
            total_clicked,
            avg_open_rate,
            avg_click_rate,
        })
    }

    // -------------------------------------------------------------------------
    // Background Campaign Automation Worker Tick
    // -------------------------------------------------------------------------

    pub async fn process_campaign_tick(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
        // 1. Check for scheduled campaigns whose scheduled_at has arrived
        let pending_campaigns: Vec<(Uuid, String)> = sqlx::query_as(
            "SELECT id, name FROM marketing_campaigns 
             WHERE status = 'scheduled' AND scheduled_at <= NOW()",
        )
        .fetch_all(pool)
        .await?;

        for (camp_id, name) in pending_campaigns {
            info!("🚀 Launching scheduled marketing campaign '{}' (id={})", name, camp_id);
            if let Err(e) = Self::dispatch_campaign(pool, camp_id, "http://localhost:8081").await {
                warn!("Failed to dispatch scheduled campaign {}: {}", camp_id, e);
            }
        }

        Ok(())
    }
}
