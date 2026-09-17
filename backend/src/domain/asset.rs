use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AssetType {
    Computer,
    NetworkEquipment,
    Monitor,
    Printer,
    Peripheral,
    Server,
    Phone,
    Other,
}

impl AssetType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AssetType::Computer => "computer",
            AssetType::NetworkEquipment => "network_equipment",
            AssetType::Monitor => "monitor",
            AssetType::Printer => "printer",
            AssetType::Peripheral => "peripheral",
            AssetType::Server => "server",
            AssetType::Phone => "phone",
            AssetType::Other => "other",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "computer" => AssetType::Computer,
            "network_equipment" => AssetType::NetworkEquipment,
            "monitor" => AssetType::Monitor,
            "printer" => AssetType::Printer,
            "peripheral" => AssetType::Peripheral,
            "server" => AssetType::Server,
            "phone" => AssetType::Phone,
            _ => AssetType::Other,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AssetStatus {
    Active,
    InStock,
    InRepair,
    Decommissioned,
    Reserved,
}

impl AssetStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            AssetStatus::Active => "active",
            AssetStatus::InStock => "in_stock",
            AssetStatus::InRepair => "in_repair",
            AssetStatus::Decommissioned => "decommissioned",
            AssetStatus::Reserved => "reserved",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "active" => AssetStatus::Active,
            "in_stock" => AssetStatus::InStock,
            "in_repair" => AssetStatus::InRepair,
            "decommissioned" => AssetStatus::Decommissioned,
            "reserved" => AssetStatus::Reserved,
            _ => AssetStatus::Active,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AssetSummaryDto {
    pub id: Uuid,
    pub entity_id: Uuid,
    pub entity_name: String,
    pub name: String,
    pub asset_type: AssetType,
    pub status: AssetStatus,
    pub serial_number: Option<String>,
    pub inventory_number: Option<String>,
    pub uuid: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub location: Option<String>,
    pub user_name: Option<String>,
    pub technician_name: Option<String>,
    pub last_inventory_at: Option<DateTime<Utc>>,
    pub agent_version: Option<String>,
    pub is_locked: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AssetConnectionSummaryDto {
    pub connection_id: Uuid,
    pub connected_asset_id: Uuid,
    pub name: String,
    pub asset_type: AssetType,
    pub connection_type: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AssetDetailDto {
    pub id: Uuid,
    pub entity_id: Uuid,
    pub entity_name: String,
    pub name: String,
    pub asset_type: AssetType,
    pub status: AssetStatus,
    pub serial_number: Option<String>,
    pub inventory_number: Option<String>,
    pub uuid: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub location: Option<String>,
    pub user_id: Option<Uuid>,
    pub user_name: Option<String>,
    pub technician_id: Option<Uuid>,
    pub technician_name: Option<String>,
    pub group_in_charge: Option<String>,
    pub comments: Option<String>,
    pub last_inventory_at: Option<DateTime<Utc>>,
    pub agent_version: Option<String>,
    pub is_locked: bool,
    pub locked_fields: Vec<String>,
    pub specifications: serde_json::Value,
    pub connections: Vec<AssetConnectionSummaryDto>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateAssetDto {
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub asset_type: AssetType,
    pub status: Option<AssetStatus>,
    pub serial_number: Option<String>,
    pub inventory_number: Option<String>,
    pub uuid: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub location: Option<String>,
    pub user_id: Option<Uuid>,
    pub technician_id: Option<Uuid>,
    pub group_in_charge: Option<String>,
    pub comments: Option<String>,
    pub specifications: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateAssetDto {
    pub name: Option<String>,
    pub asset_type: Option<AssetType>,
    pub status: Option<AssetStatus>,
    pub serial_number: Option<String>,
    pub inventory_number: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub location: Option<String>,
    pub user_id: Option<Uuid>,
    pub technician_id: Option<Uuid>,
    pub group_in_charge: Option<String>,
    pub comments: Option<String>,
    pub is_locked: Option<bool>,
    pub locked_fields: Option<Vec<String>>,
    pub specifications: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct AssetFilterQuery {
    pub entity_id: Option<Uuid>,
    pub asset_type: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AssetMetricsDto {
    pub total_assets: i64,
    pub computers_count: i64,
    pub servers_count: i64,
    pub network_equipment_count: i64,
    pub monitors_count: i64,
    pub active_count: i64,
    pub in_stock_count: i64,
    pub in_repair_count: i64,
    pub agent_inventoried_count: i64,
}
