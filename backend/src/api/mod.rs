pub mod assets;
pub mod auth;
pub mod chat;
pub mod entities;
pub mod groups;
pub mod health;
pub mod inventory;
pub mod notifications;
pub mod public_surveys;
pub mod receivers;
pub mod rules;
pub mod slas;
pub mod surveys;
pub mod templates;
pub mod tickets;
pub mod users;
pub mod version;
pub mod problems;
pub mod changes;

use axum::{
    routing::{delete, get, post},
    Router,
};
use utoipa::{
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
    Modify, OpenApi,
};
use utoipa_swagger_ui::SwaggerUi;
use crate::state::AppState;

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer_auth",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}

#[derive(OpenApi)]
#[openapi(
    paths(
        health::health_check,
        version::get_version,
        auth::login,
        auth::me,
        entities::list_entities,
        entities::create_entity,
        users::list_users,
        users::create_user,
        users::get_user,
        users::update_user,
        users::delete_user,
        users::batch_import_users,
        groups::list_groups,
        groups::create_group,
        groups::get_group,
        groups::update_group,
        groups::delete_group,
        groups::add_group_member,
        groups::remove_group_member,
        groups::update_group_member,
        tickets::list_tickets,
        tickets::get_ticket,
        tickets::create_ticket,
        tickets::update_ticket,
        tickets::add_followup,
        tickets::get_ticket_metrics,
        templates::list_templates,
        templates::get_template,
        templates::create_template,
        templates::update_template,
        templates::delete_template,
        assets::list_assets,
        assets::get_asset_metrics,
        assets::get_asset,
        assets::create_asset,
        assets::update_asset,
        assets::delete_asset,
        inventory::handle_agent_inventory,
        inventory::simulate_agent_inventory,
        slas::list_calendars,
        slas::create_calendar,
        slas::get_calendar,
        slas::update_calendar,
        slas::delete_calendar,
        slas::save_calendar_segments,
        slas::add_calendar_holiday,
        slas::delete_calendar_holiday,
        slas::list_slas,
        slas::create_sla,
        slas::get_sla,
        slas::update_sla,
        slas::delete_sla,
        slas::list_sla_levels,
        slas::create_sla_level,
        slas::update_sla_level,
        slas::delete_sla_level,
        slas::simulate_sla,
        surveys::list_presets,
        surveys::get_dashboard_metrics,
        surveys::list_surveys,
        surveys::get_survey,
        surveys::create_survey,
        surveys::update_survey,
        surveys::delete_survey,
        surveys::clone_survey,
        surveys::list_questions,
        surveys::create_question,
        surveys::update_question,
        surveys::delete_question,
        surveys::reorder_questions,
        surveys::list_tokens,
        surveys::generate_token,
        surveys::generate_ticket_survey_token,
        surveys::get_ticket_survey_token,
        public_surveys::get_public_survey,
        public_surveys::save_public_draft,
        public_surveys::submit_public_survey,
        problems::list_problems,
        problems::get_problem,
        problems::create_problem,
        problems::update_problem,
        problems::add_problem_followup,
        problems::list_kedb,
        problems::get_kedb,
        problems::create_kedb,
        problems::update_kedb,
        changes::list_changes,
        changes::get_change,
        changes::create_change,
        changes::update_change,
        changes::submit_cab_vote,
    ),
    components(
        schemas(
            health::HealthResponse,
            version::VersionResponse,
            auth::LoginRequest,
            auth::LoginResponse,
            auth::AuthUserResponse,
            crate::domain::entity::Entity,
            crate::domain::entity::EntityTreeNode,
            crate::domain::entity::CreateEntityDto,
            crate::domain::user::UserSummaryDto,
            crate::domain::user::UserDetailDto,
            crate::domain::user::CreateUserDto,
            crate::domain::user::UpdateUserDto,
            crate::domain::user::BatchUserImportRequest,
            crate::domain::user::BatchUserImportItem,
            crate::domain::user::BatchUserImportResponse,
            crate::domain::user::BatchUserImportRowResult,
            crate::domain::user::ConflictResolutionMode,
            crate::domain::user::UserGroupMembershipDto,
            crate::domain::group::GroupSummaryDto,
            crate::domain::group::GroupDetailDto,
            crate::domain::group::GroupMemberDto,
            crate::domain::group::CreateGroupDto,
            crate::domain::group::UpdateGroupDto,
            crate::domain::group::AddGroupMemberDto,
            crate::domain::group::UpdateGroupMemberDto,
            crate::domain::ticket::Ticket,
            crate::domain::ticket::TicketSummaryDto,
            crate::domain::ticket::TicketDetailDto,
            crate::domain::ticket::TicketFollowupDto,
            crate::domain::ticket::CreateTicketDto,
            crate::domain::ticket::UpdateTicketDto,
            crate::domain::ticket::CreateFollowupDto,
            crate::domain::ticket::TicketMetricsDto,
            crate::domain::template::TicketTemplate,
            crate::domain::template::CreateTicketTemplateDto,
            crate::domain::template::UpdateTicketTemplateDto,
            crate::domain::asset::AssetSummaryDto,
            crate::domain::asset::AssetDetailDto,
            crate::domain::asset::AssetConnectionSummaryDto,
            crate::domain::asset::CreateAssetDto,
            crate::domain::asset::UpdateAssetDto,
            crate::domain::asset::AssetMetricsDto,
            crate::domain::asset::AssetType,
            crate::domain::asset::AssetStatus,
            crate::domain::agent::GlpiAgentPayload,
            crate::domain::agent::GlpiAgentContent,
            crate::domain::agent::GlpiHardware,
            crate::domain::agent::GlpiBios,
            crate::domain::agent::GlpiOs,
            crate::domain::agent::GlpiCpu,
            crate::domain::agent::GlpiMemory,
            crate::domain::agent::GlpiDrive,
            crate::domain::agent::GlpiNetwork,
            crate::domain::agent::GlpiMonitor,
            crate::domain::agent::GlpiSoftware,
            crate::domain::agent::GlpiAgentResponse,
            crate::domain::agent::AgentSimulationPresetRequest,
            crate::domain::sla::Calendar,
            crate::domain::sla::CalendarSegment,
            crate::domain::sla::CalendarHoliday,
            crate::domain::sla::CalendarDetailDto,
            crate::domain::sla::CreateCalendarDto,
            crate::domain::sla::UpdateCalendarDto,
            crate::domain::sla::CreateCalendarSegmentDto,
            crate::domain::sla::CreateCalendarHolidayDto,
            crate::domain::sla::Sla,
            crate::domain::sla::SlaSummaryDto,
            crate::domain::sla::SlaDetailDto,
            crate::domain::sla::SlaLevel,
            crate::domain::sla::CreateSlaDto,
            crate::domain::sla::UpdateSlaDto,
            crate::domain::sla::CreateSlaLevelDto,
            crate::domain::sla::UpdateSlaLevelDto,
            crate::domain::sla::SlaSimulationRequest,
            crate::domain::sla::SlaSimulationResponse,
            crate::domain::survey::Survey,
            crate::domain::survey::SurveySummaryDto,
            crate::domain::survey::SurveyDetailDto,
            crate::domain::survey::CreateSurveyDto,
            crate::domain::survey::UpdateSurveyDto,
            crate::domain::survey::SurveyQuestion,
            crate::domain::survey::SurveyQuestionDto,
            crate::domain::survey::SurveyQuestionOption,
            crate::domain::survey::SurveyQuestionOptionDto,
            crate::domain::survey::CreateQuestionDto,
            crate::domain::survey::UpdateQuestionDto,
            crate::domain::survey::ReorderQuestionsDto,
            crate::domain::survey::SurveyToken,
            crate::domain::survey::SurveyTokenDto,
            crate::domain::survey::GenerateTokenDto,
            crate::domain::survey::SurveyAnswer,
            crate::domain::survey::SurveyAnswerDto,
            crate::domain::survey::PublicQuestionOptionDto,
            crate::domain::survey::PublicQuestionDto,
            crate::domain::survey::PublicSurveyDto,
            crate::domain::survey::QuestionAnswerInput,
            crate::domain::survey::SaveDraftDto,
            crate::domain::survey::SubmitSurveyDto,
            crate::domain::survey::CsatDistributionDto,
            crate::domain::survey::NpsDistributionDto,
            crate::domain::survey::RecentSurveyResponseDto,
            crate::domain::survey::SurveyDashboardMetricsDto,
            crate::domain::survey::PresetQuestionDef,
            crate::domain::survey::SurveyPresetDef,
            crate::domain::problem::ProblemSummaryDto,
            crate::domain::problem::ProblemDetailDto,
            crate::domain::problem::ProblemFollowupDto,
            crate::domain::problem::CreateProblemDto,
            crate::domain::problem::UpdateProblemDto,
            crate::domain::problem::CreateProblemFollowupDto,
            crate::domain::problem::LinkedTicketDto,
            crate::domain::problem::LinkedAssetDto,
            crate::domain::problem::LinkedChangeDto,
            crate::domain::problem::KedbArticleSummaryDto,
            crate::domain::problem::CreateKedbArticleDto,
            crate::domain::problem::UpdateKedbArticleDto,
            crate::domain::change::ChangeSummaryDto,
            crate::domain::change::ChangeDetailDto,
            crate::domain::change::ChangeApprovalDto,
            crate::domain::change::ChangeFollowupDto,
            crate::domain::change::CreateChangeDto,
            crate::domain::change::UpdateChangeDto,
            crate::domain::change::SubmitCabVoteDto,
            crate::domain::change::CreateChangeFollowupDto,
            crate::error::ErrorDetail,
            crate::error::ErrorResponse,
        )
    ),
    modifiers(&SecurityAddon),
    tags(
        (name = "Authentication", description = "User authentication and JWT token lifecycle"),
        (name = "Entities", description = "Hierarchical Multi-Tenancy Entity management"),
        (name = "Users", description = "User profiles, identity, and batch ingestion"),
        (name = "Groups", description = "Transversal Groups and Teams inspired by GLPI"),
        (name = "Tickets", description = "ITIL Service Desk Incident/Request lifecycles and dispatch"),
        (name = "SLAs", description = "Service Level Agreements (SLA), Business Calendars and Escalation Matrices"),
        (name = "Surveys", description = "Satisfaction surveys, question builders, and NPS/CSAT analytics"),
        (name = "Public Surveys", description = "Zero-login public responder with draft autosave"),
        (name = "Templates", description = "ITIL Ticket Templates inspired by GLPI"),
        (name = "Assets", description = "ITAM / CMDB Hardware and Software Asset Inventory inspired by GLPI"),
        (name = "GLPI Agent Inventory", description = "Automated Hardware & Software Ingestion compatible with GLPI-Agent"),
        (name = "Problems & RCA", description = "ITIL Problem Management, Root Cause Analysis, and Workarounds"),
        (name = "Known Error Database (KEDB)", description = "Documented Workarounds and Known Error Articles"),
        (name = "Change Enablement (RFC & CAB)", description = "Requests for Change (RFC), CAB Approvals, and Deployment Plans"),
        (name = "Health", description = "Service monitoring and status endpoints"),
        (name = "Version", description = "Application and environment version metadata")
    ),
    info(
        title = "ITILSuite REST API",
        version = "0.0.9",
        description = "High-performance Rust REST API for ITSM, ITAM, and CMDB.",
        license(name = "GPL-3.0-or-later", url = "https://www.gnu.org/licenses/gpl-3.0.html")
    )
)]
pub struct ApiDoc;

pub fn create_router(state: AppState) -> Router {
    let api_v1 = Router::new()
        .route("/health", get(health::health_check))
        .route("/version", get(version::get_version))
        .route("/auth/login", post(auth::login))
        .route("/auth/me", get(auth::me))
        .route("/entities", get(entities::list_entities).post(entities::create_entity))
        .route("/users", get(users::list_users).post(users::create_user))
        .route("/users/batch-import", post(users::batch_import_users))
        .route(
            "/users/:id",
            get(users::get_user)
                .patch(users::update_user)
                .delete(users::delete_user),
        )
        .route("/groups", get(groups::list_groups).post(groups::create_group))
        .route(
            "/groups/:id",
            get(groups::get_group)
                .patch(groups::update_group)
                .delete(groups::delete_group),
        )
        .route("/groups/:id/members", post(groups::add_group_member))
        .route(
            "/groups/:id/members/:user_id",
            delete(groups::remove_group_member).patch(groups::update_group_member),
        )
        .route("/tickets", get(tickets::list_tickets).post(tickets::create_ticket))
        .route("/tickets/metrics", get(tickets::get_ticket_metrics))
        .route("/tickets/:id", get(tickets::get_ticket).patch(tickets::update_ticket))
        .route("/tickets/:id/followups", post(tickets::add_followup))
        .route(
            "/ticket-templates",
            get(templates::list_templates).post(templates::create_template),
        )
        .route(
            "/ticket-templates/:id",
            get(templates::get_template)
                .patch(templates::update_template)
                .delete(templates::delete_template),
        )
        .route("/assets", get(assets::list_assets).post(assets::create_asset))
        .route("/assets/metrics", get(assets::get_asset_metrics))
        .route(
            "/assets/:id",
            get(assets::get_asset)
                .patch(assets::update_asset)
                .delete(assets::delete_asset),
        )
        .route("/inventory/agent", post(inventory::handle_agent_inventory))
        .route("/inventory/agent/simulate", post(inventory::simulate_agent_inventory))
        .nest("/chat", chat::chat_router())
        .merge(notifications::router())
        .merge(public_surveys::router())
        .merge(receivers::router())
        .merge(rules::router())
        .merge(slas::router())
        .merge(surveys::router())
        .merge(problems::router())
        .merge(changes::router());

    let static_dir = if std::path::Path::new("backend/static").exists() {
        "backend/static"
    } else {
        "static"
    };

    Router::new()
        .merge(crate::web::router())
        .nest_service("/static", tower_http::services::ServeDir::new(static_dir))
        .nest("/api/v1", api_v1)
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .with_state(state)
}
