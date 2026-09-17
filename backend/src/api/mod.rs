pub mod auth;
pub mod entities;
pub mod health;
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
        (name = "Health", description = "Service monitoring and status endpoints"),
        (name = "Version", description = "Application and environment version metadata")
    ),
    info(
        title = "ITILSuite REST API",
        version = "0.0.3",
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
        .route("/tickets/:id/followups", post(tickets::add_followup));

    Router::new()
        .nest("/api/v1", api_v1)
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .with_state(state)
}
