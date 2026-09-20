use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub email: String,
    pub realname: String,
    pub firstname: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Profile {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub rights: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserSummaryDto {
    pub id: Uuid,
    pub username: String,
    pub display_name: String,
    pub email: String,
    pub profile_name: String,
    pub is_active: bool,
    pub groups: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserGroupMembershipDto {
    pub group_id: Uuid,
    pub group_name: String,
    pub is_manager: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserDetailDto {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub realname: String,
    pub firstname: String,
    pub display_name: String,
    pub is_active: bool,
    pub profile_name: String,
    pub profile_id: Option<Uuid>,
    pub entity_name: String,
    pub entity_id: Option<Uuid>,
    pub groups: Vec<UserGroupMembershipDto>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateUserDto {
    pub username: String,
    pub email: String,
    pub password: Option<String>,
    pub firstname: Option<String>,
    pub realname: Option<String>,
    pub is_active: Option<bool>,
    pub profile_id: Option<Uuid>,
    pub entity_id: Option<Uuid>,
    pub initial_group_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateUserDto {
    pub email: Option<String>,
    pub password: Option<String>,
    pub firstname: Option<String>,
    pub realname: Option<String>,
    pub is_active: Option<bool>,
    pub profile_id: Option<Uuid>,
    pub entity_id: Option<Uuid>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ConflictResolutionMode {
    Skip,
    Overwrite,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BatchUserImportItem {
    pub username: String,
    pub email: String,
    pub firstname: Option<String>,
    pub realname: Option<String>,
    pub password: Option<String>,
    pub profile_name: Option<String>,
    pub entity_name: Option<String>,
    pub group_name: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct BatchUserImportRequest {
    pub users: Vec<BatchUserImportItem>,
    pub conflict_resolution: ConflictResolutionMode,
    pub default_entity_id: Option<Uuid>,
    pub default_profile_id: Option<Uuid>,
    pub default_group_id: Option<Uuid>,
    pub default_password: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BatchUserImportRowResult {
    pub username: String,
    pub email: String,
    pub status: String, // "created", "updated", "skipped", "failed"
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BatchUserImportResponse {
    pub total_processed: usize,
    pub created_count: usize,
    pub updated_count: usize,
    pub skipped_count: usize,
    pub failed_count: usize,
    pub results: Vec<BatchUserImportRowResult>,
}
