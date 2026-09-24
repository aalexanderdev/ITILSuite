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
use crate::domain::problem::{
    CreateKedbArticleDto, CreateProblemDto, CreateProblemFollowupDto, KedbArticleSummaryDto,
    ProblemDetailDto, ProblemFollowupDto, ProblemSummaryDto, UpdateKedbArticleDto, UpdateProblemDto,
};
use crate::error::AppError;
use crate::services::problem_service::ProblemService;
use crate::state::AppState;

#[derive(Debug, Deserialize, IntoParams)]
pub struct ProblemFilterParams {
    pub entity_id: Option<Uuid>,
    pub status: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct KedbFilterParams {
    pub entity_id: Option<Uuid>,
    pub status: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct LinkTicketDto {
    pub ticket_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct LinkAssetDto {
    pub asset_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CreateKedbFromProblemDto {
    pub title: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/problems",
    tag = "Problems & RCA",
    params(ProblemFilterParams),
    responses(
        (status = 200, description = "List of ITIL problems", body = Vec<ProblemSummaryDto>)
    )
)]
pub async fn list_problems(
    State(state): State<AppState>,
    Query(params): Query<ProblemFilterParams>,
) -> Result<Json<Vec<ProblemSummaryDto>>, AppError> {
    let limit = params.limit.unwrap_or(50).clamp(1, 200);
    let offset = params.offset.unwrap_or(0).max(0);
    let search = params.search.as_deref();
    let status = params.status.as_deref();

    let problems = ProblemService::list_problems(
        &state.pool,
        params.entity_id,
        status,
        search,
        limit,
        offset,
    )
    .await?;

    Ok(Json(problems))
}

#[utoipa::path(
    get,
    path = "/api/v1/problems/{id}",
    tag = "Problems & RCA",
    params(
        ("id" = Uuid, Path, description = "Problem unique UUID")
    ),
    responses(
        (status = 200, description = "Detailed problem info with followups and links", body = ProblemDetailDto),
        (status = 404, description = "Problem not found")
    )
)]
pub async fn get_problem(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProblemDetailDto>, AppError> {
    let problem = ProblemService::get_problem_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Problem {} not found", id)))?;

    Ok(Json(problem))
}

#[utoipa::path(
    post,
    path = "/api/v1/problems",
    tag = "Problems & RCA",
    request_body = CreateProblemDto,
    responses(
        (status = 201, description = "Problem created successfully", body = ProblemSummaryDto)
    ),
    security(("bearer_auth" = []))
)]
pub async fn create_problem(
    State(state): State<AppState>,
    claims: Option<Claims>,
    Json(payload): Json<CreateProblemDto>,
) -> Result<(StatusCode, Json<ProblemSummaryDto>), AppError> {
    let requester_id = claims.and_then(|c| Uuid::parse_str(&c.sub).ok());
    let problem = ProblemService::create_problem(&state.pool, payload, requester_id).await?;
    Ok((StatusCode::CREATED, Json(problem)))
}

#[utoipa::path(
    put,
    path = "/api/v1/problems/{id}",
    tag = "Problems & RCA",
    params(
        ("id" = Uuid, Path, description = "Problem unique UUID")
    ),
    request_body = UpdateProblemDto,
    responses(
        (status = 200, description = "Problem updated successfully", body = ProblemSummaryDto)
    ),
    security(("bearer_auth" = []))
)]
pub async fn update_problem(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProblemDto>,
) -> Result<Json<ProblemSummaryDto>, AppError> {
    let updated = ProblemService::update_problem(&state.pool, id, payload).await?;
    Ok(Json(updated))
}

#[utoipa::path(
    post,
    path = "/api/v1/problems/{id}/followups",
    tag = "Problems & RCA",
    params(
        ("id" = Uuid, Path, description = "Problem unique UUID")
    ),
    request_body = CreateProblemFollowupDto,
    responses(
        (status = 201, description = "Followup or RCA note added", body = ProblemFollowupDto)
    ),
    security(("bearer_auth" = []))
)]
pub async fn add_problem_followup(
    State(state): State<AppState>,
    claims: Option<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateProblemFollowupDto>,
) -> Result<(StatusCode, Json<ProblemFollowupDto>), AppError> {
    let author_id = claims.and_then(|c| Uuid::parse_str(&c.sub).ok());
    let followup = ProblemService::add_followup(&state.pool, id, author_id, payload).await?;
    Ok((StatusCode::CREATED, Json(followup)))
}

pub async fn link_problem_ticket(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<LinkTicketDto>,
) -> Result<StatusCode, AppError> {
    ProblemService::link_ticket(&state.pool, id, payload.ticket_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn unlink_problem_ticket(
    State(state): State<AppState>,
    Path((id, ticket_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    ProblemService::unlink_ticket(&state.pool, id, ticket_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn link_problem_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<LinkAssetDto>,
) -> Result<StatusCode, AppError> {
    ProblemService::link_asset(&state.pool, id, payload.asset_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn unlink_problem_asset(
    State(state): State<AppState>,
    Path((id, asset_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    ProblemService::unlink_asset(&state.pool, id, asset_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn create_kedb_from_problem(
    State(state): State<AppState>,
    claims: Option<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateKedbFromProblemDto>,
) -> Result<(StatusCode, Json<KedbArticleSummaryDto>), AppError> {
    let author_id = claims.and_then(|c| Uuid::parse_str(&c.sub).ok());
    let article = ProblemService::create_kedb_from_problem(&state.pool, id, author_id, payload.title).await?;
    Ok((StatusCode::CREATED, Json(article)))
}

// ============================================================================
// KEDB Endpoints
// ============================================================================

#[utoipa::path(
    get,
    path = "/api/v1/kedb",
    tag = "Known Error Database (KEDB)",
    params(KedbFilterParams),
    responses(
        (status = 200, description = "List of KEDB articles", body = Vec<KedbArticleSummaryDto>)
    )
)]
pub async fn list_kedb(
    State(state): State<AppState>,
    Query(params): Query<KedbFilterParams>,
) -> Result<Json<Vec<KedbArticleSummaryDto>>, AppError> {
    let limit = params.limit.unwrap_or(50).clamp(1, 200);
    let offset = params.offset.unwrap_or(0).max(0);
    let search = params.search.as_deref();
    let status = params.status.as_deref();

    let articles = ProblemService::list_kedb_articles(
        &state.pool,
        params.entity_id,
        status,
        search,
        limit,
        offset,
    )
    .await?;

    Ok(Json(articles))
}

#[utoipa::path(
    get,
    path = "/api/v1/kedb/{id}",
    tag = "Known Error Database (KEDB)",
    params(
        ("id" = Uuid, Path, description = "KEDB Article UUID")
    ),
    responses(
        (status = 200, description = "KEDB article details", body = KedbArticleSummaryDto),
        (status = 404, description = "Article not found")
    )
)]
pub async fn get_kedb(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<KedbArticleSummaryDto>, AppError> {
    let article = ProblemService::get_kedb_article_by_id(&state.pool, id, true)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("KEDB article {} not found", id)))?;

    Ok(Json(article))
}

#[utoipa::path(
    post,
    path = "/api/v1/kedb",
    tag = "Known Error Database (KEDB)",
    request_body = CreateKedbArticleDto,
    responses(
        (status = 201, description = "KEDB article created successfully", body = KedbArticleSummaryDto)
    ),
    security(("bearer_auth" = []))
)]
pub async fn create_kedb(
    State(state): State<AppState>,
    claims: Option<Claims>,
    Json(payload): Json<CreateKedbArticleDto>,
) -> Result<(StatusCode, Json<KedbArticleSummaryDto>), AppError> {
    let author_id = claims.and_then(|c| Uuid::parse_str(&c.sub).ok());
    let article = ProblemService::create_kedb_article(&state.pool, payload, author_id).await?;
    Ok((StatusCode::CREATED, Json(article)))
}

#[utoipa::path(
    put,
    path = "/api/v1/kedb/{id}",
    tag = "Known Error Database (KEDB)",
    params(
        ("id" = Uuid, Path, description = "KEDB Article UUID")
    ),
    request_body = UpdateKedbArticleDto,
    responses(
        (status = 200, description = "KEDB article updated successfully", body = KedbArticleSummaryDto)
    ),
    security(("bearer_auth" = []))
)]
pub async fn update_kedb(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateKedbArticleDto>,
) -> Result<Json<KedbArticleSummaryDto>, AppError> {
    let updated = ProblemService::update_kedb_article(&state.pool, id, payload).await?;
    Ok(Json(updated))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/problems", get(list_problems).post(create_problem))
        .route("/problems/:id", get(get_problem).put(update_problem))
        .route("/problems/:id/followups", post(add_problem_followup))
        .route("/problems/:id/tickets", post(link_problem_ticket))
        .route("/problems/:id/tickets/:ticket_id", delete(unlink_problem_ticket))
        .route("/problems/:id/assets", post(link_problem_asset))
        .route("/problems/:id/assets/:asset_id", delete(unlink_problem_asset))
        .route("/problems/:id/kedb", post(create_kedb_from_problem))
        .route("/kedb", get(list_kedb).post(create_kedb))
        .route("/kedb/:id", get(get_kedb).put(update_kedb))
}
