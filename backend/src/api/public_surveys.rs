use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};

use crate::domain::survey::*;
use crate::error::AppError;
use crate::services::survey_service::SurveyService;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/public/surveys/:token", get(get_public_survey))
        .route("/public/surveys/:token/draft", post(save_public_draft))
        .route("/public/surveys/:token/submit", post(submit_public_survey))
}

#[utoipa::path(
    get,
    path = "/api/v1/public/surveys/{token}",
    tag = "Public Surveys",
    responses(
        (status = 200, description = "Public survey details with draft answers and questions", body = PublicSurveyDto),
        (status = 400, description = "Survey expired or already completed", body = crate::error::ErrorResponse),
        (status = 404, description = "Survey token not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn get_public_survey(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<PublicSurveyDto>, AppError> {
    let survey_data = SurveyService::get_public_survey(&state.pool, &token).await?;
    Ok(Json(survey_data))
}

#[utoipa::path(
    post,
    path = "/api/v1/public/surveys/{token}/draft",
    tag = "Public Surveys",
    request_body = SaveDraftDto,
    responses(
        (status = 200, description = "Draft answers autosaved successfully"),
        (status = 400, description = "Survey expired or already completed", body = crate::error::ErrorResponse),
        (status = 404, description = "Survey token not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn save_public_draft(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(payload): Json<SaveDraftDto>,
) -> Result<StatusCode, AppError> {
    SurveyService::save_draft(&state.pool, &token, payload).await?;
    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/api/v1/public/surveys/{token}/submit",
    tag = "Public Surveys",
    request_body = SubmitSurveyDto,
    responses(
        (status = 200, description = "Survey submitted successfully"),
        (status = 400, description = "Survey expired or already completed", body = crate::error::ErrorResponse),
        (status = 404, description = "Survey token not found", body = crate::error::ErrorResponse)
    )
)]
pub async fn submit_public_survey(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<SubmitSurveyDto>,
) -> Result<StatusCode, AppError> {
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.trim().to_string())
        });

    SurveyService::submit_survey(&state.pool, &token, payload, client_ip).await?;
    Ok(StatusCode::OK)
}
