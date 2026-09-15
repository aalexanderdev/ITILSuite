use axum::{extract::State, Json};
use crate::domain::auth::Claims;
use crate::domain::user::UserSummaryDto;
use crate::error::AppError;
use crate::state::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/users",
    tag = "Users",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "List of active users in the system", body = Vec<UserSummaryDto>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn list_users(
    State(state): State<AppState>,
    _claims: Claims,
) -> Result<Json<Vec<UserSummaryDto>>, AppError> {
    let users = sqlx::query!(
        r#"
        SELECT u.id, u.username, u.email, u.realname, u.firstname, u.is_active,
               COALESCE(p.name, 'No Profile') as profile_name
        FROM users u
        LEFT JOIN user_profiles_entities upe ON upe.user_id = u.id
        LEFT JOIN profiles p ON p.id = upe.profile_id
        ORDER BY u.username ASC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to retrieve users: {}", e)))?;

    let summaries = users
        .into_iter()
        .map(|u| {
            let display_name = if !u.firstname.is_empty() || !u.realname.is_empty() {
                format!("{} {}", u.firstname, u.realname).trim().to_string()
            } else {
                u.username.clone()
            };

            UserSummaryDto {
                id: u.id,
                username: u.username,
                display_name,
                email: u.email,
                profile_name: u.profile_name.unwrap_or_else(|| "No Profile".to_string()),
                is_active: u.is_active,
            }
        })
        .collect();

    Ok(Json(summaries))
}
