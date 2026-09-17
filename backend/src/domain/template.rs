use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct TicketTemplate {
    pub id: Uuid,
    pub entity_id: Uuid,
    #[sqlx(default)]
    pub entity_name: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub ticket_type: String,
    pub category: Option<String>,
    pub predefined_title: Option<String>,
    pub predefined_content: Option<String>,
    pub predefined_urgency: Option<i32>,
    pub predefined_impact: Option<i32>,
    pub default_technician_id: Option<Uuid>,
    #[sqlx(default)]
    pub default_technician_name: Option<String>,
    pub mandatory_fields: serde_json::Value,
    pub hidden_fields: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateTicketTemplateDto {
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub ticket_type: Option<String>,
    pub category: Option<String>,
    pub predefined_title: Option<String>,
    pub predefined_content: Option<String>,
    pub predefined_urgency: Option<i32>,
    pub predefined_impact: Option<i32>,
    pub default_technician_id: Option<Uuid>,
    pub mandatory_fields: Option<Vec<String>>,
    pub hidden_fields: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateTicketTemplateDto {
    pub name: Option<String>,
    pub description: Option<String>,
    pub ticket_type: Option<String>,
    pub category: Option<String>,
    pub predefined_title: Option<String>,
    pub predefined_content: Option<String>,
    pub predefined_urgency: Option<i32>,
    pub predefined_impact: Option<i32>,
    pub default_technician_id: Option<Uuid>,
    pub mandatory_fields: Option<Vec<String>>,
    pub hidden_fields: Option<Vec<String>>,
    pub is_active: Option<bool>,
}

impl TicketTemplate {
    pub fn is_field_mandatory(&self, field_name: &str) -> bool {
        if let Some(arr) = self.mandatory_fields.as_array() {
            arr.iter().any(|v| v.as_str() == Some(field_name))
        } else {
            false
        }
    }

    pub fn is_field_hidden(&self, field_name: &str) -> bool {
        if let Some(arr) = self.hidden_fields.as_array() {
            arr.iter().any(|v| v.as_str() == Some(field_name))
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_template_rules_evaluation() {
        let template = TicketTemplate {
            id: Uuid::new_v4(),
            entity_id: Uuid::new_v4(),
            entity_name: Some("Root Entity".to_string()),
            name: "Test Hardware Template".to_string(),
            description: Some("Description".to_string()),
            ticket_type: "incident".to_string(),
            category: Some("Hardware / Equipos".to_string()),
            predefined_title: Some("[HARDWARE]: ".to_string()),
            predefined_content: Some("Details here".to_string()),
            predefined_urgency: Some(3),
            predefined_impact: Some(3),
            default_technician_id: None,
            default_technician_name: None,
            mandatory_fields: json!(["content", "urgency"]),
            hidden_fields: json!(["assigned_technician_id"]),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert!(template.is_field_mandatory("content"));
        assert!(template.is_field_mandatory("urgency"));
        assert!(!template.is_field_mandatory("impact"));

        assert!(template.is_field_hidden("assigned_technician_id"));
        assert!(!template.is_field_hidden("content"));
    }
}
