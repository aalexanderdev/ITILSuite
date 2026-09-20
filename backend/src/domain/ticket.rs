use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

/// Calculate Priority according to the standard ITIL 5x5 Urgency x Impact Matrix.
/// Output scale: 1 (Very Low), 2 (Low), 3 (Medium), 4 (High), 5 (Major / Critical)
pub fn calculate_priority(urgency: i32, impact: i32) -> i32 {
    let u = urgency.clamp(1, 5) as usize;
    let i = impact.clamp(1, 5) as usize;

    // Rows: Urgency 1..5, Columns: Impact 1..5
    const MATRIX: [[i32; 5]; 5] = [
        [1, 1, 2, 3, 4], // Urgency 1: Very Low
        [1, 2, 2, 3, 4], // Urgency 2: Low
        [2, 2, 3, 4, 5], // Urgency 3: Medium
        [3, 3, 4, 5, 5], // Urgency 4: High
        [4, 4, 5, 5, 5], // Urgency 5: Very High / Critical
    ];

    MATRIX[u - 1][i - 1]
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Ticket {
    pub id: Uuid,
    pub ticket_number: String,
    pub entity_id: Uuid,
    pub name: String,
    pub content: String,
    pub ticket_type: String,
    pub status: String,
    pub urgency: i32,
    pub impact: i32,
    pub priority: i32,
    pub requester_id: Option<Uuid>,
    pub assigned_technician_id: Option<Uuid>,
    pub assigned_group_id: Option<Uuid>,
    pub requester_group_id: Option<Uuid>,
    pub category: Option<String>,
    pub sla_id: Option<Uuid>,
    pub time_to_own: Option<DateTime<Utc>>,
    pub time_to_resolve: Option<DateTime<Utc>>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub sla_tto_status: String,
    pub sla_ttr_status: String,
    pub solved_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct TicketSummaryDto {
    pub id: Uuid,
    pub ticket_number: String,
    pub entity_id: Uuid,
    pub entity_name: String,
    pub name: String,
    pub content: String,
    pub ticket_type: String,
    pub status: String,
    pub urgency: i32,
    pub impact: i32,
    pub priority: i32,
    pub requester_id: Option<Uuid>,
    pub requester_name: Option<String>,
    pub assigned_technician_id: Option<Uuid>,
    pub assigned_technician_name: Option<String>,
    pub assigned_group_id: Option<Uuid>,
    pub assigned_group_name: Option<String>,
    pub requester_group_id: Option<Uuid>,
    pub requester_group_name: Option<String>,
    pub category: Option<String>,
    pub sla_id: Option<Uuid>,
    pub sla_name: Option<String>,
    pub time_to_own: Option<DateTime<Utc>>,
    pub time_to_resolve: Option<DateTime<Utc>>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub sla_tto_status: String,
    pub sla_ttr_status: String,
    pub solved_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct TicketFollowup {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub author_id: Option<Uuid>,
    pub content: String,
    pub item_type: String,
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct TicketFollowupDto {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub author_id: Option<Uuid>,
    pub author_name: Option<String>,
    pub content: String,
    pub item_type: String,
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TicketDetailDto {
    #[serde(flatten)]
    pub summary: TicketSummaryDto,
    pub followups: Vec<TicketFollowupDto>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateTicketDto {
    /// Subject/Title of the Incident or Service Request
    pub name: String,
    /// Detailed description of the problem or request
    pub content: String,
    /// 'incident' or 'request' (default: 'incident')
    pub ticket_type: Option<String>,
    /// Urgency (1..5, default: 3)
    pub urgency: Option<i32>,
    /// Impact (1..5, default: 3)
    pub impact: Option<i32>,
    /// Target organizational entity ID
    pub entity_id: Option<Uuid>,
    /// Assigned technician user ID for dispatch
    pub assigned_technician_id: Option<Uuid>,
    /// Assigned transversal group ID for dispatch
    pub assigned_group_id: Option<Uuid>,
    /// Requester transversal group ID
    pub requester_group_id: Option<Uuid>,
    /// Category (e.g. Hardware, Software, Redes, Accesos)
    pub category: Option<String>,
    /// Optional SLA Profile ID override
    pub sla_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateTicketDto {
    pub name: Option<String>,
    pub content: Option<String>,
    /// New status: 'new', 'assigned', 'planned', 'pending', 'solved', 'closed'
    pub status: Option<String>,
    pub urgency: Option<i32>,
    pub impact: Option<i32>,
    pub assigned_technician_id: Option<Uuid>,
    pub assigned_group_id: Option<Uuid>,
    pub requester_group_id: Option<Uuid>,
    pub category: Option<String>,
    pub sla_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateFollowupDto {
    /// Followup text, task notes or resolution details
    pub content: String,
    /// 'followup', 'task', or 'solution' (default: 'followup')
    pub item_type: Option<String>,
    /// Whether this note is only visible to technicians
    pub is_private: Option<bool>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TicketMetricsDto {
    pub total_open: i64,
    pub incidents_count: i64,
    pub requests_count: i64,
    pub sla_at_risk_count: i64,
    pub sla_breached_count: i64,
    pub solved_count: i64,
    pub closed_count: i64,
    pub average_priority: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_itil_priority_matrix_calculations() {
        // High Urgency + High Impact -> Priority 5 (Major/Critical)
        assert_eq!(calculate_priority(5, 5), 5);
        assert_eq!(calculate_priority(5, 4), 5);
        assert_eq!(calculate_priority(4, 5), 5);

        // Low Urgency + Low Impact -> Priority 1 (Very Low)
        assert_eq!(calculate_priority(1, 1), 1);
        assert_eq!(calculate_priority(1, 2), 1);
        assert_eq!(calculate_priority(2, 1), 1);

        // Medium Urgency + Medium Impact -> Priority 3 (Medium)
        assert_eq!(calculate_priority(3, 3), 3);

        // Clamping check for inputs outside 1..5
        assert_eq!(calculate_priority(0, 10), 4);
        assert_eq!(calculate_priority(-2, -5), 1);
    }
}
