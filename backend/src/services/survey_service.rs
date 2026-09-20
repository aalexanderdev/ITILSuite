use chrono::{DateTime, Duration, Utc};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use uuid::Uuid;

use crate::domain::survey::*;
use crate::error::AppError;

pub struct SurveyService;

impl SurveyService {
    // --- Surveys CRUD ---

    pub async fn list_surveys(
        pool: &PgPool,
        entity_id: Option<Uuid>,
        is_active: Option<bool>,
    ) -> Result<Vec<SurveySummaryDto>, AppError> {
        let mut query_str = String::from(
            r#"
            SELECT 
                s.id,
                s.entity_id,
                e.name AS entity_name,
                s.is_recursive,
                s.name,
                s.comment,
                s.is_active,
                s.is_default,
                s.ttl_days_override,
                s.allow_reentry_override,
                (SELECT COUNT(*)::BIGINT FROM survey_questions q WHERE q.survey_id = s.id) AS questions_count,
                (SELECT COUNT(*)::BIGINT FROM survey_tokens t WHERE t.survey_id = s.id AND t.status = 'completed') AS completed_tokens_count,
                (
                    SELECT AVG(NULLIF(regexp_replace(a.answer, '[^0-9]', '', 'g'), '')::numeric)::FLOAT8
                    FROM survey_answers a
                    JOIN survey_questions q ON a.question_id = q.id
                    JOIN survey_tokens t ON a.token_id = t.id
                    WHERE q.survey_id = s.id 
                      AND q.question_type = 'rating5' 
                      AND a.status = 'final'
                      AND a.answer IS NOT NULL
                ) AS average_rating,
                s.created_at,
                s.updated_at
            FROM surveys s
            LEFT JOIN entities e ON s.entity_id = e.id
            WHERE 1=1
            "#,
        );

        if let Some(_) = entity_id {
            query_str.push_str(" AND (s.entity_id = $1 OR s.entity_id IS NULL)");
        }
        if let Some(_) = is_active {
            let param_idx = if entity_id.is_some() { "$2" } else { "$1" };
            query_str.push_str(&format!(" AND s.is_active = {}", param_idx));
        }

        query_str.push_str(" ORDER BY s.is_default DESC, s.created_at DESC");

        let mut query = sqlx::query(&query_str);
        if let Some(eid) = entity_id {
            query = query.bind(eid);
        }
        if let Some(act) = is_active {
            query = query.bind(act);
        }

        let rows = query
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error listing surveys: {}", e)))?;

        let mut results = Vec::new();
        for r in rows {
            results.push(SurveySummaryDto {
                id: r.get("id"),
                entity_id: r.get("entity_id"),
                entity_name: r.get("entity_name"),
                is_recursive: r.get("is_recursive"),
                name: r.get("name"),
                comment: r.get("comment"),
                is_active: r.get("is_active"),
                is_default: r.get("is_default"),
                ttl_days_override: r.get("ttl_days_override"),
                allow_reentry_override: r.get("allow_reentry_override"),
                questions_count: r.get("questions_count"),
                completed_tokens_count: r.get("completed_tokens_count"),
                average_rating: r.get("average_rating"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            });
        }

        Ok(results)
    }

    pub async fn get_survey_detail(
        pool: &PgPool,
        survey_id: Uuid,
    ) -> Result<SurveyDetailDto, AppError> {
        let survey_row = sqlx::query(
            r#"
            SELECT 
                s.id, s.entity_id, e.name AS entity_name, s.is_recursive, s.name, s.comment,
                s.header_content, s.footer_content, s.success_content,
                s.is_active, s.is_default, s.ttl_days_override, s.allow_reentry_override,
                s.created_at, s.updated_at
            FROM surveys s
            LEFT JOIN entities e ON s.entity_id = e.id
            WHERE s.id = $1
            "#,
        )
        .bind(survey_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error fetching survey: {}", e)))?
        .ok_or_else(|| AppError::NotFound(format!("Survey with ID {} not found", survey_id)))?;

        let questions = Self::list_questions_internal(pool, survey_id).await?;

        Ok(SurveyDetailDto {
            id: survey_row.get("id"),
            entity_id: survey_row.get("entity_id"),
            entity_name: survey_row.get("entity_name"),
            is_recursive: survey_row.get("is_recursive"),
            name: survey_row.get("name"),
            comment: survey_row.get("comment"),
            header_content: survey_row.get("header_content"),
            footer_content: survey_row.get("footer_content"),
            success_content: survey_row.get("success_content"),
            is_active: survey_row.get("is_active"),
            is_default: survey_row.get("is_default"),
            ttl_days_override: survey_row.get("ttl_days_override"),
            allow_reentry_override: survey_row.get("allow_reentry_override"),
            questions,
            created_at: survey_row.get("created_at"),
            updated_at: survey_row.get("updated_at"),
        })
    }

    pub async fn create_survey(
        pool: &PgPool,
        input: CreateSurveyDto,
    ) -> Result<SurveyDetailDto, AppError> {
        let is_default = input.is_default.unwrap_or(false);
        let is_active = input.is_active.unwrap_or(true);
        let is_recursive = input.is_recursive.unwrap_or(true);
        let ttl_days = input.ttl_days_override.unwrap_or(15);
        let allow_reentry = input.allow_reentry_override.unwrap_or(0);

        let mut tx = pool
            .begin()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Transaction error: {}", e)))?;

        if is_default {
            if let Some(eid) = input.entity_id {
                let _ = sqlx::query("UPDATE surveys SET is_default = FALSE WHERE entity_id = $1")
                    .bind(eid)
                    .execute(&mut *tx)
                    .await;
            } else {
                let _ = sqlx::query("UPDATE surveys SET is_default = FALSE WHERE entity_id IS NULL")
                    .execute(&mut *tx)
                    .await;
            }
        }

        // Check if preset selected
        let preset_opt = input
            .template_preset
            .as_deref()
            .and_then(|p| SurveyPresetDef::get_by_key(p));

        let header_content = input.header_content.or_else(|| preset_opt.as_ref().map(|p| p.header.clone()));
        let success_content = input.success_content.or_else(|| preset_opt.as_ref().map(|p| p.success.clone()));

        let survey_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO surveys (
                id, entity_id, is_recursive, name, comment,
                header_content, footer_content, success_content,
                is_active, is_default, ttl_days_override, allow_reentry_override,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
            "#,
        )
        .bind(survey_id)
        .bind(input.entity_id)
        .bind(is_recursive)
        .bind(&input.name)
        .bind(input.comment)
        .bind(header_content)
        .bind(input.footer_content)
        .bind(success_content)
        .bind(is_active)
        .bind(is_default)
        .bind(ttl_days)
        .bind(allow_reentry)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error inserting survey: {}", e)))?;

        // If preset provided, generate preset questions and options
        if let Some(preset) = preset_opt {
            let mut created_q_ids: Vec<Uuid> = Vec::new();

            for q_def in preset.questions {
                let q_id = Uuid::new_v4();
                let cond_q_id = q_def
                    .condition_on_prev_index
                    .and_then(|idx| created_q_ids.get(idx).cloned());

                sqlx::query(
                    r#"
                    INSERT INTO survey_questions (
                        id, survey_id, name, question_type, is_mandatory, ranking,
                        condition_question_id, condition_value, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                    "#,
                )
                .bind(q_id)
                .bind(survey_id)
                .bind(&q_def.name)
                .bind(&q_def.question_type)
                .bind(q_def.is_mandatory)
                .bind(q_def.ranking)
                .bind(cond_q_id)
                .bind(q_def.condition_value)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Error inserting preset question: {}", e)))?;

                created_q_ids.push(q_id);

                if let Some(opts) = q_def.options {
                    for (i, opt_val) in opts.into_iter().enumerate() {
                        let opt_id = Uuid::new_v4();
                        sqlx::query(
                            r#"
                            INSERT INTO survey_question_options (id, question_id, value, ranking, created_at)
                            VALUES ($1, $2, $3, $4, NOW())
                            "#,
                        )
                        .bind(opt_id)
                        .bind(q_id)
                        .bind(opt_val)
                        .bind(((i + 1) * 10) as i32)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| AppError::InternalServerError(format!("Error inserting preset question option: {}", e)))?;
                    }
                }
            }
        }

        tx.commit()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Commit error: {}", e)))?;

        Self::get_survey_detail(pool, survey_id).await
    }

    pub async fn update_survey(
        pool: &PgPool,
        survey_id: Uuid,
        input: UpdateSurveyDto,
    ) -> Result<SurveyDetailDto, AppError> {
        let existing: Survey = sqlx::query_as("SELECT * FROM surveys WHERE id = $1")
            .bind(survey_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error fetching survey: {}", e)))?
            .ok_or_else(|| AppError::NotFound(format!("Survey with ID {} not found", survey_id)))?;

        let mut tx = pool
            .begin()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Transaction error: {}", e)))?;

        let is_default = input.is_default.unwrap_or(existing.is_default);
        if is_default && !existing.is_default {
            let entity_id = input.entity_id.or(existing.entity_id);
            if let Some(eid) = entity_id {
                let _ = sqlx::query("UPDATE surveys SET is_default = FALSE WHERE entity_id = $1")
                    .bind(eid)
                    .execute(&mut *tx)
                    .await;
            } else {
                let _ = sqlx::query("UPDATE surveys SET is_default = FALSE WHERE entity_id IS NULL")
                    .execute(&mut *tx)
                    .await;
            }
        }

        let is_recursive = input.is_recursive.unwrap_or(existing.is_recursive);
        let name = input.name.unwrap_or(existing.name);
        let comment = input.comment.or(existing.comment);
        let header_content = input.header_content.or(existing.header_content);
        let footer_content = input.footer_content.or(existing.footer_content);
        let success_content = input.success_content.or(existing.success_content);
        let is_active = input.is_active.unwrap_or(existing.is_active);
        let ttl_days = input.ttl_days_override.unwrap_or(existing.ttl_days_override);
        let allow_reentry = input.allow_reentry_override.unwrap_or(existing.allow_reentry_override);
        let entity_id = if input.entity_id.is_some() { input.entity_id } else { existing.entity_id };

        sqlx::query(
            r#"
            UPDATE surveys
            SET entity_id = $1, is_recursive = $2, name = $3, comment = $4,
                header_content = $5, footer_content = $6, success_content = $7,
                is_active = $8, is_default = $9, ttl_days_override = $10,
                allow_reentry_override = $11, updated_at = NOW()
            WHERE id = $12
            "#,
        )
        .bind(entity_id)
        .bind(is_recursive)
        .bind(name)
        .bind(comment)
        .bind(header_content)
        .bind(footer_content)
        .bind(success_content)
        .bind(is_active)
        .bind(is_default)
        .bind(ttl_days)
        .bind(allow_reentry)
        .bind(survey_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error updating survey: {}", e)))?;

        tx.commit()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Commit error: {}", e)))?;

        Self::get_survey_detail(pool, survey_id).await
    }

    pub async fn delete_survey(pool: &PgPool, survey_id: Uuid) -> Result<(), AppError> {
        let result = sqlx::query("DELETE FROM surveys WHERE id = $1")
            .bind(survey_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error deleting survey: {}", e)))?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!("Survey with ID {} not found", survey_id)));
        }

        Ok(())
    }

    pub async fn clone_survey(
        pool: &PgPool,
        survey_id: Uuid,
        new_name: Option<String>,
    ) -> Result<SurveyDetailDto, AppError> {
        let original = Self::get_survey_detail(pool, survey_id).await?;

        let cloned_name = new_name.unwrap_or_else(|| format!("{} (Copia)", original.name));
        let new_survey_id = Uuid::new_v4();

        let mut tx = pool
            .begin()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Transaction error: {}", e)))?;

        sqlx::query(
            r#"
            INSERT INTO surveys (
                id, entity_id, is_recursive, name, comment,
                header_content, footer_content, success_content,
                is_active, is_default, ttl_days_override, allow_reentry_override,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, $10, $11, NOW(), NOW())
            "#,
        )
        .bind(new_survey_id)
        .bind(original.entity_id)
        .bind(original.is_recursive)
        .bind(cloned_name)
        .bind(original.comment)
        .bind(original.header_content)
        .bind(original.footer_content)
        .bind(original.success_content)
        .bind(original.is_active)
        .bind(original.ttl_days_override)
        .bind(original.allow_reentry_override)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error cloning survey: {}", e)))?;

        // Old ID -> New ID mapping for questions to preserve conditional question references
        let mut id_map: HashMap<Uuid, Uuid> = HashMap::new();

        // First pass: insert all questions without condition links to get new UUIDs
        for q in &original.questions {
            let new_q_id = Uuid::new_v4();
            id_map.insert(q.id, new_q_id);
        }

        // Second pass: insert questions with remapped condition_question_id
        for q in &original.questions {
            let new_q_id = id_map[&q.id];
            let remapped_cond_id = q.condition_question_id.and_then(|old_cond| id_map.get(&old_cond).cloned());

            sqlx::query(
                r#"
                INSERT INTO survey_questions (
                    id, survey_id, name, question_type, is_mandatory, ranking,
                    condition_question_id, condition_value, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                "#,
            )
            .bind(new_q_id)
            .bind(new_survey_id)
            .bind(&q.name)
            .bind(&q.question_type)
            .bind(q.is_mandatory)
            .bind(q.ranking)
            .bind(remapped_cond_id)
            .bind(&q.condition_value)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error cloning question: {}", e)))?;

            // Copy options
            for opt in &q.options {
                let new_opt_id = Uuid::new_v4();
                sqlx::query(
                    r#"
                    INSERT INTO survey_question_options (id, question_id, value, ranking, created_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    "#,
                )
                .bind(new_opt_id)
                .bind(new_q_id)
                .bind(&opt.value)
                .bind(opt.ranking)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Error cloning question option: {}", e)))?;
            }
        }

        tx.commit()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Commit error: {}", e)))?;

        Self::get_survey_detail(pool, new_survey_id).await
    }

    // --- Questions CRUD ---

    async fn list_questions_internal(
        pool: &PgPool,
        survey_id: Uuid,
    ) -> Result<Vec<SurveyQuestionDto>, AppError> {
        let q_rows: Vec<SurveyQuestion> = sqlx::query_as(
            "SELECT * FROM survey_questions WHERE survey_id = $1 ORDER BY ranking ASC, created_at ASC",
        )
        .bind(survey_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error fetching questions: {}", e)))?;

        let mut results = Vec::new();

        for q in q_rows {
            let opt_rows: Vec<SurveyQuestionOption> = sqlx::query_as(
                "SELECT * FROM survey_question_options WHERE question_id = $1 ORDER BY ranking ASC, created_at ASC",
            )
            .bind(q.id)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error fetching options: {}", e)))?;

            let options_dto = opt_rows
                .into_iter()
                .map(|o| SurveyQuestionOptionDto {
                    id: o.id,
                    question_id: o.question_id,
                    value: o.value,
                    ranking: o.ranking,
                })
                .collect();

            results.push(SurveyQuestionDto {
                id: q.id,
                survey_id: q.survey_id,
                name: q.name,
                question_type: q.question_type,
                is_mandatory: q.is_mandatory,
                ranking: q.ranking,
                condition_question_id: q.condition_question_id,
                condition_value: q.condition_value,
                options: options_dto,
                created_at: q.created_at,
                updated_at: q.updated_at,
            });
        }

        Ok(results)
    }

    pub async fn list_questions(
        pool: &PgPool,
        survey_id: Uuid,
    ) -> Result<Vec<SurveyQuestionDto>, AppError> {
        Self::list_questions_internal(pool, survey_id).await
    }

    pub async fn create_question(
        pool: &PgPool,
        survey_id: Uuid,
        input: CreateQuestionDto,
    ) -> Result<SurveyQuestionDto, AppError> {
        let question_id = Uuid::new_v4();
        let is_mandatory = input.is_mandatory.unwrap_or(false);
        
        let ranking = if let Some(r) = input.ranking {
            r
        } else {
            let max_r: Option<i32> = sqlx::query_scalar(
                "SELECT MAX(ranking) FROM survey_questions WHERE survey_id = $1",
            )
            .bind(survey_id)
            .fetch_one(pool)
            .await
            .unwrap_or(None);
            max_r.unwrap_or(0) + 10
        };

        let mut tx = pool
            .begin()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Transaction error: {}", e)))?;

        sqlx::query(
            r#"
            INSERT INTO survey_questions (
                id, survey_id, name, question_type, is_mandatory, ranking,
                condition_question_id, condition_value, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            "#,
        )
        .bind(question_id)
        .bind(survey_id)
        .bind(&input.name)
        .bind(&input.question_type)
        .bind(is_mandatory)
        .bind(ranking)
        .bind(input.condition_question_id)
        .bind(input.condition_value.as_deref())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error creating question: {}", e)))?;

        let mut options_dto = Vec::new();
        if let Some(opts) = input.options {
            for (idx, opt_str) in opts.into_iter().enumerate() {
                let opt_id = Uuid::new_v4();
                let opt_rank = ((idx + 1) * 10) as i32;
                sqlx::query(
                    r#"
                    INSERT INTO survey_question_options (id, question_id, value, ranking, created_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    "#,
                )
                .bind(opt_id)
                .bind(question_id)
                .bind(&opt_str)
                .bind(opt_rank)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Error inserting option: {}", e)))?;

                options_dto.push(SurveyQuestionOptionDto {
                    id: opt_id,
                    question_id,
                    value: opt_str,
                    ranking: opt_rank,
                });
            }
        }

        tx.commit()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Commit error: {}", e)))?;

        let now = Utc::now();
        Ok(SurveyQuestionDto {
            id: question_id,
            survey_id,
            name: input.name,
            question_type: input.question_type,
            is_mandatory,
            ranking,
            condition_question_id: input.condition_question_id,
            condition_value: input.condition_value,
            options: options_dto,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn update_question(
        pool: &PgPool,
        question_id: Uuid,
        input: UpdateQuestionDto,
    ) -> Result<SurveyQuestionDto, AppError> {
        let existing: SurveyQuestion = sqlx::query_as("SELECT * FROM survey_questions WHERE id = $1")
            .bind(question_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error fetching question: {}", e)))?
            .ok_or_else(|| AppError::NotFound(format!("Question with ID {} not found", question_id)))?;

        let mut tx = pool
            .begin()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Transaction error: {}", e)))?;

        let name = input.name.unwrap_or(existing.name);
        let question_type = input.question_type.unwrap_or(existing.question_type);
        let is_mandatory = input.is_mandatory.unwrap_or(existing.is_mandatory);
        let ranking = input.ranking.unwrap_or(existing.ranking);
        let condition_question_id = if input.condition_question_id.is_some() {
            input.condition_question_id
        } else {
            existing.condition_question_id
        };
        let condition_value = if input.condition_value.is_some() {
            input.condition_value
        } else {
            existing.condition_value
        };

        sqlx::query(
            r#"
            UPDATE survey_questions
            SET name = $1, question_type = $2, is_mandatory = $3, ranking = $4,
                condition_question_id = $5, condition_value = $6, updated_at = NOW()
            WHERE id = $7
            "#,
        )
        .bind(&name)
        .bind(&question_type)
        .bind(is_mandatory)
        .bind(ranking)
        .bind(condition_question_id)
        .bind(condition_value.as_deref())
        .bind(question_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error updating question: {}", e)))?;

        if let Some(opts) = input.options {
            sqlx::query("DELETE FROM survey_question_options WHERE question_id = $1")
                .bind(question_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Error clearing options: {}", e)))?;

            for (idx, opt_str) in opts.into_iter().enumerate() {
                let opt_id = Uuid::new_v4();
                let opt_rank = ((idx + 1) * 10) as i32;
                sqlx::query(
                    r#"
                    INSERT INTO survey_question_options (id, question_id, value, ranking, created_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    "#,
                )
                .bind(opt_id)
                .bind(question_id)
                .bind(&opt_str)
                .bind(opt_rank)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Error inserting option: {}", e)))?;
            }
        }

        tx.commit()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Commit error: {}", e)))?;

        let opt_rows: Vec<SurveyQuestionOption> = sqlx::query_as(
            "SELECT * FROM survey_question_options WHERE question_id = $1 ORDER BY ranking ASC, created_at ASC",
        )
        .bind(question_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error fetching options: {}", e)))?;

        let options_dto = opt_rows
            .into_iter()
            .map(|o| SurveyQuestionOptionDto {
                id: o.id,
                question_id: o.question_id,
                value: o.value,
                ranking: o.ranking,
            })
            .collect();

        Ok(SurveyQuestionDto {
            id: question_id,
            survey_id: existing.survey_id,
            name,
            question_type,
            is_mandatory,
            ranking,
            condition_question_id,
            condition_value,
            options: options_dto,
            created_at: existing.created_at,
            updated_at: Utc::now(),
        })
    }

    pub async fn delete_question(pool: &PgPool, question_id: Uuid) -> Result<(), AppError> {
        let result = sqlx::query("DELETE FROM survey_questions WHERE id = $1")
            .bind(question_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error deleting question: {}", e)))?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!("Question with ID {} not found", question_id)));
        }

        Ok(())
    }

    pub async fn reorder_questions(
        pool: &PgPool,
        survey_id: Uuid,
        input: ReorderQuestionsDto,
    ) -> Result<(), AppError> {
        let mut tx = pool
            .begin()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Transaction error: {}", e)))?;

        for (idx, q_id) in input.question_ids.into_iter().enumerate() {
            let rank = ((idx + 1) * 10) as i32;
            sqlx::query("UPDATE survey_questions SET ranking = $1 WHERE id = $2 AND survey_id = $3")
                .bind(rank)
                .bind(q_id)
                .bind(survey_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Error reordering questions: {}", e)))?;
        }

        tx.commit()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Commit error: {}", e)))?;

        Ok(())
    }

    // --- Entity Resolution & Token Generation ---

    pub async fn resolve_survey_for_entity(
        pool: &PgPool,
        entity_id_opt: Option<Uuid>,
    ) -> Result<Survey, AppError> {
        if let Some(eid) = entity_id_opt {
            // 1. Direct match on entity
            let survey: Option<Survey> = sqlx::query_as(
                "SELECT * FROM surveys WHERE entity_id = $1 AND is_active = TRUE ORDER BY is_default DESC, created_at DESC LIMIT 1"
            )
            .bind(eid)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error finding survey: {}", e)))?;

            if let Some(s) = survey {
                return Ok(s);
            }

            // 2. Recursive parent inheritance (if entities table has parent_id)
            let parent_survey: Option<Survey> = sqlx::query_as(
                r#"
                WITH RECURSIVE entity_tree AS (
                    SELECT id, parent_id, 1 as depth
                    FROM entities WHERE id = $1
                    UNION ALL
                    SELECT e.id, e.parent_id, et.depth + 1
                    FROM entities e
                    JOIN entity_tree et ON e.id = et.parent_id
                )
                SELECT s.*
                FROM entity_tree et
                JOIN surveys s ON s.entity_id = et.id
                WHERE s.is_active = TRUE AND s.is_recursive = TRUE
                ORDER BY et.depth ASC, s.is_default DESC, s.created_at DESC
                LIMIT 1
                "#
            )
            .bind(eid)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);

            if let Some(ps) = parent_survey {
                return Ok(ps);
            }
        }

        // 3. Fallback: Global default active survey or any active survey
        let global_survey: Option<Survey> = sqlx::query_as(
            "SELECT * FROM surveys WHERE is_active = TRUE ORDER BY is_default DESC, (entity_id IS NULL) DESC, created_at ASC LIMIT 1"
        )
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error finding fallback survey: {}", e)))?;

        global_survey.ok_or_else(|| AppError::NotFound("No hay ninguna encuesta activa disponible en el sistema".to_string()))
    }

    pub async fn generate_token(
        pool: &PgPool,
        survey_id_opt: Option<Uuid>,
        ticket_id_opt: Option<Uuid>,
        requester_email_opt: Option<String>,
        base_url_opt: Option<&str>,
    ) -> Result<SurveyTokenDto, AppError> {
        let mut entity_id: Option<Uuid> = None;
        let mut ticket_number: Option<String> = None;
        let mut ticket_name: Option<String> = None;
        let mut requester_email = requester_email_opt;

        if let Some(tid) = ticket_id_opt {
            let row = sqlx::query(
                r#"
                SELECT t.id, t.ticket_number, t.name AS title, t.entity_id, u.email as req_email
                FROM tickets t
                LEFT JOIN users u ON t.requester_id = u.id
                WHERE t.id = $1
                "#,
            )
            .bind(tid)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error fetching ticket: {}", e)))?
            .ok_or_else(|| AppError::NotFound(format!("Ticket with ID {} not found", tid)))?;

            ticket_number = Some(row.get("ticket_number"));
            ticket_name = Some(row.get("title"));
            entity_id = row.get("entity_id");
            if requester_email.is_none() {
                requester_email = row.get("req_email");
            }
        }

        let survey = if let Some(sid) = survey_id_opt {
            sqlx::query_as::<_, Survey>("SELECT * FROM surveys WHERE id = $1 AND is_active = TRUE")
                .bind(sid)
                .fetch_optional(pool)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Error fetching survey: {}", e)))?
                .ok_or_else(|| AppError::NotFound("Encuesta seleccionada no encontrada o inactiva".to_string()))?
        } else {
            Self::resolve_survey_for_entity(pool, entity_id).await?
        };

        // If ticket already has a pending or in_progress token for this survey, return existing token!
        if let Some(tid) = ticket_id_opt {
            let existing: Option<SurveyToken> = sqlx::query_as(
                r#"
                SELECT * FROM survey_tokens
                WHERE ticket_id = $1 AND survey_id = $2 AND status IN ('pending', 'in_progress') AND expires_at > NOW()
                ORDER BY created_at DESC LIMIT 1
                "#,
            )
            .bind(tid)
            .bind(survey.id)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);

            if let Some(tok) = existing {
                let base = base_url_opt.unwrap_or("");
                let public_url = format!("{}/survey/{}", base.trim_end_matches('/'), tok.token);
                let entity_name: Option<String> = if let Some(eid) = tok.entity_id {
                    sqlx::query_scalar("SELECT name FROM entities WHERE id = $1").bind(eid).fetch_optional(pool).await.unwrap_or(None)
                } else {
                    None
                };

                return Ok(SurveyTokenDto {
                    id: tok.id,
                    entity_id: tok.entity_id,
                    entity_name,
                    ticket_id: tok.ticket_id,
                    ticket_number,
                    ticket_name,
                    survey_id: survey.id,
                    survey_name: survey.name,
                    token: tok.token,
                    status: tok.status,
                    requester_email: tok.requester_email,
                    public_url,
                    created_at: tok.created_at,
                    expires_at: tok.expires_at,
                    answered_at: tok.answered_at,
                    last_accessed_at: tok.last_accessed_at,
                });
            }
        }

        // Generate 64-character cryptographically secure hex string
        let token_str = format!("{}{}", Uuid::new_v4().as_simple(), Uuid::new_v4().as_simple());
        let token_id = Uuid::new_v4();
        let now = Utc::now();
        let expires_at = now + Duration::days(survey.ttl_days_override as i64);

        sqlx::query(
            r#"
            INSERT INTO survey_tokens (
                id, entity_id, ticket_id, item_type, item_id,
                survey_id, token, status, requester_email, created_at, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10)
            "#,
        )
        .bind(token_id)
        .bind(entity_id)
        .bind(ticket_id_opt)
        .bind(if ticket_id_opt.is_some() { Some("ticket") } else { None })
        .bind(ticket_id_opt)
        .bind(survey.id)
        .bind(&token_str)
        .bind(&requester_email)
        .bind(now)
        .bind(expires_at)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error creating survey token: {}", e)))?;

        let base = base_url_opt.unwrap_or("");
        let public_url = format!("{}/survey/{}", base.trim_end_matches('/'), token_str);

        let entity_name: Option<String> = if let Some(eid) = entity_id {
            sqlx::query_scalar("SELECT name FROM entities WHERE id = $1").bind(eid).fetch_optional(pool).await.unwrap_or(None)
        } else {
            None
        };

        Ok(SurveyTokenDto {
            id: token_id,
            entity_id,
            entity_name,
            ticket_id: ticket_id_opt,
            ticket_number,
            ticket_name,
            survey_id: survey.id,
            survey_name: survey.name,
            token: token_str,
            status: "pending".to_string(),
            requester_email,
            public_url,
            created_at: now,
            expires_at,
            answered_at: None,
            last_accessed_at: None,
        })
    }

    pub async fn list_tokens(
        pool: &PgPool,
        survey_id: Option<Uuid>,
        ticket_id: Option<Uuid>,
        status: Option<String>,
        limit: i64,
        offset: i64,
        base_url_opt: Option<&str>,
    ) -> Result<Vec<SurveyTokenDto>, AppError> {
        let mut query_str = String::from(
            r#"
            SELECT 
                t.id, t.entity_id, e.name AS entity_name,
                t.ticket_id, tk.ticket_number, tk.name AS ticket_name,
                t.survey_id, s.name AS survey_name,
                t.token, t.status, t.requester_email,
                t.created_at, t.expires_at, t.answered_at, t.last_accessed_at
            FROM survey_tokens t
            JOIN surveys s ON t.survey_id = s.id
            LEFT JOIN entities e ON t.entity_id = e.id
            LEFT JOIN tickets tk ON t.ticket_id = tk.id
            WHERE 1=1
            "#,
        );

        if let Some(_) = survey_id {
            query_str.push_str(" AND t.survey_id = $1");
        }
        if let Some(_) = ticket_id {
            let param_idx = if survey_id.is_some() { "$2" } else { "$1" };
            query_str.push_str(&format!(" AND t.ticket_id = {}", param_idx));
        }
        if let Some(_) = status {
            let count = [survey_id.is_some(), ticket_id.is_some()].iter().filter(|&&x| x).count();
            query_str.push_str(&format!(" AND t.status = ${}", count + 1));
        }

        query_str.push_str(" ORDER BY t.created_at DESC LIMIT $limit OFFSET $offset");

        let base = base_url_opt.unwrap_or("");
        let query_raw = query_str
            .replace("$limit", &limit.to_string())
            .replace("$offset", &offset.to_string());

        let mut query = sqlx::query(&query_raw);
        if let Some(sid) = survey_id {
            query = query.bind(sid);
        }
        if let Some(tid) = ticket_id {
            query = query.bind(tid);
        }
        if let Some(st) = status {
            query = query.bind(st);
        }

        let rows = query
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error listing tokens: {}", e)))?;

        let mut results = Vec::new();
        for r in rows {
            let token_str: String = r.get("token");
            let public_url = format!("{}/survey/{}", base.trim_end_matches('/'), token_str);

            results.push(SurveyTokenDto {
                id: r.get("id"),
                entity_id: r.get("entity_id"),
                entity_name: r.get("entity_name"),
                ticket_id: r.get("ticket_id"),
                ticket_number: r.get("ticket_number"),
                ticket_name: r.get("ticket_name"),
                survey_id: r.get("survey_id"),
                survey_name: r.get("survey_name"),
                token: token_str,
                status: r.get("status"),
                requester_email: r.get("requester_email"),
                public_url,
                created_at: r.get("created_at"),
                expires_at: r.get("expires_at"),
                answered_at: r.get("answered_at"),
                last_accessed_at: r.get("last_accessed_at"),
            });
        }

        Ok(results)
    }

    // --- Public Answering & Draft Logic ---

    pub async fn get_public_survey(
        pool: &PgPool,
        token_str: &str,
    ) -> Result<PublicSurveyDto, AppError> {
        let token: SurveyToken = sqlx::query_as("SELECT * FROM survey_tokens WHERE token = $1")
            .bind(token_str)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error fetching token: {}", e)))?
            .ok_or_else(|| AppError::NotFound("Enlace de encuesta no válido o inexistente".to_string()))?;

        // Check expiration
        if token.expires_at < Utc::now() {
            if token.status == "pending" || token.status == "in_progress" {
                let _ = sqlx::query("UPDATE survey_tokens SET status = 'expired' WHERE id = $1")
                    .bind(token.id)
                    .execute(pool)
                    .await;
            }
            return Err(AppError::BadRequest("Este enlace de encuesta ha expirado".to_string()));
        }

        let survey: Survey = sqlx::query_as("SELECT * FROM surveys WHERE id = $1")
            .bind(token.survey_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error fetching survey: {}", e)))?
            .ok_or_else(|| AppError::NotFound("La encuesta asociada no fue encontrada".to_string()))?;

        if !survey.is_active {
            return Err(AppError::BadRequest("Esta encuesta ya no se encuentra activa".to_string()));
        }

        if token.status == "completed" && survey.allow_reentry_override == 0 {
            return Err(AppError::BadRequest("Esta encuesta ya ha sido completada. ¡Muchas gracias!".to_string()));
        }

        // Fetch ticket details for template tags replacement if applicable
        let mut ticket_number: Option<String> = None;
        let mut ticket_title: Option<String> = None;
        let mut technician_name: Option<String> = None;
        let mut requester_name: Option<String> = None;

        if let Some(tid) = token.ticket_id {
            let row = sqlx::query(
                r#"
                SELECT 
                    t.ticket_number, t.name AS title,
                    COALESCE(NULLIF(TRIM(u_tech.firstname || ' ' || u_tech.realname), ''), u_tech.username) AS tech_name,
                    COALESCE(NULLIF(TRIM(u_req.firstname || ' ' || u_req.realname), ''), u_req.username) AS req_name
                FROM tickets t
                LEFT JOIN users u_tech ON t.assigned_technician_id = u_tech.id
                LEFT JOIN users u_req ON t.requester_id = u_req.id
                WHERE t.id = $1
                "#,
            )
            .bind(tid)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);

            if let Some(r) = row {
                ticket_number = r.get("ticket_number");
                ticket_title = r.get("title");
                technician_name = r.get("tech_name");
                requester_name = r.get("req_name");
            }
        }

        // Template tags replacement function
        let replace_tags = |content: Option<String>| -> Option<String> {
            content.map(|text| {
                text.replace("##ticket.id##", ticket_number.as_deref().unwrap_or(""))
                    .replace("##ticket.title##", ticket_title.as_deref().unwrap_or(""))
                    .replace("##ticket.technician##", technician_name.as_deref().unwrap_or("el equipo técnico"))
                    .replace("##ticket.requester##", requester_name.as_deref().unwrap_or("Estimado cliente"))
            })
        };

        let header_content = replace_tags(survey.header_content);
        let footer_content = replace_tags(survey.footer_content);
        let success_content = replace_tags(survey.success_content);

        // Fetch questions and options
        let questions_internal = Self::list_questions_internal(pool, survey.id).await?;
        let public_questions = questions_internal
            .into_iter()
            .map(|q| PublicQuestionDto {
                id: q.id,
                name: q.name,
                question_type: q.question_type,
                is_mandatory: q.is_mandatory,
                ranking: q.ranking,
                condition_question_id: q.condition_question_id,
                condition_value: q.condition_value,
                options: q
                    .options
                    .into_iter()
                    .map(|o| PublicQuestionOptionDto {
                        value: o.value,
                        ranking: o.ranking,
                    })
                    .collect(),
            })
            .collect();

        // Fetch draft answers
        let draft_rows: Vec<SurveyAnswer> = sqlx::query_as(
            "SELECT * FROM survey_answers WHERE token_id = $1",
        )
        .bind(token.id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        let mut draft_answers = HashMap::new();
        for d in draft_rows {
            if let Some(val) = d.answer {
                draft_answers.insert(d.question_id.to_string(), val);
            }
        }

        // Update last accessed
        let _ = sqlx::query("UPDATE survey_tokens SET last_accessed_at = NOW() WHERE id = $1")
            .bind(token.id)
            .execute(pool)
            .await;

        Ok(PublicSurveyDto {
            token: token.token,
            status: token.status,
            survey_name: survey.name,
            header_content,
            footer_content,
            success_content,
            allow_reentry: survey.allow_reentry_override == 1,
            ticket_number,
            ticket_title,
            technician_name,
            requester_name,
            questions: public_questions,
            draft_answers,
        })
    }

    pub async fn save_draft(
        pool: &PgPool,
        token_str: &str,
        input: SaveDraftDto,
    ) -> Result<(), AppError> {
        let token: SurveyToken = sqlx::query_as("SELECT * FROM survey_tokens WHERE token = $1")
            .bind(token_str)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error fetching token: {}", e)))?
            .ok_or_else(|| AppError::NotFound("Token de encuesta no encontrado".to_string()))?;

        if token.status == "completed" {
            return Err(AppError::BadRequest("No se pueden modificar borradores de una encuesta ya completada".to_string()));
        }

        if token.expires_at < Utc::now() {
            return Err(AppError::BadRequest("Esta encuesta ha expirado".to_string()));
        }

        let mut tx = pool
            .begin()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Transaction error: {}", e)))?;

        for ans in input.answers {
            let ans_id = Uuid::new_v4();
            sqlx::query(
                r#"
                INSERT INTO survey_answers (id, token_id, question_id, answer, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 'draft', NOW(), NOW())
                ON CONFLICT (token_id, question_id) 
                DO UPDATE SET answer = EXCLUDED.answer, status = 'draft', updated_at = NOW()
                "#,
            )
            .bind(ans_id)
            .bind(token.id)
            .bind(ans.question_id)
            .bind(&ans.value)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error saving draft answer: {}", e)))?;
        }

        if token.status == "pending" {
            let _ = sqlx::query("UPDATE survey_tokens SET status = 'in_progress', last_accessed_at = NOW() WHERE id = $1")
                .bind(token.id)
                .execute(&mut *tx)
                .await;
        }

        tx.commit()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Commit error: {}", e)))?;

        Ok(())
    }

    pub async fn submit_survey(
        pool: &PgPool,
        token_str: &str,
        input: SubmitSurveyDto,
        client_ip: Option<String>,
    ) -> Result<(), AppError> {
        let token: SurveyToken = sqlx::query_as("SELECT * FROM survey_tokens WHERE token = $1")
            .bind(token_str)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error fetching token: {}", e)))?
            .ok_or_else(|| AppError::NotFound("Token de encuesta no válido".to_string()))?;

        let survey: Survey = sqlx::query_as("SELECT * FROM surveys WHERE id = $1")
            .bind(token.survey_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error fetching survey: {}", e)))?
            .ok_or_else(|| AppError::NotFound("Encuesta no encontrada".to_string()))?;

        if token.status == "completed" && survey.allow_reentry_override == 0 {
            return Err(AppError::BadRequest("Esta encuesta ya ha sido completada".to_string()));
        }

        if token.expires_at < Utc::now() {
            return Err(AppError::BadRequest("Esta encuesta ha expirado".to_string()));
        }

        let mut tx = pool
            .begin()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Transaction error: {}", e)))?;

        let mut followup_lines: Vec<String> = Vec::new();
        let mut overall_rating: Option<i32> = None;

        for ans in &input.answers {
            let ans_id = Uuid::new_v4();
            sqlx::query(
                r#"
                INSERT INTO survey_answers (id, token_id, question_id, answer, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 'final', NOW(), NOW())
                ON CONFLICT (token_id, question_id) 
                DO UPDATE SET answer = EXCLUDED.answer, status = 'final', updated_at = NOW()
                "#,
            )
            .bind(ans_id)
            .bind(token.id)
            .bind(ans.question_id)
            .bind(&ans.value)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Error committing answer: {}", e)))?;

            // Fetch question name for ticket followup summary
            let q_info: Option<(String, String)> = sqlx::query_as(
                "SELECT name, question_type FROM survey_questions WHERE id = $1",
            )
            .bind(ans.question_id)
            .fetch_optional(&mut *tx)
            .await
            .unwrap_or(None);

            if let Some((q_name, q_type)) = q_info {
                if q_type == "rating5" {
                    if let Ok(num) = ans.value.parse::<i32>() {
                        overall_rating = Some(num);
                        let stars = "⭐".repeat(num.clamp(1, 5) as usize);
                        followup_lines.push(format!("* **{}**: {} ({}/5)", q_name, stars, num));
                    }
                } else if q_type == "nps" {
                    followup_lines.push(format!("* **{}**: **{}/10**", q_name, ans.value));
                } else {
                    followup_lines.push(format!("* **{}**: {}", q_name, ans.value));
                }
            }
        }

        // Mark token as completed
        sqlx::query(
            r#"
            UPDATE survey_tokens 
            SET status = 'completed', answered_at = NOW(), last_accessed_at = NOW(), ip_answered = $1
            WHERE id = $2
            "#,
        )
        .bind(client_ip)
        .bind(token.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Error completing token: {}", e)))?;

        // If survey linked to ticket, record satisfaction summary in ticket_followups!
        if let Some(tid) = token.ticket_id {
            let stars_header = overall_rating
                .map(|r| format!("{} ({}/5)", "⭐".repeat(r as usize), r))
                .unwrap_or_else(|| "Completada".to_string());

            let followup_content = format!(
                "📋 **Encuesta de Satisfacción Recibida**: {}\n\n{}\n\n*Registrado de forma automatizada por el sistema de encuestas.*",
                stars_header,
                followup_lines.join("\n")
            );

            let followup_id = Uuid::new_v4();
            let followup_res = sqlx::query(
                r#"
                INSERT INTO ticket_followups (id, ticket_id, author_id, content, item_type, is_private, created_at, updated_at)
                VALUES ($1, $2, NULL, $3, 'followup', TRUE, NOW(), NOW())
                "#,
            )
            .bind(followup_id)
            .bind(tid)
            .bind(followup_content)
            .execute(&mut *tx)
            .await;

            if let Err(e) = followup_res {
                tracing::warn!("Failed to record satisfaction followup in ticket timeline: {}", e);
            }
        }

        tx.commit()
            .await
            .map_err(|e| AppError::InternalServerError(format!("Commit error: {}", e)))?;

        Ok(())
    }

    // --- Analytics & Dashboard ---

    pub async fn calculate_metrics(
        pool: &PgPool,
        survey_id_opt: Option<Uuid>,
        date_from_opt: Option<DateTime<Utc>>,
        date_to_opt: Option<DateTime<Utc>>,
    ) -> Result<SurveyDashboardMetricsDto, AppError> {
        let total_surveys: i64 = sqlx::query_scalar("SELECT COUNT(*)::BIGINT FROM surveys")
            .fetch_one(pool)
            .await
            .unwrap_or(0);

        let active_surveys: i64 = sqlx::query_scalar("SELECT COUNT(*)::BIGINT FROM surveys WHERE is_active = TRUE")
            .fetch_one(pool)
            .await
            .unwrap_or(0);

        let mut token_filter = String::from("WHERE 1=1");
        if let Some(_) = survey_id_opt {
            token_filter.push_str(" AND survey_id = $1");
        }
        if let Some(_) = date_from_opt {
            let idx = if survey_id_opt.is_some() { "$2" } else { "$1" };
            token_filter.push_str(&format!(" AND created_at >= {}", idx));
        }
        if let Some(_) = date_to_opt {
            let count = [survey_id_opt.is_some(), date_from_opt.is_some()].iter().filter(|&&x| x).count();
            token_filter.push_str(&format!(" AND created_at <= ${}", count + 1));
        }

        // Count tokens by status
        let token_stats_query = format!(
            r#"
            SELECT 
                COUNT(*)::BIGINT AS total,
                COUNT(CASE WHEN status = 'completed' THEN 1 END)::BIGINT AS completed,
                COUNT(CASE WHEN status = 'pending' THEN 1 END)::BIGINT AS pending,
                COUNT(CASE WHEN status = 'expired' OR (status = 'pending' AND expires_at < NOW()) THEN 1 END)::BIGINT AS expired
            FROM survey_tokens
            {}
            "#,
            token_filter
        );

        let mut q = sqlx::query(&token_stats_query);
        if let Some(sid) = survey_id_opt {
            q = q.bind(sid);
        }
        if let Some(df) = date_from_opt {
            q = q.bind(df);
        }
        if let Some(dt) = date_to_opt {
            q = q.bind(dt);
        }

        let stats_row = q.fetch_one(pool).await.map_err(|e| AppError::InternalServerError(format!("Stats query error: {}", e)))?;

        let total_links_issued: i64 = stats_row.get("total");
        let completed_surveys: i64 = stats_row.get("completed");
        let pending_surveys: i64 = stats_row.get("pending");
        let expired_surveys: i64 = stats_row.get("expired");

        let response_rate = if total_links_issued > 0 {
            (completed_surveys as f64 / total_links_issued as f64) * 100.0
        } else {
            0.0
        };

        // CSAT distribution and average for rating5 questions
        let csat_query = format!(
            r#"
            SELECT 
                NULLIF(regexp_replace(a.answer, '[^0-9]', '', 'g'), '')::INT AS star,
                COUNT(*)::BIGINT AS count
            FROM survey_answers a
            JOIN survey_questions q ON a.question_id = q.id
            JOIN survey_tokens t ON a.token_id = t.id
            WHERE q.question_type = 'rating5' AND a.status = 'final' AND a.answer IS NOT NULL
            {}
            GROUP BY 1
            "#,
            if let Some(_) = survey_id_opt { " AND q.survey_id = $1" } else { "" }
        );

        let mut csat_q = sqlx::query(&csat_query);
        if let Some(sid) = survey_id_opt {
            csat_q = csat_q.bind(sid);
        }

        let csat_rows = csat_q.fetch_all(pool).await.unwrap_or_default();
        let mut csat_map: HashMap<i32, i64> = HashMap::new();
        let mut total_ratings: i64 = 0;
        let mut sum_ratings: f64 = 0.0;

        for r in csat_rows {
            let star_opt: Option<i32> = r.get("star");
            let count: i64 = r.get("count");
            if let Some(star) = star_opt {
                if (1..=5).contains(&star) {
                    csat_map.insert(star, count);
                    total_ratings += count;
                    sum_ratings += (star as f64) * (count as f64);
                }
            }
        }

        let average_csat = if total_ratings > 0 {
            sum_ratings / (total_ratings as f64)
        } else {
            0.0
        };

        let mut csat_distribution = Vec::new();
        for star in 1..=5 {
            let count = *csat_map.get(&star).unwrap_or(&0);
            let percentage = if total_ratings > 0 {
                (count as f64 / total_ratings as f64) * 100.0
            } else {
                0.0
            };
            csat_distribution.push(CsatDistributionDto {
                star,
                count,
                percentage,
            });
        }

        // NPS calculation for nps questions (0..=10)
        let nps_query = format!(
            r#"
            SELECT 
                NULLIF(regexp_replace(a.answer, '[^0-9]', '', 'g'), '')::INT AS score,
                COUNT(*)::BIGINT AS count
            FROM survey_answers a
            JOIN survey_questions q ON a.question_id = q.id
            JOIN survey_tokens t ON a.token_id = t.id
            WHERE q.question_type = 'nps' AND a.status = 'final' AND a.answer IS NOT NULL
            {}
            GROUP BY 1
            "#,
            if let Some(_) = survey_id_opt { " AND q.survey_id = $1" } else { "" }
        );

        let mut nps_q = sqlx::query(&nps_query);
        if let Some(sid) = survey_id_opt {
            nps_q = nps_q.bind(sid);
        }

        let nps_rows = nps_q.fetch_all(pool).await.unwrap_or_default();
        let mut promoters: i64 = 0;
        let mut passives: i64 = 0;
        let mut detractors: i64 = 0;
        let mut total_nps: i64 = 0;

        for r in nps_rows {
            let score_opt: Option<i32> = r.get("score");
            let count: i64 = r.get("count");
            if let Some(score) = score_opt {
                if (0..=10).contains(&score) {
                    total_nps += count;
                    if score >= 9 {
                        promoters += count;
                    } else if score >= 7 {
                        passives += count;
                    } else {
                        detractors += count;
                    }
                }
            }
        }

        let nps_score = calculate_nps_score(promoters, passives, detractors);
        let nps = NpsDistributionDto {
            promoters,
            passives,
            detractors,
            score: nps_score,
            total: total_nps,
        };

        // Recent responses
        let recent_query = format!(
            r#"
            SELECT 
                t.id AS token_id,
                tk.ticket_number,
                tk.name AS ticket_title,
                s.name AS survey_name,
                t.requester_email,
                t.answered_at
            FROM survey_tokens t
            JOIN surveys s ON t.survey_id = s.id
            LEFT JOIN tickets tk ON t.ticket_id = tk.id
            WHERE t.status = 'completed' AND t.answered_at IS NOT NULL
            {}
            ORDER BY t.answered_at DESC
            LIMIT 10
            "#,
            if let Some(_) = survey_id_opt { " AND t.survey_id = $1" } else { "" }
        );

        let mut recent_q = sqlx::query(&recent_query);
        if let Some(sid) = survey_id_opt {
            recent_q = recent_q.bind(sid);
        }

        let recent_rows = recent_q.fetch_all(pool).await.unwrap_or_default();
        let mut recent_responses = Vec::new();

        for r in recent_rows {
            let token_id: Uuid = r.get("token_id");
            let answered_at: DateTime<Utc> = r.get("answered_at");

            let answers_rows: Vec<SurveyAnswerDto> = sqlx::query_as(
                r#"
                SELECT 
                    q.id AS question_id,
                    q.name AS question_name,
                    q.question_type,
                    a.answer,
                    a.status
                FROM survey_answers a
                JOIN survey_questions q ON a.question_id = q.id
                WHERE a.token_id = $1 AND a.status = 'final'
                ORDER BY q.ranking ASC
                "#,
            )
            .bind(token_id)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

            let csat_rating = answers_rows
                .iter()
                .find(|a| a.question_type == "rating5")
                .and_then(|a| a.answer.as_deref())
                .and_then(|val| val.parse::<i32>().ok());

            let nps_ans = answers_rows
                .iter()
                .find(|a| a.question_type == "nps")
                .and_then(|a| a.answer.as_deref())
                .and_then(|val| val.parse::<i32>().ok());

            recent_responses.push(RecentSurveyResponseDto {
                token_id,
                ticket_number: r.get("ticket_number"),
                ticket_title: r.get("ticket_title"),
                survey_name: r.get("survey_name"),
                requester_email: r.get("requester_email"),
                answered_at,
                csat_rating,
                nps_score: nps_ans,
                answers_summary: answers_rows,
            });
        }

        Ok(SurveyDashboardMetricsDto {
            total_surveys,
            active_surveys,
            total_links_issued,
            completed_surveys,
            pending_surveys,
            expired_surveys,
            response_rate,
            average_csat,
            csat_distribution,
            nps,
            recent_responses,
        })
    }
}
