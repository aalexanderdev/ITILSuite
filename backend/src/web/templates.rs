use askama::Template;
use axum::{
    http::StatusCode,
    response::{Html, IntoResponse, Response},
};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::domain::asset::{AssetDetailDto, AssetMetricsDto, AssetSummaryDto};
use crate::domain::chat::{ChatDashboardMetricsDto, ChatSettingsDto, OnlineUserDto};
use crate::domain::entity::{Entity, EntityTreeNode};
use crate::domain::notification::{
    CollectResultDto, MailBlacklist, MailReceiver, MailSettings, NotificationEvent,
    NotificationQueueItem, NotificationTemplate,
};
use crate::domain::rule::RuleWithDetails;
use crate::domain::sla::SlaSummaryDto;
use crate::domain::survey::{
    PublicSurveyDto, SurveyDashboardMetricsDto, SurveyPresetDef, SurveySummaryDto, SurveyTokenDto,
};
use crate::domain::ticket::{
    TicketDetailDto, TicketFollowupDto, TicketMetricsDto, TicketSummaryDto,
};
use crate::domain::user::UserSummaryDto;
use crate::domain::marketing::{
    MarketingCampaign, MarketingContact, MarketingEmail, MarketingMetricsSummary, MarketingSegment,
};

pub struct HtmlTemplate<T>(pub T);

impl<T> IntoResponse for HtmlTemplate<T>
where
    T: Template,
{
    fn into_response(self) -> Response {
        match self.0.render() {
            Ok(html) => Html(html).into_response(),
            Err(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error al renderizar plantilla Askama: {}", err),
            )
                .into_response(),
        }
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserSelectItem {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct GroupSelectItem {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct EntitySelectItem {
    pub id: Uuid,
    pub name: String,
    pub completeness: String,
    pub level: i32,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ProfileSelectItem {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct TicketTemplateRow {
    pub id: Uuid,
    pub name: String,
    pub category: Option<String>,
    pub ticket_type: String,
    pub predefined_title: Option<String>,
    pub predefined_content: Option<String>,
    pub predefined_urgency: Option<i32>,
    pub predefined_impact: Option<i32>,
    pub default_technician_id: Option<Uuid>,
}

#[derive(Template)]
#[template(path = "pages/login.html")]
pub struct LoginTemplate {
    pub error_message: Option<String>,
}

#[derive(Template)]
#[template(path = "pages/dashboard.html")]
pub struct DashboardTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub open_tickets_count: i64,
    pub sla_compliance_rate: f64,
    pub csat_score: f64,
    pub nps_score: i32,
    pub assets_count: i64,
}

#[derive(Template)]
#[template(path = "pages/tickets.html")]
pub struct TicketsTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub tickets: Vec<TicketSummaryDto>,
    pub metrics: TicketMetricsDto,
    pub current_search: String,
    pub current_status: String,
    pub current_ticket_type: String,
    pub current_priority: String,
    pub current_sla_status: String,
    pub current_page: i64,
    pub total_pages: i64,
    pub total_count: i64,
    pub limit: i64,
}

#[derive(Template)]
#[template(path = "partials/tickets_table.html")]
pub struct TicketsTablePartialTemplate {
    pub tickets: Vec<TicketSummaryDto>,
    pub current_page: i64,
    pub total_pages: i64,
    pub total_count: i64,
    pub limit: i64,
}

#[derive(Template)]
#[template(path = "pages/ticket_new.html")]
pub struct TicketNewTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub templates: Vec<TicketTemplateRow>,
    pub technicians: Vec<UserSelectItem>,
    pub groups: Vec<GroupSelectItem>,
}

#[derive(Template)]
#[template(path = "pages/ticket_detail.html")]
pub struct TicketDetailTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub ticket: TicketDetailDto,
    pub survey_token: Option<String>,
    pub technicians: Vec<UserSelectItem>,
    pub groups: Vec<GroupSelectItem>,
}

impl TicketDetailTemplate {
    pub fn is_technician_selected(&self, tech_id: &uuid::Uuid) -> bool {
        self.ticket.summary.assigned_technician_id == Some(*tech_id)
    }

    pub fn is_group_selected(&self, group_id: &uuid::Uuid) -> bool {
        self.ticket.summary.assigned_group_id == Some(*group_id)
    }
}

#[derive(Template)]
#[template(path = "partials/followup_item.html")]
pub struct FollowupPartialTemplate {
    pub followup: TicketFollowupDto,
}

#[derive(Template)]
#[template(path = "pages/slas.html")]
pub struct SlasTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub slas: Vec<SlaSummaryDto>,
}

#[derive(Template)]
#[template(path = "pages/surveys_admin.html")]
pub struct SurveysAdminTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub active_tab: String,
    pub surveys: Vec<SurveySummaryDto>,
    pub presets: Vec<SurveyPresetDef>,
    pub tokens: Vec<SurveyTokenDto>,
    pub metrics: SurveyDashboardMetricsDto,
}

#[derive(Template)]
#[template(path = "pages/survey_public.html")]
pub struct SurveyPublicTemplate {
    pub survey: PublicSurveyDto,
    pub already_completed: bool,
    pub is_expired: bool,
}

#[derive(Template)]
#[template(path = "pages/chat_analytics.html")]
pub struct ChatAnalyticsTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub metrics: ChatDashboardMetricsDto,
    pub online_users: Vec<OnlineUserDto>,
    pub settings: ChatSettingsDto,
}

// ----------------------------------------------------------------------------
// Phase 4: CMDB / Assets, Entities, Users & Rules Templates
// ----------------------------------------------------------------------------

#[derive(Template)]
#[template(path = "pages/assets.html")]
pub struct AssetsTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub assets: Vec<AssetSummaryDto>,
    pub metrics: AssetMetricsDto,
    pub current_search: String,
    pub current_asset_type: String,
    pub current_status: String,
    pub current_page: i64,
    pub total_pages: i64,
    pub total_count: i64,
    pub limit: i64,
}

#[derive(Template)]
#[template(path = "partials/assets_table.html")]
pub struct AssetsTablePartialTemplate {
    pub assets: Vec<AssetSummaryDto>,
    pub current_page: i64,
    pub total_pages: i64,
    pub total_count: i64,
    pub limit: i64,
}

#[derive(Template)]
#[template(path = "pages/asset_detail.html")]
pub struct AssetDetailTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub asset: AssetDetailDto,
    pub entities: Vec<EntitySelectItem>,
    pub technicians: Vec<UserSelectItem>,
    pub users: Vec<UserSelectItem>,
}

impl AssetDetailTemplate {
    pub fn is_technician_selected(&self, tech_id: &Uuid) -> bool {
        self.asset.technician_id == Some(*tech_id)
    }

    pub fn is_user_selected(&self, u_id: &Uuid) -> bool {
        self.asset.user_id == Some(*u_id)
    }

    pub fn is_status_selected(&self, st: &str) -> bool {
        self.asset.status.as_str() == st
    }

    pub fn cpu_display(&self) -> String {
        let specs = &self.asset.specifications;
        if let Some(s) = specs.get("cpu").and_then(|v| v.as_str()) {
            return s.to_string();
        }
        if let Some(name) = specs.get("cpu").and_then(|v| v.get("name")).and_then(|v| v.as_str()) {
            return name.to_string();
        }
        "No especificado".to_string()
    }

    pub fn cpu_cores_display(&self) -> Option<String> {
        let specs = &self.asset.specifications;
        let cpu_obj = specs.get("cpu");
        let cores = cpu_obj.and_then(|v| v.get("cores")).and_then(|v| v.as_i64())
            .or_else(|| specs.get("cores").and_then(|v| v.as_i64()));
        let threads = cpu_obj.and_then(|v| v.get("threads")).and_then(|v| v.as_i64());
        let speed = cpu_obj.and_then(|v| v.get("speed_mhz")).and_then(|v| v.as_i64());

        match (cores, threads, speed) {
            (Some(c), Some(t), Some(s)) => Some(format!("{} Núcleos / {} Hilos @ {} MHz", c, t, s)),
            (Some(c), Some(t), None) => Some(format!("{} Núcleos / {} Hilos", c, t)),
            (Some(c), None, _) => Some(format!("{} Núcleos lógicos", c)),
            _ => None,
        }
    }

    pub fn ram_display(&self) -> String {
        let specs = &self.asset.specifications;
        if let Some(mem) = specs.get("memory") {
            if let Some(total_mb) = mem.get("total_mb").and_then(|v| v.as_i64()) {
                let mem_type = mem.get("type").and_then(|v| v.as_str()).unwrap_or("RAM");
                if total_mb >= 1024 {
                    return format!("{:.0} GB {}", (total_mb as f64) / 1024.0, mem_type);
                } else {
                    return format!("{} MB {}", total_mb, mem_type);
                }
            }
        }
        if let Some(s) = specs.get("ram").and_then(|v| v.as_str()) {
            return s.to_string();
        }
        "No especificado".to_string()
    }

    pub fn ram_slots_display(&self) -> Option<String> {
        let specs = &self.asset.specifications;
        if let Some(mem) = specs.get("memory") {
            if let (Some(used), Some(total)) = (
                mem.get("slots_used").and_then(|v| v.as_i64()),
                mem.get("slots_total").and_then(|v| v.as_i64()),
            ) {
                return Some(format!("{} de {} ranuras en uso", used, total));
            }
        }
        if let Some(s) = specs.get("ram_slots").and_then(|v| v.as_str()) {
            return Some(s.to_string());
        }
        None
    }

    pub fn storage_display(&self) -> String {
        let specs = &self.asset.specifications;
        if let Some(drives) = specs.get("storage").and_then(|v| v.as_array()) {
            if !drives.is_empty() {
                let items: Vec<String> = drives.iter().map(|d| {
                    let name = d.get("name").and_then(|v| v.as_str()).unwrap_or("Disco");
                    let size = d.get("size_gb").and_then(|v| v.as_i64());
                    let free = d.get("free_gb").and_then(|v| v.as_i64());
                    match (size, free) {
                        (Some(s), Some(f)) => format!("{} ({} GB, {} GB libres)", name, s, f),
                        (Some(s), None) => format!("{} ({} GB)", name, s),
                        _ => name.to_string(),
                    }
                }).collect();
                return items.join(" • ");
            }
        }
        if let Some(s) = specs.get("storage").and_then(|v| v.as_str()) {
            return s.to_string();
        }
        "No especificado".to_string()
    }

    pub fn os_display(&self) -> String {
        let specs = &self.asset.specifications;
        if let Some(os) = specs.get("os") {
            if let Some(name) = os.get("name").and_then(|v| v.as_str()) {
                return name.to_string();
            }
        }
        if let Some(s) = specs.get("os").and_then(|v| v.as_str()) {
            return s.to_string();
        }
        "No detectado".to_string()
    }

    pub fn os_details_display(&self) -> Option<String> {
        let specs = &self.asset.specifications;
        if let Some(os) = specs.get("os") {
            let arch = os.get("arch").and_then(|v| v.as_str());
            let kernel = os.get("kernel").and_then(|v| v.as_str());
            match (arch, kernel) {
                (Some(a), Some(k)) => Some(format!("Arch: {} | Kernel: {}", a, k)),
                (Some(a), None) => Some(format!("Arch: {}", a)),
                (None, Some(k)) => Some(format!("Kernel: {}", k)),
                _ => None,
            }
        } else if let Some(a) = specs.get("arch").and_then(|v| v.as_str()) {
            Some(format!("Arch: {}", a))
        } else {
            None
        }
    }

    pub fn network_ip_display(&self) -> String {
        let specs = &self.asset.specifications;
        if let Some(nets) = specs.get("networks").and_then(|v| v.as_array()) {
            if let Some(first) = nets.first() {
                if let Some(ip) = first.get("ip").and_then(|v| v.as_str()) {
                    return ip.to_string();
                }
            }
        }
        if let Some(s) = specs.get("ip").and_then(|v| v.as_str()) {
            return s.to_string();
        }
        "-".to_string()
    }

    pub fn network_mac_display(&self) -> String {
        let specs = &self.asset.specifications;
        if let Some(nets) = specs.get("networks").and_then(|v| v.as_array()) {
            if let Some(first) = nets.first() {
                if let Some(mac) = first.get("mac").and_then(|v| v.as_str()) {
                    return mac.to_string();
                }
            }
        }
        if let Some(s) = specs.get("mac").and_then(|v| v.as_str()) {
            return s.to_string();
        }
        "-".to_string()
    }

    pub fn network_interface_display(&self) -> Option<String> {
        let specs = &self.asset.specifications;
        if let Some(nets) = specs.get("networks").and_then(|v| v.as_array()) {
            if let Some(first) = nets.first() {
                let name = first.get("name").and_then(|v| v.as_str());
                let speed = first.get("speed").and_then(|v| v.as_str());
                match (name, speed) {
                    (Some(n), Some(s)) => Some(format!("Interfaz {} ({})", n, s)),
                    (Some(n), None) => Some(format!("Interfaz {}", n)),
                    _ => None,
                }
            } else {
                None
            }
        } else {
            None
        }
    }

    pub fn softwares_list(&self) -> Vec<(String, String, String)> {
        let specs = &self.asset.specifications;
        let mut list = Vec::new();
        if let Some(softs) = specs.get("softwares").and_then(|v| v.as_array()) {
            for s in softs {
                let name = s.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let ver = s.get("version").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let publ = s.get("publisher").and_then(|v| v.as_str()).unwrap_or("").to_string();
                if !name.is_empty() {
                    list.push((name, ver, publ));
                }
            }
        }
        list
    }
}

#[derive(Template)]
#[template(path = "pages/asset_new.html")]
pub struct AssetNewTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub entities: Vec<EntitySelectItem>,
    pub technicians: Vec<UserSelectItem>,
    pub users: Vec<UserSelectItem>,
    pub preset_type: String,
}

#[derive(Template)]
#[template(path = "pages/entities.html")]
pub struct EntitiesTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub entities: Vec<Entity>,
    pub tree: Vec<EntityTreeNode>,
    pub total_entities: usize,
    pub max_level: i32,
}

#[derive(Template)]
#[template(path = "pages/users.html")]
pub struct UsersTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub users: Vec<UserSummaryDto>,
    pub profiles: Vec<ProfileSelectItem>,
    pub entities: Vec<EntitySelectItem>,
    pub groups: Vec<GroupSelectItem>,
    pub current_search: String,
    pub current_profile: String,
    pub current_status: String,
    pub total_users: usize,
    pub active_users_count: usize,
    pub technicians_count: usize,
    pub admins_count: usize,
}

#[derive(Template)]
#[template(path = "pages/rules.html")]
pub struct RulesTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub active_tab: String,
    pub helpdesk_rules: Vec<RuleWithDetails>,
    pub asset_rules: Vec<RuleWithDetails>,
    pub dictionary_rules: Vec<RuleWithDetails>,
    pub entities: Vec<EntitySelectItem>,
}

#[derive(Template)]
#[template(path = "pages/rule_new.html")]
pub struct RuleNewTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub entities: Vec<EntitySelectItem>,
}

// ----------------------------------------------------------------------------
// Phase 5: Mail Configuration, Notifications, Receivers & Contracts Templates
// ----------------------------------------------------------------------------

#[derive(Template)]
#[template(path = "pages/mail_config.html")]
pub struct MailConfigTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub active_tab: String,
    pub settings: MailSettings,
    pub receivers: Vec<MailReceiver>,
    pub blacklists: Vec<MailBlacklist>,
    pub templates: Vec<NotificationTemplate>,
    pub events: Vec<NotificationEvent>,
    pub queue_items: Vec<NotificationQueueItem>,
    pub entities: Vec<EntitySelectItem>,
    pub message: Option<String>,
    pub error_message: Option<String>,
}

impl MailConfigTemplate {
    pub fn is_smtp_tab(&self) -> bool {
        self.active_tab == "smtp" || self.active_tab.is_empty()
    }

    pub fn is_receivers_tab(&self) -> bool {
        self.active_tab == "receivers"
    }

    pub fn is_templates_tab(&self) -> bool {
        self.active_tab == "templates"
    }

    pub fn is_queue_tab(&self) -> bool {
        self.active_tab == "queue"
    }

    pub fn format_opt_dt(&self, dt: &Option<DateTime<Utc>>) -> String {
        match dt {
            Some(d) => d.format("%Y-%m-%d %H:%M").to_string(),
            None => "-".to_string(),
        }
    }

    pub fn format_dt(&self, dt: &DateTime<Utc>) -> String {
        dt.format("%Y-%m-%d %H:%M").to_string()
    }
}

#[derive(Template)]
#[template(path = "partials/smtp_test_result.html")]
pub struct SmtpTestResultPartialTemplate {
    pub success: bool,
    pub message: String,
}

#[derive(Template)]
#[template(path = "partials/collect_result.html")]
pub struct CollectResultPartialTemplate {
    pub result: CollectResultDto,
}

#[derive(Template)]
#[template(path = "pages/contracts.html")]
pub struct ContractsTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub active_contracts_count: i64,
    pub active_warranties_count: i64,
    pub active_licenses_count: i64,
    pub expiring_soon_count: i64,
}

// ----------------------------------------------------------------------------
// Marketing & Campaign Automation Templates (Mautic-Inspired)
// ----------------------------------------------------------------------------

#[derive(Template)]
#[template(path = "pages/campaigns.html")]
pub struct CampaignsTemplate {
    pub current_username: String,
    pub current_display_name: String,
    pub current_profile_name: String,
    pub user_initials: String,
    pub active_entity_name: String,
    pub active_nav: String,
    pub active_tab: String,
    pub metrics: MarketingMetricsSummary,
    pub campaigns: Vec<MarketingCampaign>,
    pub segments: Vec<MarketingSegment>,
    pub contacts: Vec<MarketingContact>,
    pub email_templates: Vec<MarketingEmail>,
    pub entities: Vec<EntitySelectItem>,
    pub message: Option<String>,
    pub error_message: Option<String>,
}

impl CampaignsTemplate {
    pub fn format_opt_dt(&self, dt: &Option<DateTime<Utc>>) -> String {
        match dt {
            Some(d) => d.format("%Y-%m-%d %H:%M").to_string(),
            None => "-".to_string(),
        }
    }

    pub fn format_dt(&self, dt: &DateTime<Utc>) -> String {
        dt.format("%Y-%m-%d %H:%M").to_string()
    }

    pub fn calc_rate(&self, part: &i32, total: &i32) -> String {
        if *total > 0 {
            format!("{:.1}%", (*part as f64 / *total as f64) * 100.0)
        } else {
            "0.0%".to_string()
        }
    }

    pub fn format_rate(&self, rate: &f64) -> String {
        format!("{:.1}%", rate)
    }
}

#[derive(Template)]
#[template(path = "pages/unsubscribe.html")]
pub struct UnsubscribeTemplate {
    pub contact_email: Option<String>,
    pub is_success: bool,
    pub message: String,
}



