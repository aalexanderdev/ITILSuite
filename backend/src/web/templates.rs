use askama::Template;
use axum::{
    http::StatusCode,
    response::{Html, IntoResponse, Response},
};
use uuid::Uuid;

use crate::domain::chat::{ChatDashboardMetricsDto, ChatSettingsDto, OnlineUserDto};
use crate::domain::sla::SlaSummaryDto;
use crate::domain::survey::{
    PublicSurveyDto, SurveyDashboardMetricsDto, SurveyPresetDef, SurveySummaryDto, SurveyTokenDto,
};
use crate::domain::ticket::{
    TicketDetailDto, TicketFollowupDto, TicketMetricsDto, TicketSummaryDto,
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
