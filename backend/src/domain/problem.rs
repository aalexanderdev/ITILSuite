use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub enum ProblemStatus {
    New,
    Investigation,
    WorkaroundFound,
    KnownError,
    Resolved,
    Closed,
}

impl ProblemStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::New => "new",
            Self::Investigation => "investigation",
            Self::WorkaroundFound => "workaround_found",
            Self::KnownError => "known_error",
            Self::Resolved => "resolved",
            Self::Closed => "closed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "investigation" => Self::Investigation,
            "workaround_found" => Self::WorkaroundFound,
            "known_error" => Self::KnownError,
            "resolved" => Self::Resolved,
            "closed" => Self::Closed,
            _ => Self::New,
        }
    }

    pub fn label_es(&self) -> &'static str {
        match self {
            Self::New => "Nuevo",
            Self::Investigation => "En Investigación",
            Self::WorkaroundFound => "Solución Temporal",
            Self::KnownError => "Error Conocido (KEDB)",
            Self::Resolved => "Resuelto",
            Self::Closed => "Cerrado",
        }
    }

    pub fn badge_class(&self) -> &'static str {
        match self {
            Self::New => "badge-info",
            Self::Investigation => "badge-warning",
            Self::WorkaroundFound => "badge-secondary",
            Self::KnownError => "badge-error",
            Self::Resolved => "badge-success",
            Self::Closed => "badge-neutral",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Problem {
    pub id: Uuid,
    pub problem_number: String,
    pub entity_id: Uuid,
    pub name: String,
    pub content: String,
    pub status: String,
    pub urgency: i32,
    pub impact: i32,
    pub priority: i32,
    pub requester_id: Option<Uuid>,
    pub assigned_technician_id: Option<Uuid>,
    pub assigned_group_id: Option<Uuid>,
    pub category: Option<String>,
    pub symptoms: Option<String>,
    pub root_cause: Option<String>,
    pub workaround: Option<String>,
    pub permanent_solution: Option<String>,
    pub solved_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ProblemSummaryDto {
    pub id: Uuid,
    pub problem_number: String,
    pub entity_id: Uuid,
    pub entity_name: String,
    pub name: String,
    pub content: String,
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
    pub category: Option<String>,
    pub symptoms: Option<String>,
    pub root_cause: Option<String>,
    pub workaround: Option<String>,
    pub permanent_solution: Option<String>,
    pub linked_ticket_count: i64,
    pub linked_asset_count: i64,
    pub linked_change_count: i64,
    pub solved_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ProblemSummaryDto {
    pub fn status_label(&self) -> &'static str {
        ProblemStatus::from_str(&self.status).label_es()
    }

    pub fn status_badge(&self) -> &'static str {
        ProblemStatus::from_str(&self.status).badge_class()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct LinkedTicketDto {
    pub id: Uuid,
    pub ticket_number: String,
    pub name: String,
    pub status: String,
    pub priority: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct LinkedAssetDto {
    pub id: Uuid,
    pub asset_tag: String,
    pub name: String,
    pub asset_type: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct LinkedChangeDto {
    pub id: Uuid,
    pub change_number: String,
    pub name: String,
    pub change_type: String,
    pub status: String,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ProblemFollowup {
    pub id: Uuid,
    pub problem_id: Uuid,
    pub author_id: Option<Uuid>,
    pub content: String,
    pub item_type: String,
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ProblemFollowupDto {
    pub id: Uuid,
    pub problem_id: Uuid,
    pub author_id: Option<Uuid>,
    pub author_name: Option<String>,
    pub content: String,
    pub item_type: String,
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProblemDetailDto {
    #[serde(flatten)]
    pub summary: ProblemSummaryDto,
    pub followups: Vec<ProblemFollowupDto>,
    pub linked_tickets: Vec<LinkedTicketDto>,
    pub linked_assets: Vec<LinkedAssetDto>,
    pub linked_changes: Vec<LinkedChangeDto>,
    pub kedb_article: Option<KedbArticleSummaryDto>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateProblemDto {
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub content: String,
    pub urgency: Option<i32>,
    pub impact: Option<i32>,
    pub assigned_technician_id: Option<Uuid>,
    pub assigned_group_id: Option<Uuid>,
    pub category: Option<String>,
    pub symptoms: Option<String>,
    pub root_cause: Option<String>,
    pub workaround: Option<String>,
    pub permanent_solution: Option<String>,
    pub ticket_ids: Option<Vec<Uuid>>,
    pub asset_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateProblemDto {
    pub name: Option<String>,
    pub content: Option<String>,
    pub status: Option<String>,
    pub urgency: Option<i32>,
    pub impact: Option<i32>,
    pub assigned_technician_id: Option<Uuid>,
    pub assigned_group_id: Option<Uuid>,
    pub category: Option<String>,
    pub symptoms: Option<String>,
    pub root_cause: Option<String>,
    pub workaround: Option<String>,
    pub permanent_solution: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateProblemFollowupDto {
    pub content: String,
    pub item_type: Option<String>, // 'followup', 'rca_note', 'workaround', 'solution'
    pub is_private: Option<bool>,
}

// ============================================================================
// Known Error Database (KEDB)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct KedbArticle {
    pub id: Uuid,
    pub kedb_number: String,
    pub entity_id: Uuid,
    pub problem_id: Option<Uuid>,
    pub title: String,
    pub category: Option<String>,
    pub error_symptoms: String,
    pub root_cause: String,
    pub workaround: String,
    pub permanent_solution: Option<String>,
    pub author_id: Option<Uuid>,
    pub status: String,
    pub view_count: i32,
    pub is_public_kb: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct KedbArticleSummaryDto {
    pub id: Uuid,
    pub kedb_number: String,
    pub entity_id: Uuid,
    pub entity_name: String,
    pub problem_id: Option<Uuid>,
    pub problem_number: Option<String>,
    pub problem_name: Option<String>,
    pub title: String,
    pub category: Option<String>,
    pub error_symptoms: String,
    pub root_cause: String,
    pub workaround: String,
    pub permanent_solution: Option<String>,
    pub author_id: Option<Uuid>,
    pub author_name: Option<String>,
    pub status: String,
    pub view_count: i32,
    pub is_public_kb: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateKedbArticleDto {
    pub entity_id: Option<Uuid>,
    pub problem_id: Option<Uuid>,
    pub title: String,
    pub category: Option<String>,
    pub error_symptoms: String,
    pub root_cause: String,
    pub workaround: String,
    pub permanent_solution: Option<String>,
    pub is_public_kb: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateKedbArticleDto {
    pub title: Option<String>,
    pub category: Option<String>,
    pub error_symptoms: Option<String>,
    pub root_cause: Option<String>,
    pub workaround: Option<String>,
    pub permanent_solution: Option<String>,
    pub status: Option<String>,
    pub is_public_kb: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_problem_status_conversions() {
        assert_eq!(ProblemStatus::from_str("new"), ProblemStatus::New);
        assert_eq!(ProblemStatus::from_str("investigation"), ProblemStatus::Investigation);
        assert_eq!(ProblemStatus::from_str("workaround_found"), ProblemStatus::WorkaroundFound);
        assert_eq!(ProblemStatus::from_str("known_error"), ProblemStatus::KnownError);
        assert_eq!(ProblemStatus::from_str("resolved"), ProblemStatus::Resolved);
        assert_eq!(ProblemStatus::from_str("closed"), ProblemStatus::Closed);
        assert_eq!(ProblemStatus::from_str("unknown"), ProblemStatus::New);

        assert_eq!(ProblemStatus::KnownError.as_str(), "known_error");
        assert_eq!(ProblemStatus::KnownError.label_es(), "Error Conocido (KEDB)");
    }
}
