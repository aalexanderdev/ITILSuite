use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuleType {
    // 1. Helpdesk Rules
    TicketBusiness,
    TicketEntity,
    ProblemBusiness,
    ChangeBusiness,

    // 2. Asset & Inventory Rules
    AssetEntity,
    AssetImportLink,

    // 3. User & Authorization Rules
    UserAuthorization,

    // 4. Normalization Dictionaries
    DictManufacturer,
    DictSoftware,
    DictComputerModel,
    DictMonitorModel,
    DictPrinterModel,
    DictPeripheralModel,
    DictPhoneModel,
    DictOs,
    DictOsVersion,
    DictOsArchitecture,
}

impl RuleType {
    pub fn as_str(&self) -> &'static str {
        match self {
            RuleType::TicketBusiness => "ticket_business",
            RuleType::TicketEntity => "ticket_entity",
            RuleType::ProblemBusiness => "problem_business",
            RuleType::ChangeBusiness => "change_business",
            RuleType::AssetEntity => "asset_entity",
            RuleType::AssetImportLink => "asset_import_link",
            RuleType::UserAuthorization => "user_authorization",
            RuleType::DictManufacturer => "dict_manufacturer",
            RuleType::DictSoftware => "dict_software",
            RuleType::DictComputerModel => "dict_computer_model",
            RuleType::DictMonitorModel => "dict_monitor_model",
            RuleType::DictPrinterModel => "dict_printer_model",
            RuleType::DictPeripheralModel => "dict_peripheral_model",
            RuleType::DictPhoneModel => "dict_phone_model",
            RuleType::DictOs => "dict_os",
            RuleType::DictOsVersion => "dict_os_version",
            RuleType::DictOsArchitecture => "dict_os_architecture",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "ticket_business" => Some(RuleType::TicketBusiness),
            "ticket_entity" => Some(RuleType::TicketEntity),
            "problem_business" => Some(RuleType::ProblemBusiness),
            "change_business" => Some(RuleType::ChangeBusiness),
            "asset_entity" => Some(RuleType::AssetEntity),
            "asset_import_link" => Some(RuleType::AssetImportLink),
            "user_authorization" => Some(RuleType::UserAuthorization),
            "dict_manufacturer" => Some(RuleType::DictManufacturer),
            "dict_software" => Some(RuleType::DictSoftware),
            "dict_computer_model" => Some(RuleType::DictComputerModel),
            "dict_monitor_model" => Some(RuleType::DictMonitorModel),
            "dict_printer_model" => Some(RuleType::DictPrinterModel),
            "dict_peripheral_model" => Some(RuleType::DictPeripheralModel),
            "dict_phone_model" => Some(RuleType::DictPhoneModel),
            "dict_os" => Some(RuleType::DictOs),
            "dict_os_version" => Some(RuleType::DictOsVersion),
            "dict_os_architecture" => Some(RuleType::DictOsArchitecture),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Rule {
    pub id: Uuid,
    pub rule_type: String,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub ranking: i32,
    pub match_logic: String, // "AND" | "OR"
    pub stop_on_first_match: bool,
    pub entity_id: Option<Uuid>,
    pub is_recursive: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RuleCriteria {
    pub id: Uuid,
    pub rule_id: Uuid,
    pub field: String,
    pub operator: String, // equals, contains, regex_match, in_subnet, is_empty, etc.
    pub pattern: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RuleAction {
    pub id: Uuid,
    pub rule_id: Uuid,
    pub action_type: String, // assign, assign_regex_match, append, add_tag, reject, trash, link_or_create
    pub field: String,
    pub value: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleWithDetails {
    #[serde(flatten)]
    pub rule: Rule,
    pub criteria: Vec<RuleCriteria>,
    pub actions: Vec<RuleAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRuleDto {
    pub rule_type: String,
    pub name: String,
    pub description: Option<String>,
    pub is_active: Option<bool>,
    pub ranking: Option<i32>,
    pub match_logic: Option<String>,
    pub stop_on_first_match: Option<bool>,
    pub entity_id: Option<Uuid>,
    pub is_recursive: Option<bool>,
    pub criteria: Vec<CreateCriteriaDto>,
    pub actions: Vec<CreateActionDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCriteriaDto {
    pub field: String,
    pub operator: String,
    pub pattern: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateActionDto {
    pub action_type: String,
    pub field: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateRuleDto {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
    pub ranking: Option<i32>,
    pub match_logic: Option<String>,
    pub stop_on_first_match: Option<bool>,
    pub entity_id: Option<Uuid>,
    pub is_recursive: Option<bool>,
    pub criteria: Option<Vec<CreateCriteriaDto>>,
    pub actions: Option<Vec<CreateActionDto>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReorderRuleItem {
    pub id: Uuid,
    pub ranking: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReorderRulesDto {
    pub rules: Vec<ReorderRuleItem>,
}

// ----------------------------------------------------------------------------
// Sandbox Simulator & Dry-Run Evaluation Types
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DryRunRequest {
    pub rule_type: String,
    pub entity_id: Option<Uuid>,
    pub input_fields: serde_json::Value, // Key-value pairs representing simulated input
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriteriaEvaluationResult {
    pub field: String,
    pub operator: String,
    pub pattern: String,
    pub actual_value: Option<String>,
    pub matched: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionEvaluationResult {
    pub action_type: String,
    pub field: String,
    pub computed_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluatedRuleStep {
    pub rule_id: Uuid,
    pub rule_name: String,
    pub ranking: i32,
    pub matched: bool,
    pub criteria_results: Vec<CriteriaEvaluationResult>,
    pub actions_executed: Vec<ActionEvaluationResult>,
    pub stopped_pipeline: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DryRunResult {
    pub rule_type: String,
    pub total_rules_evaluated: usize,
    pub total_rules_matched: usize,
    pub final_output_fields: serde_json::Value,
    pub steps: Vec<EvaluatedRuleStep>,
    pub execution_time_us: u64,
}
