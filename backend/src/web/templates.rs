use askama::Template;
use axum::{
    http::StatusCode,
    response::{Html, IntoResponse, Response},
};

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
}

#[derive(Template)]
#[template(path = "partials/tickets_table.html")]
pub struct TicketsTablePartialTemplate {
    pub tickets: Vec<TicketSummaryDto>,
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
}

#[derive(Template)]
#[template(path = "partials/followup_item.html")]
pub struct FollowupPartialTemplate {
    pub followup: TicketFollowupDto,
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
