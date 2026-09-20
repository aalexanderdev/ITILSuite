use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use uuid::Uuid;

use crate::domain::auth::Claims;
use crate::domain::survey::*;
use crate::error::AppError;
use crate::services::survey_service::SurveyService;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // Dashboard & Presets
        .route("/surveys/presets", get(list_presets))
        .route("/surveys/dashboard", get(get_dashboard_metrics))
        // Tokens
        .route("/surveys/tokens", get(list_tokens).post(generate_token))
        // Surveys CRUD & Actions
        .route("/surveys", get(list_surveys).post(create_survey))
        .route(
            "/surveys/:id",
            get(get_survey).put(update_survey).delete(delete_survey),
        )
        .route("/surveys/:id/clone", post(clone_survey))
        // Questions
        .route(
            "/surveys/:id/questions",
            get(list_questions).post(create_question),
        )
        .route("/surveys/:id/questions/reorder", post(reorder_questions))
        .route(
            "/surveys/questions/:question_id",
            put(update_question).delete(delete_question),
        )
        // Ticket Survey Token Helper
        .route("/tickets/:id/survey-token", post(generate_ticket_survey_token).get(get_ticket_survey_token))
}

// --- Query Structs ---

#[derive(Debug, Deserialize)]
pub struct ListSurveysQuery {
    pub entity_id: Option<Uuid>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct DashboardQuery {
    pub survey_id: Option<Uuid>,
    pub date_from: Option<DateTime<Utc>>,
    pub date_to: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct ListTokensQuery {
    pub survey_id: Option<Uuid>,
    pub ticket_id: Option<Uuid>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CloneSurveyRequest {
    pub name: Option<String>,
}

// --- Handlers ---

#[utoipa::path(
    get,
    path = "/api/v1/surveys/presets",
    tag = "Surveys",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "List of starter survey templates/presets", body = Vec<SurveyPresetDef>)
    )
)]
pub async fn list_presets(
    _claims: Claims,
) -> Result<Json<Vec<SurveyPresetDef>>, AppError> {
    Ok(Json(SurveyPresetDef::get_all()))
}

#[utoipa::path(
    get,
    path = "/api/v1/surveys/dashboard",
    tag = "Surveys",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Aggregated survey dashboard & NPS metrics", body = SurveyDashboardMetricsDto)
    )
)]
pub async fn get_dashboard_metrics(
    State(state): State<AppState>,
    _claims: Claims,
    Query(query): Query<DashboardQuery>,
) -> Result<Json<SurveyDashboardMetricsDto>, AppError> {
    let metrics = SurveyService::calculate_metrics(&state.pool, query.survey_id, query.date_from, query.date_to).await?;
    Ok(Json(metrics))
}

#[utoipa::path(
    get,
    path = "/api/v1/surveys",
    tag = "Surveys",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "List of surveys with metrics summary", body = Vec<SurveySummaryDto>)
    )
)]
pub async fn list_surveys(
    State(state): State<AppState>,
    _claims: Claims,
    Query(query): Query<ListSurveysQuery>,
) -> Result<Json<Vec<SurveySummaryDto>>, AppError> {
    let surveys = SurveyService::list_surveys(&state.pool, query.entity_id, query.is_active).await?;
    Ok(Json(surveys))
}

#[utoipa::path(
    get,
    path = "/api/v1/surveys/{id}",
    tag = "Surveys",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Survey details with nested questions and options", body = SurveyDetailDto),
        (status = 404, description = "Survey not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn get_survey(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<SurveyDetailDto>, AppError> {
    let survey = SurveyService::get_survey_detail(&state.pool, id).await?;
    Ok(Json(survey))
}

#[utoipa::path(
    post,
    path = "/api/v1/surveys",
    tag = "Surveys",
    request_body = CreateSurveyDto,
    security(("bearer_auth" = [])),
    responses(
        (status = 201, description = "Survey created successfully", body = SurveyDetailDto),
        (status = 400, description = "Invalid payload", body = crate::error::ErrorResponse)
    )
)]
pub async fn create_survey(
    State(state): State<AppState>,
    _claims: Claims,
    Json(payload): Json<CreateSurveyDto>,
) -> Result<(StatusCode, Json<SurveyDetailDto>), AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("El nombre de la encuesta es obligatorio".to_string()));
    }
    let survey = SurveyService::create_survey(&state.pool, payload).await?;
    Ok((StatusCode::CREATED, Json(survey)))
}

#[utoipa::path(
    put,
    path = "/api/v1/surveys/{id}",
    tag = "Surveys",
    request_body = UpdateSurveyDto,
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Survey updated successfully", body = SurveyDetailDto),
        (status = 404, description = "Survey not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn update_survey(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSurveyDto>,
) -> Result<Json<SurveyDetailDto>, AppError> {
    let survey = SurveyService::update_survey(&state.pool, id, payload).await?;
    Ok(Json(survey))
}

#[utoipa::path(
    delete,
    path = "/api/v1/surveys/{id}",
    tag = "Surveys",
    security(("bearer_auth" = [])),
    responses(
        (status = 204, description = "Survey deleted successfully"),
        (status = 404, description = "Survey not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn delete_survey(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    SurveyService::delete_survey(&state.pool, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/surveys/{id}/clone",
    tag = "Surveys",
    security(("bearer_auth" = [])),
    responses(
        (status = 201, description = "Survey deep cloned successfully", body = SurveyDetailDto),
        (status = 404, description = "Survey not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn clone_survey(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<CloneSurveyRequest>,
) -> Result<(StatusCode, Json<SurveyDetailDto>), AppError> {
    let survey = SurveyService::clone_survey(&state.pool, id, payload.name).await?;
    Ok((StatusCode::CREATED, Json(survey)))
}

// --- Questions Handlers ---

#[utoipa::path(
    get,
    path = "/api/v1/surveys/{id}/questions",
    tag = "Surveys",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "List of questions for a survey", body = Vec<SurveyQuestionDto>)
    )
)]
pub async fn list_questions(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<SurveyQuestionDto>>, AppError> {
    let questions = SurveyService::list_questions(&state.pool, id).await?;
    Ok(Json(questions))
}

#[utoipa::path(
    post,
    path = "/api/v1/surveys/{id}/questions",
    tag = "Surveys",
    request_body = CreateQuestionDto,
    security(("bearer_auth" = [])),
    responses(
        (status = 201, description = "Question created successfully", body = SurveyQuestionDto),
        (status = 400, description = "Invalid payload", body = crate::error::ErrorResponse)
    )
)]
pub async fn create_question(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateQuestionDto>,
) -> Result<(StatusCode, Json<SurveyQuestionDto>), AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("El texto de la pregunta es obligatorio".to_string()));
    }
    let q = SurveyService::create_question(&state.pool, id, payload).await?;
    Ok((StatusCode::CREATED, Json(q)))
}

#[utoipa::path(
    put,
    path = "/api/v1/surveys/questions/{question_id}",
    tag = "Surveys",
    request_body = UpdateQuestionDto,
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Question updated successfully", body = SurveyQuestionDto),
        (status = 404, description = "Question not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn update_question(
    State(state): State<AppState>,
    _claims: Claims,
    Path(question_id): Path<Uuid>,
    Json(payload): Json<UpdateQuestionDto>,
) -> Result<Json<SurveyQuestionDto>, AppError> {
    let q = SurveyService::update_question(&state.pool, question_id, payload).await?;
    Ok(Json(q))
}

#[utoipa::path(
    delete,
    path = "/api/v1/surveys/questions/{question_id}",
    tag = "Surveys",
    security(("bearer_auth" = [])),
    responses(
        (status = 204, description = "Question deleted successfully"),
        (status = 404, description = "Question not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn delete_question(
    State(state): State<AppState>,
    _claims: Claims,
    Path(question_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    SurveyService::delete_question(&state.pool, question_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/surveys/{id}/questions/reorder",
    tag = "Surveys",
    request_body = ReorderQuestionsDto,
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Questions reordered successfully")
    )
)]
pub async fn reorder_questions(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReorderQuestionsDto>,
) -> Result<StatusCode, AppError> {
    SurveyService::reorder_questions(&state.pool, id, payload).await?;
    Ok(StatusCode::OK)
}

// --- Tokens Handlers ---

#[utoipa::path(
    get,
    path = "/api/v1/surveys/tokens",
    tag = "Surveys",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "List of survey response tokens", body = Vec<SurveyTokenDto>)
    )
)]
pub async fn list_tokens(
    State(state): State<AppState>,
    _claims: Claims,
    Query(query): Query<ListTokensQuery>,
) -> Result<Json<Vec<SurveyTokenDto>>, AppError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let offset = query.offset.unwrap_or(0).max(0);
    let tokens = SurveyService::list_tokens(
        &state.pool,
        query.survey_id,
        query.ticket_id,
        query.status,
        limit,
        offset,
        None,
    )
    .await?;
    Ok(Json(tokens))
}

#[utoipa::path(
    post,
    path = "/api/v1/surveys/tokens",
    tag = "Surveys",
    request_body = GenerateTokenDto,
    security(("bearer_auth" = [])),
    responses(
        (status = 201, description = "Survey token generated successfully", body = SurveyTokenDto)
    )
)]
pub async fn generate_token(
    State(state): State<AppState>,
    _claims: Claims,
    Json(payload): Json<GenerateTokenDto>,
) -> Result<(StatusCode, Json<SurveyTokenDto>), AppError> {
    let token = SurveyService::generate_token(
        &state.pool,
        payload.survey_id,
        payload.ticket_id,
        payload.requester_email,
        None,
    )
    .await?;
    Ok((StatusCode::CREATED, Json(token)))
}

#[utoipa::path(
    post,
    path = "/api/v1/tickets/{id}/survey-token",
    tag = "Tickets",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Satisfaction survey token for the ticket", body = SurveyTokenDto)
    )
)]
pub async fn generate_ticket_survey_token(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<SurveyTokenDto>, AppError> {
    let token = SurveyService::generate_token(&state.pool, None, Some(id), None, None).await?;
    Ok(Json(token))
}

#[utoipa::path(
    get,
    path = "/api/v1/tickets/{id}/survey-token",
    tag = "Tickets",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Fetch existing satisfaction survey token for the ticket", body = Option<SurveyTokenDto>)
    )
)]
pub async fn get_ticket_survey_token(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<Option<SurveyTokenDto>>, AppError> {
    let tokens = SurveyService::list_tokens(&state.pool, None, Some(id), None, 1, 0, None).await?;
    Ok(Json(tokens.into_iter().next()))
}
