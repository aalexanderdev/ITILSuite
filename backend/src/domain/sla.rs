use chrono::{DateTime, Datelike, Duration, NaiveDate, NaiveTime, Timelike, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Calendar {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub timezone: String,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct CalendarSegment {
    pub id: Uuid,
    pub calendar_id: Uuid,
    pub day_of_week: i32, // 1 = Monday, ..., 7 = Sunday
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct CalendarHoliday {
    pub id: Uuid,
    pub calendar_id: Uuid,
    pub name: String,
    pub holiday_date: NaiveDate,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CalendarDetailDto {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub timezone: String,
    pub is_default: bool,
    pub segments: Vec<CalendarSegment>,
    pub holidays: Vec<CalendarHoliday>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Sla {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub calendar_id: Option<Uuid>,
    pub tto_duration_minutes: i32,
    pub ttr_duration_minutes: i32,
    pub priority_override: Option<i32>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SlaSummaryDto {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub entity_name: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub calendar_id: Option<Uuid>,
    pub calendar_name: Option<String>,
    pub tto_duration_minutes: i32,
    pub ttr_duration_minutes: i32,
    pub priority_override: Option<i32>,
    pub is_active: bool,
    pub escalation_levels_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SlaLevel {
    pub id: Uuid,
    pub sla_id: Uuid,
    pub name: String,
    pub target_type: String, // 'tto' or 'ttr'
    pub execution_offset_minutes: i32, // negative = before breach, 0 = on breach, positive = after breach
    pub action_type: String, // 'escalate_priority', 'reassign_group', 'reassign_technician', 'send_alert'
    pub action_value: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SlaDetailDto {
    #[serde(flatten)]
    pub summary: SlaSummaryDto,
    pub levels: Vec<SlaLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct TicketSlaEscalationLog {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub sla_level_id: Uuid,
    pub executed_at: DateTime<Utc>,
    pub action_type: String,
    pub action_details: Option<String>,
}

// ============================================================================
// DTOs for Creation and Mutation
// ============================================================================

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateCalendarDto {
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub timezone: Option<String>,
    pub is_default: Option<bool>,
    pub segments: Option<Vec<CreateCalendarSegmentDto>>,
    pub holidays: Option<Vec<CreateCalendarHolidayDto>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateCalendarDto {
    pub name: Option<String>,
    pub timezone: Option<String>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateCalendarSegmentDto {
    pub day_of_week: i32,
    pub start_time: String, // "HH:MM:SS" or "HH:MM"
    pub end_time: String,   // "HH:MM:SS" or "HH:MM"
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateCalendarHolidayDto {
    pub name: String,
    pub holiday_date: String, // "YYYY-MM-DD"
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateSlaDto {
    pub entity_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub calendar_id: Option<Uuid>,
    pub tto_duration_minutes: i32,
    pub ttr_duration_minutes: i32,
    pub priority_override: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateSlaDto {
    pub name: Option<String>,
    pub description: Option<String>,
    pub calendar_id: Option<Uuid>,
    pub tto_duration_minutes: Option<i32>,
    pub ttr_duration_minutes: Option<i32>,
    pub priority_override: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateSlaLevelDto {
    pub name: String,
    pub target_type: String, // 'tto' or 'ttr'
    pub execution_offset_minutes: i32,
    pub action_type: String, // 'escalate_priority', 'reassign_group', 'reassign_technician', 'send_alert'
    pub action_value: String,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateSlaLevelDto {
    pub name: Option<String>,
    pub target_type: Option<String>,
    pub execution_offset_minutes: Option<i32>,
    pub action_type: Option<String>,
    pub action_value: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SlaSimulationRequest {
    pub start_time: Option<DateTime<Utc>>,
    pub calendar_id: Option<Uuid>,
    pub duration_minutes: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SlaSimulationResponse {
    pub start_time: DateTime<Utc>,
    pub target_time: DateTime<Utc>,
    pub duration_minutes: i64,
    pub calendar_name: String,
    pub working_days_elapsed: i32,
}

// ============================================================================
// Pure Working Calendar Arithmetic Engine
// ============================================================================

/// Calculates the target deadline timestamp advancing strictly through active
/// business hours defined by calendar segments and skipping configured holidays.
pub fn calculate_target_time(
    start_time: DateTime<Utc>,
    duration_minutes: i64,
    segments: &[CalendarSegment],
    holidays: &[NaiveDate],
) -> DateTime<Utc> {
    if duration_minutes <= 0 {
        return start_time;
    }

    if segments.is_empty() {
        return start_time + Duration::minutes(duration_minutes);
    }

    let mut remaining = duration_minutes;
    let mut current_dt = start_time;
    let mut safety_days = 0;

    while remaining > 0 && safety_days < 366 {
        let current_date = current_dt.date_naive();

        // 1. Skip holidays
        if holidays.contains(&current_date) {
            current_dt = current_dt + Duration::days(1);
            current_dt = current_dt
                .with_hour(0)
                .unwrap_or(current_dt)
                .with_minute(0)
                .unwrap_or(current_dt)
                .with_second(0)
                .unwrap_or(current_dt);
            safety_days += 1;
            continue;
        }

        // 2. Day of week: 1 (Mon) .. 7 (Sun)
        let day_num = current_dt.weekday().number_from_monday() as i32;

        // Find segments for today, sorted by start_time
        let mut day_segments: Vec<&CalendarSegment> = segments
            .iter()
            .filter(|s| s.day_of_week == day_num)
            .collect();
        day_segments.sort_by_key(|s| s.start_time);

        if day_segments.is_empty() {
            // Non-working day (e.g. Saturday or Sunday in 9x5 calendar)
            current_dt = current_dt + Duration::days(1);
            current_dt = current_dt
                .with_hour(0)
                .unwrap_or(current_dt)
                .with_minute(0)
                .unwrap_or(current_dt)
                .with_second(0)
                .unwrap_or(current_dt);
            safety_days += 1;
            continue;
        }

        let current_time = current_dt.time();

        for seg in day_segments {
            if current_time >= seg.end_time {
                // Current time is past this segment
                continue;
            }

            let seg_start = if current_time < seg.start_time {
                seg.start_time
            } else {
                current_time
            };

            // Available minutes in this working segment
            let available_minutes = (seg.end_time.hour() as i64 * 60 + seg.end_time.minute() as i64)
                - (seg_start.hour() as i64 * 60 + seg_start.minute() as i64);

            if available_minutes <= 0 {
                continue;
            }

            // Move current_dt to segment start if needed
            if current_time < seg.start_time {
                current_dt = current_dt
                    .with_hour(seg.start_time.hour())
                    .unwrap_or(current_dt)
                    .with_minute(seg.start_time.minute())
                    .unwrap_or(current_dt)
                    .with_second(0)
                    .unwrap_or(current_dt);
            }

            if remaining <= available_minutes {
                current_dt = current_dt + Duration::minutes(remaining);
                remaining = 0;
                break;
            } else {
                remaining -= available_minutes;
                current_dt = current_dt
                    .with_hour(seg.end_time.hour())
                    .unwrap_or(current_dt)
                    .with_minute(seg.end_time.minute())
                    .unwrap_or(current_dt)
                    .with_second(0)
                    .unwrap_or(current_dt);
            }
        }

        if remaining > 0 {
            // Advance to start of next day
            current_dt = current_dt + Duration::days(1);
            current_dt = current_dt
                .with_hour(0)
                .unwrap_or(current_dt)
                .with_minute(0)
                .unwrap_or(current_dt)
                .with_second(0)
                .unwrap_or(current_dt);
            safety_days += 1;
        }
    }

    if remaining > 0 {
        // Fallback safety if calendar was empty or looping
        current_dt + Duration::minutes(remaining)
    } else {
        current_dt
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_calendar_9x5_calculation() {
        let calendar_id = Uuid::new_v4();
        let segments = vec![
            CalendarSegment {
                id: Uuid::new_v4(),
                calendar_id,
                day_of_week: 1, // Monday
                start_time: NaiveTime::from_hms_opt(8, 0, 0).unwrap(),
                end_time: NaiveTime::from_hms_opt(18, 0, 0).unwrap(),
                created_at: Utc::now(),
            },
            CalendarSegment {
                id: Uuid::new_v4(),
                calendar_id,
                day_of_week: 2, // Tuesday
                start_time: NaiveTime::from_hms_opt(8, 0, 0).unwrap(),
                end_time: NaiveTime::from_hms_opt(18, 0, 0).unwrap(),
                created_at: Utc::now(),
            },
            CalendarSegment {
                id: Uuid::new_v4(),
                calendar_id,
                day_of_week: 5, // Friday
                start_time: NaiveTime::from_hms_opt(8, 0, 0).unwrap(),
                end_time: NaiveTime::from_hms_opt(18, 0, 0).unwrap(),
                created_at: Utc::now(),
            },
        ];

        // 1. Ticket opened Monday 10:00 with 120 minutes (2h) -> Target: Monday 12:00
        let mon_10am = Utc.with_ymd_and_hms(2026, 9, 21, 10, 0, 0).unwrap();
        let target = calculate_target_time(mon_10am, 120, &segments, &[]);
        assert_eq!(target, Utc.with_ymd_and_hms(2026, 9, 21, 12, 0, 0).unwrap());

        // 2. Ticket opened Monday 17:00 with 120 minutes (2h) -> 1h on Monday until 18:00, 1h carried to Tuesday 08:00 -> Target: Tuesday 09:00
        let mon_5pm = Utc.with_ymd_and_hms(2026, 9, 21, 17, 0, 0).unwrap();
        let target = calculate_target_time(mon_5pm, 120, &segments, &[]);
        assert_eq!(target, Utc.with_ymd_and_hms(2026, 9, 22, 9, 0, 0).unwrap());

        // 3. Ticket opened Friday 17:00 with 120 minutes -> skips Saturday, Sunday, Tuesday... jumps to next working day (Monday)!
        let fri_5pm = Utc.with_ymd_and_hms(2026, 9, 25, 17, 0, 0).unwrap();
        let target = calculate_target_time(fri_5pm, 120, &segments, &[]);
        // 2026-09-25 is Friday. 1h left until 18:00, remaining 60m goes to Monday 2026-09-28 08:00 + 60m = 09:00!
        assert_eq!(target, Utc.with_ymd_and_hms(2026, 9, 28, 9, 0, 0).unwrap());
    }

    #[test]
    fn test_calendar_holiday_skip() {
        let calendar_id = Uuid::new_v4();
        let segments = vec![CalendarSegment {
            id: Uuid::new_v4(),
            calendar_id,
            day_of_week: 1, // Monday
            start_time: NaiveTime::from_hms_opt(8, 0, 0).unwrap(),
            end_time: NaiveTime::from_hms_opt(18, 0, 0).unwrap(),
            created_at: Utc::now(),
        }, CalendarSegment {
            id: Uuid::new_v4(),
            calendar_id,
            day_of_week: 2, // Tuesday
            start_time: NaiveTime::from_hms_opt(8, 0, 0).unwrap(),
            end_time: NaiveTime::from_hms_opt(18, 0, 0).unwrap(),
            created_at: Utc::now(),
        }];

        let holiday_tuesday = NaiveDate::from_ymd_opt(2026, 9, 22).unwrap();
        let holidays = vec![holiday_tuesday];

        // Ticket opened Monday 17:00 with 120m -> 1h Monday until 18:00. Next day Tuesday is holiday!
        // So remaining 60m rolls over to next working Monday (2026-09-28)
        let mon_5pm = Utc.with_ymd_and_hms(2026, 9, 21, 17, 0, 0).unwrap();
        let target = calculate_target_time(mon_5pm, 120, &segments, &holidays);
        assert_eq!(target, Utc.with_ymd_and_hms(2026, 9, 28, 9, 0, 0).unwrap());
    }
}
