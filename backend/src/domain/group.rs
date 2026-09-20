use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Group {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub comment: Option<String>,
    pub is_recursive: bool,
    pub is_task: bool,
    pub is_requester: bool,
    pub is_user_group: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GroupSummaryDto {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub entity_name: Option<String>,
    pub name: String,
    pub comment: Option<String>,
    pub is_recursive: bool,
    pub is_task: bool,
    pub is_requester: bool,
    pub is_user_group: bool,
    pub member_count: i64,
    pub manager_count: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GroupMemberDto {
    pub user_id: Uuid,
    pub username: String,
    pub display_name: String,
    pub email: String,
    pub profile_name: String,
    pub is_manager: bool,
    pub is_user: bool,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GroupDetailDto {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub entity_name: Option<String>,
    pub name: String,
    pub comment: Option<String>,
    pub is_recursive: bool,
    pub is_task: bool,
    pub is_requester: bool,
    pub is_user_group: bool,
    pub members: Vec<GroupMemberDto>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateGroupDto {
    pub name: String,
    pub entity_id: Option<Uuid>,
    pub comment: Option<String>,
    pub is_recursive: Option<bool>,
    pub is_task: Option<bool>,
    pub is_requester: Option<bool>,
    pub is_user_group: Option<bool>,
    pub initial_member_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateGroupDto {
    pub name: Option<String>,
    pub entity_id: Option<Uuid>,
    pub comment: Option<String>,
    pub is_recursive: Option<bool>,
    pub is_task: Option<bool>,
    pub is_requester: Option<bool>,
    pub is_user_group: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct AddGroupMemberDto {
    pub user_id: Uuid,
    pub is_manager: Option<bool>,
    pub is_user: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateGroupMemberDto {
    pub is_manager: Option<bool>,
    pub is_user: Option<bool>,
}
