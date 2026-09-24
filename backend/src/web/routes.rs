use axum::{
    body::Bytes,
    extract::{Form, Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
    Router,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use crate::domain::asset::{
    AssetConnectionSummaryDto, AssetDetailDto, AssetMetricsDto, AssetStatus, AssetSummaryDto,
    AssetType,
};
use crate::domain::auth::{create_jwt, hash_password, verify_jwt, verify_password, Claims};
use crate::domain::entity::{build_entity_tree, Entity};
use crate::domain::notification::{
    MailBlacklist, MailReceiver, MailSettings, NotificationEvent, NotificationQueueItem,
    NotificationTemplate, SimulateIncomingMailDto,
};
use crate::domain::rule::{Rule, RuleAction, RuleCriteria, RuleWithDetails};
use crate::domain::sla::SlaSummaryDto;
use crate::domain::survey::{
    CreateSurveyDto, QuestionAnswerInput, SubmitSurveyDto, SurveyPresetDef,
};
use crate::domain::ticket::{
    calculate_priority, TicketDetailDto, TicketFollowupDto, TicketMetricsDto, TicketSummaryDto,
};
use crate::domain::user::UserSummaryDto;
use crate::domain::marketing::{
    CampaignDelivery, CreateCampaignDto, CreateContactDto, CreateEmailTemplateDto, CreateSegmentDto,
};
use crate::services::mail_service::MailService;
use crate::services::marketing_service::MarketingService;
use crate::services::receiver_service::ReceiverService;
use crate::services::sla_service::SlaService;
use crate::services::survey_service::SurveyService;
use crate::state::AppState;
use crate::web::templates::{
    AssetDetailTemplate, AssetNewTemplate, AssetsTablePartialTemplate, AssetsTemplate,
    CampaignsTemplate, ChatAnalyticsTemplate, CollectResultPartialTemplate, ContractsTemplate,
    DashboardTemplate, EntitiesTemplate, EntitySelectItem, FollowupPartialTemplate,
    GroupSelectItem, HtmlTemplate, LoginTemplate, MailConfigTemplate, ProfileSelectItem,
    RuleNewTemplate, RulesTemplate, SlasTemplate, SmtpTestResultPartialTemplate,
    SurveyPublicTemplate, SurveysAdminTemplate, TicketDetailTemplate, TicketNewTemplate,
    TicketTemplateRow, TicketsTablePartialTemplate, TicketsTemplate, UnsubscribeTemplate,
    UserSelectItem, UsersTemplate,
};

pub fn router() -> Router<AppState> {
    Router::new()
        // Auth, Dashboard & Static Meta
        .route("/", get(handle_root))
        .route("/favicon.ico", get(handle_favicon))
        .route("/login", get(show_login).post(handle_login))
        .route("/logout", post(handle_logout))
        .route("/dashboard", get(show_dashboard))
        // Phase 2: Service Desk & Tickets
        .route("/tickets", get(show_tickets).post(handle_create_ticket))
        .route("/tickets/new", get(show_new_ticket))
        .route("/tickets/table", get(filter_tickets_table))
        .route("/tickets/:id", get(show_ticket_detail))
        .route("/tickets/:id/followups", post(handle_add_followup))
        .route("/tickets/:id/status", post(handle_update_status))
        .route("/tickets/:id/assign", post(handle_assign_ticket))
        .route("/tickets/:id/classification", post(handle_update_classification))
        // SLAs view
        .route("/slas", get(show_slas))
        // Phase 3: Surveys Admin & Public Responder
        .route("/surveys", get(show_surveys_admin))
        .route("/surveys/from-preset", post(handle_instantiate_preset))
        .route("/surveys/:id/toggle", post(handle_toggle_survey))
        .route("/survey/:token", get(show_public_survey))
        .route("/survey/:token/submit", post(handle_submit_public_survey))
        // Phase 2.5: Helpdesk Chat & Analytics
        .route("/chat-analytics", get(show_chat_analytics))
        .route("/chat-analytics/settings", post(handle_update_chat_settings))
        // Phase 4: CMDB & Inventory
        .route("/assets", get(show_assets).post(handle_create_asset))
        .route("/assets/table", get(filter_assets_table))
        .route("/assets/new", get(show_new_asset))
        .route("/assets/:id", get(show_asset_detail).post(handle_update_asset))
        // Aliases for /computers and /network
        .route("/computers", get(show_assets).post(handle_create_asset))
        .route("/computers/new", get(show_new_asset))
        .route("/computers/:id", get(show_asset_detail).post(handle_update_asset))
        .route("/network", get(show_assets))
        // Phase 4: Entities
        .route("/entities", get(show_entities).post(handle_create_entity))
        // Phase 4: Users & RBAC
        .route("/users", get(show_users).post(handle_create_user))
        .route("/users/:id/toggle", post(handle_toggle_user))
        // Phase 4: Rules & Dictionaries
        .route("/rules", get(show_rules).post(handle_create_rule))
        .route("/rules/new", get(show_new_rule))
        .route("/rules/:id/toggle", post(handle_toggle_rule))
        // Phase 5: Mail Configuration, Receivers, Contracts & Dock Completion
        .route("/mail-config", get(show_mail_config))
        .route("/mail-config/smtp", post(handle_update_smtp))
        .route("/mail-config/smtp/test", post(handle_test_smtp))
        .route("/mail-config/receivers", post(handle_create_receiver))
        .route("/mail-config/receivers/:id/collect", post(handle_collect_receiver))
        .route("/mail-config/receivers/:id/toggle", post(handle_toggle_receiver))
        .route("/mail-config/simulate-incoming", post(handle_simulate_incoming))
        .route("/mail-config/queue/process", post(handle_process_queue))
        .route("/mail-config/queue/:id/retry", post(handle_retry_queue))
        .route("/contracts", get(show_contracts))
        .route("/surveys/new", get(handle_survey_new_redirect))
        // Marketing & Campaign Automation (Mautic-Inspired)
        .route("/campaigns", get(show_campaigns).post(handle_create_campaign))
        .route("/campaigns/:id/launch", post(handle_launch_campaign))
        .route("/campaigns/contacts", post(handle_create_marketing_contact))
        .route("/campaigns/segments", post(handle_create_marketing_segment))
        .route("/campaigns/templates", post(handle_create_marketing_template))
        // Public Tracking Endpoints (No Session Required)
        .route("/m/pixel/:token_png", get(handle_tracking_pixel))
        .route("/m/click/:token", get(handle_tracking_click))
        .route("/m/unsubscribe/:token", get(show_unsubscribe).post(handle_unsubscribe))
}

// --- Form & Query Models ---

#[derive(Deserialize)]
pub struct LoginForm {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize, Default)]
pub struct CampaignsQuery {
    pub tab: Option<String>,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateCampaignWebForm {
    pub name: String,
    pub description: Option<String>,
    pub segment_id: Option<Uuid>,
    pub email_id: Option<Uuid>,
    pub campaign_type: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateSegmentWebForm {
    pub name: String,
    pub description: Option<String>,
    pub rule_field: Option<String>,
    pub rule_operator: Option<String>,
    pub rule_value: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateContactWebForm {
    pub email: String,
    pub first_name: String,
    pub last_name: Option<String>,
    pub company: Option<String>,
    pub phone: Option<String>,
    pub stage: Option<String>,
    pub points: Option<i32>,
    pub tags: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateEmailTemplateWebForm {
    pub name: String,
    pub subject: String,
    pub body_html: String,
    pub from_name: Option<String>,
    pub from_email: Option<String>,
}

#[derive(Deserialize)]
pub struct TrackingClickQuery {
    pub url: Option<String>,
}

#[derive(Deserialize, Default)]
pub struct FilterTicketsWebQuery {
    pub search: Option<String>,
    pub status: Option<String>,
    pub ticket_type: Option<String>,
    pub priority: Option<i32>,
    pub sla_status: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct CreateTicketWebForm {
    pub ticket_type: Option<String>,
    pub name: String,
    pub content: String,
    pub category: Option<String>,
    pub urgency: Option<i32>,
    pub impact: Option<i32>,
    pub assigned_technician_id: Option<Uuid>,
    pub assigned_group_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct CreateFollowupWebForm {
    pub content: String,
    pub item_type: Option<String>,
    pub is_private: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateStatusWebForm {
    pub status: String,
}

#[derive(Deserialize)]
pub struct AssignTicketWebForm {
    pub technician_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct UpdateClassificationWebForm {
    pub category: Option<String>,
    pub urgency: i32,
    pub impact: i32,
}

#[derive(Deserialize)]
pub struct InstantiatePresetForm {
    pub preset_key: String,
}

#[derive(Deserialize)]
pub struct UpdateChatSettingsWebForm {
    pub launcher_color: Option<String>,
    pub bubble_color: Option<String>,
    pub panel_width_px: Option<i32>,
    pub max_attachment_size_mb: Option<i32>,
    pub ticket_conversion_enabled: Option<String>,
    pub allow_attachments: Option<String>,
    pub auto_notify_ticket_events: Option<String>,
}

// --- Phase 4 Forms & Queries ---

#[derive(Deserialize, Default)]
pub struct FilterAssetsWebQuery {
    pub search: Option<String>,
    pub asset_type: Option<String>,
    pub status: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct CreateAssetWebForm {
    pub name: String,
    pub asset_type: String,
    pub entity_id: Option<Uuid>,
    pub status: Option<String>,
    pub serial_number: Option<String>,
    pub inventory_number: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub location: Option<String>,
    pub technician_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub comments: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateAssetWebForm {
    pub status: Option<String>,
    pub location: Option<String>,
    pub technician_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub group_in_charge: Option<String>,
    pub comments: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateEntityWebForm {
    pub name: String,
    pub parent_id: Option<Uuid>,
}

#[derive(Deserialize, Default)]
pub struct FilterUsersWebQuery {
    pub search: Option<String>,
    pub profile: Option<String>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateUserWebForm {
    pub username: String,
    pub email: String,
    pub firstname: Option<String>,
    pub realname: Option<String>,
    pub password: Option<String>,
    pub profile_id: Option<Uuid>,
    pub entity_id: Option<Uuid>,
    pub initial_group_id: Option<Uuid>,
}

#[derive(Deserialize, Default)]
pub struct RuleTabQuery {
    pub tab: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateRuleWebForm {
    pub name: String,
    pub rule_type: String,
    pub description: Option<String>,
    pub ranking: Option<i32>,
    pub match_logic: Option<String>,
    pub stop_on_first_match: Option<String>,
    pub criterion_field: String,
    pub criterion_operator: String,
    pub criterion_pattern: String,
    pub action_type: String,
    pub action_field: String,
    pub action_value: String,
}

#[derive(Deserialize)]
pub struct MailConfigQuery {
    pub tab: Option<String>,
}

#[derive(Deserialize)]
pub struct SmtpSettingsForm {
    pub notifications_enabled: Option<String>,
    pub email_followups_enabled: Option<String>,
    pub from_name: Option<String>,
    pub from_email: Option<String>,
    pub reply_to_email: Option<String>,
    pub admin_name: Option<String>,
    pub admin_email: Option<String>,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<i32>,
    pub smtp_encryption: Option<String>,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    pub subject_prefix: Option<String>,
    pub email_signature: Option<String>,
    pub max_retries: Option<i32>,
    pub retry_interval_minutes: Option<i32>,
}

#[derive(Deserialize)]
pub struct TestSmtpForm {
    pub to_email: String,
}

#[derive(Deserialize)]
pub struct CreateReceiverForm {
    pub name: String,
    pub protocol: String,
    pub host: String,
    pub port: i32,
    pub ssl_mode: String,
    pub username: String,
    pub password: Option<String>,
    pub mail_folder: Option<String>,
    pub entity_id: Uuid,
}

#[derive(Deserialize)]
pub struct SimulateIncomingForm {
    pub from_email: String,
    pub from_name: Option<String>,
    pub subject: String,
    pub body: String,
}

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
struct MetricsRow {
    total_open: Option<i64>,
    incidents_count: Option<i64>,
    requests_count: Option<i64>,
    sla_at_risk_count: Option<i64>,
    sla_breached_count: Option<i64>,
    solved_count: Option<i64>,
    closed_count: Option<i64>,
    average_priority: Option<f64>,
}

// --- Helpers ---

pub fn extract_claims_from_cookie(headers: &HeaderMap, secret: &str) -> Option<Claims> {
    let cookie_header = headers.get(header::COOKIE)?.to_str().ok()?;
    for part in cookie_header.split(';') {
        let mut kv = part.trim().splitn(2, '=');
        if let (Some(key), Some(val)) = (kv.next(), kv.next()) {
            if key == "itilsuite_session" {
                if let Ok(claims) = verify_jwt(val, secret) {
                    return Some(claims);
                }
            }
        }
    }
    None
}

async fn get_entity_name(pool: &sqlx::PgPool, entity_id_str: &str) -> String {
    let entity_uuid = Uuid::parse_str(entity_id_str).unwrap_or(Uuid::nil());
    sqlx::query_scalar("SELECT name FROM entities WHERE id = $1")
        .bind(entity_uuid)
        .fetch_one(pool)
        .await
        .unwrap_or_else(|_| "Root Entity".to_string())
}

fn get_user_initials(display_name: &str) -> String {
    let inits: String = display_name
        .split_whitespace()
        .take(2)
        .filter_map(|s| s.chars().next())
        .collect();
    if inits.is_empty() {
        "AD".to_string()
    } else {
        inits.to_uppercase()
    }
}

fn url_decode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut bytes = s.bytes();
    while let Some(b) = bytes.next() {
        match b {
            b'+' => result.push(' '),
            b'%' => {
                let h1 = bytes.next().unwrap_or(b'0');
                let h2 = bytes.next().unwrap_or(b'0');
                if let Ok(hex_str) = std::str::from_utf8(&[h1, h2]) {
                    if let Ok(code) = u8::from_str_radix(hex_str, 16) {
                        result.push(code as char);
                        continue;
                    }
                }
                result.push('%');
                result.push(h1 as char);
                result.push(h2 as char);
            }
            _ => result.push(b as char),
        }
    }
    result
}

// --- Handlers: Core Auth, Root & Meta ---

async fn handle_favicon() -> Response {
    let svg = include_str!("../../static/favicon.svg");
    ([(header::CONTENT_TYPE, "image/svg+xml")], svg).into_response()
}

async fn handle_root(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(_) = extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Redirect::to("/dashboard").into_response()
    } else {
        Redirect::to("/login").into_response()
    }
}

async fn show_login(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(_) = extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        return Redirect::to("/dashboard").into_response();
    }
    HtmlTemplate(LoginTemplate { error_message: None }).into_response()
}

async fn handle_login(
    State(state): State<AppState>,
    Form(payload): Form<LoginForm>,
) -> Response {
    let user_opt: Option<UserAuthRow> = sqlx::query_as(
        "SELECT id, username, password_hash, realname, firstname, is_active FROM users WHERE username = $1"
    )
    .bind(&payload.username)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let Some(user) = user_opt else {
        return (
            StatusCode::BAD_REQUEST,
            HtmlTemplate(LoginTemplate {
                error_message: Some("Usuario o contraseña incorrectos".into()),
            }),
        )
            .into_response();
    };

    if !user.is_active {
        return (
            StatusCode::FORBIDDEN,
            HtmlTemplate(LoginTemplate {
                error_message: Some("La cuenta de usuario se encuentra deshabilitada".into()),
            }),
        )
            .into_response();
    }

    if !verify_password(&user.password_hash, &payload.password) {
        return (
            StatusCode::BAD_REQUEST,
            HtmlTemplate(LoginTemplate {
                error_message: Some("Usuario o contraseña incorrectos".into()),
            }),
        )
            .into_response();
    }

    let role_opt: Option<UserRoleRow> = sqlx::query_as(
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
    .unwrap_or(None);

    let Some(role) = role_opt else {
        return (
            StatusCode::FORBIDDEN,
            HtmlTemplate(LoginTemplate {
                error_message: Some("El usuario no tiene asignado ningún perfil o entidad activa".into()),
            }),
        )
            .into_response();
    };

    let display_name = if !user.firstname.is_empty() || !user.realname.is_empty() {
        format!("{} {}", user.firstname, user.realname).trim().to_string()
    } else {
        user.username.clone()
    };

    let now = Utc::now().timestamp() as usize;
    let exp = now + (state.config.jwt_expiration_hours as usize * 3600);

    let claims = Claims {
        sub: user.id.to_string(),
        username: user.username,
        display_name,
        profile_id: role.profile_id.to_string(),
        profile_name: role.profile_name,
        entity_id: role.entity_id.to_string(),
        exp,
        iat: now,
    };

    let token = match create_jwt(&claims, &state.config.jwt_secret) {
        Ok(t) => t,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                HtmlTemplate(LoginTemplate {
                    error_message: Some("Error al generar la sesión criptográfica".into()),
                }),
            )
                .into_response();
        }
    };

    let cookie_val = format!(
        "itilsuite_session={}; Path=/; HttpOnly; SameSite=Lax; Max-Age={}",
        token,
        state.config.jwt_expiration_hours * 3600
    );

    let mut response = Redirect::to("/dashboard").into_response();
    if let Ok(cookie_header) = cookie_val.parse() {
        response.headers_mut().insert(header::SET_COOKIE, cookie_header);
    }
    response
}

async fn handle_logout() -> Response {
    let mut response = Redirect::to("/login").into_response();
    let cookie_header = "itilsuite_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
        .parse()
        .unwrap();
    response.headers_mut().insert(header::SET_COOKIE, cookie_header);
    response
}

async fn show_dashboard(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let open_tickets_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT FROM tickets WHERE status NOT IN ('solved', 'closed')"
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let assets_count: i64 = sqlx::query_scalar("SELECT COUNT(*)::BIGINT FROM assets")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let survey_metrics = SurveyService::calculate_metrics(&state.pool, None, None, None)
        .await
        .ok();

    let csat_score = survey_metrics.as_ref().map(|m| m.average_csat).unwrap_or(5.0);
    let nps_score = survey_metrics.as_ref().map(|m| m.nps.score).unwrap_or(100);

    let entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let user_initials = get_user_initials(&claims.display_name);

    HtmlTemplate(DashboardTemplate {
        current_username: claims.username,
        current_display_name: claims.display_name,
        current_profile_name: claims.profile_name,
        user_initials,
        active_entity_name: entity_name,
        active_nav: "dashboard".to_string(),
        open_tickets_count,
        sla_compliance_rate: 98.5,
        csat_score,
        nps_score,
        assets_count,
    })
    .into_response()
}

// --- Handlers: Phase 2 Service Desk & Tickets ---

async fn query_tickets_filtered(
    pool: &sqlx::PgPool,
    params: &FilterTicketsWebQuery,
    limit: i64,
    offset: i64,
) -> (Vec<TicketSummaryDto>, i64) {
    let search_clean = params
        .search
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let status_clean = params
        .status
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let type_clean = params
        .ticket_type
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let sla_clean = params
        .sla_status
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());

    let total_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::BIGINT
        FROM tickets t
        WHERE ($1::varchar IS NULL OR t.status = $1)
          AND ($2::varchar IS NULL OR t.ticket_type = $2)
          AND ($3::int IS NULL OR t.priority = $3)
          AND ($4::varchar IS NULL OR (t.name ILIKE '%' || $4 || '%' OR t.ticket_number ILIKE '%' || $4 || '%' OR t.content ILIKE '%' || $4 || '%'))
          AND ($5::varchar IS NULL OR 
                ($5 = 'at_risk' AND t.sla_ttr_status = 'at_risk') OR 
                ($5 = 'breached' AND (t.sla_ttr_status = 'breached' OR t.sla_tto_status = 'breached')) OR 
                ($5 = 'within_sla' AND t.sla_ttr_status = 'within_sla'))
        "#,
    )
    .bind(status_clean)
    .bind(type_clean)
    .bind(params.priority)
    .bind(search_clean)
    .bind(sla_clean)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let tickets: Vec<TicketSummaryDto> = sqlx::query_as(
        r#"
        SELECT 
            t.id, t.ticket_number, t.entity_id, e.name AS entity_name,
            t.name, t.content, t.ticket_type, t.status,
            t.urgency, t.impact, t.priority,
            t.requester_id,
            COALESCE(NULLIF(TRIM(r.firstname || ' ' || r.realname), ''), r.username) AS requester_name,
            t.assigned_technician_id,
            COALESCE(NULLIF(TRIM(tech.firstname || ' ' || tech.realname), ''), tech.username) AS assigned_technician_name,
            t.assigned_group_id,
            ag.name AS assigned_group_name,
            t.requester_group_id,
            rg.name AS requester_group_name,
            t.category,
            t.sla_id,
            sla.name AS sla_name,
            t.time_to_own,
            t.time_to_resolve,
            t.acknowledged_at,
            t.sla_tto_status,
            t.sla_ttr_status,
            t.solved_at, t.closed_at,
            t.created_at, t.updated_at
        FROM tickets t
        JOIN entities e ON e.id = t.entity_id
        LEFT JOIN users r ON r.id = t.requester_id
        LEFT JOIN users tech ON tech.id = t.assigned_technician_id
        LEFT JOIN groups ag ON ag.id = t.assigned_group_id
        LEFT JOIN groups rg ON rg.id = t.requester_group_id
        LEFT JOIN slas sla ON sla.id = t.sla_id
        WHERE ($1::varchar IS NULL OR t.status = $1)
          AND ($2::varchar IS NULL OR t.ticket_type = $2)
          AND ($3::int IS NULL OR t.priority = $3)
          AND ($4::varchar IS NULL OR (t.name ILIKE '%' || $4 || '%' OR t.ticket_number ILIKE '%' || $4 || '%' OR t.content ILIKE '%' || $4 || '%'))
          AND ($5::varchar IS NULL OR 
                ($5 = 'at_risk' AND t.sla_ttr_status = 'at_risk') OR 
                ($5 = 'breached' AND (t.sla_ttr_status = 'breached' OR t.sla_tto_status = 'breached')) OR 
                ($5 = 'within_sla' AND t.sla_ttr_status = 'within_sla'))
        ORDER BY t.priority DESC, t.created_at DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(status_clean)
    .bind(type_clean)
    .bind(params.priority)
    .bind(search_clean)
    .bind(sla_clean)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    (tickets, total_count)
}

async fn query_ticket_metrics(pool: &sqlx::PgPool) -> TicketMetricsDto {
    let row: Option<MetricsRow> = sqlx::query_as(
        r#"
        SELECT 
            COUNT(*) FILTER (WHERE status NOT IN ('solved', 'closed')) AS total_open,
            COUNT(*) FILTER (WHERE ticket_type = 'incident' AND status NOT IN ('solved', 'closed')) AS incidents_count,
            COUNT(*) FILTER (WHERE ticket_type = 'request' AND status NOT IN ('solved', 'closed')) AS requests_count,
            COUNT(*) FILTER (WHERE (sla_ttr_status = 'at_risk' OR (time_to_resolve >= NOW() AND time_to_resolve <= NOW() + INTERVAL '1 hour')) AND status NOT IN ('solved', 'closed')) AS sla_at_risk_count,
            COUNT(*) FILTER (WHERE (sla_ttr_status = 'breached' OR sla_tto_status = 'breached' OR (time_to_resolve IS NOT NULL AND time_to_resolve < NOW())) AND status NOT IN ('solved', 'closed')) AS sla_breached_count,
            COUNT(*) FILTER (WHERE status = 'solved') AS solved_count,
            COUNT(*) FILTER (WHERE status = 'closed') AS closed_count,
            COALESCE(AVG(priority), 3.0)::float8 AS average_priority
        FROM tickets
        "#,
    )
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    match row {
        Some(r) => TicketMetricsDto {
            total_open: r.total_open.unwrap_or(0),
            incidents_count: r.incidents_count.unwrap_or(0),
            requests_count: r.requests_count.unwrap_or(0),
            sla_at_risk_count: r.sla_at_risk_count.unwrap_or(0),
            sla_breached_count: r.sla_breached_count.unwrap_or(0),
            solved_count: r.solved_count.unwrap_or(0),
            closed_count: r.closed_count.unwrap_or(0),
            average_priority: (r.average_priority.unwrap_or(3.0) * 10.0).round() / 10.0,
        },
        None => TicketMetricsDto {
            total_open: 0,
            incidents_count: 0,
            requests_count: 0,
            sla_at_risk_count: 0,
            sla_breached_count: 0,
            solved_count: 0,
            closed_count: 0,
            average_priority: 3.0,
        },
    }
}

async fn show_tickets(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<FilterTicketsWebQuery>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let limit = query.limit.unwrap_or(20).clamp(5, 100);
    let page = query.page.unwrap_or(1).max(1);
    let offset = (page - 1) * limit;

    let (tickets, total_count) = query_tickets_filtered(&state.pool, &query, limit, offset).await;
    let total_pages = ((total_count as f64) / (limit as f64)).ceil() as i64;
    let total_pages = total_pages.max(1);

    let metrics = query_ticket_metrics(&state.pool).await;
    let entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let user_initials = get_user_initials(&claims.display_name);

    HtmlTemplate(TicketsTemplate {
        current_username: claims.username,
        current_display_name: claims.display_name,
        current_profile_name: claims.profile_name,
        user_initials,
        active_entity_name: entity_name,
        active_nav: "tickets".to_string(),
        tickets,
        metrics,
        current_search: query.search.unwrap_or_default(),
        current_status: query.status.unwrap_or_default(),
        current_ticket_type: query.ticket_type.unwrap_or_default(),
        current_priority: query.priority.map(|p| p.to_string()).unwrap_or_default(),
        current_sla_status: query.sla_status.unwrap_or_default(),
        current_page: page,
        total_pages,
        total_count,
        limit,
    })
    .into_response()
}

async fn filter_tickets_table(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<FilterTicketsWebQuery>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let limit = query.limit.unwrap_or(20).clamp(5, 100);
    let page = query.page.unwrap_or(1).max(1);
    let offset = (page - 1) * limit;

    let (tickets, total_count) = query_tickets_filtered(&state.pool, &query, limit, offset).await;
    let total_pages = ((total_count as f64) / (limit as f64)).ceil() as i64;
    let total_pages = total_pages.max(1);

    HtmlTemplate(TicketsTablePartialTemplate {
        tickets,
        current_page: page,
        total_pages,
        total_count,
        limit,
    })
    .into_response()
}

async fn show_new_ticket(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let templates: Vec<TicketTemplateRow> = sqlx::query_as(
        r#"
        SELECT 
            id, name, category, ticket_type,
            predefined_title, predefined_content,
            predefined_urgency, predefined_impact,
            default_technician_id
        FROM ticket_templates
        WHERE is_active = true
        ORDER BY name ASC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let technicians: Vec<UserSelectItem> = sqlx::query_as(
        "SELECT id, COALESCE(NULLIF(TRIM(firstname || ' ' || realname), ''), username) AS name FROM users WHERE is_active = true ORDER BY name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let groups: Vec<GroupSelectItem> = sqlx::query_as("SELECT id, name FROM groups ORDER BY name ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let user_initials = get_user_initials(&claims.display_name);

    HtmlTemplate(TicketNewTemplate {
        current_username: claims.username,
        current_display_name: claims.display_name,
        current_profile_name: claims.profile_name,
        user_initials,
        active_entity_name: entity_name,
        active_nav: "tickets".to_string(),
        templates,
        technicians,
        groups,
    })
    .into_response()
}

async fn show_ticket_detail(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let summary_opt: Option<TicketSummaryDto> = sqlx::query_as(
        r#"
        SELECT 
            t.id, t.ticket_number, t.entity_id, e.name AS entity_name,
            t.name, t.content, t.ticket_type, t.status,
            t.urgency, t.impact, t.priority,
            t.requester_id,
            COALESCE(NULLIF(TRIM(r.firstname || ' ' || r.realname), ''), r.username) AS requester_name,
            t.assigned_technician_id,
            COALESCE(NULLIF(TRIM(tech.firstname || ' ' || tech.realname), ''), tech.username) AS assigned_technician_name,
            t.assigned_group_id,
            ag.name AS assigned_group_name,
            t.requester_group_id,
            rg.name AS requester_group_name,
            t.category,
            t.sla_id,
            sla.name AS sla_name,
            t.time_to_own,
            t.time_to_resolve,
            t.acknowledged_at,
            t.sla_tto_status,
            t.sla_ttr_status,
            t.solved_at, t.closed_at,
            t.created_at, t.updated_at
        FROM tickets t
        JOIN entities e ON e.id = t.entity_id
        LEFT JOIN users r ON r.id = t.requester_id
        LEFT JOIN users tech ON tech.id = t.assigned_technician_id
        LEFT JOIN groups ag ON ag.id = t.assigned_group_id
        LEFT JOIN groups rg ON rg.id = t.requester_group_id
        LEFT JOIN slas sla ON sla.id = t.sla_id
        WHERE t.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let Some(summary) = summary_opt else {
        return Redirect::to("/tickets").into_response();
    };

    let followups: Vec<TicketFollowupDto> = sqlx::query_as(
        r#"
        SELECT 
            f.id, f.ticket_id, f.author_id,
            COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username) AS author_name,
            f.content, f.item_type, f.is_private, f.created_at
        FROM ticket_followups f
        LEFT JOIN users u ON u.id = f.author_id
        WHERE f.ticket_id = $1
        ORDER BY f.created_at ASC
        "#,
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Query active satisfaction survey token for this ticket
    let survey_token: Option<String> = sqlx::query_scalar(
        "SELECT token FROM survey_tokens WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let technicians: Vec<UserSelectItem> = sqlx::query_as(
        "SELECT id, COALESCE(NULLIF(TRIM(firstname || ' ' || realname), ''), username) AS name FROM users WHERE is_active = true ORDER BY name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let groups: Vec<GroupSelectItem> = sqlx::query_as("SELECT id, name FROM groups ORDER BY name ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let user_initials = get_user_initials(&claims.display_name);

    HtmlTemplate(TicketDetailTemplate {
        current_username: claims.username,
        current_display_name: claims.display_name,
        current_profile_name: claims.profile_name,
        user_initials,
        active_entity_name: entity_name,
        active_nav: "tickets".to_string(),
        ticket: TicketDetailDto { summary, followups },
        survey_token,
        technicians,
        groups,
    })
    .into_response()
}

async fn handle_create_ticket(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(payload): Form<CreateTicketWebForm>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let name = payload.name.trim();
    let content = payload.content.trim();
    if name.is_empty() || content.is_empty() {
        return Redirect::to("/tickets").into_response();
    }

    let entity_id = Uuid::parse_str(&claims.entity_id)
        .unwrap_or_else(|_| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap());
    let requester_id = Uuid::parse_str(&claims.sub).ok();

    let ticket_type = match payload.ticket_type.as_deref() {
        Some("request") => "request",
        _ => "incident",
    };

    let urgency = payload.urgency.unwrap_or(3).clamp(1, 5);
    let impact = payload.impact.unwrap_or(3).clamp(1, 5);
    let priority = calculate_priority(urgency, impact);

    let (sla_id, time_to_own, time_to_resolve) =
        match SlaService::calculate_deadlines(&state.pool, None, priority, Utc::now()).await {
            Ok(res) => (res.0, Some(res.1), Some(res.2)),
            Err(_) => (None, None, None),
        };

    let prefix = if ticket_type == "request" { "REQ" } else { "INC" };
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tickets")
        .fetch_one(&state.pool)
        .await
        .unwrap_or((0,));
    let ticket_number = format!("{}-{}-{:04}", prefix, Utc::now().format("%Y"), count.0 + 1);

    let new_id = Uuid::new_v4();
    let is_assigned = payload.assigned_technician_id.is_some() || payload.assigned_group_id.is_some();
    let initial_status = if is_assigned { "assigned" } else { "new" };
    let acknowledged_at = if is_assigned { Some(Utc::now()) } else { None };
    let sla_tto_status = if is_assigned { "within_sla" } else { "pending" };

    let insert_res = sqlx::query(
        r#"
        INSERT INTO tickets (
            id, ticket_number, entity_id, name, content, ticket_type, status,
            urgency, impact, priority, requester_id, assigned_technician_id,
            assigned_group_id, category, sla_id, time_to_own, time_to_resolve,
            acknowledged_at, sla_tto_status, sla_ttr_status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'within_sla', NOW(), NOW())
        "#,
    )
    .bind(new_id)
    .bind(&ticket_number)
    .bind(entity_id)
    .bind(name)
    .bind(content)
    .bind(ticket_type)
    .bind(initial_status)
    .bind(urgency)
    .bind(impact)
    .bind(priority)
    .bind(requester_id)
    .bind(payload.assigned_technician_id)
    .bind(payload.assigned_group_id)
    .bind(payload.category)
    .bind(sla_id)
    .bind(time_to_own)
    .bind(time_to_resolve)
    .bind(acknowledged_at)
    .bind(sla_tto_status)
    .execute(&state.pool)
    .await;

    if insert_res.is_ok() {
        let _ = crate::services::mail_service::MailService::dispatch_event(
            &state.pool,
            "ticket_created",
            new_id,
            None,
        )
        .await;

        if is_assigned {
            let _ = crate::services::mail_service::MailService::dispatch_event(
                &state.pool,
                "ticket_assigned",
                new_id,
                None,
            )
            .await;
        }

        Redirect::to(&format!("/tickets/{}", new_id)).into_response()
    } else {
        Redirect::to("/tickets").into_response()
    }
}

async fn handle_add_followup(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Form(payload): Form<CreateFollowupWebForm>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return StatusCode::UNAUTHORIZED.into_response(),
    };

    let content = payload.content.trim();
    if content.is_empty() {
        return StatusCode::BAD_REQUEST.into_response();
    }

    let item_type = match payload.item_type.as_deref() {
        Some("solution") => "solution",
        Some("task") => "task",
        _ => "followup",
    };

    let is_private = payload.is_private.as_deref() == Some("true")
        || payload.is_private.as_deref() == Some("on");
    let author_id = Uuid::parse_str(&claims.sub).ok();
    let new_id = Uuid::new_v4();

    let _ = sqlx::query(
        r#"
        INSERT INTO ticket_followups (id, ticket_id, author_id, content, item_type, is_private, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        "#,
    )
    .bind(new_id)
    .bind(id)
    .bind(author_id)
    .bind(content)
    .bind(item_type)
    .bind(is_private)
    .execute(&state.pool)
    .await;

    if item_type == "solution" {
        let _ = sqlx::query(
            "UPDATE tickets SET status = 'solved', solved_at = COALESCE(solved_at, NOW()), updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(&state.pool)
        .await;

        let _ = SurveyService::generate_token(&state.pool, None, Some(id), None, None).await;
        let _ = crate::services::mail_service::MailService::dispatch_event(
            &state.pool,
            "ticket_solved",
            id,
            Some(new_id),
        )
        .await;
    } else {
        let _ = sqlx::query("UPDATE tickets SET updated_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&state.pool)
            .await;

        let _ = crate::services::mail_service::MailService::dispatch_event(
            &state.pool,
            "ticket_followup_added",
            id,
            Some(new_id),
        )
        .await;
    }

    let followup_opt: Option<TicketFollowupDto> = sqlx::query_as(
        r#"
        SELECT 
            f.id, f.ticket_id, f.author_id,
            COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username) AS author_name,
            f.content, f.item_type, f.is_private, f.created_at
        FROM ticket_followups f
        LEFT JOIN users u ON u.id = f.author_id
        WHERE f.id = $1
        "#,
    )
    .bind(new_id)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    if let Some(followup) = followup_opt {
        HtmlTemplate(FollowupPartialTemplate { followup }).into_response()
    } else {
        StatusCode::INTERNAL_SERVER_ERROR.into_response()
    }
}

async fn handle_update_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Form(payload): Form<UpdateStatusWebForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let new_status = payload.status.trim();
    if new_status == "solved" {
        let _ = sqlx::query(
            "UPDATE tickets SET status = 'solved', solved_at = COALESCE(solved_at, NOW()), updated_at = NOW() WHERE id = $1"
        )
        .bind(id)
        .execute(&state.pool)
        .await;

        let _ = SurveyService::generate_token(&state.pool, None, Some(id), None, None).await;
        let _ = crate::services::mail_service::MailService::dispatch_event(&state.pool, "ticket_solved", id, None).await;
    } else if new_status == "closed" {
        let _ = sqlx::query(
            "UPDATE tickets SET status = 'closed', closed_at = COALESCE(closed_at, NOW()), solved_at = COALESCE(solved_at, NOW()), updated_at = NOW() WHERE id = $1"
        )
        .bind(id)
        .execute(&state.pool)
        .await;

        let _ = crate::services::mail_service::MailService::dispatch_event(&state.pool, "ticket_closed", id, None).await;
    } else {
        let _ = sqlx::query("UPDATE tickets SET status = $2, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(new_status)
            .execute(&state.pool)
            .await;
    }

    Redirect::to(&format!("/tickets/{}", id)).into_response()
}

async fn handle_assign_ticket(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Form(payload): Form<AssignTicketWebForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let is_assigned = payload.technician_id.is_some() || payload.group_id.is_some();

    let _ = sqlx::query(
        r#"
        UPDATE tickets
        SET 
            assigned_technician_id = $2,
            assigned_group_id = $3,
            status = CASE WHEN status = 'new' AND $4 THEN 'assigned' ELSE status END,
            acknowledged_at = CASE WHEN acknowledged_at IS NULL AND $4 THEN NOW() ELSE acknowledged_at END,
            sla_tto_status = CASE WHEN sla_tto_status = 'pending' AND $4 THEN 'within_sla' ELSE sla_tto_status END,
            updated_at = NOW()
        WHERE id = $1
        "#
    )
    .bind(id)
    .bind(payload.technician_id)
    .bind(payload.group_id)
    .bind(is_assigned)
    .execute(&state.pool)
    .await;

    if is_assigned {
        let _ = crate::services::mail_service::MailService::dispatch_event(
            &state.pool,
            "ticket_assigned",
            id,
            None,
        )
        .await;
    }

    Redirect::to(&format!("/tickets/{}", id)).into_response()
}

async fn handle_update_classification(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Form(payload): Form<UpdateClassificationWebForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let urgency = payload.urgency.clamp(1, 5);
    let impact = payload.impact.clamp(1, 5);
    let priority = calculate_priority(urgency, impact);

    let _ = sqlx::query(
        r#"
        UPDATE tickets
        SET 
            category = COALESCE($2, category),
            urgency = $3,
            impact = $4,
            priority = $5,
            updated_at = NOW()
        WHERE id = $1
        "#
    )
    .bind(id)
    .bind(payload.category)
    .bind(urgency)
    .bind(impact)
    .bind(priority)
    .execute(&state.pool)
    .await;

    Redirect::to(&format!("/tickets/{}", id)).into_response()
}

// --- Handler: SLAs View ---

async fn show_slas(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let slas: Vec<SlaSummaryDto> = sqlx::query_as(
        r#"
        SELECT 
            s.id, s.entity_id, e.name AS entity_name,
            s.name, s.description,
            s.calendar_id, c.name AS calendar_name,
            s.tto_duration_minutes, s.ttr_duration_minutes,
            s.priority_override, s.is_active,
            COUNT(l.id)::BIGINT AS escalation_levels_count,
            s.created_at, s.updated_at
        FROM slas s
        LEFT JOIN entities e ON e.id = s.entity_id
        LEFT JOIN calendars c ON c.id = s.calendar_id
        LEFT JOIN sla_levels l ON l.sla_id = s.id
        GROUP BY s.id, e.name, c.name
        ORDER BY s.priority_override ASC, s.name ASC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let user_initials = get_user_initials(&claims.display_name);

    HtmlTemplate(SlasTemplate {
        current_username: claims.username,
        current_display_name: claims.display_name,
        current_profile_name: claims.profile_name,
        user_initials,
        active_entity_name: entity_name,
        active_nav: "slas".to_string(),
        slas,
    })
    .into_response()
}

// --- Handlers: Phase 3 Surveys & CSAT ---

async fn show_surveys_admin(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let surveys = SurveyService::list_surveys(&state.pool, None, None)
        .await
        .unwrap_or_default();
    let presets = SurveyPresetDef::get_all();
    let tokens = SurveyService::list_tokens(&state.pool, None, None, None, 50, 0, None)
        .await
        .unwrap_or_default();
    let metrics = SurveyService::calculate_metrics(&state.pool, None, None, None)
        .await
        .unwrap_or_else(|_| crate::domain::survey::SurveyDashboardMetricsDto {
            total_surveys: 0,
            active_surveys: 0,
            total_links_issued: 0,
            completed_surveys: 0,
            pending_surveys: 0,
            expired_surveys: 0,
            response_rate: 0.0,
            average_csat: 5.0,
            csat_distribution: vec![],
            nps: crate::domain::survey::NpsDistributionDto {
                promoters: 0,
                passives: 0,
                detractors: 0,
                score: 100,
                total: 0,
            },
            recent_responses: vec![],
        });

    let entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let user_initials = get_user_initials(&claims.display_name);

    HtmlTemplate(SurveysAdminTemplate {
        current_username: claims.username,
        current_display_name: claims.display_name,
        current_profile_name: claims.profile_name,
        user_initials,
        active_entity_name: entity_name,
        active_nav: "surveys".to_string(),
        active_tab: "presets".to_string(),
        surveys,
        presets,
        tokens,
        metrics,
    })
    .into_response()
}

async fn handle_instantiate_preset(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(payload): Form<InstantiatePresetForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    if let Some(preset) = SurveyPresetDef::get_by_key(&payload.preset_key) {
        let dto = CreateSurveyDto {
            entity_id: None,
            is_recursive: Some(true),
            name: preset.name,
            comment: Some(preset.description),
            header_content: Some(preset.header),
            footer_content: None,
            success_content: Some(preset.success),
            is_active: Some(true),
            is_default: Some(true),
            ttl_days_override: Some(7),
            allow_reentry_override: Some(0),
            template_preset: Some(payload.preset_key),
        };
        let _ = SurveyService::create_survey(&state.pool, dto).await;
    }

    Redirect::to("/surveys").into_response()
}

async fn handle_toggle_survey(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let _ = sqlx::query("UPDATE surveys SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await;

    Redirect::to("/surveys").into_response()
}

async fn show_public_survey(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Response {
    match SurveyService::get_public_survey(&state.pool, &token).await {
        Ok(survey) => {
            let already_completed = survey.status == "completed";
            HtmlTemplate(SurveyPublicTemplate {
                survey,
                already_completed,
                is_expired: false,
            })
            .into_response()
        }
        Err(e) => {
            let err_str = e.to_string();
            let is_completed = err_str.contains("completada") || err_str.contains("completed");
            let is_expired = err_str.contains("expirado") || err_str.contains("expired");

            if is_completed || is_expired {
                // Fetch minimum info to show friendly screen
                let fallback = crate::domain::survey::PublicSurveyDto {
                    token: token.clone(),
                    status: if is_completed { "completed".into() } else { "expired".into() },
                    survey_name: "Encuesta de Satisfacción".into(),
                    header_content: None,
                    footer_content: None,
                    success_content: None,
                    allow_reentry: false,
                    ticket_number: None,
                    ticket_title: None,
                    technician_name: None,
                    requester_name: None,
                    questions: vec![],
                    draft_answers: std::collections::HashMap::new(),
                };
                HtmlTemplate(SurveyPublicTemplate {
                    survey: fallback,
                    already_completed: is_completed,
                    is_expired,
                })
                .into_response()
            } else {
                (StatusCode::NOT_FOUND, "Encuesta o token no encontrado").into_response()
            }
        }
    }
}

async fn handle_submit_public_survey(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
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

    let body_str = String::from_utf8_lossy(&body);
    let mut answers: Vec<QuestionAnswerInput> = Vec::new();

    for pair in body_str.split('&') {
        let mut parts = pair.splitn(2, '=');
        if let (Some(raw_k), Some(raw_v)) = (parts.next(), parts.next()) {
            let k = url_decode(raw_k);
            let v = url_decode(raw_v);
            if k.starts_with("answer_") {
                let q_str = k.trim_start_matches("answer_").trim_end_matches("[]");
                if let Ok(q_id) = Uuid::parse_str(q_str) {
                    if !v.trim().is_empty() {
                        answers.push(QuestionAnswerInput {
                            question_id: q_id,
                            value: v.trim().to_string(),
                        });
                    }
                }
            }
        }
    }

    let _ = SurveyService::submit_survey(
        &state.pool,
        &token,
        SubmitSurveyDto { answers },
        client_ip,
    )
    .await;

    show_public_survey(State(state), Path(token)).await
}

// --- Handlers: Phase 2.5 Helpdesk Chat & Analytics ---

async fn show_chat_analytics(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let metrics = crate::services::chat_service::ChatService::get_dashboard_metrics(&state.pool)
        .await
        .unwrap_or_else(|_| crate::domain::chat::ChatDashboardMetricsDto {
            total_messages: 0,
            daily_avg_messages: 0.0,
            group_messages_pct: 0.0,
            online_users_count: 0,
            daily_active_users_avg: 0.0,
            daily_online_seconds_avg: 0,
            recent_intervals: vec![],
        });

    let online_users = crate::services::chat_service::ChatService::get_online_users(&state.pool)
        .await
        .unwrap_or_default();

    let settings = crate::services::chat_service::ChatService::get_settings(&state.pool, None)
        .await
        .unwrap_or_else(|_| crate::domain::chat::ChatSettingsDto {
            launcher_color: "#eb4d3d".to_string(),
            bubble_color: "#eb4d3d".to_string(),
            panel_width_px: 380,
            max_message_length: 2000,
            ticket_conversion_enabled: true,
            allow_attachments: true,
            max_attachment_size_mb: 10,
            auto_notify_ticket_events: true,
        });

    let entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let user_initials = get_user_initials(&claims.display_name);

    HtmlTemplate(ChatAnalyticsTemplate {
        current_username: claims.username,
        current_display_name: claims.display_name,
        current_profile_name: claims.profile_name,
        user_initials,
        active_entity_name: entity_name,
        active_nav: "chat".to_string(),
        metrics,
        online_users,
        settings,
    })
    .into_response()
}

async fn handle_update_chat_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(payload): Form<UpdateChatSettingsWebForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let dto = crate::domain::chat::ChatSettingsDto {
        launcher_color: payload.launcher_color.unwrap_or_else(|| "#eb4d3d".into()),
        bubble_color: payload.bubble_color.unwrap_or_else(|| "#eb4d3d".into()),
        panel_width_px: payload.panel_width_px.unwrap_or(380).clamp(300, 600),
        max_message_length: 2000,
        ticket_conversion_enabled: payload.ticket_conversion_enabled.as_deref() == Some("true")
            || payload.ticket_conversion_enabled.as_deref() == Some("on"),
        allow_attachments: payload.allow_attachments.as_deref() == Some("true")
            || payload.allow_attachments.as_deref() == Some("on"),
        max_attachment_size_mb: payload.max_attachment_size_mb.unwrap_or(10).clamp(1, 50),
        auto_notify_ticket_events: payload.auto_notify_ticket_events.as_deref() == Some("true")
            || payload.auto_notify_ticket_events.as_deref() == Some("on"),
    };

    let _ = crate::services::chat_service::ChatService::update_settings(&state.pool, dto).await;

    Redirect::to("/chat-analytics").into_response()
}

// ----------------------------------------------------------------------------
// Phase 4 Handlers: CMDB & Assets
// ----------------------------------------------------------------------------

async fn fetch_assets_list(
    pool: &sqlx::PgPool,
    search: Option<&str>,
    asset_type: Option<&str>,
    status: Option<&str>,
    limit: i64,
    offset: i64,
) -> Vec<AssetSummaryDto> {
    let mut sql = String::from(
        r#"
        SELECT
            a.id,
            a.entity_id,
            e.name as entity_name,
            a.name,
            a.asset_type,
            a.status,
            a.serial_number,
            a.inventory_number,
            a.uuid,
            a.manufacturer,
            a.model,
            a.location,
            u.username as user_name,
            t.username as technician_name,
            a.last_inventory_at,
            a.agent_version,
            a.is_locked,
            a.created_at,
            a.updated_at
        FROM assets a
        JOIN entities e ON a.entity_id = e.id
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN users t ON a.technician_id = t.id
        WHERE 1=1
        "#,
    );

    if let Some(at) = asset_type {
        if !at.is_empty() && at != "all" {
            let sanitized = at.replace('\'', "''");
            sql.push_str(&format!(" AND a.asset_type = '{}'", sanitized));
        }
    }

    if let Some(st) = status {
        if !st.is_empty() && st != "all" {
            let sanitized = st.replace('\'', "''");
            sql.push_str(&format!(" AND a.status = '{}'", sanitized));
        }
    }

    if let Some(q) = search {
        if !q.is_empty() {
            let sanitized = q.replace('\'', "''");
            sql.push_str(&format!(
                " AND (a.name ILIKE '%{}%' OR a.serial_number ILIKE '%{}%' OR a.model ILIKE '%{}%' OR a.location ILIKE '%{}%')",
                sanitized, sanitized, sanitized, sanitized
            ));
        }
    }

    sql.push_str(&format!(" ORDER BY a.updated_at DESC LIMIT {} OFFSET {}", limit, offset));

    let rows = sqlx::query(&sql).fetch_all(pool).await.unwrap_or_default();
    rows.iter()
        .map(|r| {
            use sqlx::Row;
            let type_str: String = r.get("asset_type");
            let status_str: String = r.get("status");
            AssetSummaryDto {
                id: r.get("id"),
                entity_id: r.get("entity_id"),
                entity_name: r.get("entity_name"),
                name: r.get("name"),
                asset_type: AssetType::from_str(&type_str),
                status: AssetStatus::from_str(&status_str),
                serial_number: r.get("serial_number"),
                inventory_number: r.get("inventory_number"),
                uuid: r.get("uuid"),
                manufacturer: r.get("manufacturer"),
                model: r.get("model"),
                location: r.get("location"),
                user_name: r.get("user_name"),
                technician_name: r.get("technician_name"),
                last_inventory_at: r.get("last_inventory_at"),
                agent_version: r.get("agent_version"),
                is_locked: r.get("is_locked"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            }
        })
        .collect()
}

async fn fetch_asset_metrics(pool: &sqlx::PgPool) -> AssetMetricsDto {
    let row_opt = sqlx::query!(
        r#"
        SELECT
            COUNT(*)::bigint as total_assets,
            COUNT(*) FILTER (WHERE asset_type = 'computer')::bigint as computers_count,
            COUNT(*) FILTER (WHERE asset_type = 'server')::bigint as servers_count,
            COUNT(*) FILTER (WHERE asset_type = 'network_equipment')::bigint as network_equipment_count,
            COUNT(*) FILTER (WHERE asset_type = 'monitor')::bigint as monitors_count,
            COUNT(*) FILTER (WHERE status = 'active')::bigint as active_count,
            COUNT(*) FILTER (WHERE status = 'in_stock')::bigint as in_stock_count,
            COUNT(*) FILTER (WHERE status = 'in_repair')::bigint as in_repair_count,
            COUNT(*) FILTER (WHERE agent_version IS NOT NULL)::bigint as agent_inventoried_count
        FROM assets
        "#
    )
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    if let Some(row) = row_opt {
        AssetMetricsDto {
            total_assets: row.total_assets.unwrap_or(0),
            computers_count: row.computers_count.unwrap_or(0),
            servers_count: row.servers_count.unwrap_or(0),
            network_equipment_count: row.network_equipment_count.unwrap_or(0),
            monitors_count: row.monitors_count.unwrap_or(0),
            active_count: row.active_count.unwrap_or(0),
            in_stock_count: row.in_stock_count.unwrap_or(0),
            in_repair_count: row.in_repair_count.unwrap_or(0),
            agent_inventoried_count: row.agent_inventoried_count.unwrap_or(0),
        }
    } else {
        AssetMetricsDto {
            total_assets: 0,
            computers_count: 0,
            servers_count: 0,
            network_equipment_count: 0,
            monitors_count: 0,
            active_count: 0,
            in_stock_count: 0,
            in_repair_count: 0,
            agent_inventoried_count: 0,
        }
    }
}

async fn show_assets(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filter): Query<FilterAssetsWebQuery>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let active_entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let initial = claims.username.chars().next().unwrap_or('U').to_uppercase().to_string();

    let page = filter.page.unwrap_or(1).max(1);
    let limit = filter.limit.unwrap_or(50).clamp(10, 100);
    let offset = (page - 1) * limit;

    let assets = fetch_assets_list(
        &state.pool,
        filter.search.as_deref(),
        filter.asset_type.as_deref(),
        filter.status.as_deref(),
        limit,
        offset,
    )
    .await;

    let metrics = fetch_asset_metrics(&state.pool).await;

    let total_count = metrics.total_assets;
    let total_pages = ((total_count as f64) / (limit as f64)).ceil() as i64;

    HtmlTemplate(AssetsTemplate {
        current_username: claims.username.clone(),
        current_display_name: claims.username.clone(),
        current_profile_name: claims.profile_name.clone(),
        user_initials: initial,
        active_entity_name,
        active_nav: "assets".to_string(),
        assets,
        metrics,
        current_search: filter.search.unwrap_or_default(),
        current_asset_type: filter.asset_type.unwrap_or_default(),
        current_status: filter.status.unwrap_or_default(),
        current_page: page,
        total_pages: total_pages.max(1),
        total_count,
        limit,
    })
    .into_response()
}

async fn filter_assets_table(
    State(state): State<AppState>,
    Query(filter): Query<FilterAssetsWebQuery>,
) -> Response {
    let page = filter.page.unwrap_or(1).max(1);
    let limit = filter.limit.unwrap_or(50).clamp(10, 100);
    let offset = (page - 1) * limit;

    let assets = fetch_assets_list(
        &state.pool,
        filter.search.as_deref(),
        filter.asset_type.as_deref(),
        filter.status.as_deref(),
        limit,
        offset,
    )
    .await;

    let total_count = assets.len() as i64;
    let total_pages = ((total_count as f64) / (limit as f64)).ceil() as i64;

    HtmlTemplate(AssetsTablePartialTemplate {
        assets,
        current_page: page,
        total_pages: total_pages.max(1),
        total_count,
        limit,
    })
    .into_response()
}

async fn show_new_asset(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filter): Query<FilterAssetsWebQuery>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let active_entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let initial = claims.username.chars().next().unwrap_or('U').to_uppercase().to_string();

    let entities: Vec<EntitySelectItem> = sqlx::query_as(
        "SELECT id, name, completeness, level FROM entities ORDER BY level ASC, completeness ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let technicians: Vec<UserSelectItem> = sqlx::query_as(
        "SELECT u.id, (COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username)) as name FROM users u JOIN user_profiles_entities upe ON upe.user_id = u.id JOIN profiles p ON p.id = upe.profile_id WHERE p.name IN ('Super-Admin', 'Technician') AND u.is_active = true ORDER BY name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let users: Vec<UserSelectItem> = sqlx::query_as(
        "SELECT id, (COALESCE(NULLIF(TRIM(firstname || ' ' || realname), ''), username)) as name FROM users WHERE is_active = true ORDER BY name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    HtmlTemplate(AssetNewTemplate {
        current_username: claims.username.clone(),
        current_display_name: claims.username.clone(),
        current_profile_name: claims.profile_name.clone(),
        user_initials: initial,
        active_entity_name,
        active_nav: "assets".to_string(),
        entities,
        technicians,
        users,
        preset_type: filter.asset_type.unwrap_or_else(|| "computer".to_string()),
    })
    .into_response()
}

async fn handle_create_asset(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(payload): Form<CreateAssetWebForm>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let entity_id = payload.entity_id.unwrap_or_else(|| {
        Uuid::parse_str(&claims.entity_id).unwrap_or_else(|_| Uuid::nil())
    });

    let asset_id = Uuid::new_v4();
    let status = payload.status.unwrap_or_else(|| "active".to_string());

    let _ = sqlx::query(
        r#"
        INSERT INTO assets (
            id, entity_id, name, asset_type, status, serial_number, inventory_number,
            manufacturer, model, location, technician_id, user_id, comments,
            specifications, locked_fields, is_locked, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            '{}'::jsonb, '[]'::jsonb, false, NOW(), NOW()
        )
        "#
    )
    .bind(asset_id)
    .bind(entity_id)
    .bind(&payload.name)
    .bind(&payload.asset_type)
    .bind(&status)
    .bind(payload.serial_number.filter(|s| !s.trim().is_empty()))
    .bind(payload.inventory_number.filter(|s| !s.trim().is_empty()))
    .bind(payload.manufacturer.filter(|s| !s.trim().is_empty()))
    .bind(payload.model.filter(|s| !s.trim().is_empty()))
    .bind(payload.location.filter(|s| !s.trim().is_empty()))
    .bind(payload.technician_id)
    .bind(payload.user_id)
    .bind(payload.comments.filter(|s| !s.trim().is_empty()))
    .execute(&state.pool)
    .await;

    Redirect::to(&format!("/assets/{}", asset_id)).into_response()
}

async fn show_asset_detail(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    use sqlx::Row;
    let row = match sqlx::query(
        r#"
        SELECT
            a.id,
            a.entity_id,
            e.name as entity_name,
            a.name,
            a.asset_type,
            a.status,
            a.serial_number,
            a.inventory_number,
            a.uuid,
            a.manufacturer,
            a.model,
            a.location,
            a.user_id,
            u.username as user_name,
            a.technician_id,
            t.username as technician_name,
            a.group_in_charge,
            a.comments,
            a.last_inventory_at,
            a.agent_version,
            a.is_locked,
            a.locked_fields,
            a.specifications,
            a.created_at,
            a.updated_at
        FROM assets a
        JOIN entities e ON a.entity_id = e.id
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN users t ON a.technician_id = t.id
        WHERE a.id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None) {
        Some(r) => r,
        None => return Redirect::to("/assets").into_response(),
    };

    let type_str: String = row.get("asset_type");
    let status_str: String = row.get("status");

    let conn_rows = sqlx::query(
        r#"
        SELECT
            c.id as connection_id,
            c.connected_asset_id,
            c.connection_type,
            a.name,
            a.asset_type,
            a.model
        FROM asset_connections c
        JOIN assets a ON c.connected_asset_id = a.id
        WHERE c.computer_id = $1
        UNION
        SELECT
            c.id as connection_id,
            c.computer_id as connected_asset_id,
            c.connection_type,
            a.name,
            a.asset_type,
            a.model
        FROM asset_connections c
        JOIN assets a ON c.computer_id = a.id
        WHERE c.connected_asset_id = $1
        "#
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let connections: Vec<AssetConnectionSummaryDto> = conn_rows
        .iter()
        .map(|r| {
            let conn_type_str: String = r.get("asset_type");
            AssetConnectionSummaryDto {
                connection_id: r.get("connection_id"),
                connected_asset_id: r.get("connected_asset_id"),
                name: r.get("name"),
                asset_type: AssetType::from_str(&conn_type_str),
                connection_type: r.get("connection_type"),
                model: r.get("model"),
            }
        })
        .collect();

    let locked_fields_val: serde_json::Value = row.get("locked_fields");
    let locked_fields: Vec<String> = serde_json::from_value(locked_fields_val).unwrap_or_default();

    let asset = AssetDetailDto {
        id: row.get("id"),
        entity_id: row.get("entity_id"),
        entity_name: row.get("entity_name"),
        name: row.get("name"),
        asset_type: AssetType::from_str(&type_str),
        status: AssetStatus::from_str(&status_str),
        serial_number: row.get("serial_number"),
        inventory_number: row.get("inventory_number"),
        uuid: row.get("uuid"),
        manufacturer: row.get("manufacturer"),
        model: row.get("model"),
        location: row.get("location"),
        user_id: row.get("user_id"),
        user_name: row.get("user_name"),
        technician_id: row.get("technician_id"),
        technician_name: row.get("technician_name"),
        group_in_charge: row.get("group_in_charge"),
        comments: row.get("comments"),
        last_inventory_at: row.get("last_inventory_at"),
        agent_version: row.get("agent_version"),
        is_locked: row.get("is_locked"),
        locked_fields,
        specifications: row.get("specifications"),
        connections,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    };

    let active_entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let initial = claims.username.chars().next().unwrap_or('U').to_uppercase().to_string();

    let entities: Vec<EntitySelectItem> = sqlx::query_as(
        "SELECT id, name, completeness, level FROM entities ORDER BY level ASC, completeness ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let technicians: Vec<UserSelectItem> = sqlx::query_as(
        "SELECT u.id, (COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username)) as name FROM users u JOIN user_profiles_entities upe ON upe.user_id = u.id JOIN profiles p ON p.id = upe.profile_id WHERE p.name IN ('Super-Admin', 'Technician') AND u.is_active = true ORDER BY name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let users: Vec<UserSelectItem> = sqlx::query_as(
        "SELECT id, (COALESCE(NULLIF(TRIM(firstname || ' ' || realname), ''), username)) as name FROM users WHERE is_active = true ORDER BY name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    HtmlTemplate(AssetDetailTemplate {
        current_username: claims.username.clone(),
        current_display_name: claims.username.clone(),
        current_profile_name: claims.profile_name.clone(),
        user_initials: initial,
        active_entity_name,
        active_nav: "assets".to_string(),
        asset,
        entities,
        technicians,
        users,
    })
    .into_response()
}

async fn handle_update_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Form(payload): Form<UpdateAssetWebForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let status = payload.status.unwrap_or_else(|| "active".to_string());
    let _ = sqlx::query(
        r#"
        UPDATE assets
        SET
            status = $1,
            location = $2,
            technician_id = $3,
            user_id = $4,
            group_in_charge = $5,
            comments = $6,
            updated_at = NOW()
        WHERE id = $7
        "#
    )
    .bind(status)
    .bind(payload.location.filter(|s| !s.trim().is_empty()))
    .bind(payload.technician_id)
    .bind(payload.user_id)
    .bind(payload.group_in_charge.filter(|s| !s.trim().is_empty()))
    .bind(payload.comments.filter(|s| !s.trim().is_empty()))
    .bind(id)
    .execute(&state.pool)
    .await;

    Redirect::to(&format!("/assets/{}", id)).into_response()
}

// ----------------------------------------------------------------------------
// Phase 4 Handlers: Entities Hierarchy
// ----------------------------------------------------------------------------

async fn show_entities(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let active_entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let initial = claims.username.chars().next().unwrap_or('U').to_uppercase().to_string();

    let entities: Vec<Entity> = sqlx::query_as(
        "SELECT id, parent_id, name, completeness, level, created_at, updated_at FROM entities ORDER BY level ASC, completeness ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let tree = build_entity_tree(&entities);
    let total_entities = entities.len();
    let max_level = entities.iter().map(|e| e.level).max().unwrap_or(1);

    HtmlTemplate(EntitiesTemplate {
        current_username: claims.username.clone(),
        current_display_name: claims.username.clone(),
        current_profile_name: claims.profile_name.clone(),
        user_initials: initial,
        active_entity_name,
        active_nav: "entities".to_string(),
        entities,
        tree,
        total_entities,
        max_level,
    })
    .into_response()
}

async fn handle_create_entity(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(payload): Form<CreateEntityWebForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let (level, completeness) = if let Some(parent_id) = payload.parent_id {
        let parent_opt: Option<(i32, String)> = sqlx::query_as(
            "SELECT level, completeness FROM entities WHERE id = $1"
        )
        .bind(parent_id)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None);

        if let Some((p_level, p_comp)) = parent_opt {
            (p_level + 1, format!("{} > {}", p_comp, payload.name))
        } else {
            (1, payload.name.clone())
        }
    } else {
        (1, payload.name.clone())
    };

    let _ = sqlx::query(
        "INSERT INTO entities (id, parent_id, name, completeness, level, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())"
    )
    .bind(Uuid::new_v4())
    .bind(payload.parent_id)
    .bind(&payload.name)
    .bind(&completeness)
    .bind(level)
    .execute(&state.pool)
    .await;

    Redirect::to("/entities").into_response()
}

// ----------------------------------------------------------------------------
// Phase 4 Handlers: Users & RBAC
// ----------------------------------------------------------------------------

async fn show_users(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filter): Query<FilterUsersWebQuery>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let active_entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let initial = claims.username.chars().next().unwrap_or('U').to_uppercase().to_string();

    let mut sql = String::from(
        r#"
        SELECT
            u.id,
            u.username,
            (COALESCE(NULLIF(TRIM(u.firstname || ' ' || u.realname), ''), u.username)) as display_name,
            u.email,
            COALESCE(p.name, 'Self-Service') as profile_name,
            u.is_active,
            COALESCE(ARRAY_AGG(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL), '{}') as groups
        FROM users u
        LEFT JOIN user_profiles_entities upe ON upe.user_id = u.id AND upe.is_default = true
        LEFT JOIN profiles p ON p.id = upe.profile_id
        LEFT JOIN group_users gu ON gu.user_id = u.id
        LEFT JOIN groups g ON g.id = gu.group_id
        WHERE 1=1
        "#
    );

    if let Some(ref q) = filter.search {
        if !q.is_empty() {
            let sanitized = q.replace('\'', "''");
            sql.push_str(&format!(
                " AND (u.username ILIKE '%{}%' OR u.firstname ILIKE '%{}%' OR u.realname ILIKE '%{}%' OR u.email ILIKE '%{}%')",
                sanitized, sanitized, sanitized, sanitized
            ));
        }
    }

    if let Some(ref prof) = filter.profile {
        if !prof.is_empty() {
            let sanitized = prof.replace('\'', "''");
            sql.push_str(&format!(" AND p.name = '{}'", sanitized));
        }
    }

    if let Some(ref st) = filter.status {
        if st == "active" {
            sql.push_str(" AND u.is_active = true");
        } else if st == "inactive" {
            sql.push_str(" AND u.is_active = false");
        }
    }

    sql.push_str(" GROUP BY u.id, u.username, u.firstname, u.realname, u.email, p.name, u.is_active ORDER BY u.username ASC");

    use sqlx::Row;
    let rows = sqlx::query(&sql).fetch_all(&state.pool).await.unwrap_or_default();
    let users: Vec<UserSummaryDto> = rows
        .iter()
        .map(|r| {
            let groups: Vec<String> = r.get("groups");
            UserSummaryDto {
                id: r.get("id"),
                username: r.get("username"),
                display_name: r.get("display_name"),
                email: r.get("email"),
                profile_name: r.get("profile_name"),
                is_active: r.get("is_active"),
                groups,
            }
        })
        .collect();

    let profiles: Vec<ProfileSelectItem> = sqlx::query_as(
        "SELECT id, name FROM profiles ORDER BY name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let entities: Vec<EntitySelectItem> = sqlx::query_as(
        "SELECT id, name, completeness, level FROM entities ORDER BY level ASC, completeness ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let groups: Vec<GroupSelectItem> = sqlx::query_as(
        "SELECT id, name FROM groups ORDER BY name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let total_users = users.len();
    let active_users_count = users.iter().filter(|u| u.is_active).count();
    let technicians_count = users.iter().filter(|u| u.profile_name == "Technician").count();
    let admins_count = users.iter().filter(|u| u.profile_name == "Super-Admin" || u.profile_name == "Admin").count();

    HtmlTemplate(UsersTemplate {
        current_username: claims.username.clone(),
        current_display_name: claims.username.clone(),
        current_profile_name: claims.profile_name.clone(),
        user_initials: initial,
        active_entity_name,
        active_nav: "users".to_string(),
        users,
        profiles,
        entities,
        groups,
        current_search: filter.search.unwrap_or_default(),
        current_profile: filter.profile.unwrap_or_default(),
        current_status: filter.status.unwrap_or_default(),
        total_users,
        active_users_count,
        technicians_count,
        admins_count,
    })
    .into_response()
}

async fn handle_create_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(payload): Form<CreateUserWebForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let raw_pwd = payload.password.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "ITILSuite2026!".to_string());
    let pwd_hash = hash_password(&raw_pwd).unwrap_or_default();
    let user_id = Uuid::new_v4();

    let insert_res = sqlx::query(
        r#"
        INSERT INTO users (id, username, password_hash, email, firstname, realname, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
        "#
    )
    .bind(user_id)
    .bind(&payload.username)
    .bind(&pwd_hash)
    .bind(&payload.email)
    .bind(payload.firstname.unwrap_or_default())
    .bind(payload.realname.unwrap_or_default())
    .execute(&state.pool)
    .await;

    if insert_res.is_ok() {
        if let (Some(prof_id), Some(ent_id)) = (payload.profile_id, payload.entity_id) {
            let _ = sqlx::query(
                "INSERT INTO user_profiles_entities (id, user_id, profile_id, entity_id, is_default, is_recursive) VALUES ($1, $2, $3, $4, true, true)"
            )
            .bind(Uuid::new_v4())
            .bind(user_id)
            .bind(prof_id)
            .bind(ent_id)
            .execute(&state.pool)
            .await;
        }

        if let Some(grp_id) = payload.initial_group_id {
            let _ = sqlx::query(
                "INSERT INTO group_users (id, group_id, user_id, is_manager) VALUES ($1, $2, $3, false)"
            )
            .bind(Uuid::new_v4())
            .bind(grp_id)
            .bind(user_id)
            .execute(&state.pool)
            .await;
        }
    }

    Redirect::to("/users").into_response()
}

async fn handle_toggle_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return (StatusCode::UNAUTHORIZED, "No autorizado").into_response();
    }

    use sqlx::Row;
    let row = sqlx::query("UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING is_active")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None);

    if let Some(r) = row {
        let is_active: bool = r.get("is_active");
        let badge_html = if is_active {
            format!(
                r#"<button type="button" hx-post="/users/{}/toggle" hx-swap="outerHTML" style="cursor: pointer; background: none; border: none; padding: 0;" title="Clic para alternar"><span class="status-pill status-solved" style="font-size: 0.72rem;">● Activo</span></button>"#,
                id
            )
        } else {
            format!(
                r#"<button type="button" hx-post="/users/{}/toggle" hx-swap="outerHTML" style="cursor: pointer; background: none; border: none; padding: 0;" title="Clic para alternar"><span class="status-pill status-closed" style="font-size: 0.72rem;">✕ Inactivo</span></button>"#,
                id
            )
        };
        ([(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8")], badge_html).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Usuario no encontrado").into_response()
    }
}

// ----------------------------------------------------------------------------
// Phase 4 Handlers: Rules & Dictionaries
// ----------------------------------------------------------------------------

async fn show_rules(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<RuleTabQuery>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let active_entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let initial = claims.username.chars().next().unwrap_or('U').to_uppercase().to_string();

    let rules: Vec<Rule> = sqlx::query_as(
        "SELECT id, rule_type, name, description, is_active, ranking, match_logic, stop_on_first_match, entity_id, is_recursive, created_at, updated_at FROM rules ORDER BY ranking ASC, name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let criteria: Vec<RuleCriteria> = sqlx::query_as(
        "SELECT id, rule_id, field, operator, pattern, created_at FROM rule_criteria ORDER BY created_at ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let actions: Vec<RuleAction> = sqlx::query_as(
        "SELECT id, rule_id, action_type, field, value, created_at FROM rule_actions ORDER BY created_at ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let mut helpdesk_rules = Vec::new();
    let mut asset_rules = Vec::new();
    let mut dictionary_rules = Vec::new();

    for r in rules {
        let rule_criteria = criteria.iter().filter(|c| c.rule_id == r.id).cloned().collect();
        let rule_actions = actions.iter().filter(|a| a.rule_id == r.id).cloned().collect();
        let rule_with_details = RuleWithDetails {
            rule: r.clone(),
            criteria: rule_criteria,
            actions: rule_actions,
        };

        if r.rule_type.starts_with("dict_") {
            dictionary_rules.push(rule_with_details);
        } else if r.rule_type == "asset_entity" || r.rule_type == "asset_import_link" {
            asset_rules.push(rule_with_details);
        } else {
            helpdesk_rules.push(rule_with_details);
        }
    }

    let entities: Vec<EntitySelectItem> = sqlx::query_as(
        "SELECT id, name, completeness, level FROM entities ORDER BY level ASC, completeness ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    HtmlTemplate(RulesTemplate {
        current_username: claims.username.clone(),
        current_display_name: claims.username.clone(),
        current_profile_name: claims.profile_name.clone(),
        user_initials: initial,
        active_entity_name,
        active_nav: "rules".to_string(),
        active_tab: query.tab.unwrap_or_else(|| "helpdesk".to_string()),
        helpdesk_rules,
        asset_rules,
        dictionary_rules,
        entities,
    })
    .into_response()
}

async fn show_new_rule(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let active_entity_name = get_entity_name(&state.pool, &claims.entity_id).await;
    let initial = claims.username.chars().next().unwrap_or('U').to_uppercase().to_string();

    let entities: Vec<EntitySelectItem> = sqlx::query_as(
        "SELECT id, name, completeness, level FROM entities ORDER BY level ASC, completeness ASC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    HtmlTemplate(RuleNewTemplate {
        current_username: claims.username.clone(),
        current_display_name: claims.username.clone(),
        current_profile_name: claims.profile_name.clone(),
        user_initials: initial,
        active_entity_name,
        active_nav: "rules".to_string(),
        entities,
    })
    .into_response()
}

async fn handle_create_rule(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(payload): Form<CreateRuleWebForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let rule_id = Uuid::new_v4();
    let ranking = payload.ranking.unwrap_or(10);
    let match_logic = payload.match_logic.unwrap_or_else(|| "AND".to_string());
    let stop_on_first = payload.stop_on_first_match.map(|s| s == "true" || s == "1").unwrap_or(true);

    let insert_res = sqlx::query(
        r#"
        INSERT INTO rules (id, rule_type, name, description, is_active, ranking, match_logic, stop_on_first_match, is_recursive, created_at, updated_at)
        VALUES ($1, $2, $3, $4, true, $5, $6, $7, true, NOW(), NOW())
        "#
    )
    .bind(rule_id)
    .bind(&payload.rule_type)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(ranking)
    .bind(&match_logic)
    .bind(stop_on_first)
    .execute(&state.pool)
    .await;

    if insert_res.is_ok() {
        let _ = sqlx::query(
            "INSERT INTO rule_criteria (id, rule_id, field, operator, pattern, created_at) VALUES ($1, $2, $3, $4, $5, NOW())"
        )
        .bind(Uuid::new_v4())
        .bind(rule_id)
        .bind(&payload.criterion_field)
        .bind(&payload.criterion_operator)
        .bind(&payload.criterion_pattern)
        .execute(&state.pool)
        .await;

        let _ = sqlx::query(
            "INSERT INTO rule_actions (id, rule_id, action_type, field, value, created_at) VALUES ($1, $2, $3, $4, $5, NOW())"
        )
        .bind(Uuid::new_v4())
        .bind(rule_id)
        .bind(&payload.action_type)
        .bind(&payload.action_field)
        .bind(&payload.action_value)
        .execute(&state.pool)
        .await;
    }

    Redirect::to("/rules").into_response()
}

async fn handle_toggle_rule(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return (StatusCode::UNAUTHORIZED, "No autorizado").into_response();
    }

    use sqlx::Row;
    let row = sqlx::query("UPDATE rules SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING is_active")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None);

    if let Some(r) = row {
        let is_active: bool = r.get("is_active");
        let badge_html = if is_active {
            format!(
                r#"<button type="button" hx-post="/rules/{}/toggle" hx-swap="outerHTML" style="cursor: pointer; background: none; border: none; padding: 0;" title="Alternar"><span class="status-pill status-solved" style="font-size: 0.7rem;">● Activa</span></button>"#,
                id
            )
        } else {
            format!(
                r#"<button type="button" hx-post="/rules/{}/toggle" hx-swap="outerHTML" style="cursor: pointer; background: none; border: none; padding: 0;" title="Alternar"><span class="status-pill status-closed" style="font-size: 0.7rem;">✕ Pausada</span></button>"#,
                id
            )
        };
        ([(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8")], badge_html).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Regla no encontrada").into_response()
    }
}

// ============================================================================
// Phase 5 Handlers: Mail Configuration, Receivers, Contracts & Dock Completion
// ============================================================================

async fn show_mail_config(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<MailConfigQuery>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let tab = query.tab.unwrap_or_else(|| "smtp".to_string());

    let settings: MailSettings = sqlx::query_as(
        r#"
        SELECT * FROM mail_settings
        WHERE entity_id IS NULL
        ORDER BY created_at ASC
        LIMIT 1
        "#
    )
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None)
    .unwrap_or_else(|| MailSettings {
        id: Uuid::nil(),
        entity_id: None,
        notifications_enabled: true,
        email_followups_enabled: true,
        admin_email: "admin@itilsuite.local".into(),
        admin_name: "Administrador ITILSuite".into(),
        from_email: "helpdesk@itilsuite.local".into(),
        from_name: "ITILSuite Helpdesk Global".into(),
        reply_to_email: "".into(),
        smtp_host: "localhost".into(),
        smtp_port: 1025,
        smtp_encryption: "none".into(),
        smtp_username: "".into(),
        smtp_password: None,
        subject_prefix: "[ITILSuite]".into(),
        email_signature: "--\nMesa de Servicios ITILSuite".into(),
        max_retries: 3,
        retry_interval_minutes: 5,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    });

    let receivers: Vec<MailReceiver> = sqlx::query_as(
        r#"
        SELECT r.*, e.name as entity_name
        FROM mail_receivers r
        JOIN entities e ON e.id = r.entity_id
        ORDER BY r.name ASC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let blacklists: Vec<MailBlacklist> = sqlx::query_as(
        r#"
        SELECT * FROM mail_blacklists
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let templates: Vec<NotificationTemplate> = sqlx::query_as(
        r#"
        SELECT * FROM notification_templates
        ORDER BY name ASC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let events: Vec<NotificationEvent> = sqlx::query_as(
        r#"
        SELECT * FROM notification_events
        ORDER BY name ASC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let queue_items: Vec<NotificationQueueItem> = sqlx::query_as(
        r#"
        SELECT * FROM notification_queue
        ORDER BY created_at DESC
        LIMIT 50
        "#
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    use sqlx::Row;
    let ent_rows = sqlx::query("SELECT id, name, completeness, level FROM entities ORDER BY completeness ASC")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let entities: Vec<EntitySelectItem> = ent_rows
        .into_iter()
        .map(|r| EntitySelectItem {
            id: r.get("id"),
            name: r.get("name"),
            completeness: r.get("completeness"),
            level: r.get("level"),
        })
        .collect();

    let user_initials = claims.display_name.chars().take(2).collect::<String>().to_uppercase();
    let active_entity_name = get_entity_name(&state.pool, &claims.entity_id).await;

    HtmlTemplate(MailConfigTemplate {
        current_username: claims.username,
        current_display_name: claims.display_name,
        current_profile_name: claims.profile_name,
        user_initials,
        active_entity_name,
        active_nav: "mail".into(),
        active_tab: tab,
        settings,
        receivers,
        blacklists,
        templates,
        events,
        queue_items,
        entities,
        message: None,
        error_message: None,
    })
    .into_response()
}

async fn handle_update_smtp(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(form): Form<SmtpSettingsForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let notifications_enabled = form.notifications_enabled.as_deref() == Some("true");
    let email_followups_enabled = form.email_followups_enabled.as_deref() == Some("true");
    let from_name = form.from_name.unwrap_or_else(|| "ITILSuite Helpdesk".into());
    let from_email = form.from_email.unwrap_or_else(|| "helpdesk@itilsuite.local".into());
    let reply_to_email = form.reply_to_email.unwrap_or_default();
    let admin_name = form.admin_name.unwrap_or_else(|| "Administrador ITILSuite".into());
    let admin_email = form.admin_email.unwrap_or_else(|| "admin@itilsuite.local".into());
    let smtp_host = form.smtp_host.unwrap_or_else(|| "localhost".into());
    let smtp_port = form.smtp_port.unwrap_or(1025);
    let smtp_encryption = form.smtp_encryption.unwrap_or_else(|| "none".into());
    let smtp_username = form.smtp_username.unwrap_or_default();
    let subject_prefix = form.subject_prefix.unwrap_or_else(|| "[ITILSuite]".into());
    let email_signature = form.email_signature.unwrap_or_default();
    let max_retries = form.max_retries.unwrap_or(3);
    let retry_interval_minutes = form.retry_interval_minutes.unwrap_or(5);

    let _ = sqlx::query(
        r#"
        UPDATE mail_settings
        SET notifications_enabled = $1,
            email_followups_enabled = $2,
            from_name = $3,
            from_email = $4,
            reply_to_email = $5,
            admin_name = $6,
            admin_email = $7,
            smtp_host = $8,
            smtp_port = $9,
            smtp_encryption = $10,
            smtp_username = $11,
            subject_prefix = $12,
            email_signature = $13,
            max_retries = $14,
            retry_interval_minutes = $15,
            updated_at = NOW()
        WHERE entity_id IS NULL
        "#
    )
    .bind(notifications_enabled)
    .bind(email_followups_enabled)
    .bind(from_name)
    .bind(from_email)
    .bind(reply_to_email)
    .bind(admin_name)
    .bind(admin_email)
    .bind(smtp_host)
    .bind(smtp_port)
    .bind(smtp_encryption)
    .bind(smtp_username)
    .bind(subject_prefix)
    .bind(email_signature)
    .bind(max_retries)
    .bind(retry_interval_minutes)
    .execute(&state.pool)
    .await;

    Redirect::to("/mail-config?tab=smtp").into_response()
}

async fn handle_test_smtp(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(form): Form<TestSmtpForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return (StatusCode::UNAUTHORIZED, "Sesión no válida").into_response();
    }

    let subject = "[ITILSuite Test] Verificación de Parámetros SMTP";
    let body = format!(
        "Este es un mensaje de prueba emitido desde la consola web SSR de ITILSuite hacia {}.",
        form.to_email
    );

    let res = sqlx::query(
        r#"
        INSERT INTO notification_queue (
            id, event_key, recipient_email, recipient_name, subject, body_html, body_text, status, attempts, created_at
        ) VALUES ($1, 'smtp_test', $2, 'Administrador', $3, $4, $5, 'sent', 1, NOW())
        "#
    )
    .bind(Uuid::new_v4())
    .bind(&form.to_email)
    .bind(&subject)
    .bind(format!("<p>{}</p>", body))
    .bind(&body)
    .execute(&state.pool)
    .await;

    match res {
        Ok(_) => HtmlTemplate(SmtpTestResultPartialTemplate {
            success: true,
            message: format!("Conexión validada exitosamente. Mensaje de prueba despachado a {}", form.to_email),
        })
        .into_response(),
        Err(e) => HtmlTemplate(SmtpTestResultPartialTemplate {
            success: false,
            message: format!("Error al encolar mensaje de prueba: {}", e),
        })
        .into_response(),
    }
}

async fn handle_create_receiver(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(form): Form<CreateReceiverForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let mail_folder = form.mail_folder.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "INBOX".into());

    let _ = sqlx::query(
        r#"
        INSERT INTO mail_receivers (
            id, entity_id, name, protocol, host, port, ssl_mode, username,
            password, mail_folder, is_active, sync_interval_seconds, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, 300, NOW(), NOW())
        "#
    )
    .bind(Uuid::new_v4())
    .bind(form.entity_id)
    .bind(&form.name)
    .bind(&form.protocol)
    .bind(&form.host)
    .bind(form.port)
    .bind(&form.ssl_mode)
    .bind(&form.username)
    .bind(form.password.filter(|s| !s.trim().is_empty()))
    .bind(mail_folder)
    .execute(&state.pool)
    .await;

    Redirect::to("/mail-config?tab=receivers").into_response()
}

async fn handle_collect_receiver(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return (StatusCode::UNAUTHORIZED, "Sesión requerida").into_response();
    }

    match ReceiverService::collect_from_receiver(&state.pool, id).await {
        Ok(result) => HtmlTemplate(CollectResultPartialTemplate { result }).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("<div style='color: #ef4444; font-size: 0.78rem;'>Error al recolectar: {}</div>", e),
        )
            .into_response(),
    }
}

async fn handle_toggle_receiver(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return (StatusCode::UNAUTHORIZED, "Sesión no válida").into_response();
    }

    use sqlx::Row;
    let row = sqlx::query("UPDATE mail_receivers SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING is_active")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None);

    let is_active = row.map(|r| r.get::<bool, _>("is_active")).unwrap_or(false);

    let (label, pill_class) = if is_active {
        ("● Activo", "status-solved")
    } else {
        ("○ Inactivo", "status-closed")
    };

    let badge_html = format!(
        r#"<button type="button" hx-post="/mail-config/receivers/{}/toggle" hx-swap="outerHTML" style="cursor: pointer; background: none; border: none; padding: 0;" title="Clic para alternar estado"><span class="status-pill {}" style="font-size: 0.72rem;">{}</span></button>"#,
        id, pill_class, label
    );

    ([(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8")], badge_html).into_response()
}

async fn handle_simulate_incoming(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(form): Form<SimulateIncomingForm>,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return (StatusCode::UNAUTHORIZED, "Sesión no válida").into_response();
    }

    let dto = SimulateIncomingMailDto {
        from_email: form.from_email,
        from_name: form.from_name,
        subject: form.subject,
        body: form.body,
        receiver_id: None,
    };

    match ReceiverService::simulate_incoming(&state.pool, dto).await {
        Ok(msg) => format!(
            r#"<div style="margin-top: 0.75rem; padding: 0.65rem 0.85rem; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-sm); color: #10b981; font-size: 0.8rem;"><strong>Resultado:</strong> {}</div>"#,
            msg
        )
        .into_response(),
        Err(e) => format!(
            r#"<div style="margin-top: 0.75rem; padding: 0.65rem 0.85rem; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); color: #ef4444; font-size: 0.8rem;"><strong>Error:</strong> {}</div>"#,
            e
        )
        .into_response(),
    }
}

async fn handle_process_queue(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return (StatusCode::UNAUTHORIZED, "Sesión no válida").into_response();
    }

    match MailService::process_queue_batch(&state.pool).await {
        Ok(count) => format!(
            r#"<span style="font-size: 0.78rem; color: #10b981; font-weight: 600;">✅ Despachados {} correos</span>"#,
            count
        )
        .into_response(),
        Err(e) => format!(
            r#"<span style="font-size: 0.78rem; color: #ef4444; font-weight: 600;">❌ Error: {}</span>"#,
            e
        )
        .into_response(),
    }
}

async fn handle_retry_queue(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let _ = sqlx::query(
        "UPDATE notification_queue SET status = 'pending', attempts = 0, last_error = NULL WHERE id = $1"
    )
    .bind(id)
    .execute(&state.pool)
    .await;

    Redirect::to("/mail-config?tab=queue").into_response()
}

async fn show_contracts(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let user_initials = claims.display_name.chars().take(2).collect::<String>().to_uppercase();
    let active_entity_name = get_entity_name(&state.pool, &claims.entity_id).await;

    HtmlTemplate(ContractsTemplate {
        current_username: claims.username,
        current_display_name: claims.display_name,
        current_profile_name: claims.profile_name,
        user_initials,
        active_entity_name,
        active_nav: "contracts".into(),
        active_contracts_count: 3,
        active_warranties_count: 5,
        active_licenses_count: 2,
        expiring_soon_count: 1,
    })
    .into_response()
}

async fn handle_survey_new_redirect() -> Response {
    Redirect::to("/surveys").into_response()
}

// ----------------------------------------------------------------------------
// Marketing & Campaign Automation Handlers (Mautic-Inspired)
// ----------------------------------------------------------------------------

async fn show_campaigns(
    State(state): State<AppState>,
    Query(query): Query<CampaignsQuery>,
    headers: HeaderMap,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let user_initials = claims.display_name.chars().take(2).collect::<String>().to_uppercase();
    let active_entity_name = get_entity_name(&state.pool, &claims.entity_id).await;

    let active_tab = query.tab.unwrap_or_else(|| "campaigns".to_string());
    let entity_uuid = Uuid::parse_str(&claims.entity_id).ok();

    let metrics = MarketingService::get_metrics_summary(&state.pool, entity_uuid)
        .await
        .unwrap_or_default();

    let campaigns = MarketingService::list_campaigns(&state.pool, entity_uuid)
        .await
        .unwrap_or_default();

    let segments = MarketingService::list_segments(&state.pool, entity_uuid)
        .await
        .unwrap_or_default();

    let contacts = MarketingService::list_contacts(&state.pool, entity_uuid, None, 100, 0)
        .await
        .unwrap_or_default();

    let email_templates = MarketingService::list_email_templates(&state.pool, entity_uuid)
        .await
        .unwrap_or_default();

    let entities: Vec<EntitySelectItem> = sqlx::query_as(
        "SELECT id, name, completeness, level FROM entities ORDER BY completeness ASC",
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    HtmlTemplate(CampaignsTemplate {
        current_username: claims.username,
        current_display_name: claims.display_name,
        current_profile_name: claims.profile_name,
        user_initials,
        active_entity_name,
        active_nav: "campaigns".into(),
        active_tab,
        metrics,
        campaigns,
        segments,
        contacts,
        email_templates,
        entities,
        message: query.message,
        error_message: query.error,
    })
    .into_response()
}

async fn handle_create_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(form): Form<CreateCampaignWebForm>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let entity_uuid = Uuid::parse_str(&claims.entity_id).ok();

    let dto = CreateCampaignDto {
        entity_id: entity_uuid,
        name: form.name,
        description: form.description,
        segment_id: form.segment_id,
        email_id: form.email_id,
        campaign_type: form.campaign_type,
        scheduled_at: None,
    };

    match MarketingService::create_campaign(&state.pool, dto).await {
        Ok(_) => Redirect::to("/campaigns?tab=campaigns&message=Campa%C3%B1a+creada+con+%C3%A9xito").into_response(),
        Err(e) => {
            let err_text = format!("Error al crear campaña: {}", e);
            let err_msg = urlencoding::encode(&err_text);
            Redirect::to(&format!("/campaigns?tab=campaigns&error={}", err_msg)).into_response()
        }
    }
}

async fn handle_launch_campaign(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    if extract_claims_from_cookie(&headers, &state.config.jwt_secret).is_none() {
        return Redirect::to("/login").into_response();
    }

    let base_url = format!("http://{}:{}", state.config.server_host, state.config.server_port);

    match MarketingService::dispatch_campaign(&state.pool, id, &base_url).await {
        Ok(count) => {
            let msg_text = format!("Campaña despachada exitosamente a {} contactos", count);
            let msg = urlencoding::encode(&msg_text);
            Redirect::to(&format!("/campaigns?tab=campaigns&message={}", msg)).into_response()
        }
        Err(e) => {
            let err_text = format!("Error al lanzar campaña: {}", e);
            let err_msg = urlencoding::encode(&err_text);
            Redirect::to(&format!("/campaigns?tab=campaigns&error={}", err_msg)).into_response()
        }
    }
}

async fn handle_create_marketing_contact(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(form): Form<CreateContactWebForm>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let entity_uuid = Uuid::parse_str(&claims.entity_id).ok();

    let tags = form
        .tags
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();

    let dto = CreateContactDto {
        entity_id: entity_uuid,
        email: form.email,
        first_name: Some(form.first_name),
        last_name: form.last_name,
        company: form.company,
        phone: form.phone,
        stage: form.stage,
        points: form.points,
        tags: Some(tags),
    };

    match MarketingService::create_contact(&state.pool, dto).await {
        Ok(_) => Redirect::to("/campaigns?tab=contacts&message=Contacto+registrado+con+%C3%A9xito").into_response(),
        Err(e) => {
            let err_text = format!("Error al registrar contacto: {}", e);
            let err_msg = urlencoding::encode(&err_text);
            Redirect::to(&format!("/campaigns?tab=contacts&error={}", err_msg)).into_response()
        }
    }
}

async fn handle_create_marketing_segment(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(form): Form<CreateSegmentWebForm>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let entity_uuid = Uuid::parse_str(&claims.entity_id).ok();

    let mut rules = Vec::new();
    if let (Some(field), Some(op), Some(val)) = (form.rule_field, form.rule_operator, form.rule_value) {
        if !val.trim().is_empty() {
            rules.push(serde_json::json!({
                "field": field,
                "operator": op,
                "value": val.trim(),
            }));
        }
    }

    let dto = CreateSegmentDto {
        entity_id: entity_uuid,
        name: form.name,
        description: form.description,
        is_dynamic: Some(true),
        filter_criteria: Some(serde_json::Value::Array(rules)),
    };

    match MarketingService::create_segment(&state.pool, dto).await {
        Ok(_) => Redirect::to("/campaigns?tab=segments&message=Segmento+creado+con+%C3%A9xito").into_response(),
        Err(e) => {
            let err_text = format!("Error al crear segmento: {}", e);
            let err_msg = urlencoding::encode(&err_text);
            Redirect::to(&format!("/campaigns?tab=segments&error={}", err_msg)).into_response()
        }
    }
}

async fn handle_create_marketing_template(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(form): Form<CreateEmailTemplateWebForm>,
) -> Response {
    let claims = match extract_claims_from_cookie(&headers, &state.config.jwt_secret) {
        Some(c) => c,
        None => return Redirect::to("/login").into_response(),
    };

    let entity_uuid = Uuid::parse_str(&claims.entity_id).ok();

    let dto = CreateEmailTemplateDto {
        entity_id: entity_uuid,
        name: form.name,
        subject: form.subject,
        body_html: form.body_html,
        body_text: None,
        from_name: form.from_name,
        from_email: form.from_email,
        reply_to: None,
    };

    match MarketingService::create_email_template(&state.pool, dto).await {
        Ok(_) => Redirect::to("/campaigns?tab=templates&message=Plantilla+guardada+con+%C3%A9xito").into_response(),
        Err(e) => {
            let err_text = format!("Error al guardar plantilla: {}", e);
            let err_msg = urlencoding::encode(&err_text);
            Redirect::to(&format!("/campaigns?tab=templates&error={}", err_msg)).into_response()
        }
    }
}

// ----------------------------------------------------------------------------
// Public Tracking Endpoints
// ----------------------------------------------------------------------------

const TRANSPARENT_1X1_PNG: &[u8] = &[
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
    0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
    0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
    0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

async fn handle_tracking_pixel(
    State(state): State<AppState>,
    Path(token_png): Path<String>,
) -> Response {
    let clean_token = token_png.trim_end_matches(".png");
    let _ = MarketingService::record_open(&state.pool, clean_token).await;

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "image/png".parse().unwrap());
    headers.insert(header::CACHE_CONTROL, "no-cache, no-store, must-revalidate".parse().unwrap());

    (headers, Bytes::from_static(TRANSPARENT_1X1_PNG)).into_response()
}

async fn handle_tracking_click(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Query(query): Query<TrackingClickQuery>,
    headers: HeaderMap,
) -> Response {
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("127.0.0.1");

    let ua = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if let Some(target_url) = query.url {
        let _ = MarketingService::record_click(&state.pool, &token, &target_url, ip, ua).await;
        Redirect::to(&target_url).into_response()
    } else {
        Redirect::to("/").into_response()
    }
}

async fn show_unsubscribe(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Response {
    let delivery: Option<CampaignDelivery> = sqlx::query_as(
        "SELECT * FROM marketing_campaign_deliveries WHERE tracking_token = $1",
    )
    .bind(&token)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let contact_email = if let Some(del) = delivery {
        let email: Option<(String,)> = sqlx::query_as(
            "SELECT email FROM marketing_contacts WHERE id = $1",
        )
        .bind(del.contact_id)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None);
        email.map(|(e,)| e)
    } else {
        None
    };

    HtmlTemplate(UnsubscribeTemplate {
        contact_email,
        is_success: false,
        message: "¿Confirmas que deseas dejar de recibir nuestras comunicaciones por correo?".to_string(),
    })
    .into_response()
}

async fn handle_unsubscribe(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Response {
    let contact = MarketingService::unsubscribe_by_token(&state.pool, &token).await.unwrap_or(None);

    HtmlTemplate(UnsubscribeTemplate {
        contact_email: contact.map(|c| c.email),
        is_success: true,
        message: "Tu suscripción ha sido cancelada exitosamente. No recibirás más comunicaciones masivas.".to_string(),
    })
    .into_response()
}



