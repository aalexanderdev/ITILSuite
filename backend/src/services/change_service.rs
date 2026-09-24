use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::change::{
    ChangeApprovalDto, ChangeDetailDto, ChangeFollowupDto, ChangeSummaryDto,
    CreateChangeDto, CreateChangeFollowupDto, SubmitCabVoteDto, UpdateChangeDto,
};
use crate::domain::problem::{LinkedAssetDto, LinkedTicketDto, ProblemSummaryDto};
use crate::domain::ticket::calculate_priority;
use crate::error::AppError;

pub struct ChangeService;

impl ChangeService {
    pub async fn list_changes(
        pool: &PgPool,
        entity_id: Option<Uuid>,
        status: Option<&str>,
        change_type: Option<&str>,
        search: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ChangeSummaryDto>, AppError> {
        let mut sql = String::from(
            r#"
            SELECT 
                c.id,
                c.change_number,
                c.entity_id,
                e.name AS entity_name,
                c.name,
                c.content,
                c.change_type,
                c.status,
                c.urgency,
                c.impact,
                c.priority,
                c.risk_level,
                c.requester_id,
                req.realname AS requester_name,
                c.assigned_technician_id,
                tech.realname AS assigned_technician_name,
                c.assigned_group_id,
                grp.name AS assigned_group_name,
                c.category,
                c.impact_assessment,
                c.implementation_plan,
                c.test_plan,
                c.rollback_plan,
                c.scheduled_start,
                c.scheduled_end,
                c.actual_start,
                c.actual_end,
                c.pir_notes,
                (SELECT COUNT(*) FROM change_approvals ca WHERE ca.change_id = c.id) AS cab_total_approvers,
                (SELECT COUNT(*) FROM change_approvals ca WHERE ca.change_id = c.id AND ca.approval_status = 'approved') AS cab_approved_count,
                (SELECT COUNT(*) FROM change_approvals ca WHERE ca.change_id = c.id AND ca.approval_status = 'rejected') AS cab_rejected_count,
                (SELECT COUNT(*) FROM change_approvals ca WHERE ca.change_id = c.id AND ca.approval_status = 'pending') AS cab_pending_count,
                (SELECT COUNT(*) FROM change_tickets ct WHERE ct.change_id = c.id) AS linked_ticket_count,
                (SELECT COUNT(*) FROM change_problems cp WHERE cp.change_id = c.id) AS linked_problem_count,
                (SELECT COUNT(*) FROM change_assets ca_ast WHERE ca_ast.change_id = c.id) AS linked_asset_count,
                c.closed_at,
                c.created_at,
                c.updated_at
            FROM changes c
            JOIN entities e ON e.id = c.entity_id
            LEFT JOIN users req ON req.id = c.requester_id
            LEFT JOIN users tech ON tech.id = c.assigned_technician_id
            LEFT JOIN groups grp ON grp.id = c.assigned_group_id
            WHERE 1=1
            "#,
        );

        if entity_id.is_some() {
            sql.push_str(" AND c.entity_id = $1");
        }
        if status.is_some() && !status.unwrap().is_empty() && status.unwrap() != "all" {
            sql.push_str(" AND c.status = $2");
        }
        if change_type.is_some() && !change_type.unwrap().is_empty() && change_type.unwrap() != "all" {
            sql.push_str(" AND c.change_type = $3");
        }
        if search.is_some() && !search.unwrap().is_empty() {
            sql.push_str(
                " AND (c.name ILIKE $4 OR c.change_number ILIKE $4 OR c.category ILIKE $4 OR c.implementation_plan ILIKE $4)",
            );
        }

        sql.push_str(" ORDER BY c.priority DESC, c.created_at DESC LIMIT $5 OFFSET $6");

        let search_pattern = search.map(|s| format!("%{}%", s));

        let rows = sqlx::query_as::<_, ChangeSummaryDto>(&sql)
            .bind(entity_id)
            .bind(status)
            .bind(change_type)
            .bind(search_pattern)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to list changes: {}", e)))?;

        Ok(rows)
    }

    pub async fn get_change_by_id(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<Option<ChangeDetailDto>, AppError> {
        let summary_sql = r#"
            SELECT 
                c.id,
                c.change_number,
                c.entity_id,
                e.name AS entity_name,
                c.name,
                c.content,
                c.change_type,
                c.status,
                c.urgency,
                c.impact,
                c.priority,
                c.risk_level,
                c.requester_id,
                req.realname AS requester_name,
                c.assigned_technician_id,
                tech.realname AS assigned_technician_name,
                c.assigned_group_id,
                grp.name AS assigned_group_name,
                c.category,
                c.impact_assessment,
                c.implementation_plan,
                c.test_plan,
                c.rollback_plan,
                c.scheduled_start,
                c.scheduled_end,
                c.actual_start,
                c.actual_end,
                c.pir_notes,
                (SELECT COUNT(*) FROM change_approvals ca WHERE ca.change_id = c.id) AS cab_total_approvers,
                (SELECT COUNT(*) FROM change_approvals ca WHERE ca.change_id = c.id AND ca.approval_status = 'approved') AS cab_approved_count,
                (SELECT COUNT(*) FROM change_approvals ca WHERE ca.change_id = c.id AND ca.approval_status = 'rejected') AS cab_rejected_count,
                (SELECT COUNT(*) FROM change_approvals ca WHERE ca.change_id = c.id AND ca.approval_status = 'pending') AS cab_pending_count,
                (SELECT COUNT(*) FROM change_tickets ct WHERE ct.change_id = c.id) AS linked_ticket_count,
                (SELECT COUNT(*) FROM change_problems cp WHERE cp.change_id = c.id) AS linked_problem_count,
                (SELECT COUNT(*) FROM change_assets ca_ast WHERE ca_ast.change_id = c.id) AS linked_asset_count,
                c.closed_at,
                c.created_at,
                c.updated_at
            FROM changes c
            JOIN entities e ON e.id = c.entity_id
            LEFT JOIN users req ON req.id = c.requester_id
            LEFT JOIN users tech ON tech.id = c.assigned_technician_id
            LEFT JOIN groups grp ON grp.id = c.assigned_group_id
            WHERE c.id = $1
        "#;

        let summary = sqlx::query_as::<_, ChangeSummaryDto>(summary_sql)
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to fetch change summary: {}", e)))?;

        let summary = match summary {
            Some(s) => s,
            None => return Ok(None),
        };

        // Fetch CAB Approvals
        let approvals = sqlx::query_as::<_, ChangeApprovalDto>(
            r#"
            SELECT 
                ca.id,
                ca.change_id,
                ca.approver_id,
                u.realname AS approver_name,
                u.email AS approver_email,
                ca.approval_status,
                ca.comments,
                ca.decided_at,
                ca.created_at
            FROM change_approvals ca
            JOIN users u ON u.id = ca.approver_id
            WHERE ca.change_id = $1
            ORDER BY ca.created_at ASC
            "#,
        )
        .bind(id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        // Fetch followups / CAB minutes
        let followups = sqlx::query_as::<_, ChangeFollowupDto>(
            r#"
            SELECT 
                cf.id,
                cf.change_id,
                cf.author_id,
                u.realname AS author_name,
                cf.content,
                cf.item_type,
                cf.is_private,
                cf.created_at
            FROM change_followups cf
            LEFT JOIN users u ON u.id = cf.author_id
            WHERE cf.change_id = $1
            ORDER BY cf.created_at ASC
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
            FROM change_tickets ct
            JOIN tickets t ON t.id = ct.ticket_id
            WHERE ct.change_id = $1
            ORDER BY t.priority DESC, t.created_at DESC
            "#,
        )
        .bind(id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        // Fetch linked problems
        let linked_problems = sqlx::query_as::<_, ProblemSummaryDto>(
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
            FROM change_problems cp
            JOIN problems p ON p.id = cp.problem_id
            JOIN entities e ON e.id = p.entity_id
            LEFT JOIN users req ON req.id = p.requester_id
            LEFT JOIN users tech ON tech.id = p.assigned_technician_id
            LEFT JOIN groups grp ON grp.id = p.assigned_group_id
            WHERE cp.change_id = $1
            ORDER BY p.priority DESC, p.created_at DESC
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
            FROM change_assets ca
            JOIN assets a ON a.id = ca.asset_id
            WHERE ca.change_id = $1
            ORDER BY a.name ASC
            "#,
        )
        .bind(id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        Ok(Some(ChangeDetailDto {
            summary,
            approvals,
            followups,
            linked_tickets,
            linked_problems,
            linked_assets,
        }))
    }

    pub async fn create_change(
        pool: &PgPool,
        dto: CreateChangeDto,
        requester_id: Option<Uuid>,
    ) -> Result<ChangeSummaryDto, AppError> {
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
        let change_type = dto.change_type.unwrap_or_else(|| "normal".to_string());
        let risk_level = dto.risk_level.unwrap_or_else(|| "medium".to_string());

        // Generate formatted change number RFC-YYYY-NNNN
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM changes")
            .fetch_one(pool)
            .await
            .unwrap_or((0,));
        let change_number = format!("RFC-{}-{:04}", Utc::now().format("%Y"), count.0 + 1);

        let new_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO changes (
                id, change_number, entity_id, name, content, change_type, status,
                urgency, impact, priority, risk_level, requester_id, assigned_technician_id,
                assigned_group_id, category, impact_assessment, implementation_plan,
                test_plan, rollback_plan, scheduled_start, scheduled_end, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
            "#,
        )
        .bind(new_id)
        .bind(&change_number)
        .bind(entity_id)
        .bind(&dto.name)
        .bind(&dto.content)
        .bind(&change_type)
        .bind(urgency)
        .bind(impact)
        .bind(priority)
        .bind(&risk_level)
        .bind(requester_id)
        .bind(dto.assigned_technician_id)
        .bind(dto.assigned_group_id)
        .bind(dto.category)
        .bind(dto.impact_assessment)
        .bind(dto.implementation_plan)
        .bind(dto.test_plan)
        .bind(dto.rollback_plan)
        .bind(dto.scheduled_start)
        .bind(dto.scheduled_end)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to create change: {}", e)))?;

        // Add CAB Approvers if specified
        if let Some(approver_ids) = dto.cab_approver_ids {
            for approver_id in approver_ids {
                let _ = sqlx::query(
                    "INSERT INTO change_approvals (change_id, approver_id, approval_status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING",
                )
                .bind(new_id)
                .bind(approver_id)
                .execute(pool)
                .await;
            }
        }

        // Link initial problems if provided
        if let Some(problem_ids) = dto.problem_ids {
            for pid in problem_ids {
                let _ = sqlx::query(
                    "INSERT INTO change_problems (change_id, problem_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                )
                .bind(new_id)
                .bind(pid)
                .execute(pool)
                .await;
            }
        }

        // Link initial tickets if provided
        if let Some(ticket_ids) = dto.ticket_ids {
            for tid in ticket_ids {
                let _ = sqlx::query(
                    "INSERT INTO change_tickets (change_id, ticket_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
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
                    "INSERT INTO change_assets (change_id, asset_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                )
                .bind(new_id)
                .bind(aid)
                .execute(pool)
                .await;
            }
        }

        let detail = Self::get_change_by_id(pool, new_id)
            .await?
            .ok_or_else(|| AppError::InternalServerError("Failed to reload created change".into()))?;

        Ok(detail.summary)
    }

    pub async fn update_change(
        pool: &PgPool,
        id: Uuid,
        dto: UpdateChangeDto,
    ) -> Result<ChangeSummaryDto, AppError> {
        let current = sqlx::query_as::<_, (i32, i32, String, String, String)>(
            "SELECT urgency, impact, status, change_type, risk_level FROM changes WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?
        .ok_or_else(|| AppError::NotFound(format!("Change {} not found", id)))?;

        let urgency = dto.urgency.unwrap_or(current.0).clamp(1, 5);
        let impact = dto.impact.unwrap_or(current.1).clamp(1, 5);
        let priority = calculate_priority(urgency, impact);

        let new_status = dto.status.unwrap_or(current.2);
        let new_type = dto.change_type.unwrap_or(current.3);
        let new_risk = dto.risk_level.unwrap_or(current.4);

        let closed_at = if new_status == "closed" || new_status == "rejected" {
            Some(Utc::now())
        } else {
            None
        };

        sqlx::query(
            r#"
            UPDATE changes
            SET 
                name = COALESCE($1, name),
                content = COALESCE($2, content),
                change_type = $3,
                status = $4,
                urgency = $5,
                impact = $6,
                priority = $7,
                risk_level = $8,
                assigned_technician_id = COALESCE($9, assigned_technician_id),
                assigned_group_id = COALESCE($10, assigned_group_id),
                category = COALESCE($11, category),
                impact_assessment = COALESCE($12, impact_assessment),
                implementation_plan = COALESCE($13, implementation_plan),
                test_plan = COALESCE($14, test_plan),
                rollback_plan = COALESCE($15, rollback_plan),
                scheduled_start = COALESCE($16, scheduled_start),
                scheduled_end = COALESCE($17, scheduled_end),
                actual_start = COALESCE($18, actual_start),
                actual_end = COALESCE($19, actual_end),
                pir_notes = COALESCE($20, pir_notes),
                closed_at = COALESCE($21, closed_at),
                updated_at = NOW()
            WHERE id = $22
            "#,
        )
        .bind(dto.name)
        .bind(dto.content)
        .bind(new_type)
        .bind(new_status)
        .bind(urgency)
        .bind(impact)
        .bind(priority)
        .bind(new_risk)
        .bind(dto.assigned_technician_id)
        .bind(dto.assigned_group_id)
        .bind(dto.category)
        .bind(dto.impact_assessment)
        .bind(dto.implementation_plan)
        .bind(dto.test_plan)
        .bind(dto.rollback_plan)
        .bind(dto.scheduled_start)
        .bind(dto.scheduled_end)
        .bind(dto.actual_start)
        .bind(dto.actual_end)
        .bind(dto.pir_notes)
        .bind(closed_at)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to update change: {}", e)))?;

        let detail = Self::get_change_by_id(pool, id)
            .await?
            .ok_or_else(|| AppError::InternalServerError("Failed to reload updated change".into()))?;

        Ok(detail.summary)
    }

    pub async fn submit_cab_vote(
        pool: &PgPool,
        change_id: Uuid,
        approver_id: Uuid,
        dto: SubmitCabVoteDto,
    ) -> Result<ChangeApprovalDto, AppError> {
        let new_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO change_approvals (id, change_id, approver_id, approval_status, comments, decided_at, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT (change_id, approver_id) DO UPDATE
            SET 
                approval_status = EXCLUDED.approval_status,
                comments = EXCLUDED.comments,
                decided_at = NOW()
            "#,
        )
        .bind(new_id)
        .bind(change_id)
        .bind(approver_id)
        .bind(&dto.approval_status)
        .bind(dto.comments)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to submit CAB vote: {}", e)))?;

        let approval = sqlx::query_as::<_, ChangeApprovalDto>(
            r#"
            SELECT 
                ca.id,
                ca.change_id,
                ca.approver_id,
                u.realname AS approver_name,
                u.email AS approver_email,
                ca.approval_status,
                ca.comments,
                ca.decided_at,
                ca.created_at
            FROM change_approvals ca
            JOIN users u ON u.id = ca.approver_id
            WHERE ca.change_id = $1 AND ca.approver_id = $2
            "#,
        )
        .bind(change_id)
        .bind(approver_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to reload CAB vote: {}", e)))?;

        Ok(approval)
    }

    pub async fn add_cab_approver(
        pool: &PgPool,
        change_id: Uuid,
        approver_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO change_approvals (change_id, approver_id, approval_status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING",
        )
        .bind(change_id)
        .bind(approver_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to add CAB approver: {}", e)))?;

        Ok(())
    }

    pub async fn add_followup(
        pool: &PgPool,
        change_id: Uuid,
        author_id: Option<Uuid>,
        dto: CreateChangeFollowupDto,
    ) -> Result<ChangeFollowupDto, AppError> {
        let item_type = dto.item_type.unwrap_or_else(|| "followup".to_string());
        let is_private = dto.is_private.unwrap_or(false);
        let new_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO change_followups (id, change_id, author_id, content, item_type, is_private, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            "#,
        )
        .bind(new_id)
        .bind(change_id)
        .bind(author_id)
        .bind(&dto.content)
        .bind(&item_type)
        .bind(is_private)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to add change followup: {}", e)))?;

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

        Ok(ChangeFollowupDto {
            id: new_id,
            change_id,
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
        change_id: Uuid,
        ticket_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO change_tickets (change_id, ticket_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(change_id)
        .bind(ticket_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to link ticket to change: {}", e)))?;

        Ok(())
    }

    pub async fn unlink_ticket(
        pool: &PgPool,
        change_id: Uuid,
        ticket_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query("DELETE FROM change_tickets WHERE change_id = $1 AND ticket_id = $2")
            .bind(change_id)
            .bind(ticket_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to unlink ticket from change: {}", e)))?;

        Ok(())
    }

    pub async fn link_problem(
        pool: &PgPool,
        change_id: Uuid,
        problem_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO change_problems (change_id, problem_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(change_id)
        .bind(problem_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to link problem to change: {}", e)))?;

        Ok(())
    }

    pub async fn unlink_problem(
        pool: &PgPool,
        change_id: Uuid,
        problem_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query("DELETE FROM change_problems WHERE change_id = $1 AND problem_id = $2")
            .bind(change_id)
            .bind(problem_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to unlink problem from change: {}", e)))?;

        Ok(())
    }

    pub async fn link_asset(
        pool: &PgPool,
        change_id: Uuid,
        asset_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO change_assets (change_id, asset_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(change_id)
        .bind(asset_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to link asset to change: {}", e)))?;

        Ok(())
    }

    pub async fn unlink_asset(
        pool: &PgPool,
        change_id: Uuid,
        asset_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query("DELETE FROM change_assets WHERE change_id = $1 AND asset_id = $2")
            .bind(change_id)
            .bind(asset_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to unlink asset from change: {}", e)))?;

        Ok(())
    }
}
