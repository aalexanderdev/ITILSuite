use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header, request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use crate::error::{AppError, ErrorDetail, ErrorResponse};
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Claims {
    /// Subject (User ID)
    pub sub: String,
    /// Username
    pub username: String,
    /// Real name or display name
    pub display_name: String,
    /// Profile ID
    pub profile_id: String,
    /// Profile Name (e.g. "Super-Admin", "Technician")
    pub profile_name: String,
    /// Active Entity ID
    pub entity_id: String,
    /// Expiration timestamp
    pub exp: usize,
    /// Issued at timestamp
    pub iat: usize,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginRequest {
    /// Account username (e.g., "admin")
    pub username: String,
    /// Account password
    pub password: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LoginResponse {
    /// JWT Bearer Token
    pub token: String,
    /// User ID
    pub user_id: Uuid,
    /// Username
    pub username: String,
    /// Display name
    pub display_name: String,
    /// Active profile name
    pub profile_name: String,
    /// Active entity ID
    pub entity_id: Uuid,
    /// Active entity name
    pub entity_name: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AuthUserResponse {
    pub user_id: Uuid,
    pub username: String,
    pub display_name: String,
    pub email: String,
    pub profile_name: String,
    pub entity_id: Uuid,
    pub entity_name: String,
    pub permissions: serde_json::Value,
}

/// Hash plain text password using Argon2id with random salt
pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::InternalServerError(format!("Password hashing failure: {}", e)))?
        .to_string();
    Ok(hash)
}

/// Verify plain text password against Argon2id hash
pub fn verify_password(hash: &str, password: &str) -> bool {
    let Ok(parsed_hash) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok()
}

/// Generate signed JWT token
pub fn create_jwt(claims: &Claims, secret: &str) -> Result<String, AppError> {
    encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::InternalServerError(format!("Token creation failure: {}", e)))
}

/// Validate and decode JWT token
pub fn verify_jwt(token: &str, secret: &str) -> Result<Claims, AppError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|_| AppError::Unauthorized("Invalid or expired authentication token".to_string()))
}

/// Axum extractor for authenticated requests with Bearer token
#[async_trait]
impl FromRequestParts<AppState> for Claims {
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok());

        let token = if let Some(auth) = auth_header {
            if auth.starts_with("Bearer ") {
                Some(auth["Bearer ".len()..].trim().to_string())
            } else {
                None
            }
        } else {
            None
        };

        let token = token.or_else(|| {
            let cookie_header = parts.headers.get(header::COOKIE)?.to_str().ok()?;
            for part in cookie_header.split(';') {
                let mut kv = part.trim().splitn(2, '=');
                if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                    if k == "itilsuite_session" {
                        return Some(v.trim().to_string());
                    }
                }
            }
            None
        });

        let Some(token) = token else {
            let error_response = ErrorResponse {
                error: ErrorDetail {
                    code: "UNAUTHORIZED".to_string(),
                    message: "Missing Authorization Bearer token or valid session cookie".to_string(),
                    details: None,
                },
            };
            return Err((StatusCode::UNAUTHORIZED, Json(error_response)).into_response());
        };

        let secret = &state.config.jwt_secret;
        verify_jwt(&token, secret).map_err(|e| e.into_response())
    }
}
