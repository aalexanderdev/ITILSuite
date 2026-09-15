pub mod health;
pub mod version;

use axum::{routing::get, Router};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        health::health_check,
        version::get_version,
    ),
    components(
        schemas(
            health::HealthResponse,
            version::VersionResponse,
            crate::error::ErrorDetail,
            crate::error::ErrorResponse,
        )
    ),
    tags(
        (name = "Health", description = "Service monitoring and status endpoints"),
        (name = "Version", description = "Application and environment version metadata")
    ),
    info(
        title = "ITILSuite REST API",
        version = "0.0.1",
        description = "High-performance Rust REST API inspired by GLPI 11 for ITSM, ITAM, and CMDB.",
        license(name = "GPL-3.0-or-later", url = "https://www.gnu.org/licenses/gpl-3.0.html")
    )
)]
pub struct ApiDoc;

pub fn create_router(state: AppState) -> Router {
    let api_v1 = Router::new()
        .route("/health", get(health::health_check))
        .route("/version", get(version::get_version));

    Router::new()
        .nest("/api/v1", api_v1)
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .with_state(state)
}
