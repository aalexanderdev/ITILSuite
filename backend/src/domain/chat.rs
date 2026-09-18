use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", content = "payload")]
pub enum WsEvent {
    #[serde(rename = "new_message")]
    NewMessage(ChatMessageDto),
    #[serde(rename = "user_typing")]
    UserTyping {
        conversation_id: Uuid,
        user_id: Uuid,
        username: String,
    },
    #[serde(rename = "reaction_updated")]
    ReactionUpdated {
        message_id: Uuid,
        reactions: Vec<MessageReactionSummaryDto>,
    },
    #[serde(rename = "presence_updated")]
    PresenceUpdated {
        user_id: Uuid,
        status: String,
        last_seen: DateTime<Utc>,
    },
    #[serde(rename = "ticket_converted")]
    TicketConverted {
        message_id: Uuid,
        ticket_id: Uuid,
        ticket_number: String,
        ticket_name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ConversationSummaryDto {
    pub id: Uuid,
    pub entity_id: Uuid,
    pub name: String,
    pub is_group: bool,
    pub is_self: bool,
    pub is_featured: bool,
    pub unread_count: i64,
    pub last_message: Option<String>,
    pub last_message_time: Option<DateTime<Utc>>,
    pub is_online: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateConversationDto {
    pub name: Option<String>,
    pub is_group: Option<bool>,
    pub participant_ids: Vec<Uuid>,
    pub entity_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ChatMemberDto {
    pub id: Uuid,
    pub username: String,
    pub display_name: String,
    pub email: String,
    pub is_online: bool,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MessageReactionSummaryDto {
    pub emoji: String,
    pub count: i64,
    pub user_reacted: bool,
    pub user_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ChatMessageDto {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub user_id: Option<Uuid>,
    pub sender_name: String,
    pub sender_username: Option<String>,
    pub content: String,
    pub link_url: Option<String>,
    pub attachment_name: Option<String>,
    pub attachment_url: Option<String>,
    pub attachment_size: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub is_self: bool,
    pub reactions: Vec<MessageReactionSummaryDto>,
    pub converted_ticket_id: Option<Uuid>,
    pub converted_ticket_number: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SendMessageDto {
    pub content: String,
    pub link_url: Option<String>,
    pub attachment_name: Option<String>,
    pub attachment_url: Option<String>,
    pub attachment_size: Option<i64>,
    pub attachment_mime: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ToggleReactionDto {
    pub emoji: String,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ConvertToTicketRequestDto {
    pub name: String,
    pub category: Option<String>,
    pub urgency: Option<i32>,
    pub impact: Option<i32>,
    pub content_override: Option<String>,
    pub entity_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ConvertToTicketResponseDto {
    pub ticket_id: Uuid,
    pub ticket_number: String,
    pub message_id: Uuid,
    pub notice_message_id: Uuid,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct PresenceHeartbeatDto {
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct OnlineUserDto {
    pub user_id: Uuid,
    pub username: String,
    pub display_name: String,
    pub email: String,
    pub status: String,
    pub last_seen: DateTime<Utc>,
    pub active_seconds: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionIntervalDto {
    pub id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub display_name: String,
    pub session_date: NaiveDate,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub duration_seconds: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ChatDashboardMetricsDto {
    pub total_messages: i64,
    pub daily_avg_messages: f64,
    pub group_messages_pct: f64,
    pub online_users_count: i64,
    pub daily_active_users_avg: f64,
    pub daily_online_seconds_avg: i64,
    pub recent_intervals: Vec<SessionIntervalDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ChatSettingsDto {
    pub launcher_color: String,
    pub bubble_color: String,
    pub panel_width_px: i32,
    pub max_message_length: i32,
    pub ticket_conversion_enabled: bool,
    pub allow_attachments: bool,
    pub max_attachment_size_mb: i32,
    pub auto_notify_ticket_events: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ShortcutButtonDto {
    pub id: Uuid,
    pub label: String,
    pub url: String,
    pub is_active: bool,
    pub ranking: i32,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateShortcutButtonDto {
    pub label: String,
    pub url: String,
    pub is_active: Option<bool>,
    pub ranking: Option<i32>,
    pub entity_id: Option<Uuid>,
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn test_ws_event_serialization() {
        let msg = ChatMessageDto {
            id: Uuid::new_v4(),
            conversation_id: Uuid::new_v4(),
            user_id: Some(Uuid::new_v4()),
            sender_name: "Técnico ITIL".to_string(),
            sender_username: Some("tech1".to_string()),
            content: "Hola mundo :rocket:".to_string(),
            link_url: None,
            attachment_name: None,
            attachment_url: None,
            attachment_size: None,
            created_at: Utc::now(),
            is_self: false,
            reactions: vec![MessageReactionSummaryDto {
                emoji: "👍".to_string(),
                count: 2,
                user_reacted: true,
                user_names: vec!["Admin".to_string(), "Tech".to_string()],
            }],
            converted_ticket_id: None,
            converted_ticket_number: None,
        };

        let event = WsEvent::NewMessage(msg.clone());
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"new_message\""));
        assert!(json.contains("Hola mundo :rocket:"));

        let typing = WsEvent::UserTyping {
            conversation_id: msg.conversation_id,
            user_id: Uuid::new_v4(),
            username: "juan_tech".to_string(),
        };
        let typing_json = serde_json::to_string(&typing).unwrap();
        assert!(typing_json.contains("\"type\":\"user_typing\""));
        assert!(typing_json.contains("juan_tech"));

        let converted = WsEvent::TicketConverted {
            message_id: msg.id,
            ticket_id: Uuid::new_v4(),
            ticket_number: "INC-2026-99999".to_string(),
            ticket_name: "Falla de red".to_string(),
        };
        let conv_json = serde_json::to_string(&converted).unwrap();
        assert!(conv_json.contains("\"type\":\"ticket_converted\""));
        assert!(conv_json.contains("INC-2026-99999"));
        assert!(conv_json.contains("Falla de red"));
    }

    #[test]
    fn test_chat_settings_default_values() {
        let settings = ChatSettingsDto {
            launcher_color: "#eb4d3d".to_string(),
            bubble_color: "#eb4d3d".to_string(),
            panel_width_px: 360,
            max_message_length: 2000,
            ticket_conversion_enabled: true,
            allow_attachments: true,
            max_attachment_size_mb: 10,
            auto_notify_ticket_events: true,
        };
        assert_eq!(settings.max_message_length, 2000);
        assert_eq!(settings.launcher_color, "#eb4d3d");
        assert!(settings.ticket_conversion_enabled);
        assert!(settings.auto_notify_ticket_events);
    }
}


