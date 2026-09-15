use axum::{extract::State, Json};
use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;
use crate::state::AppState;

#[derive(Debug, Serialize, ToSchema)]
pub struct HealthResponse {
    /// Overall service status ("ok", "degraded", etc.)
    pub status: String,
    /// Number of seconds the service has been running
    pub uptime_seconds: u64,
    /// Current UTC timestamp
    pub timestamp: DateTime<Utc>,
    /// Active runtime environment (development, production)
    pub environment: String,
}

#[utoipa::path(
    get,
    path = "/api/v1/health",
    tag = "Health",
    responses(
        (status = 200, description = "Service is healthy and operating normally", body = HealthResponse)
    )
)]
pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let uptime = state.start_time.elapsed().as_secs();

    Json(HealthResponse {
        status: "ok".to_string(),
        uptime_seconds: uptime,
        timestamp: Utc::now(),
        environment: state.config.environment.clone(),
    })
}
