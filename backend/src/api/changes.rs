use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use utoipa::IntoParams;
use uuid::Uuid;

use crate::domain::auth::Claims;
use crate::domain::change::{
    ChangeApprovalDto, ChangeDetailDto, ChangeFollowupDto, ChangeSummaryDto,
    CreateChangeDto, CreateChangeFollowupDto, SubmitCabVoteDto, UpdateChangeDto,
};
use crate::error::AppError;
use crate::services::change_service::ChangeService;
use crate::state::AppState;

#[derive(Debug, Deserialize, IntoParams)]
pub struct ChangeFilterParams {
    pub entity_id: Option<Uuid>,
    pub status: Option<String>,
    pub change_type: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct AddApproverDto {
    pub approver_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct LinkTicketDto {
    pub ticket_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct LinkProblemDto {
    pub problem_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct LinkAssetDto {
    pub asset_id: Uuid,
}

#[utoipa::path(
    get,
    path = "/api/v1/changes",
    tag = "Change Enablement (RFC & CAB)",
    params(ChangeFilterParams),
    responses(
        (status = 200, description = "List of RFC Changes", body = Vec<ChangeSummaryDto>)
    )
)]
pub async fn list_changes(
    State(state): State<AppState>,
    Query(params): Query<ChangeFilterParams>,
) -> Result<Json<Vec<ChangeSummaryDto>>, AppError> {
    let limit = params.limit.unwrap_or(50).clamp(1, 200);
    let offset = params.offset.unwrap_or(0).max(0);
    let search = params.search.as_deref();
    let status = params.status.as_deref();
    let change_type = params.change_type.as_deref();

    let changes = ChangeService::list_changes(
        &state.pool,
        params.entity_id,
        status,
        change_type,
        search,
        limit,
        offset,
    )
    .await?;

    Ok(Json(changes))
}

#[utoipa::path(
    get,
    path = "/api/v1/changes/{id}",
    tag = "Change Enablement (RFC & CAB)",
    params(
        ("id" = Uuid, Path, description = "Change unique UUID")
    ),
    responses(
        (status = 200, description = "Detailed RFC Change info with CAB votes, plans and links", body = ChangeDetailDto),
        (status = 404, description = "Change not found")
    )
)]
pub async fn get_change(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ChangeDetailDto>, AppError> {
    let change = ChangeService::get_change_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Change {} not found", id)))?;

    Ok(Json(change))
}

#[utoipa::path(
    post,
    path = "/api/v1/changes",
    tag = "Change Enablement (RFC & CAB)",
    request_body = CreateChangeDto,
    responses(
        (status = 201, description = "RFC Change created successfully", body = ChangeSummaryDto)
    ),
    security(("bearer_auth" = []))
)]
pub async fn create_change(
    State(state): State<AppState>,
    claims: Option<Claims>,
    Json(payload): Json<CreateChangeDto>,
) -> Result<(StatusCode, Json<ChangeSummaryDto>), AppError> {
    let requester_id = claims.and_then(|c| Uuid::parse_str(&c.sub).ok());
    let change = ChangeService::create_change(&state.pool, payload, requester_id).await?;
    Ok((StatusCode::CREATED, Json(change)))
}

#[utoipa::path(
    put,
    path = "/api/v1/changes/{id}",
    tag = "Change Enablement (RFC & CAB)",
    params(
        ("id" = Uuid, Path, description = "Change unique UUID")
    ),
    request_body = UpdateChangeDto,
    responses(
        (status = 200, description = "RFC Change updated successfully", body = ChangeSummaryDto)
    ),
    security(("bearer_auth" = []))
)]
pub async fn update_change(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateChangeDto>,
) -> Result<Json<ChangeSummaryDto>, AppError> {
    let updated = ChangeService::update_change(&state.pool, id, payload).await?;
    Ok(Json(updated))
}

#[utoipa::path(
    post,
    path = "/api/v1/changes/{id}/approvals",
    tag = "Change Enablement (RFC & CAB)",
    params(
        ("id" = Uuid, Path, description = "Change unique UUID")
    ),
    request_body = SubmitCabVoteDto,
    responses(
        (status = 200, description = "CAB vote registered", body = ChangeApprovalDto)
    ),
    security(("bearer_auth" = []))
)]
pub async fn submit_cab_vote(
    State(state): State<AppState>,
    claims: Option<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SubmitCabVoteDto>,
) -> Result<Json<ChangeApprovalDto>, AppError> {
    let approver_id = claims
        .and_then(|c| Uuid::parse_str(&c.sub).ok())
        .ok_or_else(|| AppError::Unauthorized("Authentication required to vote in CAB".into()))?;

    let vote = ChangeService::submit_cab_vote(&state.pool, id, approver_id, payload).await?;
    Ok(Json(vote))
}

pub async fn add_cab_approver(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddApproverDto>,
) -> Result<StatusCode, AppError> {
    ChangeService::add_cab_approver(&state.pool, id, payload.approver_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn add_change_followup(
    State(state): State<AppState>,
    claims: Option<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateChangeFollowupDto>,
) -> Result<(StatusCode, Json<ChangeFollowupDto>), AppError> {
    let author_id = claims.and_then(|c| Uuid::parse_str(&c.sub).ok());
    let followup = ChangeService::add_followup(&state.pool, id, author_id, payload).await?;
    Ok((StatusCode::CREATED, Json(followup)))
}

pub async fn link_change_ticket(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<LinkTicketDto>,
) -> Result<StatusCode, AppError> {
    ChangeService::link_ticket(&state.pool, id, payload.ticket_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn unlink_change_ticket(
    State(state): State<AppState>,
    Path((id, ticket_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    ChangeService::unlink_ticket(&state.pool, id, ticket_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn link_change_problem(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<LinkProblemDto>,
) -> Result<StatusCode, AppError> {
    ChangeService::link_problem(&state.pool, id, payload.problem_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn unlink_change_problem(
    State(state): State<AppState>,
    Path((id, problem_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    ChangeService::unlink_problem(&state.pool, id, problem_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn link_change_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<LinkAssetDto>,
) -> Result<StatusCode, AppError> {
    ChangeService::link_asset(&state.pool, id, payload.asset_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn unlink_change_asset(
    State(state): State<AppState>,
    Path((id, asset_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    ChangeService::unlink_asset(&state.pool, id, asset_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/changes", get(list_changes).post(create_change))
        .route("/changes/:id", get(get_change).put(update_change))
        .route("/changes/:id/approvals", post(submit_cab_vote))
        .route("/changes/:id/approvers", post(add_cab_approver))
        .route("/changes/:id/followups", post(add_change_followup))
        .route("/changes/:id/tickets", post(link_change_ticket))
        .route("/changes/:id/tickets/:ticket_id", delete(unlink_change_ticket))
        .route("/changes/:id/problems", post(link_change_problem))
        .route("/changes/:id/problems/:problem_id", delete(unlink_change_problem))
        .route("/changes/:id/assets", post(link_change_asset))
        .route("/changes/:id/assets/:asset_id", delete(unlink_change_asset))
}
