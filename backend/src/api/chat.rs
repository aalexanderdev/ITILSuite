use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tracing::{info, warn};
use uuid::Uuid;

use crate::domain::auth::{verify_jwt, Claims};
use crate::domain::chat::*;
use crate::error::AppError;
use crate::services::chat_service::ChatService;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConversationFilterQuery {
    pub entity_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct MessagesQuery {
    pub limit: Option<i64>,
}

pub fn chat_router() -> Router<AppState> {
    Router::new()
        .route("/ws", get(ws_chat_handler))
        .route("/conversations", get(get_conversations).post(create_conversation))
        .route("/conversations/:id/featured", post(toggle_featured))
        .route("/conversations/:id/messages", get(get_messages).post(send_message))
        .route("/conversations/:id/members", get(get_members))
        .route("/conversations/:id/typing", post(post_typing))
        .route("/messages/:id/react", post(toggle_reaction))
        .route("/messages/:id/convert-to-ticket", post(convert_to_ticket))
        .route("/presence/heartbeat", post(post_heartbeat))
        .route("/presence/online", get(get_online_users))
        .route("/dashboard", get(get_dashboard_metrics))
        .route("/dashboard/export", get(export_messages_csv))
        .route("/settings", get(get_settings).put(update_settings))
        .route("/shortcuts", get(get_shortcuts))
}

// ---------------------------------------------------------------------------
// WebSocket Real-Time Channel
// ---------------------------------------------------------------------------

pub async fn ws_chat_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Response {
    let token = query.token.or_else(|| {
        let cookie_header = headers.get(header::COOKIE)?.to_str().ok()?;
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
        return (StatusCode::UNAUTHORIZED, "Missing authentication token or session cookie").into_response();
    };

    let claims = match verify_jwt(&token, &state.config.jwt_secret) {
        Ok(c) => c,
        Err(_) => return (StatusCode::UNAUTHORIZED, "Invalid authentication token").into_response(),
    };

    ws.on_upgrade(move |socket| handle_ws_connection(socket, state, claims))
}

async fn handle_ws_connection(mut socket: WebSocket, state: AppState, claims: Claims) {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return,
    };

    info!("🔌 WebSocket connected for user {} ({})", claims.username, user_id);

    // Subscribe to Tokio broadcast hub
    let mut rx = state.chat_hub.subscribe();

    // Mark user as online immediately
    let _ = ChatService::heartbeat_presence(&state.pool, &state.chat_hub, user_id, Some("online".to_string())).await;

    loop {
        tokio::select! {
            // Receive from broadcast channel and send to WebSocket client
            broadcast_result = rx.recv() => {
                match broadcast_result {
                    Ok(event) => {
                        if let Ok(json) = serde_json::to_string(&event) {
                            if socket.send(Message::Text(json.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                        warn!("WebSocket client lagged by {} messages", n);
                    }
                    Err(_) => break,
                }
            }

            // Receive from WebSocket client (client keepalive / heartbeat / client typing)
            msg_result = socket.recv() => {
                match msg_result {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                            if val.get("type").and_then(|t| t.as_str()) == Some("heartbeat") {
                                let _ = ChatService::heartbeat_presence(&state.pool, &state.chat_hub, user_id, Some("online".to_string())).await;
                            }
                        }
                    }
                    Some(Ok(Message::Ping(_))) => {
                        if socket.send(Message::Pong(vec![].into())).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        break;
                    }
                    _ => {}
                }
            }
        }
    }

    info!("🔌 WebSocket disconnected for user {}", claims.username);
}

// ---------------------------------------------------------------------------
// REST API Endpoints
// ---------------------------------------------------------------------------

#[utoipa::path(
    get,
    path = "/api/v1/chat/conversations",
    tag = "Chat",
    responses(
        (status = 200, description = "List conversations for current user", body = Vec<ConversationSummaryDto>)
    )
)]
pub async fn get_conversations(
    State(state): State<AppState>,
    claims: Claims,
    Query(query): Query<ConversationFilterQuery>,
) -> Result<Json<Vec<ConversationSummaryDto>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in claims".to_string()))?;

    let list = ChatService::get_conversations(&state.pool, user_id, query.entity_id).await?;
    Ok(Json(list))
}

#[utoipa::path(
    post,
    path = "/api/v1/chat/conversations",
    tag = "Chat",
    request_body = CreateConversationDto,
    responses(
        (status = 201, description = "Conversation created successfully", body = ConversationSummaryDto)
    )
)]
pub async fn create_conversation(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateConversationDto>,
) -> Result<(StatusCode, Json<ConversationSummaryDto>), AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in claims".to_string()))?;

    let entity_id = payload.entity_id.unwrap_or_else(|| {
        Uuid::parse_str(&claims.entity_id).unwrap_or_else(|_| Uuid::nil())
    });

    let is_group = payload.is_group.unwrap_or(false);
    let conv_name = payload.name.as_deref().unwrap_or("Nueva Conversación");

    let conv_id = sqlx::query_scalar!(
        r#"
        INSERT INTO chat_conversations (entity_id, name, is_group, is_self)
        VALUES ($1, $2, $3, FALSE)
        RETURNING id
        "#,
        entity_id,
        conv_name,
        is_group
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to create conversation: {}", e)))?;

    // Add creator to conversation
    let _ = sqlx::query!(
        "INSERT INTO chat_conversation_users (conversation_id, user_id, is_featured) VALUES ($1, $2, FALSE)",
        conv_id,
        user_id
    )
    .execute(&state.pool)
    .await;

    // Add participants
    for pid in payload.participant_ids {
        if pid != user_id {
            let _ = sqlx::query!(
                "INSERT INTO chat_conversation_users (conversation_id, user_id, is_featured) VALUES ($1, $2, FALSE) ON CONFLICT DO NOTHING",
                conv_id,
                pid
            )
            .execute(&state.pool)
            .await;
        }
    }

    let summary = ConversationSummaryDto {
        id: conv_id,
        entity_id,
        name: conv_name.to_string(),
        is_group,
        is_self: false,
        is_featured: false,
        unread_count: 0,
        last_message: None,
        last_message_time: None,
        is_online: None,
    };

    Ok((StatusCode::CREATED, Json(summary)))
}

#[utoipa::path(
    post,
    path = "/api/v1/chat/conversations/{id}/featured",
    tag = "Chat",
    responses(
        (status = 200, description = "Toggled featured state")
    )
)]
pub async fn toggle_featured(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in claims".to_string()))?;

    let is_featured = ChatService::toggle_featured(&state.pool, id, user_id).await?;
    Ok(Json(serde_json::json!({ "is_featured": is_featured })))
}

#[utoipa::path(
    get,
    path = "/api/v1/chat/conversations/{id}/messages",
    tag = "Chat",
    responses(
        (status = 200, description = "List messages in conversation", body = Vec<ChatMessageDto>)
    )
)]
pub async fn get_messages(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
    Query(query): Query<MessagesQuery>,
) -> Result<Json<Vec<ChatMessageDto>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in claims".to_string()))?;

    let limit = query.limit.unwrap_or(100).min(500);
    let messages = ChatService::get_messages(&state.pool, id, user_id, limit).await?;
    Ok(Json(messages))
}

#[utoipa::path(
    post,
    path = "/api/v1/chat/conversations/{id}/messages",
    tag = "Chat",
    request_body = SendMessageDto,
    responses(
        (status = 201, description = "Message sent successfully", body = ChatMessageDto)
    )
)]
pub async fn send_message(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<SendMessageDto>,
) -> Result<(StatusCode, Json<ChatMessageDto>), AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in claims".to_string()))?;

    let msg = ChatService::send_message(&state.pool, &state.chat_hub, id, user_id, payload).await?;
    Ok((StatusCode::CREATED, Json(msg)))
}

#[utoipa::path(
    get,
    path = "/api/v1/chat/conversations/{id}/members",
    tag = "Chat",
    responses(
        (status = 200, description = "List conversation members", body = Vec<ChatMemberDto>)
    )
)]
pub async fn get_members(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ChatMemberDto>>, AppError> {
    let members = ChatService::get_conversation_members(&state.pool, id).await?;
    Ok(Json(members))
}

#[utoipa::path(
    post,
    path = "/api/v1/chat/conversations/{id}/typing",
    tag = "Chat",
    responses(
        (status = 200, description = "Broadcast user typing event")
    )
)]
pub async fn post_typing(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in claims".to_string()))?;

    let _ = state.chat_hub.send(WsEvent::UserTyping {
        conversation_id: id,
        user_id,
        username: claims.display_name.clone(),
    });

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[utoipa::path(
    post,
    path = "/api/v1/chat/messages/{id}/react",
    tag = "Chat",
    request_body = ToggleReactionDto,
    responses(
        (status = 200, description = "Toggle reaction on message", body = Vec<MessageReactionSummaryDto>)
    )
)]
pub async fn toggle_reaction(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<ToggleReactionDto>,
) -> Result<Json<Vec<MessageReactionSummaryDto>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in claims".to_string()))?;

    let reactions = ChatService::toggle_reaction(&state.pool, &state.chat_hub, id, user_id, payload.emoji).await?;
    Ok(Json(reactions))
}

#[utoipa::path(
    post,
    path = "/api/v1/chat/messages/{id}/convert-to-ticket",
    tag = "Chat",
    request_body = ConvertToTicketRequestDto,
    responses(
        (status = 201, description = "Message converted to ticket", body = ConvertToTicketResponseDto),
        (status = 400, description = "Message already converted or invalid")
    )
)]
pub async fn convert_to_ticket(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<ConvertToTicketRequestDto>,
) -> Result<(StatusCode, Json<ConvertToTicketResponseDto>), AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in claims".to_string()))?;

    let res = ChatService::convert_to_ticket(&state.pool, &state.chat_hub, id, user_id, payload).await?;
    Ok((StatusCode::CREATED, Json(res)))
}

#[utoipa::path(
    post,
    path = "/api/v1/chat/presence/heartbeat",
    tag = "Chat",
    request_body = PresenceHeartbeatDto,
    responses(
        (status = 200, description = "Heartbeat recorded")
    )
)]
pub async fn post_heartbeat(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<PresenceHeartbeatDto>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in claims".to_string()))?;

    ChatService::heartbeat_presence(&state.pool, &state.chat_hub, user_id, payload.status).await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[utoipa::path(
    get,
    path = "/api/v1/chat/presence/online",
    tag = "Chat",
    responses(
        (status = 200, description = "List online users", body = Vec<OnlineUserDto>)
    )
)]
pub async fn get_online_users(
    State(state): State<AppState>,
) -> Result<Json<Vec<OnlineUserDto>>, AppError> {
    let online = ChatService::get_online_users(&state.pool).await?;
    Ok(Json(online))
}

#[utoipa::path(
    get,
    path = "/api/v1/chat/dashboard",
    tag = "Chat",
    responses(
        (status = 200, description = "Dashboard metrics and session timeline", body = ChatDashboardMetricsDto)
    )
)]
pub async fn get_dashboard_metrics(
    State(state): State<AppState>,
) -> Result<Json<ChatDashboardMetricsDto>, AppError> {
    let metrics = ChatService::get_dashboard_metrics(&state.pool).await?;
    Ok(Json(metrics))
}

#[utoipa::path(
    get,
    path = "/api/v1/chat/settings",
    tag = "Chat",
    responses(
        (status = 200, description = "Get chat settings", body = ChatSettingsDto)
    )
)]
pub async fn get_settings(
    State(state): State<AppState>,
) -> Result<Json<ChatSettingsDto>, AppError> {
    let settings = ChatService::get_settings(&state.pool, None).await?;
    Ok(Json(settings))
}

#[utoipa::path(
    put,
    path = "/api/v1/chat/settings",
    tag = "Chat",
    request_body = ChatSettingsDto,
    responses(
        (status = 200, description = "Update chat settings", body = ChatSettingsDto)
    )
)]
pub async fn update_settings(
    State(state): State<AppState>,
    Json(payload): Json<ChatSettingsDto>,
) -> Result<Json<ChatSettingsDto>, AppError> {
    let updated = ChatService::update_settings(&state.pool, payload).await?;
    Ok(Json(updated))
}

#[utoipa::path(
    get,
    path = "/api/v1/chat/shortcuts",
    tag = "Chat",
    responses(
        (status = 200, description = "Get shortcut buttons", body = Vec<ShortcutButtonDto>)
    )
)]
pub async fn get_shortcuts(
    State(state): State<AppState>,
) -> Result<Json<Vec<ShortcutButtonDto>>, AppError> {
    let shortcuts = ChatService::get_shortcut_buttons(&state.pool).await?;
    Ok(Json(shortcuts))
}

#[utoipa::path(
    get,
    path = "/api/v1/chat/dashboard/export",
    tag = "Chat",
    responses(
        (status = 200, description = "Export messages as CSV")
    )
)]
pub async fn export_messages_csv(
    State(state): State<AppState>,
) -> Result<Response, AppError> {
    let rows = sqlx::query!(
        r#"
        SELECT 
            m.id,
            m.created_at,
            c.name as conversation_name,
            COALESCE(u.username, 'system') as username,
            COALESCE(u.firstname || ' ' || u.realname, 'Sistema ITIL') as full_name,
            m.content
        FROM chat_messages m
        JOIN chat_conversations c ON c.id = m.conversation_id
        LEFT JOIN users u ON u.id = m.user_id
        ORDER BY m.created_at DESC
        LIMIT 5000
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Export query error: {}", e)))?;

    let mut csv = String::from("id,created_at,conversation,username,full_name,content\n");
    for r in rows {
        let escaped_content = r.content.replace('"', "\"\"").replace('\n', " ");
        let conv_name = r.conversation_name.unwrap_or_else(|| "Direct".to_string()).replace('"', "\"\"");
        csv.push_str(&format!(
            "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
            r.id,
            r.created_at.to_rfc3339(),
            conv_name,
            r.username.as_deref().unwrap_or("system"),
            r.full_name.as_deref().unwrap_or("Sistema ITIL"),
            escaped_content
        ));
    }

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"itilsuite_chat_messages_export.csv\"",
        )
        .body(csv.into())
        .map_err(|e| AppError::InternalServerError(format!("Response build error: {}", e)))?;

    Ok(response)
}
