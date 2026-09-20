use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::domain::auth::Claims;
use crate::domain::group::{
    AddGroupMemberDto, CreateGroupDto, GroupDetailDto, GroupMemberDto, GroupSummaryDto,
    UpdateGroupDto, UpdateGroupMemberDto,
};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct GroupFilterQuery {
    pub entity_id: Option<Uuid>,
    pub search: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/groups",
    tag = "Groups",
    security(("bearer_auth" = [])),
    params(
        ("entity_id" = Option<Uuid>, Query, description = "Filter by organizational entity ID"),
        ("search" = Option<String>, Query, description = "Search query for group name or comments")
    ),
    responses(
        (status = 200, description = "List of transversal groups", body = Vec<GroupSummaryDto>),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn list_groups(
    State(state): State<AppState>,
    _claims: Claims,
    Query(query): Query<GroupFilterQuery>,
) -> Result<Json<Vec<GroupSummaryDto>>, AppError> {
    let search_pattern = query.search.as_ref().map(|s| format!("%{}%", s.to_lowercase()));

    let rows = sqlx::query!(
        r#"
        SELECT 
            g.id,
            g.entity_id,
            e.name as "entity_name?",
            g.name,
            g.comment,
            g.is_recursive,
            g.is_task,
            g.is_requester,
            g.is_user_group,
            g.created_at,
            COUNT(gu.user_id) as "member_count!",
            COUNT(CASE WHEN gu.is_manager = TRUE THEN 1 END) as "manager_count!"
        FROM groups g
        LEFT JOIN entities e ON g.entity_id = e.id
        LEFT JOIN group_users gu ON g.id = gu.group_id
        WHERE ($1::uuid IS NULL OR g.entity_id = $1 OR g.entity_id IS NULL)
          AND ($2::text IS NULL OR LOWER(g.name) LIKE $2 OR LOWER(COALESCE(g.comment, '')) LIKE $2)
        GROUP BY g.id, g.entity_id, e.name, g.name, g.comment, g.is_recursive, g.is_task, g.is_requester, g.is_user_group, g.created_at
        ORDER BY g.name ASC
        "#,
        query.entity_id,
        search_pattern
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to retrieve groups: {}", e)))?;

    let summaries = rows
        .into_iter()
        .map(|r| GroupSummaryDto {
            id: r.id,
            entity_id: r.entity_id,
            entity_name: r.entity_name,
            name: r.name,
            comment: r.comment,
            is_recursive: r.is_recursive,
            is_task: r.is_task,
            is_requester: r.is_requester,
            is_user_group: r.is_user_group,
            member_count: r.member_count,
            manager_count: r.manager_count,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(summaries))
}

#[utoipa::path(
    post,
    path = "/api/v1/groups",
    tag = "Groups",
    security(("bearer_auth" = [])),
    request_body = CreateGroupDto,
    responses(
        (status = 201, description = "Group created successfully", body = GroupSummaryDto),
        (status = 400, description = "Bad Request", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn create_group(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateGroupDto>,
) -> Result<(StatusCode, Json<GroupSummaryDto>), AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("El nombre del grupo es obligatorio".to_string()));
    }

    let mut tx = state.pool.begin().await?;

    let group_id = Uuid::new_v4();
    let is_rec = payload.is_recursive.unwrap_or(true);
    let is_task = payload.is_task.unwrap_or(true);
    let is_req = payload.is_requester.unwrap_or(true);
    let is_ug = payload.is_user_group.unwrap_or(true);

    sqlx::query!(
        r#"
        INSERT INTO groups (id, entity_id, name, comment, is_recursive, is_task, is_requester, is_user_group)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
        group_id,
        payload.entity_id,
        payload.name.trim(),
        payload.comment,
        is_rec,
        is_task,
        is_req,
        is_ug
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Error al crear grupo: {}", e)))?;

    // Add initial members if provided
    let mut member_count = 0;
    if let Some(member_ids) = payload.initial_member_ids {
        for uid in member_ids {
            let res = sqlx::query!(
                r#"
                INSERT INTO group_users (group_id, user_id, is_manager, is_user)
                VALUES ($1, $2, FALSE, TRUE)
                ON CONFLICT (group_id, user_id) DO NOTHING
                "#,
                group_id,
                uid
            )
            .execute(&mut *tx)
            .await;
            if res.is_ok() {
                member_count += 1;
            }
        }
    }

    // Auto-create synchronized HelpdeskChat conversation room
    let chat_name = format!("#{}", payload.name.trim().to_lowercase().replace(' ', "-"));
    let target_entity = payload.entity_id.unwrap_or_else(|| {
        Uuid::parse_str(&claims.entity_id)
            .unwrap_or_else(|_| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap())
    });
    let chat_id = Uuid::new_v4();

    let _ = sqlx::query!(
        r#"
        INSERT INTO chat_conversations (id, entity_id, name, is_group, is_self, group_id)
        VALUES ($1, $2, $3, TRUE, FALSE, $4)
        ON CONFLICT DO NOTHING
        "#,
        chat_id,
        target_entity,
        chat_name,
        group_id
    )
    .execute(&mut *tx)
    .await;

    tx.commit().await?;

    let summary = GroupSummaryDto {
        id: group_id,
        entity_id: payload.entity_id,
        entity_name: None,
        name: payload.name.trim().to_string(),
        comment: payload.comment,
        is_recursive: is_rec,
        is_task: is_task,
        is_requester: is_req,
        is_user_group: is_ug,
        member_count,
        manager_count: 0,
        created_at: chrono::Utc::now(),
    };

    Ok((StatusCode::CREATED, Json(summary)))
}

#[utoipa::path(
    get,
    path = "/api/v1/groups/{id}",
    tag = "Groups",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Group ID")
    ),
    responses(
        (status = 200, description = "Group detail with members", body = GroupDetailDto),
        (status = 404, description = "Group not found", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn get_group(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<GroupDetailDto>, AppError> {
    let group = sqlx::query!(
        r#"
        SELECT 
            g.id,
            g.entity_id,
            e.name as "entity_name?",
            g.name,
            g.comment,
            g.is_recursive,
            g.is_task,
            g.is_requester,
            g.is_user_group,
            g.created_at,
            g.updated_at
        FROM groups g
        LEFT JOIN entities e ON g.entity_id = e.id
        WHERE g.id = $1
        "#,
        id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Database error: {}", e)))?
    .ok_or_else(|| AppError::NotFound(format!("Grupo con ID {} no encontrado", id)))?;

    let members = sqlx::query!(
        r#"
        SELECT 
            u.id as user_id,
            u.username,
            u.email,
            u.realname,
            u.firstname,
            COALESCE(p.name, 'Sin Perfil') as "profile_name!",
            gu.is_manager,
            gu.is_user,
            gu.created_at as joined_at
        FROM group_users gu
        JOIN users u ON gu.user_id = u.id
        LEFT JOIN user_profiles_entities upe ON upe.user_id = u.id
        LEFT JOIN profiles p ON p.id = upe.profile_id
        WHERE gu.group_id = $1
        ORDER BY gu.is_manager DESC, u.username ASC
        "#,
        id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to fetch group members: {}", e)))?;

    let member_dtos = members
        .into_iter()
        .map(|m| {
            let display_name = if !m.firstname.is_empty() || !m.realname.is_empty() {
                format!("{} {}", m.firstname, m.realname).trim().to_string()
            } else {
                m.username.clone()
            };

            GroupMemberDto {
                user_id: m.user_id,
                username: m.username,
                display_name,
                email: m.email,
                profile_name: m.profile_name,
                is_manager: m.is_manager,
                is_user: m.is_user,
                joined_at: m.joined_at,
            }
        })
        .collect();

    Ok(Json(GroupDetailDto {
        id: group.id,
        entity_id: group.entity_id,
        entity_name: group.entity_name,
        name: group.name,
        comment: group.comment,
        is_recursive: group.is_recursive,
        is_task: group.is_task,
        is_requester: group.is_requester,
        is_user_group: group.is_user_group,
        members: member_dtos,
        created_at: group.created_at,
        updated_at: group.updated_at,
    }))
}

#[utoipa::path(
    patch,
    path = "/api/v1/groups/{id}",
    tag = "Groups",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Group ID")
    ),
    request_body = UpdateGroupDto,
    responses(
        (status = 200, description = "Group updated successfully", body = GroupSummaryDto),
        (status = 404, description = "Group not found", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn update_group(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateGroupDto>,
) -> Result<Json<GroupSummaryDto>, AppError> {
    let mut tx = state.pool.begin().await?;

    let current = sqlx::query!(
        "SELECT name, comment, entity_id, is_recursive, is_task, is_requester, is_user_group FROM groups WHERE id = $1",
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Grupo con ID {} no encontrado", id)))?;

    let new_name = payload.name.unwrap_or(current.name);
    let new_comment = payload.comment.or(current.comment);
    let new_entity = payload.entity_id.or(current.entity_id);
    let new_is_rec = payload.is_recursive.unwrap_or(current.is_recursive);
    let new_is_task = payload.is_task.unwrap_or(current.is_task);
    let new_is_req = payload.is_requester.unwrap_or(current.is_requester);
    let new_is_ug = payload.is_user_group.unwrap_or(current.is_user_group);

    sqlx::query!(
        r#"
        UPDATE groups
        SET name = $1, comment = $2, entity_id = $3, is_recursive = $4, is_task = $5, is_requester = $6, is_user_group = $7, updated_at = NOW()
        WHERE id = $8
        "#,
        new_name,
        new_comment,
        new_entity,
        new_is_rec,
        new_is_task,
        new_is_req,
        new_is_ug,
        id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let count_row = sqlx::query!(
        r#"
        SELECT 
            COUNT(user_id) as "member_count!",
            COUNT(CASE WHEN is_manager = TRUE THEN 1 END) as "manager_count!"
        FROM group_users
        WHERE group_id = $1
        "#,
        id
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(GroupSummaryDto {
        id,
        entity_id: new_entity,
        entity_name: None,
        name: new_name,
        comment: new_comment,
        is_recursive: new_is_rec,
        is_task: new_is_task,
        is_requester: new_is_req,
        is_user_group: new_is_ug,
        member_count: count_row.member_count,
        manager_count: count_row.manager_count,
        created_at: chrono::Utc::now(),
    }))
}

#[utoipa::path(
    delete,
    path = "/api/v1/groups/{id}",
    tag = "Groups",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Group ID")
    ),
    responses(
        (status = 204, description = "Group deleted successfully"),
        (status = 404, description = "Group not found", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn delete_group(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!("DELETE FROM groups WHERE id = $1", id)
        .execute(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error al eliminar grupo: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Grupo {} no encontrado", id)));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/groups/{id}/members",
    tag = "Groups",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Group ID")
    ),
    request_body = AddGroupMemberDto,
    responses(
        (status = 201, description = "Member added to group"),
        (status = 404, description = "Group or User not found", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn add_group_member(
    State(state): State<AppState>,
    _claims: Claims,
    Path(group_id): Path<Uuid>,
    Json(payload): Json<AddGroupMemberDto>,
) -> Result<StatusCode, AppError> {
    let mut tx = state.pool.begin().await?;

    let is_manager = payload.is_manager.unwrap_or(false);
    let is_user = payload.is_user.unwrap_or(true);

    sqlx::query!(
        r#"
        INSERT INTO group_users (group_id, user_id, is_manager, is_user)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (group_id, user_id) 
        DO UPDATE SET is_manager = EXCLUDED.is_manager, is_user = EXCLUDED.is_user
        "#,
        group_id,
        payload.user_id,
        is_manager,
        is_user
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Error al agregar miembro: {}", e)))?;

    // Auto-enroll user into associated HelpdeskChat conversation if exists
    let chat_conv = sqlx::query!(
        "SELECT id FROM chat_conversations WHERE group_id = $1 LIMIT 1",
        group_id
    )
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(chat) = chat_conv {
        let _ = sqlx::query!(
            r#"
            INSERT INTO chat_conversation_users (conversation_id, user_id, is_featured)
            VALUES ($1, $2, FALSE)
            ON CONFLICT DO NOTHING
            "#,
            chat.id,
            payload.user_id
        )
        .execute(&mut *tx)
        .await;
    }

    tx.commit().await?;

    Ok(StatusCode::CREATED)
}

#[utoipa::path(
    delete,
    path = "/api/v1/groups/{id}/members/{user_id}",
    tag = "Groups",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Group ID"),
        ("user_id" = Uuid, Path, description = "User ID")
    ),
    responses(
        (status = 204, description = "Member removed from group"),
        (status = 404, description = "Member not found", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn remove_group_member(
    State(state): State<AppState>,
    _claims: Claims,
    Path((group_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let mut tx = state.pool.begin().await?;

    let res = sqlx::query!(
        "DELETE FROM group_users WHERE group_id = $1 AND user_id = $2",
        group_id,
        user_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Error al remover miembro: {}", e)))?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("Miembro no encontrado en el grupo".to_string()));
    }

    // Auto-remove user from associated chat conversation
    let chat_conv = sqlx::query!(
        "SELECT id FROM chat_conversations WHERE group_id = $1 LIMIT 1",
        group_id
    )
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(chat) = chat_conv {
        let _ = sqlx::query!(
            "DELETE FROM chat_conversation_users WHERE conversation_id = $1 AND user_id = $2",
            chat.id,
            user_id
        )
        .execute(&mut *tx)
        .await;
    }

    tx.commit().await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    patch,
    path = "/api/v1/groups/{id}/members/{user_id}",
    tag = "Groups",
    security(("bearer_auth" = [])),
    params(
        ("id" = Uuid, Path, description = "Group ID"),
        ("user_id" = Uuid, Path, description = "User ID")
    ),
    request_body = UpdateGroupMemberDto,
    responses(
        (status = 200, description = "Member role updated"),
        (status = 404, description = "Member not found", body = crate::error::ErrorResponse),
        (status = 401, description = "Unauthorized", body = crate::error::ErrorResponse)
    )
)]
pub async fn update_group_member(
    State(state): State<AppState>,
    _claims: Claims,
    Path((group_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateGroupMemberDto>,
) -> Result<StatusCode, AppError> {
    let current = sqlx::query!(
        "SELECT is_manager, is_user FROM group_users WHERE group_id = $1 AND user_id = $2",
        group_id,
        user_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Miembro no encontrado en el grupo".to_string()))?;

    let new_is_manager = payload.is_manager.unwrap_or(current.is_manager);
    let new_is_user = payload.is_user.unwrap_or(current.is_user);

    sqlx::query!(
        r#"
        UPDATE group_users
        SET is_manager = $1, is_user = $2
        WHERE group_id = $3 AND user_id = $4
        "#,
        new_is_manager,
        new_is_user,
        group_id,
        user_id
    )
    .execute(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Error al actualizar rol de miembro: {}", e)))?;

    Ok(StatusCode::OK)
}
