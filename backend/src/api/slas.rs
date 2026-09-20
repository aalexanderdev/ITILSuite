use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use chrono::{NaiveDate, NaiveTime, Utc};
use uuid::Uuid;

use crate::domain::auth::Claims;
use crate::domain::sla::{
    calculate_target_time, Calendar, CalendarDetailDto, CalendarHoliday, CalendarSegment,
    CreateCalendarDto, CreateCalendarHolidayDto, CreateCalendarSegmentDto, CreateSlaDto,
    CreateSlaLevelDto, Sla, SlaDetailDto, SlaLevel, SlaSimulationRequest, SlaSimulationResponse,
    SlaSummaryDto, UpdateCalendarDto, UpdateSlaDto, UpdateSlaLevelDto,
};
use crate::error::AppError;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // Calendars
        .route("/calendars", get(list_calendars).post(create_calendar))
        .route(
            "/calendars/:id",
            get(get_calendar).put(update_calendar).delete(delete_calendar),
        )
        .route("/calendars/:id/segments", post(save_calendar_segments))
        .route("/calendars/:id/holidays", post(add_calendar_holiday))
        .route(
            "/calendars/:id/holidays/:holiday_id",
            delete(delete_calendar_holiday),
        )
        // SLAs
        .route("/slas", get(list_slas).post(create_sla))
        .route("/slas/:id", get(get_sla).put(update_sla).delete(delete_sla))
        .route(
            "/slas/:id/levels",
            get(list_sla_levels).post(create_sla_level),
        )
        .route(
            "/slas/:id/levels/:level_id",
            put(update_sla_level).delete(delete_sla_level),
        )
        // Simulation
        .route("/slas/simulate", post(simulate_sla))
}

// ============================================================================
// Calendars Handlers
// ============================================================================

#[utoipa::path(
    get,
    path = "/api/v1/calendars",
    tag = "SLAs",
    responses(
        (status = 200, description = "List of business calendars", body = Vec<Calendar>)
    )
)]
pub async fn list_calendars(
    State(state): State<AppState>,
    _claims: Claims,
) -> Result<Json<Vec<Calendar>>, AppError> {
    let calendars: Vec<Calendar> = sqlx::query_as(
        "SELECT * FROM calendars ORDER BY is_default DESC, name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to fetch calendars: {}", e)))?;

    Ok(Json(calendars))
}

#[utoipa::path(
    post,
    path = "/api/v1/calendars",
    tag = "SLAs",
    request_body = CreateCalendarDto,
    responses(
        (status = 201, description = "Calendar created successfully", body = CalendarDetailDto)
    )
)]
pub async fn create_calendar(
    State(state): State<AppState>,
    _claims: Claims,
    Json(payload): Json<CreateCalendarDto>,
) -> Result<(StatusCode, Json<CalendarDetailDto>), AppError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Calendar name cannot be empty".into()));
    }

    let timezone = payload.timezone.unwrap_or_else(|| "UTC".to_string());
    let is_default = payload.is_default.unwrap_or(false);
    let new_id = Uuid::new_v4();

    let mut tx = state.pool.begin().await
        .map_err(|e| AppError::InternalServerError(format!("Failed to start transaction: {}", e)))?;

    if is_default {
        let _ = sqlx::query("UPDATE calendars SET is_default = FALSE WHERE entity_id IS NOT DISTINCT FROM $1")
            .bind(payload.entity_id)
            .execute(&mut *tx)
            .await;
    }

    let calendar: Calendar = sqlx::query_as(
        r#"
        INSERT INTO calendars (id, entity_id, name, timezone, is_default, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING *
        "#
    )
    .bind(new_id)
    .bind(payload.entity_id)
    .bind(name)
    .bind(&timezone)
    .bind(is_default)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to insert calendar: {}", e)))?;

    // Insert segments if provided
    let mut saved_segments = Vec::new();
    if let Some(segs) = payload.segments {
        for s in segs {
            let start = parse_time(&s.start_time)?;
            let end = parse_time(&s.end_time)?;
            if start >= end {
                return Err(AppError::BadRequest("Segment start_time must be strictly earlier than end_time".into()));
            }
            let seg_id = Uuid::new_v4();
            let seg: CalendarSegment = sqlx::query_as(
                r#"
                INSERT INTO calendar_segments (id, calendar_id, day_of_week, start_time, end_time, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING *
                "#
            )
            .bind(seg_id)
            .bind(new_id)
            .bind(s.day_of_week.clamp(1, 7))
            .bind(start)
            .bind(end)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to insert segment: {}", e)))?;
            saved_segments.push(seg);
        }
    }

    // Insert holidays if provided
    let mut saved_holidays = Vec::new();
    if let Some(hols) = payload.holidays {
        for h in hols {
            let hdate = NaiveDate::parse_from_str(&h.holiday_date, "%Y-%m-%d")
                .map_err(|_| AppError::BadRequest(format!("Invalid date format '{}', expected YYYY-MM-DD", h.holiday_date)))?;
            let hol_id = Uuid::new_v4();
            let hol: CalendarHoliday = sqlx::query_as(
                r#"
                INSERT INTO calendar_holidays (id, calendar_id, name, holiday_date, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (calendar_id, holiday_date) DO NOTHING
                RETURNING *
                "#
            )
            .bind(hol_id)
            .bind(new_id)
            .bind(h.name.trim())
            .bind(hdate)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to insert holiday: {}", e)))?;
            saved_holidays.push(hol);
        }
    }

    tx.commit().await
        .map_err(|e| AppError::InternalServerError(format!("Failed to commit transaction: {}", e)))?;

    Ok((
        StatusCode::CREATED,
        Json(CalendarDetailDto {
            id: calendar.id,
            entity_id: calendar.entity_id,
            name: calendar.name,
            timezone: calendar.timezone,
            is_default: calendar.is_default,
            segments: saved_segments,
            holidays: saved_holidays,
            created_at: calendar.created_at,
            updated_at: calendar.updated_at,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/calendars/{id}",
    tag = "SLAs",
    responses(
        (status = 200, description = "Calendar details with segments and holidays", body = CalendarDetailDto),
        (status = 404, description = "Calendar not found")
    )
)]
pub async fn get_calendar(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<CalendarDetailDto>, AppError> {
    let calendar: Calendar = sqlx::query_as("SELECT * FROM calendars WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Calendar not found".into()))?;

    let segments: Vec<CalendarSegment> = sqlx::query_as(
        "SELECT * FROM calendar_segments WHERE calendar_id = $1 ORDER BY day_of_week, start_time"
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let holidays: Vec<CalendarHoliday> = sqlx::query_as(
        "SELECT * FROM calendar_holidays WHERE calendar_id = $1 ORDER BY holiday_date ASC"
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Ok(Json(CalendarDetailDto {
        id: calendar.id,
        entity_id: calendar.entity_id,
        name: calendar.name,
        timezone: calendar.timezone,
        is_default: calendar.is_default,
        segments,
        holidays,
        created_at: calendar.created_at,
        updated_at: calendar.updated_at,
    }))
}

#[utoipa::path(
    put,
    path = "/api/v1/calendars/{id}",
    tag = "SLAs",
    request_body = UpdateCalendarDto,
    responses(
        (status = 200, description = "Calendar updated", body = Calendar),
        (status = 404, description = "Calendar not found")
    )
)]
pub async fn update_calendar(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCalendarDto>,
) -> Result<Json<Calendar>, AppError> {
    let existing: Calendar = sqlx::query_as("SELECT * FROM calendars WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Calendar not found".into()))?;

    let name = payload.name.unwrap_or(existing.name);
    let timezone = payload.timezone.unwrap_or(existing.timezone);
    let is_default = payload.is_default.unwrap_or(existing.is_default);

    if is_default && !existing.is_default {
        let _ = sqlx::query("UPDATE calendars SET is_default = FALSE WHERE entity_id IS NOT DISTINCT FROM $1")
            .bind(existing.entity_id)
            .execute(&state.pool)
            .await;
    }

    let updated: Calendar = sqlx::query_as(
        r#"
        UPDATE calendars
        SET name = $1, timezone = $2, is_default = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *
        "#
    )
    .bind(name)
    .bind(timezone)
    .bind(is_default)
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to update calendar: {}", e)))?;

    Ok(Json(updated))
}

#[utoipa::path(
    delete,
    path = "/api/v1/calendars/{id}",
    tag = "SLAs",
    responses(
        (status = 204, description = "Calendar deleted"),
        (status = 404, description = "Calendar not found")
    )
)]
pub async fn delete_calendar(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM calendars WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to delete calendar: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Calendar not found".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/calendars/{id}/segments",
    tag = "SLAs",
    request_body = Vec<CreateCalendarSegmentDto>,
    responses(
        (status = 200, description = "Segments replaced successfully", body = Vec<CalendarSegment>)
    )
)]
pub async fn save_calendar_segments(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<Vec<CreateCalendarSegmentDto>>,
) -> Result<Json<Vec<CalendarSegment>>, AppError> {
    let mut tx = state.pool.begin().await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    // Delete existing segments
    let _ = sqlx::query("DELETE FROM calendar_segments WHERE calendar_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await;

    let mut saved = Vec::new();
    for s in payload {
        let start = parse_time(&s.start_time)?;
        let end = parse_time(&s.end_time)?;
        if start >= end {
            return Err(AppError::BadRequest("Segment start_time must be strictly earlier than end_time".into()));
        }

        let seg: CalendarSegment = sqlx::query_as(
            r#"
            INSERT INTO calendar_segments (id, calendar_id, day_of_week, start_time, end_time, created_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
            RETURNING *
            "#
        )
        .bind(id)
        .bind(s.day_of_week.clamp(1, 7))
        .bind(start)
        .bind(end)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to insert segment: {}", e)))?;

        saved.push(seg);
    }

    tx.commit().await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    Ok(Json(saved))
}

#[utoipa::path(
    post,
    path = "/api/v1/calendars/{id}/holidays",
    tag = "SLAs",
    request_body = CreateCalendarHolidayDto,
    responses(
        (status = 201, description = "Holiday added", body = CalendarHoliday)
    )
)]
pub async fn add_calendar_holiday(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateCalendarHolidayDto>,
) -> Result<(StatusCode, Json<CalendarHoliday>), AppError> {
    let hdate = NaiveDate::parse_from_str(&payload.holiday_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid date format, expected YYYY-MM-DD".into()))?;

    let hol: CalendarHoliday = sqlx::query_as(
        r#"
        INSERT INTO calendar_holidays (id, calendar_id, name, holiday_date, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, NOW())
        RETURNING *
        "#
    )
    .bind(id)
    .bind(payload.name.trim())
    .bind(hdate)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to add holiday: {}", e)))?;

    Ok((StatusCode::CREATED, Json(hol)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/calendars/{id}/holidays/{holiday_id}",
    tag = "SLAs",
    responses(
        (status = 204, description = "Holiday removed")
    )
)]
pub async fn delete_calendar_holiday(
    State(state): State<AppState>,
    _claims: Claims,
    Path((_id, holiday_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    sqlx::query("DELETE FROM calendar_holidays WHERE id = $1")
        .bind(holiday_id)
        .execute(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// SLAs Handlers
// ============================================================================

#[utoipa::path(
    get,
    path = "/api/v1/slas",
    tag = "SLAs",
    responses(
        (status = 200, description = "List of SLA profiles with calendar names and level counts", body = Vec<SlaSummaryDto>)
    )
)]
pub async fn list_slas(
    State(state): State<AppState>,
    _claims: Claims,
) -> Result<Json<Vec<SlaSummaryDto>>, AppError> {
    let slas: Vec<SlaSummaryDto> = sqlx::query_as(
        r#"
        SELECT 
            s.id, s.entity_id, e.name AS entity_name,
            s.name, s.description,
            s.calendar_id, c.name AS calendar_name,
            s.tto_duration_minutes, s.ttr_duration_minutes,
            s.priority_override, s.is_active,
            COUNT(l.id)::int8 AS escalation_levels_count,
            s.created_at, s.updated_at
        FROM slas s
        LEFT JOIN entities e ON e.id = s.entity_id
        LEFT JOIN calendars c ON c.id = s.calendar_id
        LEFT JOIN sla_levels l ON l.sla_id = s.id
        GROUP BY s.id, e.name, c.name
        ORDER BY s.priority_override DESC NULLS LAST, s.created_at ASC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to retrieve SLAs: {}", e)))?;

    Ok(Json(slas))
}

#[utoipa::path(
    post,
    path = "/api/v1/slas",
    tag = "SLAs",
    request_body = CreateSlaDto,
    responses(
        (status = 201, description = "SLA created successfully", body = Sla)
    )
)]
pub async fn create_sla(
    State(state): State<AppState>,
    _claims: Claims,
    Json(payload): Json<CreateSlaDto>,
) -> Result<(StatusCode, Json<Sla>), AppError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("SLA profile name cannot be empty".into()));
    }

    let tto = payload.tto_duration_minutes.max(1);
    let ttr = payload.ttr_duration_minutes.max(1);
    let is_active = payload.is_active.unwrap_or(true);
    let new_id = Uuid::new_v4();

    let sla: Sla = sqlx::query_as(
        r#"
        INSERT INTO slas (
            id, entity_id, name, description, calendar_id,
            tto_duration_minutes, ttr_duration_minutes, priority_override,
            is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
        "#
    )
    .bind(new_id)
    .bind(payload.entity_id)
    .bind(name)
    .bind(payload.description.as_deref())
    .bind(payload.calendar_id)
    .bind(tto)
    .bind(ttr)
    .bind(payload.priority_override)
    .bind(is_active)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to insert SLA: {}", e)))?;

    Ok((StatusCode::CREATED, Json(sla)))
}

#[utoipa::path(
    get,
    path = "/api/v1/slas/{id}",
    tag = "SLAs",
    responses(
        (status = 200, description = "SLA details including escalation levels", body = SlaDetailDto),
        (status = 404, description = "SLA not found")
    )
)]
pub async fn get_sla(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<SlaDetailDto>, AppError> {
    let summary: SlaSummaryDto = sqlx::query_as(
        r#"
        SELECT 
            s.id, s.entity_id, e.name AS entity_name,
            s.name, s.description,
            s.calendar_id, c.name AS calendar_name,
            s.tto_duration_minutes, s.ttr_duration_minutes,
            s.priority_override, s.is_active,
            COUNT(l.id)::int8 AS escalation_levels_count,
            s.created_at, s.updated_at
        FROM slas s
        LEFT JOIN entities e ON e.id = s.entity_id
        LEFT JOIN calendars c ON c.id = s.calendar_id
        LEFT JOIN sla_levels l ON l.sla_id = s.id
        WHERE s.id = $1
        GROUP BY s.id, e.name, c.name
        "#
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(e.to_string()))?
    .ok_or_else(|| AppError::NotFound("SLA profile not found".into()))?;

    let levels: Vec<SlaLevel> = sqlx::query_as(
        "SELECT * FROM sla_levels WHERE sla_id = $1 ORDER BY execution_offset_minutes ASC"
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Ok(Json(SlaDetailDto { summary, levels }))
}

#[utoipa::path(
    put,
    path = "/api/v1/slas/{id}",
    tag = "SLAs",
    request_body = UpdateSlaDto,
    responses(
        (status = 200, description = "SLA updated successfully", body = Sla),
        (status = 404, description = "SLA not found")
    )
)]
pub async fn update_sla(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSlaDto>,
) -> Result<Json<Sla>, AppError> {
    let existing: Sla = sqlx::query_as("SELECT * FROM slas WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("SLA not found".into()))?;

    let name = payload.name.unwrap_or(existing.name);
    let description = payload.description.or(existing.description);
    let calendar_id = payload.calendar_id.or(existing.calendar_id);
    let tto = payload.tto_duration_minutes.unwrap_or(existing.tto_duration_minutes).max(1);
    let ttr = payload.ttr_duration_minutes.unwrap_or(existing.ttr_duration_minutes).max(1);
    let priority_override = payload.priority_override.or(existing.priority_override);
    let is_active = payload.is_active.unwrap_or(existing.is_active);

    let updated: Sla = sqlx::query_as(
        r#"
        UPDATE slas
        SET name = $1, description = $2, calendar_id = $3,
            tto_duration_minutes = $4, ttr_duration_minutes = $5,
            priority_override = $6, is_active = $7, updated_at = NOW()
        WHERE id = $8
        RETURNING *
        "#
    )
    .bind(name)
    .bind(description)
    .bind(calendar_id)
    .bind(tto)
    .bind(ttr)
    .bind(priority_override)
    .bind(is_active)
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to update SLA: {}", e)))?;

    Ok(Json(updated))
}

#[utoipa::path(
    delete,
    path = "/api/v1/slas/{id}",
    tag = "SLAs",
    responses(
        (status = 204, description = "SLA deleted"),
        (status = 404, description = "SLA not found")
    )
)]
pub async fn delete_sla(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM slas WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to delete SLA: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("SLA not found".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// SLA Levels / Escalation Rules Handlers
// ============================================================================

#[utoipa::path(
    get,
    path = "/api/v1/slas/{id}/levels",
    tag = "SLAs",
    responses(
        (status = 200, description = "List escalation levels for SLA", body = Vec<SlaLevel>)
    )
)]
pub async fn list_sla_levels(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<SlaLevel>>, AppError> {
    let levels: Vec<SlaLevel> = sqlx::query_as(
        "SELECT * FROM sla_levels WHERE sla_id = $1 ORDER BY execution_offset_minutes ASC"
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    Ok(Json(levels))
}

#[utoipa::path(
    post,
    path = "/api/v1/slas/{id}/levels",
    tag = "SLAs",
    request_body = CreateSlaLevelDto,
    responses(
        (status = 201, description = "SLA escalation level created", body = SlaLevel)
    )
)]
pub async fn create_sla_level(
    State(state): State<AppState>,
    _claims: Claims,
    Path(sla_id): Path<Uuid>,
    Json(payload): Json<CreateSlaLevelDto>,
) -> Result<(StatusCode, Json<SlaLevel>), AppError> {
    let target_type = match payload.target_type.as_str() {
        "tto" => "tto",
        _ => "ttr",
    };

    let valid_action = match payload.action_type.as_str() {
        "escalate_priority" | "reassign_group" | "reassign_technician" | "send_alert" => {
            payload.action_type
        }
        _ => {
            return Err(AppError::BadRequest(
                "action_type must be escalate_priority, reassign_group, reassign_technician, or send_alert".into(),
            ))
        }
    };

    let is_active = payload.is_active.unwrap_or(true);
    let level_id = Uuid::new_v4();

    let level: SlaLevel = sqlx::query_as(
        r#"
        INSERT INTO sla_levels (
            id, sla_id, name, target_type, execution_offset_minutes,
            action_type, action_value, is_active, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *
        "#
    )
    .bind(level_id)
    .bind(sla_id)
    .bind(payload.name.trim())
    .bind(target_type)
    .bind(payload.execution_offset_minutes)
    .bind(valid_action)
    .bind(payload.action_value.trim())
    .bind(is_active)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to create escalation level: {}", e)))?;

    Ok((StatusCode::CREATED, Json(level)))
}

#[utoipa::path(
    put,
    path = "/api/v1/slas/{id}/levels/{level_id}",
    tag = "SLAs",
    request_body = UpdateSlaLevelDto,
    responses(
        (status = 200, description = "SLA escalation level updated", body = SlaLevel),
        (status = 404, description = "Escalation level not found")
    )
)]
pub async fn update_sla_level(
    State(state): State<AppState>,
    _claims: Claims,
    Path((_sla_id, level_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateSlaLevelDto>,
) -> Result<Json<SlaLevel>, AppError> {
    let existing: SlaLevel = sqlx::query_as("SELECT * FROM sla_levels WHERE id = $1")
        .bind(level_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("SLA level not found".into()))?;

    let name = payload.name.unwrap_or(existing.name);
    let target_type = payload.target_type.unwrap_or(existing.target_type);
    let offset = payload.execution_offset_minutes.unwrap_or(existing.execution_offset_minutes);
    let action_type = payload.action_type.unwrap_or(existing.action_type);
    let action_value = payload.action_value.unwrap_or(existing.action_value);
    let is_active = payload.is_active.unwrap_or(existing.is_active);

    let updated: SlaLevel = sqlx::query_as(
        r#"
        UPDATE sla_levels
        SET name = $1, target_type = $2, execution_offset_minutes = $3,
            action_type = $4, action_value = $5, is_active = $6
        WHERE id = $7
        RETURNING *
        "#
    )
    .bind(name)
    .bind(target_type)
    .bind(offset)
    .bind(action_type)
    .bind(action_value)
    .bind(is_active)
    .bind(level_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to update escalation level: {}", e)))?;

    Ok(Json(updated))
}

#[utoipa::path(
    delete,
    path = "/api/v1/slas/{id}/levels/{level_id}",
    tag = "SLAs",
    responses(
        (status = 204, description = "Escalation level deleted"),
        (status = 404, description = "Level not found")
    )
)]
pub async fn delete_sla_level(
    State(state): State<AppState>,
    _claims: Claims,
    Path((_sla_id, level_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM sla_levels WHERE id = $1")
        .bind(level_id)
        .execute(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("SLA level not found".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// SLA Simulator Handler
// ============================================================================

#[utoipa::path(
    post,
    path = "/api/v1/slas/simulate",
    tag = "SLAs",
    request_body = SlaSimulationRequest,
    responses(
        (status = 200, description = "Simulated deadline calculated", body = SlaSimulationResponse)
    )
)]
pub async fn simulate_sla(
    State(state): State<AppState>,
    _claims: Claims,
    Json(payload): Json<SlaSimulationRequest>,
) -> Result<Json<SlaSimulationResponse>, AppError> {
    let start_time = payload.start_time.unwrap_or_else(Utc::now);
    let duration = payload.duration_minutes.max(1);

    let (calendar_name, segments, holidays) = if let Some(cal_id) = payload.calendar_id {
        let cal: Option<Calendar> = sqlx::query_as("SELECT * FROM calendars WHERE id = $1")
            .bind(cal_id)
            .fetch_optional(&state.pool)
            .await
            .unwrap_or(None);

        let segs: Vec<CalendarSegment> = sqlx::query_as(
            "SELECT * FROM calendar_segments WHERE calendar_id = $1 ORDER BY day_of_week, start_time"
        )
        .bind(cal_id)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

        let hols: Vec<CalendarHoliday> = sqlx::query_as(
            "SELECT * FROM calendar_holidays WHERE calendar_id = $1 ORDER BY holiday_date"
        )
        .bind(cal_id)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

        let hdates: Vec<NaiveDate> = hols.into_iter().map(|h| h.holiday_date).collect();
        (cal.map(|c| c.name).unwrap_or_else(|| "Calendario Personalizado".into()), segs, hdates)
    } else {
        ("Sin Calendario (24/7 Directo)".into(), Vec::new(), Vec::new())
    };

    let target_time = calculate_target_time(start_time, duration, &segments, &holidays);
    let days_diff = (target_time.date_naive() - start_time.date_naive()).num_days() as i32;

    Ok(Json(SlaSimulationResponse {
        start_time,
        target_time,
        duration_minutes: duration,
        calendar_name,
        working_days_elapsed: days_diff.max(0),
    }))
}

// Helper: parse HH:MM or HH:MM:SS
fn parse_time(s: &str) -> Result<NaiveTime, AppError> {
    if let Ok(t) = NaiveTime::parse_from_str(s, "%H:%M:%S") {
        return Ok(t);
    }
    if let Ok(t) = NaiveTime::parse_from_str(s, "%H:%M") {
        return Ok(t);
    }
    Err(AppError::BadRequest(format!("Invalid time format '{}', expected HH:MM or HH:MM:SS", s)))
}
