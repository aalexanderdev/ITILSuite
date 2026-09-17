use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiAgentPayload {
    pub deviceid: Option<String>,
    pub action: Option<String>,
    pub itemtype: Option<String>,
    pub content: Option<GlpiAgentContent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiAgentContent {
    pub hardware: Option<GlpiHardware>,
    pub bios: Option<GlpiBios>,
    pub operatingsystem: Option<GlpiOs>,
    pub cpus: Option<Vec<GlpiCpu>>,
    pub memories: Option<Vec<GlpiMemory>>,
    pub drives: Option<Vec<GlpiDrive>>,
    pub networks: Option<Vec<GlpiNetwork>>,
    pub monitors: Option<Vec<GlpiMonitor>>,
    pub softwares: Option<Vec<GlpiSoftware>>,
    pub versionclient: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiHardware {
    pub name: Option<String>,
    pub workgroup: Option<String>,
    pub uuid: Option<String>,
    pub dns: Option<String>,
    pub vmsystem: Option<String>,
    pub memory: Option<i64>,
    pub swap: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiBios {
    pub smanufacturer: Option<String>,
    pub smodel: Option<String>,
    pub ssn: Option<String>,
    pub bversion: Option<String>,
    pub bdate: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiOs {
    pub name: Option<String>,
    pub version: Option<String>,
    pub arch: Option<String>,
    pub kernel_version: Option<String>,
    pub install_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiCpu {
    pub name: Option<String>,
    pub speed: Option<i64>,
    pub cores: Option<i32>,
    pub threads: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiMemory {
    pub capacity: Option<i64>,
    pub memory_type: Option<String>,
    pub speed: Option<i64>,
    pub numslots: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiDrive {
    pub volumn: Option<String>,
    pub filesystem: Option<String>,
    pub total: Option<i64>,
    pub free: Option<i64>,
    pub drive_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiNetwork {
    pub description: Option<String>,
    pub mac: Option<String>,
    pub ipaddress: Option<String>,
    pub ipmask: Option<String>,
    pub status: Option<String>,
    pub speed: Option<String>,
    pub network_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiMonitor {
    pub name: Option<String>,
    pub serial: Option<String>,
    pub manufacturer: Option<String>,
    pub caption: Option<String>,
    pub resolution: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiSoftware {
    pub name: Option<String>,
    pub version: Option<String>,
    pub publisher: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GlpiAgentResponse {
    pub status: String,
    pub message: String,
    pub asset_id: Uuid,
    pub action_taken: String, // "created" or "reconciled_updated"
    pub asset_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AgentSimulationPresetRequest {
    pub preset_name: String, // "thinkpad_laptop", "ubuntu_workstation", "dl380_server", "cisco_switch"
    pub entity_id: Option<Uuid>,
}
