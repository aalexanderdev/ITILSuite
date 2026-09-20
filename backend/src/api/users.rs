use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::domain::auth::{hash_password, Claims};
use crate::domain::user::{
    BatchUserImportRequest, BatchUserImportResponse, BatchUserImportRowResult,
    ConflictResolutionMode, CreateUserDto, UpdateUserDto, UserDetailDto,
    UserGroupMembershipDto, UserSummaryDto,
};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct UserFilterQuery {
    pub is_active: Option<bool>,
    pub group_id: Option<Uuid>,
    pub profile_id: Option<Uuid>,
    pub search: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/users",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(
        ("is_active" = Option<bool>, Query, description = "Filter by active status"),
        ("group_id" = Option<Uuid>, Query, description = "Filter by transversal group ID"),
        ("profile_id" = Option<Uuid>, Query, description = "Filter by RBAC profile ID"),
        ("search" = Option<String>, Query, description = "Search query for username, realname, email")
    ),
    responses(
        (status = 200, description = "List of users in the system", body = Vec<UserSummaryDto>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn list_users(
    State(state): State<AppState>,
    _claims: Claims,
    Query(query): Query<UserFilterQuery>,
) -> Result<Json<Vec<UserSummaryDto>>, AppError> {
    let search_pattern = query.search.as_ref().map(|s| format!("%{}%", s.to_lowercase()));

    let users = sqlx::query!(
        r#"
        SELECT 
            u.id, 
            u.username, 
            u.email, 
            u.realname, 
            u.firstname, 
            u.is_active,
            COALESCE(p.name, 'No Profile') as "profile_name!",
            COALESCE(
                array_agg(g.name) FILTER (WHERE g.name IS NOT NULL),
                '{}'::varchar[]
            ) as "groups!"
        FROM users u
        LEFT JOIN user_profiles_entities upe ON upe.user_id = u.id
        LEFT JOIN profiles p ON p.id = upe.profile_id
        LEFT JOIN group_users gu ON gu.user_id = u.id
        LEFT JOIN groups g ON g.id = gu.group_id
        WHERE ($1::boolean IS NULL OR u.is_active = $1)
          AND ($2::uuid IS NULL OR gu.group_id = $2)
          AND ($3::uuid IS NULL OR p.id = $3)
          AND ($4::text IS NULL OR 
               LOWER(u.username) LIKE $4 OR 
               LOWER(u.email) LIKE $4 OR 
               LOWER(u.realname) LIKE $4 OR 
               LOWER(u.firstname) LIKE $4)
        GROUP BY u.id, u.username, u.email, u.realname, u.firstname, u.is_active, p.name
        ORDER BY u.username ASC
        "#,
        query.is_active,
        query.group_id,
        query.profile_id,
        search_pattern
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
                profile_name: u.profile_name,
                is_active: u.is_active,
                groups: u.groups,
            }
        })
        .collect();

    Ok(Json(summaries))
}

#[utoipa::path(
    post,
    path = "/api/v1/users",
    tag = "Users",
    security(("bearer_auth" = [])),
    request_body = CreateUserDto,
    responses(
        (status = 201, description = "User created successfully", body = UserDetailDto),
        (status = 400, description = "Validation error", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn create_user(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateUserDto>,
) -> Result<(StatusCode, Json<UserDetailDto>), AppError> {
    if payload.username.trim().is_empty() || payload.email.trim().is_empty() {
        return Err(AppError::BadRequest("Username y Email son obligatorios".to_string()));
    }

    let mut tx = state.pool.begin().await?;

    let user_id = Uuid::new_v4();
    let raw_pwd = payload.password.unwrap_or_else(|| "WelcomeITIL2026!".to_string());
    let pwd_hash = hash_password(&raw_pwd)
        .map_err(|e| AppError::InternalServerError(format!("Error hashing password: {:?}", e)))?;

    let fn_str = payload.firstname.unwrap_or_default();
    let rn_str = payload.realname.unwrap_or_default();
    let is_act = payload.is_active.unwrap_or(true);

    sqlx::query!(
        r#"
        INSERT INTO users (id, username, password_hash, email, firstname, realname, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
        user_id,
        payload.username.trim(),
        pwd_hash,
        payload.email.trim().to_lowercase(),
        fn_str,
        rn_str,
        is_act
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::BadRequest(format!("Error al crear usuario (puede estar duplicado): {}", e)))?;

    // Map Profile and Entity
    let target_entity = payload.entity_id.unwrap_or_else(|| {
        Uuid::parse_str(&claims.entity_id)
            .unwrap_or_else(|_| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
    });
    let target_profile = match payload.profile_id {
        Some(pid) => pid,
        None => {
            // Default to Self-Service
            let default_prof = sqlx::query!("SELECT id FROM profiles WHERE is_default = TRUE LIMIT 1")
                .fetch_optional(&mut *tx)
                .await?;
            default_prof.map(|p| p.id).unwrap_or_else(|| {
                Uuid::parse_str(&claims.profile_id)
                    .unwrap_or_else(|_| Uuid::parse_str("00000000-0000-0000-0000-000000000012").unwrap())
            })
        }
    };

    sqlx::query!(
        r#"
        INSERT INTO user_profiles_entities (user_id, profile_id, entity_id, is_recursive)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (user_id, profile_id, entity_id) DO NOTHING
        "#,
        user_id,
        target_profile,
        target_entity
    )
    .execute(&mut *tx)
    .await?;

    // Map initial groups if specified
    let mut assigned_groups = Vec::new();
    if let Some(group_ids) = payload.initial_group_ids {
        for gid in group_ids {
            let group_row = sqlx::query!("SELECT name FROM groups WHERE id = $1", gid)
                .fetch_optional(&mut *tx)
                .await?;

            if let Some(grow) = group_row {
                let _ = sqlx::query!(
                    r#"
                    INSERT INTO group_users (group_id, user_id, is_manager, is_user)
                    VALUES ($1, $2, FALSE, TRUE)
                    ON CONFLICT (group_id, user_id) DO NOTHING
                    "#,
                    gid,
                    user_id
                )
                .execute(&mut *tx)
                .await;

                assigned_groups.push(UserGroupMembershipDto {
                    group_id: gid,
                    group_name: grow.name,
                    is_manager: false,
                });
            }
        }
    }

    let prof_name = sqlx::query!("SELECT name FROM profiles WHERE id = $1", target_profile)
        .fetch_optional(&mut *tx)
        .await?
        .map(|p| p.name)
        .unwrap_or_else(|| "General".to_string());

    let ent_name = sqlx::query!("SELECT name FROM entities WHERE id = $1", target_entity)
        .fetch_optional(&mut *tx)
        .await?
        .map(|e| e.name)
        .unwrap_or_else(|| "Root Entity".to_string());

    tx.commit().await?;

    let display_name = if !fn_str.is_empty() || !rn_str.is_empty() {
        format!("{} {}", fn_str, rn_str).trim().to_string()
    } else {
        payload.username.clone()
    };

    Ok((
        StatusCode::CREATED,
        Json(UserDetailDto {
            id: user_id,
            username: payload.username,
            email: payload.email,
            realname: rn_str,
            firstname: fn_str,
            display_name,
            is_active: is_act,
            profile_name: prof_name,
            profile_id: Some(target_profile),
            entity_name: ent_name,
            entity_id: Some(target_entity),
            groups: assigned_groups,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/users/{id}",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "User detail", body = UserDetailDto),
        (status = 404, description = "User not found", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn get_user(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<UserDetailDto>, AppError> {
    let user = sqlx::query!(
        r#"
        SELECT 
            u.id, 
            u.username, 
            u.email, 
            u.realname, 
            u.firstname, 
            u.is_active,
            u.created_at,
            u.updated_at,
            p.id as "profile_id?",
            p.name as "profile_name?",
            e.id as "entity_id?",
            e.name as "entity_name?"
        FROM users u
        LEFT JOIN user_profiles_entities upe ON upe.user_id = u.id
        LEFT JOIN profiles p ON p.id = upe.profile_id
        LEFT JOIN entities e ON e.id = upe.entity_id
        WHERE u.id = $1
        ORDER BY upe.created_at ASC
        LIMIT 1
        "#,
        id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Database error: {}", e)))?
    .ok_or_else(|| AppError::NotFound(format!("Usuario {} no encontrado", id)))?;

    let groups = sqlx::query!(
        r#"
        SELECT g.id as group_id, g.name as group_name, gu.is_manager
        FROM group_users gu
        JOIN groups g ON gu.group_id = g.id
        WHERE gu.user_id = $1
        ORDER BY g.name ASC
        "#,
        id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Database error: {}", e)))?;

    let group_dtos = groups
        .into_iter()
        .map(|g| UserGroupMembershipDto {
            group_id: g.group_id,
            group_name: g.group_name,
            is_manager: g.is_manager,
        })
        .collect();

    let display_name = if !user.firstname.is_empty() || !user.realname.is_empty() {
        format!("{} {}", user.firstname, user.realname).trim().to_string()
    } else {
        user.username.clone()
    };

    Ok(Json(UserDetailDto {
        id: user.id,
        username: user.username,
        email: user.email,
        realname: user.realname,
        firstname: user.firstname,
        display_name,
        is_active: user.is_active,
        profile_name: user.profile_name.unwrap_or_else(|| "No Profile".to_string()),
        profile_id: user.profile_id,
        entity_name: user.entity_name.unwrap_or_else(|| "Root Entity".to_string()),
        entity_id: user.entity_id,
        groups: group_dtos,
        created_at: user.created_at,
        updated_at: user.updated_at,
    }))
}

#[utoipa::path(
    patch,
    path = "/api/v1/users/{id}",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "User ID")
    ),
    request_body = UpdateUserDto,
    responses(
        (status = 200, description = "User updated successfully"),
        (status = 404, description = "User not found", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn update_user(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateUserDto>,
) -> Result<StatusCode, AppError> {
    let mut tx = state.pool.begin().await?;

    let current = sqlx::query!(
        "SELECT email, firstname, realname, is_active FROM users WHERE id = $1",
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Usuario {} no encontrado", id)))?;

    let new_email = payload.email.unwrap_or(current.email);
    let new_fn = payload.firstname.unwrap_or(current.firstname);
    let new_rn = payload.realname.unwrap_or(current.realname);
    let new_act = payload.is_active.unwrap_or(current.is_active);

    if let Some(pwd) = payload.password {
        let pwd_hash = hash_password(&pwd)
            .map_err(|e| AppError::InternalServerError(format!("Error hashing password: {:?}", e)))?;
        sqlx::query!(
            r#"
            UPDATE users
            SET email = $1, firstname = $2, realname = $3, is_active = $4, password_hash = $5, updated_at = NOW()
            WHERE id = $6
            "#,
            new_email,
            new_fn,
            new_rn,
            new_act,
            pwd_hash,
            id
        )
        .execute(&mut *tx)
        .await?;
    } else {
        sqlx::query!(
            r#"
            UPDATE users
            SET email = $1, firstname = $2, realname = $3, is_active = $4, updated_at = NOW()
            WHERE id = $5
            "#,
            new_email,
            new_fn,
            new_rn,
            new_act,
            id
        )
        .execute(&mut *tx)
        .await?;
    }

    if let (Some(pid), Some(eid)) = (payload.profile_id, payload.entity_id) {
        sqlx::query!(
            r#"
            INSERT INTO user_profiles_entities (user_id, profile_id, entity_id, is_recursive)
            VALUES ($1, $2, $3, TRUE)
            ON CONFLICT (user_id, profile_id, entity_id) DO NOTHING
            "#,
            id,
            pid,
            eid
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    delete,
    path = "/api/v1/users/{id}",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "User ID")
    ),
    responses(
        (status = 204, description = "User deactivated or deleted successfully"),
        (status = 404, description = "User not found", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn delete_user(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    // Soft toggle to inactive for audit safety
    let result = sqlx::query!(
        "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
        id
    )
    .execute(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Error: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Usuario {} no encontrado", id)));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/users/batch-import",
    tag = "Users",
    security(("bearer_auth" = [])),
    request_body = BatchUserImportRequest,
    responses(
        (status = 200, description = "Batch import execution summary", body = BatchUserImportResponse),
        (status = 400, description = "Bad Request", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn batch_import_users(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<BatchUserImportRequest>,
) -> Result<Json<BatchUserImportResponse>, AppError> {
    if payload.users.is_empty() {
        return Err(AppError::BadRequest("No se proporcionaron usuarios para importar".to_string()));
    }

    let default_pwd = payload
        .default_password
        .as_deref()
        .unwrap_or("WelcomeITIL2026!");
    let default_pwd_hash = hash_password(default_pwd)
        .map_err(|e| AppError::InternalServerError(format!("Error hashing default password: {:?}", e)))?;

    let default_entity = payload.default_entity_id.unwrap_or_else(|| {
        Uuid::parse_str(&claims.entity_id)
            .unwrap_or_else(|_| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
    });
    let default_profile = match payload.default_profile_id {
        Some(pid) => pid,
        None => {
            let row = sqlx::query!("SELECT id FROM profiles WHERE is_default = TRUE LIMIT 1")
                .fetch_optional(&state.pool)
                .await?;
            row.map(|r| r.id).unwrap_or_else(|| {
                Uuid::parse_str(&claims.profile_id)
                    .unwrap_or_else(|_| Uuid::parse_str("00000000-0000-0000-0000-000000000012").unwrap())
            })
        }
    };

    let mut created_count = 0;
    let mut updated_count = 0;
    let mut skipped_count = 0;
    let mut failed_count = 0;
    let mut results = Vec::new();

    for item in payload.users {
        let uname = item.username.trim();
        let uemail = item.email.trim().to_lowercase();

        if uname.is_empty() || uemail.is_empty() {
            failed_count += 1;
            results.push(BatchUserImportRowResult {
                username: uname.to_string(),
                email: uemail,
                status: "failed".to_string(),
                message: Some("El nombre de usuario y correo son obligatorios".to_string()),
            });
            continue;
        }

        // Check if user already exists
        let existing = sqlx::query!(
            "SELECT id FROM users WHERE username = $1 OR email = $2",
            uname,
            uemail
        )
        .fetch_optional(&state.pool)
        .await;

        match existing {
            Ok(Some(ex_user)) => {
                match payload.conflict_resolution {
                    ConflictResolutionMode::Skip => {
                        skipped_count += 1;
                        results.push(BatchUserImportRowResult {
                            username: uname.to_string(),
                            email: uemail,
                            status: "skipped".to_string(),
                            message: Some("El usuario o correo ya existe (Omitido)".to_string()),
                        });
                    }
                    ConflictResolutionMode::Overwrite => {
                        let fn_str = item.firstname.unwrap_or_default();
                        let rn_str = item.realname.unwrap_or_default();
                        let is_act = item.is_active.unwrap_or(true);

                        let update_res = sqlx::query!(
                            r#"
                            UPDATE users
                            SET firstname = $1, realname = $2, is_active = $3, updated_at = NOW()
                            WHERE id = $4
                            "#,
                            fn_str,
                            rn_str,
                            is_act,
                            ex_user.id
                        )
                        .execute(&state.pool)
                        .await;

                        match update_res {
                            Ok(_) => {
                                updated_count += 1;
                                results.push(BatchUserImportRowResult {
                                    username: uname.to_string(),
                                    email: uemail,
                                    status: "updated".to_string(),
                                    message: Some("Información actualizada exitosamente".to_string()),
                                });
                            }
                            Err(e) => {
                                failed_count += 1;
                                results.push(BatchUserImportRowResult {
                                    username: uname.to_string(),
                                    email: uemail,
                                    status: "failed".to_string(),
                                    message: Some(format!("Error al actualizar: {}", e)),
                                });
                            }
                        }
                    }
                }
            }
            Ok(None) => {
                // Insert new user
                let new_id = Uuid::new_v4();
                let fn_str = item.firstname.unwrap_or_default();
                let rn_str = item.realname.unwrap_or_default();
                let is_act = item.is_active.unwrap_or(true);

                let pwd_hash = if let Some(ref p) = item.password {
                    hash_password(p).unwrap_or_else(|_| default_pwd_hash.clone())
                } else {
                    default_pwd_hash.clone()
                };

                let mut tx = match state.pool.begin().await {
                    Ok(t) => t,
                    Err(e) => {
                        failed_count += 1;
                        results.push(BatchUserImportRowResult {
                            username: uname.to_string(),
                            email: uemail,
                            status: "failed".to_string(),
                            message: Some(format!("Error de transacción: {}", e)),
                        });
                        continue;
                    }
                };

                let insert_res = sqlx::query!(
                    r#"
                    INSERT INTO users (id, username, password_hash, email, firstname, realname, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    "#,
                    new_id,
                    uname,
                    pwd_hash,
                    uemail,
                    fn_str,
                    rn_str,
                    is_act
                )
                .execute(&mut *tx)
                .await;

                if let Err(e) = insert_res {
                    failed_count += 1;
                    results.push(BatchUserImportRowResult {
                        username: uname.to_string(),
                        email: uemail,
                        status: "failed".to_string(),
                        message: Some(format!("Error al insertar: {}", e)),
                    });
                    let _ = tx.rollback().await;
                    continue;
                }

                // Profile and entity assignment
                let target_prof = if let Some(ref pname) = item.profile_name {
                    let prow = sqlx::query!(
                        "SELECT id FROM profiles WHERE LOWER(name) = LOWER($1) LIMIT 1",
                        pname
                    )
                    .fetch_optional(&mut *tx)
                    .await;
                    match prow {
                        Ok(Some(p)) => p.id,
                        _ => default_profile,
                    }
                } else {
                    default_profile
                };

                let target_ent = if let Some(ref ename) = item.entity_name {
                    let erow = sqlx::query!(
                        "SELECT id FROM entities WHERE LOWER(name) = LOWER($1) LIMIT 1",
                        ename
                    )
                    .fetch_optional(&mut *tx)
                    .await;
                    match erow {
                        Ok(Some(e)) => e.id,
                        _ => default_entity,
                    }
                } else {
                    default_entity
                };

                let _ = sqlx::query!(
                    r#"
                    INSERT INTO user_profiles_entities (user_id, profile_id, entity_id, is_recursive)
                    VALUES ($1, $2, $3, TRUE)
                    ON CONFLICT DO NOTHING
                    "#,
                    new_id,
                    target_prof,
                    target_ent
                )
                .execute(&mut *tx)
                .await;

                // Group assignment: item group_name or payload default_group_id
                let group_to_assign = if let Some(ref gname) = item.group_name {
                    let grow = sqlx::query!(
                        "SELECT id FROM groups WHERE LOWER(name) = LOWER($1) LIMIT 1",
                        gname
                    )
                    .fetch_optional(&mut *tx)
                    .await;
                    match grow {
                        Ok(Some(g)) => Some(g.id),
                        _ => payload.default_group_id,
                    }
                } else {
                    payload.default_group_id
                };

                if let Some(gid) = group_to_assign {
                    let _ = sqlx::query!(
                        r#"
                        INSERT INTO group_users (group_id, user_id, is_manager, is_user)
                        VALUES ($1, $2, FALSE, TRUE)
                        ON CONFLICT DO NOTHING
                        "#,
                        gid,
                        new_id
                    )
                    .execute(&mut *tx)
                    .await;
                }

                if tx.commit().await.is_ok() {
                    created_count += 1;
                    results.push(BatchUserImportRowResult {
                        username: uname.to_string(),
                        email: uemail,
                        status: "created".to_string(),
                        message: Some("Usuario creado exitosamente".to_string()),
                    });
                } else {
                    failed_count += 1;
                    results.push(BatchUserImportRowResult {
                        username: uname.to_string(),
                        email: uemail,
                        status: "failed".to_string(),
                        message: Some("Fallo al confirmar transacción".to_string()),
                    });
                }
            }
            Err(e) => {
                failed_count += 1;
                results.push(BatchUserImportRowResult {
                    username: uname.to_string(),
                    email: uemail,
                    status: "failed".to_string(),
                    message: Some(format!("Error de consulta: {}", e)),
                });
            }
        }
    }

    Ok(Json(BatchUserImportResponse {
        total_processed: created_count + updated_count + skipped_count + failed_count,
        created_count,
        updated_count,
        skipped_count,
        failed_count,
        results,
    }))
}
