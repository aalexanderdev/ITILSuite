pub mod assets;
pub mod auth;
pub mod chat;
pub mod entities;
pub mod health;
pub mod inventory;
pub mod notifications;
pub mod receivers;
pub mod rules;
pub mod templates;
pub mod tickets;
pub mod users;
pub mod version;

use axum::{
    routing::{get, post},
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
            crate::error::ErrorDetail,
            crate::error::ErrorResponse,
        )
    ),
    modifiers(&SecurityAddon),
    tags(
        (name = "Authentication", description = "User authentication and JWT token lifecycle"),
        (name = "Entities", description = "Hierarchical Multi-Tenancy Entity management"),
        (name = "Users", description = "User profiles and identity"),
        (name = "Tickets", description = "ITIL Service Desk Incident/Request lifecycles and dispatch"),
        (name = "Templates", description = "ITIL Ticket Templates inspired by GLPI"),
        (name = "Assets", description = "ITAM / CMDB Hardware and Software Asset Inventory inspired by GLPI"),
        (name = "GLPI Agent Inventory", description = "Automated Hardware & Software Ingestion compatible with GLPI-Agent"),
        (name = "Health", description = "Service monitoring and status endpoints"),
        (name = "Version", description = "Application and environment version metadata")
    ),
    info(
        title = "ITILSuite REST API",
        version = "0.0.5",
        description = "High-performance Rust REST API inspired by GLPI 11 for ITSM, ITAM, and CMDB.",
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
        .route("/users", get(users::list_users))
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
        .merge(receivers::router())
        .merge(rules::router());

    Router::new()
        .nest("/api/v1", api_v1)
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .with_state(state)
}
