use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::problem::{
    CreateKedbArticleDto, CreateProblemDto, CreateProblemFollowupDto,
    KedbArticleSummaryDto, LinkedAssetDto, LinkedChangeDto, LinkedTicketDto, ProblemDetailDto,
    ProblemFollowupDto, ProblemSummaryDto, UpdateKedbArticleDto, UpdateProblemDto,
};
use crate::domain::ticket::calculate_priority;
use crate::error::AppError;

pub struct ProblemService;

impl ProblemService {
    pub async fn list_problems(
        pool: &PgPool,
        entity_id: Option<Uuid>,
        status: Option<&str>,
        search: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ProblemSummaryDto>, AppError> {
        let mut sql = String::from(
            r#"
            SELECT 
                p.id,
                p.problem_number,
                p.entity_id,
                e.name AS entity_name,
                p.name,
                p.content,
                p.status,
                p.urgency,
                p.impact,
                p.priority,
                p.requester_id,
                req.realname AS requester_name,
                p.assigned_technician_id,
                tech.realname AS assigned_technician_name,
                p.assigned_group_id,
                grp.name AS assigned_group_name,
                p.category,
                p.symptoms,
                p.root_cause,
                p.workaround,
                p.permanent_solution,
                (SELECT COUNT(*) FROM problem_tickets pt WHERE pt.problem_id = p.id) AS linked_ticket_count,
                (SELECT COUNT(*) FROM problem_assets pa WHERE pa.problem_id = p.id) AS linked_asset_count,
                (SELECT COUNT(*) FROM change_problems cp WHERE cp.problem_id = p.id) AS linked_change_count,
                p.solved_at,
                p.closed_at,
                p.created_at,
                p.updated_at
            FROM problems p
            JOIN entities e ON e.id = p.entity_id
            LEFT JOIN users req ON req.id = p.requester_id
            LEFT JOIN users tech ON tech.id = p.assigned_technician_id
            LEFT JOIN groups grp ON grp.id = p.assigned_group_id
            WHERE 1=1
            "#,
        );

        if entity_id.is_some() {
            sql.push_str(" AND p.entity_id = $1");
        }
        if status.is_some() && !status.unwrap().is_empty() && status.unwrap() != "all" {
            sql.push_str(" AND p.status = $2");
        }
        if search.is_some() && !search.unwrap().is_empty() {
            sql.push_str(
                " AND (p.name ILIKE $3 OR p.problem_number ILIKE $3 OR p.symptoms ILIKE $3 OR p.category ILIKE $3)",
            );
        }

        sql.push_str(" ORDER BY p.priority DESC, p.created_at DESC LIMIT $4 OFFSET $5");

        let search_pattern = search.map(|s| format!("%{}%", s));

        let rows = sqlx::query_as::<_, ProblemSummaryDto>(&sql)
            .bind(entity_id)
            .bind(status)
            .bind(search_pattern)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to list problems: {}", e)))?;

        Ok(rows)
    }

    pub async fn get_problem_by_id(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<Option<ProblemDetailDto>, AppError> {
        let summary_sql = r#"
            SELECT 
                p.id,
                p.problem_number,
                p.entity_id,
                e.name AS entity_name,
                p.name,
                p.content,
                p.status,
                p.urgency,
                p.impact,
                p.priority,
                p.requester_id,
                req.realname AS requester_name,
                p.assigned_technician_id,
                tech.realname AS assigned_technician_name,
                p.assigned_group_id,
                grp.name AS assigned_group_name,
                p.category,
                p.symptoms,
                p.root_cause,
                p.workaround,
                p.permanent_solution,
                (SELECT COUNT(*) FROM problem_tickets pt WHERE pt.problem_id = p.id) AS linked_ticket_count,
                (SELECT COUNT(*) FROM problem_assets pa WHERE pa.problem_id = p.id) AS linked_asset_count,
                (SELECT COUNT(*) FROM change_problems cp WHERE cp.problem_id = p.id) AS linked_change_count,
                p.solved_at,
                p.closed_at,
                p.created_at,
                p.updated_at
            FROM problems p
            JOIN entities e ON e.id = p.entity_id
            LEFT JOIN users req ON req.id = p.requester_id
            LEFT JOIN users tech ON tech.id = p.assigned_technician_id
            LEFT JOIN groups grp ON grp.id = p.assigned_group_id
            WHERE p.id = $1
        "#;

        let summary = sqlx::query_as::<_, ProblemSummaryDto>(summary_sql)
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to fetch problem summary: {}", e)))?;

        let summary = match summary {
            Some(s) => s,
            None => return Ok(None),
        };

        // Fetch followups
        let followups = sqlx::query_as::<_, ProblemFollowupDto>(
            r#"
            SELECT 
                pf.id,
                pf.problem_id,
                pf.author_id,
                u.realname AS author_name,
                pf.content,
                pf.item_type,
                pf.is_private,
                pf.created_at
            FROM problem_followups pf
            LEFT JOIN users u ON u.id = pf.author_id
            WHERE pf.problem_id = $1
            ORDER BY pf.created_at ASC
            "#,
        )
        .bind(id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        // Fetch linked tickets
        let linked_tickets = sqlx::query_as::<_, LinkedTicketDto>(
            r#"
            SELECT 
                t.id,
                t.ticket_number,
                t.name,
                t.status,
                t.priority,
                t.created_at
            FROM problem_tickets pt
            JOIN tickets t ON t.id = pt.ticket_id
            WHERE pt.problem_id = $1
            ORDER BY t.priority DESC, t.created_at DESC
            "#,
        )
        .bind(id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        // Fetch linked assets
        let linked_assets = sqlx::query_as::<_, LinkedAssetDto>(
            r#"
            SELECT 
                a.id,
                a.asset_tag,
                a.name,
                a.asset_type,
                a.status
            FROM problem_assets pa
            JOIN assets a ON a.id = pa.asset_id
            WHERE pa.problem_id = $1
            ORDER BY a.name ASC
            "#,
        )
        .bind(id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        // Fetch linked changes
        let linked_changes = sqlx::query_as::<_, LinkedChangeDto>(
            r#"
            SELECT 
                c.id,
                c.change_number,
                c.name,
                c.change_type,
                c.status,
                c.priority
            FROM change_problems cp
            JOIN changes c ON c.id = cp.change_id
            WHERE cp.problem_id = $1
            ORDER BY c.created_at DESC
            "#,
        )
        .bind(id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        // Fetch KEDB article if exists
        let kedb_article = sqlx::query_as::<_, KedbArticleSummaryDto>(
            r#"
            SELECT 
                k.id,
                k.kedb_number,
                k.entity_id,
                e.name AS entity_name,
                k.problem_id,
                p.problem_number,
                p.name AS problem_name,
                k.title,
                k.category,
                k.error_symptoms,
                k.root_cause,
                k.workaround,
                k.permanent_solution,
                k.author_id,
                u.realname AS author_name,
                k.status,
                k.view_count,
                k.is_public_kb,
                k.created_at,
                k.updated_at
            FROM kedb_articles k
            JOIN entities e ON e.id = k.entity_id
            LEFT JOIN problems p ON p.id = k.problem_id
            LEFT JOIN users u ON u.id = k.author_id
            WHERE k.problem_id = $1
            LIMIT 1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .unwrap_or(None);

        Ok(Some(ProblemDetailDto {
            summary,
            followups,
            linked_tickets,
            linked_assets,
            linked_changes,
            kedb_article,
        }))
    }

    pub async fn create_problem(
        pool: &PgPool,
        dto: CreateProblemDto,
        requester_id: Option<Uuid>,
    ) -> Result<ProblemSummaryDto, AppError> {
        let entity_id = match dto.entity_id {
            Some(e) => e,
            None => {
                let root_id: (Uuid,) = sqlx::query_as(
                    "SELECT id FROM entities WHERE parent_id IS NULL ORDER BY created_at ASC LIMIT 1",
                )
                .fetch_one(pool)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Root entity lookup failed: {}", e)))?;
                root_id.0
            }
        };

        let urgency = dto.urgency.unwrap_or(3).clamp(1, 5);
        let impact = dto.impact.unwrap_or(3).clamp(1, 5);
        let priority = calculate_priority(urgency, impact);

        // Generate formatted problem number PRB-YYYY-NNNN
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM problems")
            .fetch_one(pool)
            .await
            .unwrap_or((0,));
        let problem_number = format!("PRB-{}-{:04}", Utc::now().format("%Y"), count.0 + 1);

        let new_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO problems (
                id, problem_number, entity_id, name, content, status,
                urgency, impact, priority, requester_id, assigned_technician_id,
                assigned_group_id, category, symptoms, root_cause, workaround,
                permanent_solution, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, 'new', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
            "#,
        )
        .bind(new_id)
        .bind(&problem_number)
        .bind(entity_id)
        .bind(&dto.name)
        .bind(&dto.content)
        .bind(urgency)
        .bind(impact)
        .bind(priority)
        .bind(requester_id)
        .bind(dto.assigned_technician_id)
        .bind(dto.assigned_group_id)
        .bind(dto.category)
        .bind(dto.symptoms)
        .bind(dto.root_cause)
        .bind(dto.workaround)
        .bind(dto.permanent_solution)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to create problem: {}", e)))?;

        // Link initial tickets if provided
        if let Some(ticket_ids) = dto.ticket_ids {
            for tid in ticket_ids {
                let _ = sqlx::query(
                    "INSERT INTO problem_tickets (problem_id, ticket_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                )
                .bind(new_id)
                .bind(tid)
                .execute(pool)
                .await;
            }
        }

        // Link initial assets if provided
        if let Some(asset_ids) = dto.asset_ids {
            for aid in asset_ids {
                let _ = sqlx::query(
                    "INSERT INTO problem_assets (problem_id, asset_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                )
                .bind(new_id)
                .bind(aid)
                .execute(pool)
                .await;
            }
        }

        let detail = Self::get_problem_by_id(pool, new_id)
            .await?
            .ok_or_else(|| AppError::InternalServerError("Failed to reload created problem".into()))?;

        Ok(detail.summary)
    }

    pub async fn update_problem(
        pool: &PgPool,
        id: Uuid,
        dto: UpdateProblemDto,
    ) -> Result<ProblemSummaryDto, AppError> {
        let current = sqlx::query_as::<_, (i32, i32, String)>(
            "SELECT urgency, impact, status FROM problems WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?
        .ok_or_else(|| AppError::NotFound(format!("Problem {} not found", id)))?;

        let urgency = dto.urgency.unwrap_or(current.0).clamp(1, 5);
        let impact = dto.impact.unwrap_or(current.1).clamp(1, 5);
        let priority = calculate_priority(urgency, impact);

        let new_status = dto.status.unwrap_or(current.2);
        let solved_at = if new_status == "resolved" {
            Some(Utc::now())
        } else {
            None
        };
        let closed_at = if new_status == "closed" {
            Some(Utc::now())
        } else {
            None
        };

        sqlx::query(
            r#"
            UPDATE problems
            SET 
                name = COALESCE($1, name),
                content = COALESCE($2, content),
                status = $3,
                urgency = $4,
                impact = $5,
                priority = $6,
                assigned_technician_id = COALESCE($7, assigned_technician_id),
                assigned_group_id = COALESCE($8, assigned_group_id),
                category = COALESCE($9, category),
                symptoms = COALESCE($10, symptoms),
                root_cause = COALESCE($11, root_cause),
                workaround = COALESCE($12, workaround),
                permanent_solution = COALESCE($13, permanent_solution),
                solved_at = COALESCE($14, solved_at),
                closed_at = COALESCE($15, closed_at),
                updated_at = NOW()
            WHERE id = $16
            "#,
        )
        .bind(dto.name)
        .bind(dto.content)
        .bind(new_status)
        .bind(urgency)
        .bind(impact)
        .bind(priority)
        .bind(dto.assigned_technician_id)
        .bind(dto.assigned_group_id)
        .bind(dto.category)
        .bind(dto.symptoms)
        .bind(dto.root_cause)
        .bind(dto.workaround)
        .bind(dto.permanent_solution)
        .bind(solved_at)
        .bind(closed_at)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to update problem: {}", e)))?;

        let detail = Self::get_problem_by_id(pool, id)
            .await?
            .ok_or_else(|| AppError::InternalServerError("Failed to reload updated problem".into()))?;

        Ok(detail.summary)
    }

    pub async fn add_followup(
        pool: &PgPool,
        problem_id: Uuid,
        author_id: Option<Uuid>,
        dto: CreateProblemFollowupDto,
    ) -> Result<ProblemFollowupDto, AppError> {
        let item_type = dto.item_type.unwrap_or_else(|| "followup".to_string());
        let is_private = dto.is_private.unwrap_or(false);
        let new_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO problem_followups (id, problem_id, author_id, content, item_type, is_private, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            "#,
        )
        .bind(new_id)
        .bind(problem_id)
        .bind(author_id)
        .bind(&dto.content)
        .bind(&item_type)
        .bind(is_private)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to add problem followup: {}", e)))?;

        let author_name = if let Some(aid) = author_id {
            sqlx::query_as::<_, (String,)>("SELECT realname FROM users WHERE id = $1")
                .bind(aid)
                .fetch_optional(pool)
                .await
                .unwrap_or(None)
                .map(|r| r.0)
        } else {
            None
        };

        Ok(ProblemFollowupDto {
            id: new_id,
            problem_id,
            author_id,
            author_name,
            content: dto.content,
            item_type,
            is_private,
            created_at: Utc::now(),
        })
    }

    pub async fn link_ticket(
        pool: &PgPool,
        problem_id: Uuid,
        ticket_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO problem_tickets (problem_id, ticket_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(problem_id)
        .bind(ticket_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to link ticket to problem: {}", e)))?;

        Ok(())
    }

    pub async fn unlink_ticket(
        pool: &PgPool,
        problem_id: Uuid,
        ticket_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query("DELETE FROM problem_tickets WHERE problem_id = $1 AND ticket_id = $2")
            .bind(problem_id)
            .bind(ticket_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to unlink ticket from problem: {}", e)))?;

        Ok(())
    }

    pub async fn link_asset(
        pool: &PgPool,
        problem_id: Uuid,
        asset_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO problem_assets (problem_id, asset_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(problem_id)
        .bind(asset_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to link asset to problem: {}", e)))?;

        Ok(())
    }

    pub async fn unlink_asset(
        pool: &PgPool,
        problem_id: Uuid,
        asset_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query("DELETE FROM problem_assets WHERE problem_id = $1 AND asset_id = $2")
            .bind(problem_id)
            .bind(asset_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to unlink asset from problem: {}", e)))?;

        Ok(())
    }

    // ========================================================================
    // KEDB (Known Error Database) Methods
    // ========================================================================

    pub async fn list_kedb_articles(
        pool: &PgPool,
        entity_id: Option<Uuid>,
        status: Option<&str>,
        search: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<KedbArticleSummaryDto>, AppError> {
        let mut sql = String::from(
            r#"
            SELECT 
                k.id,
                k.kedb_number,
                k.entity_id,
                e.name AS entity_name,
                k.problem_id,
                p.problem_number,
                p.name AS problem_name,
                k.title,
                k.category,
                k.error_symptoms,
                k.root_cause,
                k.workaround,
                k.permanent_solution,
                k.author_id,
                u.realname AS author_name,
                k.status,
                k.view_count,
                k.is_public_kb,
                k.created_at,
                k.updated_at
            FROM kedb_articles k
            JOIN entities e ON e.id = k.entity_id
            LEFT JOIN problems p ON p.id = k.problem_id
            LEFT JOIN users u ON u.id = k.author_id
            WHERE 1=1
            "#,
        );

        if entity_id.is_some() {
            sql.push_str(" AND k.entity_id = $1");
        }
        if status.is_some() && !status.unwrap().is_empty() && status.unwrap() != "all" {
            sql.push_str(" AND k.status = $2");
        }
        if search.is_some() && !search.unwrap().is_empty() {
            sql.push_str(
                " AND (k.title ILIKE $3 OR k.kedb_number ILIKE $3 OR k.error_symptoms ILIKE $3 OR k.workaround ILIKE $3)",
            );
        }

        sql.push_str(" ORDER BY k.view_count DESC, k.created_at DESC LIMIT $4 OFFSET $5");

        let search_pattern = search.map(|s| format!("%{}%", s));

        let rows = sqlx::query_as::<_, KedbArticleSummaryDto>(&sql)
            .bind(entity_id)
            .bind(status)
            .bind(search_pattern)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to list KEDB articles: {}", e)))?;

        Ok(rows)
    }

    pub async fn get_kedb_article_by_id(
        pool: &PgPool,
        id: Uuid,
        increment_views: bool,
    ) -> Result<Option<KedbArticleSummaryDto>, AppError> {
        if increment_views {
            let _ = sqlx::query("UPDATE kedb_articles SET view_count = view_count + 1 WHERE id = $1")
                .bind(id)
                .execute(pool)
                .await;
        }

        let row = sqlx::query_as::<_, KedbArticleSummaryDto>(
            r#"
            SELECT 
                k.id,
                k.kedb_number,
                k.entity_id,
                e.name AS entity_name,
                k.problem_id,
                p.problem_number,
                p.name AS problem_name,
                k.title,
                k.category,
                k.error_symptoms,
                k.root_cause,
                k.workaround,
                k.permanent_solution,
                k.author_id,
                u.realname AS author_name,
                k.status,
                k.view_count,
                k.is_public_kb,
                k.created_at,
                k.updated_at
            FROM kedb_articles k
            JOIN entities e ON e.id = k.entity_id
            LEFT JOIN problems p ON p.id = k.problem_id
            LEFT JOIN users u ON u.id = k.author_id
            WHERE k.id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to fetch KEDB article: {}", e)))?;

        Ok(row)
    }

    pub async fn create_kedb_from_problem(
        pool: &PgPool,
        problem_id: Uuid,
        author_id: Option<Uuid>,
        title: Option<String>,
    ) -> Result<KedbArticleSummaryDto, AppError> {
        let problem = Self::get_problem_by_id(pool, problem_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Problem {} not found", problem_id)))?;

        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM kedb_articles")
            .fetch_one(pool)
            .await
            .unwrap_or((0,));
        let kedb_number = format!("KEDB-{}-{:04}", Utc::now().format("%Y"), count.0 + 1);

        let new_id = Uuid::new_v4();
        let article_title = title.unwrap_or_else(|| format!("Workaround para: {}", problem.summary.name));
        let symptoms = problem.summary.symptoms.unwrap_or_else(|| problem.summary.content.clone());
        let root_cause = problem.summary.root_cause.unwrap_or_else(|| "En análisis".to_string());
        let workaround = problem.summary.workaround.unwrap_or_else(|| "Procedimiento de mitigación no documentado aún".to_string());

        sqlx::query(
            r#"
            INSERT INTO kedb_articles (
                id, kedb_number, entity_id, problem_id, title, category,
                error_symptoms, root_cause, workaround, permanent_solution,
                author_id, status, view_count, is_public_kb, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'published', 0, true, NOW(), NOW())
            "#,
        )
        .bind(new_id)
        .bind(&kedb_number)
        .bind(problem.summary.entity_id)
        .bind(problem_id)
        .bind(&article_title)
        .bind(problem.summary.category)
        .bind(symptoms)
        .bind(root_cause)
        .bind(workaround)
        .bind(problem.summary.permanent_solution)
        .bind(author_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to create KEDB article: {}", e)))?;

        // Update problem status to known_error if not already resolved or closed
        if problem.summary.status != "resolved" && problem.summary.status != "closed" {
            let _ = sqlx::query("UPDATE problems SET status = 'known_error', updated_at = NOW() WHERE id = $1")
                .bind(problem_id)
                .execute(pool)
                .await;
        }

        let article = Self::get_kedb_article_by_id(pool, new_id, false)
            .await?
            .ok_or_else(|| AppError::InternalServerError("Failed to reload created KEDB article".into()))?;

        Ok(article)
    }

    pub async fn create_kedb_article(
        pool: &PgPool,
        dto: CreateKedbArticleDto,
        author_id: Option<Uuid>,
    ) -> Result<KedbArticleSummaryDto, AppError> {
        let entity_id = match dto.entity_id {
            Some(e) => e,
            None => {
                let root_id: (Uuid,) = sqlx::query_as(
                    "SELECT id FROM entities WHERE parent_id IS NULL ORDER BY created_at ASC LIMIT 1",
                )
                .fetch_one(pool)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Root entity lookup failed: {}", e)))?;
                root_id.0
            }
        };

        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM kedb_articles")
            .fetch_one(pool)
            .await
            .unwrap_or((0,));
        let kedb_number = format!("KEDB-{}-{:04}", Utc::now().format("%Y"), count.0 + 1);

        let new_id = Uuid::new_v4();
        let is_public = dto.is_public_kb.unwrap_or(true);

        sqlx::query(
            r#"
            INSERT INTO kedb_articles (
                id, kedb_number, entity_id, problem_id, title, category,
                error_symptoms, root_cause, workaround, permanent_solution,
                author_id, status, view_count, is_public_kb, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'published', 0, $12, NOW(), NOW())
            "#,
        )
        .bind(new_id)
        .bind(&kedb_number)
        .bind(entity_id)
        .bind(dto.problem_id)
        .bind(&dto.title)
        .bind(dto.category)
        .bind(&dto.error_symptoms)
        .bind(&dto.root_cause)
        .bind(&dto.workaround)
        .bind(dto.permanent_solution)
        .bind(author_id)
        .bind(is_public)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to create KEDB article: {}", e)))?;

        let article = Self::get_kedb_article_by_id(pool, new_id, false)
            .await?
            .ok_or_else(|| AppError::InternalServerError("Failed to reload created KEDB article".into()))?;

        Ok(article)
    }

    pub async fn update_kedb_article(
        pool: &PgPool,
        id: Uuid,
        dto: UpdateKedbArticleDto,
    ) -> Result<KedbArticleSummaryDto, AppError> {
        sqlx::query(
            r#"
            UPDATE kedb_articles
            SET 
                title = COALESCE($1, title),
                category = COALESCE($2, category),
                error_symptoms = COALESCE($3, error_symptoms),
                root_cause = COALESCE($4, root_cause),
                workaround = COALESCE($5, workaround),
                permanent_solution = COALESCE($6, permanent_solution),
                status = COALESCE($7, status),
                is_public_kb = COALESCE($8, is_public_kb),
                updated_at = NOW()
            WHERE id = $9
            "#,
        )
        .bind(dto.title)
        .bind(dto.category)
        .bind(dto.error_symptoms)
        .bind(dto.root_cause)
        .bind(dto.workaround)
        .bind(dto.permanent_solution)
        .bind(dto.status)
        .bind(dto.is_public_kb)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to update KEDB article: {}", e)))?;

        let article = Self::get_kedb_article_by_id(pool, id, false)
            .await?
            .ok_or_else(|| AppError::InternalServerError("Failed to reload updated KEDB article".into()))?;

        Ok(article)
    }
}
