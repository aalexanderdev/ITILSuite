use axum::{extract::State, Json};
use chrono::Utc;
use uuid::Uuid;
pub use crate::domain::auth::{
    create_jwt, verify_password, AuthUserResponse, Claims, LoginRequest, LoginResponse,
};
use crate::error::AppError;
use crate::state::AppState;

#[derive(sqlx::FromRow)]
struct UserAuthRow {
    id: Uuid,
    username: String,
    password_hash: String,
    realname: String,
    firstname: String,
    is_active: bool,
}

#[derive(sqlx::FromRow)]
struct UserRoleRow {
    profile_id: Uuid,
    profile_name: String,
    entity_id: Uuid,
    entity_name: String,
}

#[derive(sqlx::FromRow)]
struct UserMeRow {
    id: Uuid,
    username: String,
    email: String,
    realname: String,
    firstname: String,
    profile_name: String,
    rights: serde_json::Value,
    entity_id: Uuid,
    entity_name: String,
}

#[utoipa::path(
    post,
    path = "/api/v1/auth/login",
    tag = "Authentication",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Successfully authenticated", body = LoginResponse),
        (status = 401, description = "Invalid credentials", body = crate::error::ErrorResponse)
    )
)]
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    // 1. Fetch user by username
    let user: Option<UserAuthRow> = sqlx::query_as(
        "SELECT id, username, password_hash, realname, firstname, is_active FROM users WHERE username = $1"
    )
    .bind(&payload.username)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Database query failure: {}", e)))?;

    let user = user.ok_or_else(|| AppError::Unauthorized("Invalid username or password".to_string()))?;

    if !user.is_active {
        return Err(AppError::Forbidden("Account has been disabled".to_string()));
    }

    // 2. Verify password with Argon2id
    if !verify_password(&user.password_hash, &payload.password) {
        return Err(AppError::Unauthorized("Invalid username or password".to_string()));
    }

    // 3. Retrieve user profile and primary entity
    let user_role: Option<UserRoleRow> = sqlx::query_as(
        r#"
        SELECT 
            p.id as profile_id,
            p.name as profile_name,
            e.id as entity_id,
            e.name as entity_name
        FROM user_profiles_entities upe
        JOIN profiles p ON p.id = upe.profile_id
        JOIN entities e ON e.id = upe.entity_id
        WHERE upe.user_id = $1
        ORDER BY p.name ASC
        LIMIT 1
        "#
    )
    .bind(user.id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Role query failure: {}", e)))?;

    let user_role = user_role.ok_or_else(|| AppError::Forbidden("User has no assigned profile or entity".to_string()))?;

    let display_name = if !user.firstname.is_empty() || !user.realname.is_empty() {
        format!("{} {}", user.firstname, user.realname).trim().to_string()
    } else {
        user.username.clone()
    };

    // 4. Generate JWT Token
    let now = Utc::now().timestamp() as usize;
    let exp = now + (state.config.jwt_expiration_hours as usize * 3600);

    let claims = Claims {
        sub: user.id.to_string(),
        username: user.username.clone(),
        display_name: display_name.clone(),
        profile_id: user_role.profile_id.to_string(),
        profile_name: user_role.profile_name.clone(),
        entity_id: user_role.entity_id.to_string(),
        exp,
        iat: now,
    };

    let token = create_jwt(&claims, &state.config.jwt_secret)?;

    Ok(Json(LoginResponse {
        token,
        user_id: user.id,
        username: user.username,
        display_name,
        profile_name: user_role.profile_name,
        entity_id: user_role.entity_id,
        entity_name: user_role.entity_name,
    }))
}

#[utoipa::path(
    get,
    path = "/api/v1/auth/me",
    tag = "Authentication",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "Authenticated user profile and permissions", body = AuthUserResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn me(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<AuthUserResponse>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user identity in token".to_string()))?;

    let user: Option<UserMeRow> = sqlx::query_as(
        r#"
        SELECT u.id, u.username, u.email, u.realname, u.firstname,
               p.name as profile_name, p.rights,
               e.id as entity_id, e.name as entity_name
        FROM users u
        JOIN user_profiles_entities upe ON upe.user_id = u.id
        JOIN profiles p ON p.id = upe.profile_id
        JOIN entities e ON e.id = upe.entity_id
        WHERE u.id = $1
        LIMIT 1
        "#
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("User lookup failure: {}", e)))?;

    let user = user.ok_or_else(|| AppError::NotFound("User profile not found".to_string()))?;

    let display_name = if !user.firstname.is_empty() || !user.realname.is_empty() {
        format!("{} {}", user.firstname, user.realname).trim().to_string()
    } else {
        user.username.clone()
    };

    Ok(Json(AuthUserResponse {
        user_id: user.id,
        username: user.username,
        display_name,
        email: user.email,
        profile_name: user.profile_name,
        entity_id: user.entity_id,
        entity_name: user.entity_name,
        permissions: user.rights,
    }))
}
