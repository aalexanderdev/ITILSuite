use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use uuid::Uuid;

use crate::domain::agent::{AgentSimulationPresetRequest, GlpiAgentPayload};
use crate::error::AppError;
use crate::services::agent_service::AgentService;
use crate::state::AppState;

#[utoipa::path(
    post,
    path = "/api/v1/inventory/agent",
    request_body = GlpiAgentPayload,
    responses(
        (status = 200, description = "Inventory processed and reconciled", body = GlpiAgentResponse)
    ),
    tag = "GLPI Agent Inventory"
)]
pub async fn handle_agent_inventory(
    State(state): State<AppState>,
    Json(payload): Json<GlpiAgentPayload>,
) -> Result<impl IntoResponse, AppError> {
    let root_entity_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
    let response = AgentService::process_agent_payload(&state.pool, root_entity_id, payload).await?;
    Ok((StatusCode::OK, Json(response)))
}

#[utoipa::path(
    post,
    path = "/api/v1/inventory/agent/simulate",
    request_body = AgentSimulationPresetRequest,
    responses(
        (status = 200, description = "Simulation executed successfully", body = GlpiAgentResponse)
    ),
    tag = "GLPI Agent Inventory"
)]
pub async fn simulate_agent_inventory(
    State(state): State<AppState>,
    Json(req): Json<AgentSimulationPresetRequest>,
) -> Result<impl IntoResponse, AppError> {
    let entity_id = req
        .entity_id
        .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap());

    let payload = AgentService::get_preset_payload(&req.preset_name);
    let response = AgentService::process_agent_payload(&state.pool, entity_id, payload).await?;
    Ok((StatusCode::OK, Json(response)))
}
