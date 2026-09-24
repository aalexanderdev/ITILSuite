use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
pub enum ContactStage {
    Lead,
    Prospect,
    Customer,
    Champion,
    Inactive,
}

impl ContactStage {
    pub fn as_str(&self) -> &'static str {
        match self {
            ContactStage::Lead => "lead",
            ContactStage::Prospect => "prospect",
            ContactStage::Customer => "customer",
            ContactStage::Champion => "champion",
            ContactStage::Inactive => "inactive",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "prospect" => ContactStage::Prospect,
            "customer" => ContactStage::Customer,
            "champion" => ContactStage::Champion,
            "inactive" => ContactStage::Inactive,
            _ => ContactStage::Lead,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
pub enum CampaignStatus {
    Draft,
    Scheduled,
    Active,
    Paused,
    Completed,
}

impl CampaignStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            CampaignStatus::Draft => "draft",
            CampaignStatus::Scheduled => "scheduled",
            CampaignStatus::Active => "active",
            CampaignStatus::Paused => "paused",
            CampaignStatus::Completed => "completed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "scheduled" => CampaignStatus::Scheduled,
            "active" => CampaignStatus::Active,
            "paused" => CampaignStatus::Paused,
            "completed" => CampaignStatus::Completed,
            _ => CampaignStatus::Draft,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
pub enum CampaignType {
    Broadcast,
    DripSequence,
    EventTriggered,
}

impl CampaignType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CampaignType::Broadcast => "broadcast",
            CampaignType::DripSequence => "drip_sequence",
            CampaignType::EventTriggered => "event_triggered",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "drip_sequence" => CampaignType::DripSequence,
            "event_triggered" => CampaignType::EventTriggered,
            _ => CampaignType::Broadcast,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
pub enum DeliveryStatus {
    Pending,
    Sent,
    Opened,
    Clicked,
    Bounced,
    Unsubscribed,
}

impl DeliveryStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            DeliveryStatus::Pending => "pending",
            DeliveryStatus::Sent => "sent",
            DeliveryStatus::Opened => "opened",
            DeliveryStatus::Clicked => "clicked",
            DeliveryStatus::Bounced => "bounced",
            DeliveryStatus::Unsubscribed => "unsubscribed",
        }
    }
}

// -----------------------------------------------------------------------------
// Database Entities
// -----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MarketingContact {
    pub id: Uuid,
    pub entity_id: Uuid,
    pub user_id: Option<Uuid>,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub company: String,
    pub phone: String,
    pub stage: String,
    pub points: i32,
    pub tags: Vec<String>,
    pub is_unsubscribed: bool,
    pub unsubscribed_at: Option<DateTime<Utc>>,
    pub custom_attributes: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MarketingSegment {
    pub id: Uuid,
    pub entity_id: Uuid,
    pub name: String,
    pub description: String,
    pub is_dynamic: bool,
    pub filter_criteria: serde_json::Value,
    pub cached_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MarketingEmail {
    pub id: Uuid,
    pub entity_id: Uuid,
    pub name: String,
    pub subject: String,
    pub body_html: String,
    pub body_text: String,
    pub from_name: String,
    pub from_email: String,
    pub reply_to: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MarketingCampaign {
    pub id: Uuid,
    pub entity_id: Uuid,
    pub name: String,
    pub description: String,
    pub segment_id: Option<Uuid>,
    pub email_id: Option<Uuid>,
    pub campaign_type: String,
    pub status: String,
    pub workflow_graph: serde_json::Value,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub total_recipients: i32,
    pub total_delivered: i32,
    pub total_opened: i32,
    pub total_clicked: i32,
    pub total_bounced: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CampaignDelivery {
    pub id: Uuid,
    pub campaign_id: Uuid,
    pub contact_id: Uuid,
    pub tracking_token: String,
    pub status: String,
    pub sent_at: Option<DateTime<Utc>>,
    pub opened_at: Option<DateTime<Utc>>,
    pub clicked_at: Option<DateTime<Utc>>,
    pub open_count: i32,
    pub click_count: i32,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LinkClick {
    pub id: Uuid,
    pub delivery_id: Uuid,
    pub target_url: String,
    pub ip_address: String,
    pub user_agent: String,
    pub clicked_at: DateTime<Utc>,
}

// -----------------------------------------------------------------------------
// DTOs & Summaries
// -----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateContactDto {
    pub entity_id: Option<Uuid>,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub company: Option<String>,
    pub phone: Option<String>,
    pub stage: Option<String>,
    pub points: Option<i32>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSegmentDto {
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub is_dynamic: Option<bool>,
    pub filter_criteria: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateEmailTemplateDto {
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub subject: String,
    pub body_html: String,
    pub body_text: Option<String>,
    pub from_name: Option<String>,
    pub from_email: Option<String>,
    pub reply_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCampaignDto {
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub segment_id: Option<Uuid>,
    pub email_id: Option<Uuid>,
    pub campaign_type: Option<String>,
    pub scheduled_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MarketingMetricsSummary {
    pub total_campaigns: i64,
    pub active_campaigns: i64,
    pub total_contacts: i64,
    pub total_sent: i64,
    pub total_opened: i64,
    pub total_clicked: i64,
    pub avg_open_rate: f64,
    pub avg_click_rate: f64,
}

// -----------------------------------------------------------------------------
// Template Interpolation & Tracking Engine
// -----------------------------------------------------------------------------

/// Renders a marketing email by replacing macros and injecting tracking pixel & wrapped links
pub fn render_marketing_email(
    raw_html: &str,
    contact: &MarketingContact,
    tracking_token: &str,
    base_url: &str,
) -> String {
    let clean_base = base_url.trim_end_matches('/');

    let unsubscribe_url = format!("{}/m/unsubscribe/{}", clean_base, tracking_token);
    let pixel_url = format!("{}/m/pixel/{}.png", clean_base, tracking_token);
    let pixel_img_tag = format!(
        r#"<img src="{}" width="1" height="1" style="display:none !important;" alt="" />"#,
        pixel_url
    );

    // 1. Substitute Contact & System Tags
    let mut rendered = raw_html
        .replace("{{contact.first_name}}", &contact.first_name)
        .replace("{{contact.last_name}}", &contact.last_name)
        .replace("{{contact.company}}", &contact.company)
        .replace("{{contact.email}}", &contact.email)
        .replace("{{contact.phone}}", &contact.phone)
        .replace("{{contact.points}}", &contact.points.to_string())
        .replace("{{contact.stage}}", &contact.stage)
        .replace("{{unsubscribe_url}}", &unsubscribe_url);

    // 2. Wrap Links for Click Tracking: <a href="http..."> -> <a href="{base_url}/m/click/{token}?url=...">
    let link_re = Regex::new(r#"<a\s+([^>]*?)href=["'](https?://[^"']+)["']([^>]*)>"#).unwrap();
    rendered = link_re
        .replace_all(&rendered, |caps: &regex::Captures| {
            let before = &caps[1];
            let target_url = &caps[2];
            let after = &caps[3];

            // Don't wrap unsubscribe or internal tracking URLs
            if target_url.contains("/m/unsubscribe") || target_url.contains("/m/pixel") {
                format!(r#"<a {}href="{}"{}>"#, before, target_url, after)
            } else {
                let encoded_url = urlencoding::encode(target_url);
                let click_tracker = format!("{}/m/click/{}?url={}", clean_base, tracking_token, encoded_url);
                format!(r#"<a {}href="{}"{}>"#, before, click_tracker, after)
            }
        })
        .to_string();

    // 3. Inject Pixel
    if rendered.contains("{{tracking_pixel}}") {
        rendered = rendered.replace("{{tracking_pixel}}", &pixel_img_tag);
    } else if rendered.contains("</body>") {
        rendered = rendered.replace("</body>", &format!("{}\n</body>", pixel_img_tag));
    } else {
        rendered.push_str(&format!("\n{}", pixel_img_tag));
    }

    rendered
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_marketing_email_macros_and_pixel() {
        let contact = MarketingContact {
            id: Uuid::new_v4(),
            entity_id: Uuid::new_v4(),
            user_id: None,
            email: "ana.torres@acme.com".to_string(),
            first_name: "Ana".to_string(),
            last_name: "Torres".to_string(),
            company: "Acme Corp".to_string(),
            phone: "+54 11 5555-0100".to_string(),
            stage: "customer".to_string(),
            points: 75,
            tags: vec!["vip".to_string()],
            is_unsubscribed: false,
            unsubscribed_at: None,
            custom_attributes: serde_json::json!({}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let template = r#"
            <h1>Hola {{contact.first_name}} {{contact.last_name}}</h1>
            <p>Empresa: {{contact.company}} | Puntos: {{contact.points}}</p>
            <p><a href="https://itilsuite.local/portal">Ir al Portal</a></p>
            <p><a href="{{unsubscribe_url}}">Darse de baja</a></p>
            {{tracking_pixel}}
        "#;

        let rendered = render_marketing_email(template, &contact, "tok_test_123", "http://localhost:8081");

        assert!(rendered.contains("Hola Ana Torres"));
        assert!(rendered.contains("Empresa: Acme Corp | Puntos: 75"));
        assert!(rendered.contains("http://localhost:8081/m/unsubscribe/tok_test_123"));
        assert!(rendered.contains("http://localhost:8081/m/pixel/tok_test_123.png"));
        // Link tracking redirection
        assert!(rendered.contains("http://localhost:8081/m/click/tok_test_123?url=https%3A%2F%2Fitilsuite.local%2Fportal"));
    }

    #[test]
    fn test_contact_stage_conversion() {
        assert_eq!(ContactStage::from_str("LEAD"), ContactStage::Lead);
        assert_eq!(ContactStage::from_str("prospect"), ContactStage::Prospect);
        assert_eq!(ContactStage::from_str("customer"), ContactStage::Customer);
        assert_eq!(ContactStage::from_str("champion"), ContactStage::Champion);
        assert_eq!(ContactStage::from_str("unknown"), ContactStage::Lead);
    }
}
