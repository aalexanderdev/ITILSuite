pub mod auth;
pub mod entities;
pub mod health;
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
            crate::error::ErrorDetail,
            crate::error::ErrorResponse,
        )
    ),
    modifiers(&SecurityAddon),
    tags(
        (name = "Authentication", description = "User authentication and JWT token lifecycle"),
        (name = "Entities", description = "Hierarchical Multi-Tenancy Entity management"),
        (name = "Users", description = "User profiles and identity"),
        (name = "Health", description = "Service monitoring and status endpoints"),
        (name = "Version", description = "Application and environment version metadata")
    ),
    info(
        title = "ITILSuite REST API",
        version = "0.0.2",
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
        .route("/users", get(users::list_users));

    Router::new()
        .nest("/api/v1", api_v1)
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .with_state(state)
}
