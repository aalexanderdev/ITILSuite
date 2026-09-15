use axum::Json;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Serialize, ToSchema)]
pub struct VersionResponse {
    /// Name of the suite application
    pub app_name: String,
    /// Semantic version of the build
    pub version: String,
    /// Human-readable description of the package
    pub description: String,
    /// Git commit SHA or build identifier
    pub git_commit: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/version",
    tag = "Version",
    responses(
        (status = 200, description = "Application version metadata", body = VersionResponse)
    )
)]
pub async fn get_version() -> Json<VersionResponse> {
    Json(VersionResponse {
        app_name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        description: env!("CARGO_PKG_DESCRIPTION").to_string(),
        git_commit: option_env!("GIT_COMMIT").map(|s| s.to_string()),
    })
}
