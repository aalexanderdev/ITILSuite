use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/rules", get(list_rules).post(create_rule))
        .route("/rules/reorder", post(reorder_rules))
        .route("/rules/dry-run", post(dry_run_rules))
        .route("/rules/:id", get(get_rule).put(update_rule).delete(delete_rule))
}


use crate::domain::auth::Claims;
use crate::domain::rule::{
    CreateRuleDto, DryRunRequest, DryRunResult, ReorderRulesDto, Rule, RuleAction,
    RuleCriteria, RuleWithDetails, UpdateRuleDto,
};
use crate::error::AppError;
use crate::services::rules::engine::RuleEngine;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct RuleFilterQuery {
    pub rule_type: Option<String>,
    pub entity_id: Option<Uuid>,
}

/// GET /api/v1/rules - List all rules optionally filtered by rule_type and entity_id
pub async fn list_rules(
    State(state): State<AppState>,
    _claims: Claims,
    Query(query): Query<RuleFilterQuery>,
) -> Result<Json<Vec<RuleWithDetails>>, AppError> {
    let rules: Vec<Rule> = if let Some(ref rt) = query.rule_type {
        sqlx::query_as(
            r#"
            SELECT * FROM rules
            WHERE rule_type = $1
              AND ($2::uuid IS NULL OR entity_id IS NULL OR entity_id = $2)
            ORDER BY ranking ASC, created_at ASC
            "#,
        )
        .bind(rt)
        .bind(query.entity_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to fetch rules: {}", e)))?
    } else {
        sqlx::query_as(
            r#"
            SELECT * FROM rules
            WHERE ($1::uuid IS NULL OR entity_id IS NULL OR entity_id = $1)
            ORDER BY rule_type ASC, ranking ASC, created_at ASC
            "#,
        )
        .bind(query.entity_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to fetch rules: {}", e)))?
    };

    let mut results = Vec::with_capacity(rules.len());

    for rule in rules {
        let criteria: Vec<RuleCriteria> = sqlx::query_as(
            "SELECT * FROM rule_criteria WHERE rule_id = $1 ORDER BY created_at ASC",
        )
        .bind(rule.id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to fetch criteria: {}", e)))?;

        let actions: Vec<RuleAction> = sqlx::query_as(
            "SELECT * FROM rule_actions WHERE rule_id = $1 ORDER BY created_at ASC",
        )
        .bind(rule.id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to fetch actions: {}", e)))?;

        results.push(RuleWithDetails {
            rule,
            criteria,
            actions,
        });
    }

    Ok(Json(results))
}

/// GET /api/v1/rules/:id - Get rule details with criteria and actions
pub async fn get_rule(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<RuleWithDetails>, AppError> {
    let rule: Option<Rule> = sqlx::query_as("SELECT * FROM rules WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to fetch rule: {}", e)))?;

    let rule = rule.ok_or_else(|| AppError::NotFound(format!("Rule with ID {} not found", id)))?;

    let criteria: Vec<RuleCriteria> = sqlx::query_as(
        "SELECT * FROM rule_criteria WHERE rule_id = $1 ORDER BY created_at ASC",
    )
    .bind(rule.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to fetch criteria: {}", e)))?;

    let actions: Vec<RuleAction> = sqlx::query_as(
        "SELECT * FROM rule_actions WHERE rule_id = $1 ORDER BY created_at ASC",
    )
    .bind(rule.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to fetch actions: {}", e)))?;

    Ok(Json(RuleWithDetails {
        rule,
        criteria,
        actions,
    }))
}

/// POST /api/v1/rules - Create a new rule with criteria and actions
pub async fn create_rule(
    State(state): State<AppState>,
    _claims: Claims,
    Json(payload): Json<CreateRuleDto>,
) -> Result<(StatusCode, Json<RuleWithDetails>), AppError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Rule name cannot be empty".into()));
    }

    let ranking = payload.ranking.unwrap_or(100);
    let match_logic = payload.match_logic.unwrap_or_else(|| "AND".into());
    let stop_on_first_match = payload.stop_on_first_match.unwrap_or(false);
    let is_active = payload.is_active.unwrap_or(true);
    let is_recursive = payload.is_recursive.unwrap_or(true);

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to begin transaction: {}", e)))?;

    let rule: Rule = sqlx::query_as(
        r#"
        INSERT INTO rules (
            rule_type, name, description, is_active, ranking,
            match_logic, stop_on_first_match, entity_id, is_recursive
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        RETURNING *
        "#,
    )
    .bind(&payload.rule_type)
    .bind(name)
    .bind(&payload.description)
    .bind(is_active)
    .bind(ranking)
    .bind(&match_logic)
    .bind(stop_on_first_match)
    .bind(payload.entity_id)
    .bind(is_recursive)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to insert rule: {}", e)))?;

    let mut criteria = Vec::new();
    for crit in payload.criteria {
        let inserted_crit: RuleCriteria = sqlx::query_as(
            r#"
            INSERT INTO rule_criteria (rule_id, field, operator, pattern)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(rule.id)
        .bind(crit.field.trim())
        .bind(crit.operator.trim())
        .bind(crit.pattern.trim())
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to insert criterion: {}", e)))?;

        criteria.push(inserted_crit);
    }

    let mut actions = Vec::new();
    for act in payload.actions {
        let inserted_act: RuleAction = sqlx::query_as(
            r#"
            INSERT INTO rule_actions (rule_id, action_type, field, value)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(rule.id)
        .bind(act.action_type.trim())
        .bind(act.field.trim())
        .bind(act.value.trim())
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to insert action: {}", e)))?;

        actions.push(inserted_act);
    }

    tx.commit()
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to commit transaction: {}", e)))?;

    Ok((
        StatusCode::CREATED,
        Json(RuleWithDetails {
            rule,
            criteria,
            actions,
        }),
    ))
}

/// PUT /api/v1/rules/:id - Update an existing rule, replacing criteria/actions if provided
pub async fn update_rule(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRuleDto>,
) -> Result<Json<RuleWithDetails>, AppError> {
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to start transaction: {}", e)))?;

    let existing: Option<Rule> = sqlx::query_as("SELECT * FROM rules WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to fetch rule: {}", e)))?;

    let existing = existing.ok_or_else(|| AppError::NotFound(format!("Rule {} not found", id)))?;

    let updated_name = payload.name.unwrap_or(existing.name);
    let updated_desc = payload.description.or(existing.description);
    let updated_active = payload.is_active.unwrap_or(existing.is_active);
    let updated_ranking = payload.ranking.unwrap_or(existing.ranking);
    let updated_logic = payload.match_logic.unwrap_or(existing.match_logic);
    let updated_stop = payload.stop_on_first_match.unwrap_or(existing.stop_on_first_match);
    let updated_entity = payload.entity_id.or(existing.entity_id);
    let updated_recursive = payload.is_recursive.unwrap_or(existing.is_recursive);

    let updated_rule: Rule = sqlx::query_as(
        r#"
        UPDATE rules SET
            name = $1,
            description = $2,
            is_active = $3,
            ranking = $4,
            match_logic = $5,
            stop_on_first_match = $6,
            entity_id = $7,
            is_recursive = $8,
            updated_at = NOW()
        WHERE id = $9
        RETURNING *
        "#,
    )
    .bind(updated_name)
    .bind(updated_desc)
    .bind(updated_active)
    .bind(updated_ranking)
    .bind(updated_logic)
    .bind(updated_stop)
    .bind(updated_entity)
    .bind(updated_recursive)
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to update rule: {}", e)))?;

    // If criteria array is provided, replace criteria
    if let Some(new_criteria) = payload.criteria {
        sqlx::query("DELETE FROM rule_criteria WHERE rule_id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to clear criteria: {}", e)))?;

        for crit in new_criteria {
            sqlx::query(
                "INSERT INTO rule_criteria (rule_id, field, operator, pattern) VALUES ($1, $2, $3, $4)",
            )
            .bind(id)
            .bind(crit.field.trim())
            .bind(crit.operator.trim())
            .bind(crit.pattern.trim())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to insert criterion: {}", e)))?;
        }
    }

    // If actions array is provided, replace actions
    if let Some(new_actions) = payload.actions {
        sqlx::query("DELETE FROM rule_actions WHERE rule_id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to clear actions: {}", e)))?;

        for act in new_actions {
            sqlx::query(
                "INSERT INTO rule_actions (rule_id, action_type, field, value) VALUES ($1, $2, $3, $4)",
            )
            .bind(id)
            .bind(act.action_type.trim())
            .bind(act.field.trim())
            .bind(act.value.trim())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to insert action: {}", e)))?;
        }
    }

    tx.commit()
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to commit transaction: {}", e)))?;

    let criteria: Vec<RuleCriteria> = sqlx::query_as(
        "SELECT * FROM rule_criteria WHERE rule_id = $1 ORDER BY created_at ASC",
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to fetch criteria: {}", e)))?;

    let actions: Vec<RuleAction> = sqlx::query_as(
        "SELECT * FROM rule_actions WHERE rule_id = $1 ORDER BY created_at ASC",
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::InternalServerError(format!("Failed to fetch actions: {}", e)))?;

    Ok(Json(RuleWithDetails {
        rule: updated_rule,
        criteria,
        actions,
    }))
}

/// DELETE /api/v1/rules/:id - Delete a rule
pub async fn delete_rule(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let rows = sqlx::query("DELETE FROM rules WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to delete rule: {}", e)))?;

    if rows.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Rule {} not found", id)));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/rules/reorder - Reorder rankings for a batch of rules
pub async fn reorder_rules(
    State(state): State<AppState>,
    _claims: Claims,
    Json(payload): Json<ReorderRulesDto>,
) -> Result<StatusCode, AppError> {
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to start transaction: {}", e)))?;

    for item in payload.rules {
        sqlx::query("UPDATE rules SET ranking = $1, updated_at = NOW() WHERE id = $2")
            .bind(item.ranking)
            .bind(item.id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to update rule ranking: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to commit transaction: {}", e)))?;

    Ok(StatusCode::OK)
}

/// POST /api/v1/rules/dry-run - Sandbox simulator to test rules against mock inputs
pub async fn dry_run_rules(
    State(state): State<AppState>,
    _claims: Claims,
    Json(payload): Json<DryRunRequest>,
) -> Result<Json<DryRunResult>, AppError> {
    let result = RuleEngine::execute_dry_run(&state.pool, payload).await?;
    Ok(Json(result))
}
