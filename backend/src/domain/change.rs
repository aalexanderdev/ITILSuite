use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub enum ChangeType {
    Standard,
    Normal,
    Emergency,
}

impl ChangeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Standard => "standard",
            Self::Normal => "normal",
            Self::Emergency => "emergency",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "standard" => Self::Standard,
            "emergency" => Self::Emergency,
            _ => Self::Normal,
        }
    }

    pub fn label_es(&self) -> &'static str {
        match self {
            Self::Standard => "Estándar (Preaprobado)",
            Self::Normal => "Normal (Requiere CAB)",
            Self::Emergency => "Emergencia (ECAB)",
        }
    }

    pub fn badge_class(&self) -> &'static str {
        match self {
            Self::Standard => "badge-info",
            Self::Normal => "badge-secondary",
            Self::Emergency => "badge-error",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub enum ChangeStatus {
    Draft,
    Evaluation,
    CabReview,
    Scheduled,
    Implementing,
    Review,
    Closed,
    Rejected,
}

impl ChangeStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Evaluation => "evaluation",
            Self::CabReview => "cab_review",
            Self::Scheduled => "scheduled",
            Self::Implementing => "implementing",
            Self::Review => "review",
            Self::Closed => "closed",
            Self::Rejected => "rejected",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "evaluation" => Self::Evaluation,
            "cab_review" => Self::CabReview,
            "scheduled" => Self::Scheduled,
            "implementing" => Self::Implementing,
            "review" => Self::Review,
            "closed" => Self::Closed,
            "rejected" => Self::Rejected,
            _ => Self::Draft,
        }
    }

    pub fn label_es(&self) -> &'static str {
        match self {
            Self::Draft => "Borrador",
            Self::Evaluation => "En Evaluación Técnica",
            Self::CabReview => "Revisión del CAB",
            Self::Scheduled => "Programado / Aprobado",
            Self::Implementing => "En Ejecución",
            Self::Review => "Revisión Post-Cambio (PIR)",
            Self::Closed => "Cerrado Exitoso",
            Self::Rejected => "Rechazado",
        }
    }

    pub fn badge_class(&self) -> &'static str {
        match self {
            Self::Draft => "badge-neutral",
            Self::Evaluation => "badge-info",
            Self::CabReview => "badge-warning",
            Self::Scheduled => "badge-primary",
            Self::Implementing => "badge-secondary",
            Self::Review => "badge-accent",
            Self::Closed => "badge-success",
            Self::Rejected => "badge-error",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Rejected,
    MoreInfoNeeded,
}

impl ApprovalStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Approved => "approved",
            Self::Rejected => "rejected",
            Self::MoreInfoNeeded => "more_info_needed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "approved" => Self::Approved,
            "rejected" => Self::Rejected,
            "more_info_needed" => Self::MoreInfoNeeded,
            _ => Self::Pending,
        }
    }

    pub fn label_es(&self) -> &'static str {
        match self {
            Self::Pending => "Pendiente",
            Self::Approved => "Aprobado",
            Self::Rejected => "Rechazado",
            Self::MoreInfoNeeded => "Requiere Información",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Change {
    pub id: Uuid,
    pub change_number: String,
    pub entity_id: Uuid,
    pub name: String,
    pub content: String,
    pub change_type: String,
    pub status: String,
    pub urgency: i32,
    pub impact: i32,
    pub priority: i32,
    pub risk_level: String,
    pub requester_id: Option<Uuid>,
    pub assigned_technician_id: Option<Uuid>,
    pub assigned_group_id: Option<Uuid>,
    pub category: Option<String>,
    pub impact_assessment: Option<String>,
    pub implementation_plan: Option<String>,
    pub test_plan: Option<String>,
    pub rollback_plan: Option<String>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub actual_start: Option<DateTime<Utc>>,
    pub actual_end: Option<DateTime<Utc>>,
    pub pir_notes: Option<String>,
    pub closed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ChangeSummaryDto {
    pub id: Uuid,
    pub change_number: String,
    pub entity_id: Uuid,
    pub entity_name: String,
    pub name: String,
    pub content: String,
    pub change_type: String,
    pub status: String,
    pub urgency: i32,
    pub impact: i32,
    pub priority: i32,
    pub risk_level: String,
    pub requester_id: Option<Uuid>,
    pub requester_name: Option<String>,
    pub assigned_technician_id: Option<Uuid>,
    pub assigned_technician_name: Option<String>,
    pub assigned_group_id: Option<Uuid>,
    pub assigned_group_name: Option<String>,
    pub category: Option<String>,
    pub impact_assessment: Option<String>,
    pub implementation_plan: Option<String>,
    pub test_plan: Option<String>,
    pub rollback_plan: Option<String>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub actual_start: Option<DateTime<Utc>>,
    pub actual_end: Option<DateTime<Utc>>,
    pub pir_notes: Option<String>,
    pub cab_total_approvers: i64,
    pub cab_approved_count: i64,
    pub cab_rejected_count: i64,
    pub cab_pending_count: i64,
    pub linked_ticket_count: i64,
    pub linked_problem_count: i64,
    pub linked_asset_count: i64,
    pub closed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ChangeSummaryDto {
    pub fn status_label(&self) -> &'static str {
        ChangeStatus::from_str(&self.status).label_es()
    }

    pub fn status_badge(&self) -> &'static str {
        ChangeStatus::from_str(&self.status).badge_class()
    }

    pub fn type_label(&self) -> &'static str {
        ChangeType::from_str(&self.change_type).label_es()
    }

    pub fn type_badge(&self) -> &'static str {
        ChangeType::from_str(&self.change_type).badge_class()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ChangeApproval {
    pub id: Uuid,
    pub change_id: Uuid,
    pub approver_id: Uuid,
    pub approval_status: String,
    pub comments: Option<String>,
    pub decided_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ChangeApprovalDto {
    pub id: Uuid,
    pub change_id: Uuid,
    pub approver_id: Uuid,
    pub approver_name: Option<String>,
    pub approver_email: Option<String>,
    pub approval_status: String,
    pub comments: Option<String>,
    pub decided_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl ChangeApprovalDto {
    pub fn status_label(&self) -> &'static str {
        ApprovalStatus::from_str(&self.approval_status).label_es()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ChangeFollowup {
    pub id: Uuid,
    pub change_id: Uuid,
    pub author_id: Option<Uuid>,
    pub content: String,
    pub item_type: String,
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ChangeFollowupDto {
    pub id: Uuid,
    pub change_id: Uuid,
    pub author_id: Option<Uuid>,
    pub author_name: Option<String>,
    pub content: String,
    pub item_type: String,
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ChangeDetailDto {
    #[serde(flatten)]
    pub summary: ChangeSummaryDto,
    pub approvals: Vec<ChangeApprovalDto>,
    pub followups: Vec<ChangeFollowupDto>,
    pub linked_tickets: Vec<crate::domain::problem::LinkedTicketDto>,
    pub linked_problems: Vec<crate::domain::problem::ProblemSummaryDto>,
    pub linked_assets: Vec<crate::domain::problem::LinkedAssetDto>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateChangeDto {
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub content: String,
    pub change_type: Option<String>, // 'standard', 'normal', 'emergency'
    pub urgency: Option<i32>,
    pub impact: Option<i32>,
    pub risk_level: Option<String>, // 'very_low', 'low', 'medium', 'high', 'critical'
    pub assigned_technician_id: Option<Uuid>,
    pub assigned_group_id: Option<Uuid>,
    pub category: Option<String>,
    pub impact_assessment: Option<String>,
    pub implementation_plan: Option<String>,
    pub test_plan: Option<String>,
    pub rollback_plan: Option<String>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub cab_approver_ids: Option<Vec<Uuid>>,
    pub problem_ids: Option<Vec<Uuid>>,
    pub ticket_ids: Option<Vec<Uuid>>,
    pub asset_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateChangeDto {
    pub name: Option<String>,
    pub content: Option<String>,
    pub change_type: Option<String>,
    pub status: Option<String>,
    pub urgency: Option<i32>,
    pub impact: Option<i32>,
    pub risk_level: Option<String>,
    pub assigned_technician_id: Option<Uuid>,
    pub assigned_group_id: Option<Uuid>,
    pub category: Option<String>,
    pub impact_assessment: Option<String>,
    pub implementation_plan: Option<String>,
    pub test_plan: Option<String>,
    pub rollback_plan: Option<String>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub actual_start: Option<DateTime<Utc>>,
    pub actual_end: Option<DateTime<Utc>>,
    pub pir_notes: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SubmitCabVoteDto {
    pub approval_status: String, // 'approved', 'rejected', 'more_info_needed'
    pub comments: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateChangeFollowupDto {
    pub content: String,
    pub item_type: Option<String>, // 'followup', 'cab_minute', 'execution_log', 'pir_note'
    pub is_private: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_change_types_and_statuses() {
        assert_eq!(ChangeType::from_str("standard"), ChangeType::Standard);
        assert_eq!(ChangeType::from_str("emergency"), ChangeType::Emergency);
        assert_eq!(ChangeType::from_str("normal"), ChangeType::Normal);

        assert_eq!(ChangeStatus::from_str("cab_review"), ChangeStatus::CabReview);
        assert_eq!(ChangeStatus::CabReview.label_es(), "Revisión del CAB");

        assert_eq!(ApprovalStatus::from_str("approved"), ApprovalStatus::Approved);
        assert_eq!(ApprovalStatus::Approved.label_es(), "Aprobado");
    }
}
