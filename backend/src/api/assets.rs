use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::domain::asset::{
    AssetConnectionSummaryDto, AssetDetailDto, AssetFilterQuery, AssetMetricsDto, AssetStatus,
    AssetSummaryDto, AssetType, CreateAssetDto, UpdateAssetDto,
};
use crate::error::AppError;
use crate::state::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/assets",
    params(
        ("entity_id" = Option<Uuid>, Query, description = "Filter by Entity ID"),
        ("asset_type" = Option<String>, Query, description = "Filter by Asset Type (computer, network_equipment, monitor, server, etc.)"),
        ("status" = Option<String>, Query, description = "Filter by Status (active, in_stock, in_repair, etc.)"),
        ("search" = Option<String>, Query, description = "Search query for name, serial, model, or location")
    ),
    responses(
        (status = 200, description = "List of assets retrieved successfully", body = Vec<AssetSummaryDto>)
    ),
    tag = "Assets"
)]
pub async fn list_assets(
    State(state): State<AppState>,
    Query(filter): Query<AssetFilterQuery>,
) -> Result<impl IntoResponse, AppError> {
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

    if let Some(entity_id) = filter.entity_id {
        sql.push_str(&format!(" AND a.entity_id = '{}'", entity_id));
    }

    if let Some(ref at) = filter.asset_type {
        if !at.is_empty() && at != "all" {
            sql.push_str(&format!(" AND a.asset_type = '{}'", at));
        }
    }

    if let Some(ref st) = filter.status {
        if !st.is_empty() && st != "all" {
            sql.push_str(&format!(" AND a.status = '{}'", st));
        }
    }

    if let Some(ref q) = filter.search {
        if !q.is_empty() {
            let sanitized = q.replace('\'', "''");
            sql.push_str(&format!(
                " AND (a.name ILIKE '%{}%' OR a.serial_number ILIKE '%{}%' OR a.model ILIKE '%{}%' OR a.location ILIKE '%{}%')",
                sanitized, sanitized, sanitized, sanitized
            ));
        }
    }

    sql.push_str(" ORDER BY a.updated_at DESC");

    let rows = sqlx::query(&sql).fetch_all(&state.pool).await?;

    let assets: Vec<AssetSummaryDto> = rows
        .iter()
        .map(|r| {
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
        .collect();

    Ok(Json(assets))
}

#[utoipa::path(
    get,
    path = "/api/v1/assets/metrics",
    responses(
        (status = 200, description = "Asset metrics and counts retrieved", body = AssetMetricsDto)
    ),
    tag = "Assets"
)]
pub async fn get_asset_metrics(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, AppError> {
    let row = sqlx::query!(
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
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(AssetMetricsDto {
        total_assets: row.total_assets.unwrap_or(0),
        computers_count: row.computers_count.unwrap_or(0),
        servers_count: row.servers_count.unwrap_or(0),
        network_equipment_count: row.network_equipment_count.unwrap_or(0),
        monitors_count: row.monitors_count.unwrap_or(0),
        active_count: row.active_count.unwrap_or(0),
        in_stock_count: row.in_stock_count.unwrap_or(0),
        in_repair_count: row.in_repair_count.unwrap_or(0),
        agent_inventoried_count: row.agent_inventoried_count.unwrap_or(0),
    }))
}

#[utoipa::path(
    get,
    path = "/api/v1/assets/{id}",
    responses(
        (status = 200, description = "Asset details retrieved successfully", body = AssetDetailDto),
        (status = 404, description = "Asset not found")
    ),
    tag = "Assets"
)]
pub async fn get_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let row = sqlx::query(
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
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Asset with ID '{}' not found", id)))?;

    // Fetch connected assets (e.g. monitors or peripherals)
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
    .await?;

    let connections: Vec<AssetConnectionSummaryDto> = conn_rows
        .iter()
        .map(|r| {
            let at_str: String = r.get("asset_type");
            AssetConnectionSummaryDto {
                connection_id: r.get("connection_id"),
                connected_asset_id: r.get("connected_asset_id"),
                name: r.get("name"),
                asset_type: AssetType::from_str(&at_str),
                connection_type: r.get("connection_type"),
                model: r.get("model"),
            }
        })
        .collect();

    let type_str: String = row.get("asset_type");
    let status_str: String = row.get("status");
    let locked_fields_val: serde_json::Value = row.get("locked_fields");
    let locked_fields: Vec<String> = serde_json::from_value(locked_fields_val).unwrap_or_default();
    let specifications: serde_json::Value = row.get("specifications");

    Ok(Json(AssetDetailDto {
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
        specifications,
        connections,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }))
}

#[utoipa::path(
    post,
    path = "/api/v1/assets",
    request_body = CreateAssetDto,
    responses(
        (status = 201, description = "Asset created successfully", body = AssetSummaryDto)
    ),
    tag = "Assets"
)]
pub async fn create_asset(
    State(state): State<AppState>,
    Json(payload): Json<CreateAssetDto>,
) -> Result<impl IntoResponse, AppError> {
    let entity_id = payload
        .entity_id
        .unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap());

    let asset_id = Uuid::new_v4();
    let status_str = payload.status.unwrap_or(AssetStatus::Active).as_str();
    let specs = payload.specifications.unwrap_or(json!({}));

    sqlx::query(
        r#"
        INSERT INTO assets (
            id, entity_id, name, asset_type, status, serial_number, inventory_number,
            uuid, manufacturer, model, location, user_id, technician_id, group_in_charge,
            comments, specifications
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        "#
    )
    .bind(asset_id)
    .bind(entity_id)
    .bind(&payload.name)
    .bind(payload.asset_type.as_str())
    .bind(status_str)
    .bind(payload.serial_number.as_deref())
    .bind(payload.inventory_number.as_deref())
    .bind(payload.uuid.as_deref())
    .bind(payload.manufacturer.as_deref())
    .bind(payload.model.as_deref())
    .bind(payload.location.as_deref())
    .bind(payload.user_id)
    .bind(payload.technician_id)
    .bind(payload.group_in_charge.as_deref())
    .bind(payload.comments.as_deref())
    .bind(specs)
    .execute(&state.pool)
    .await?;

    let summary = AssetSummaryDto {
        id: asset_id,
        entity_id,
        entity_name: "Root Entity".to_string(),
        name: payload.name,
        asset_type: payload.asset_type,
        status: payload.status.unwrap_or(AssetStatus::Active),
        serial_number: payload.serial_number,
        inventory_number: payload.inventory_number,
        uuid: payload.uuid,
        manufacturer: payload.manufacturer,
        model: payload.model,
        location: payload.location,
        user_name: None,
        technician_name: None,
        last_inventory_at: None,
        agent_version: None,
        is_locked: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok((StatusCode::CREATED, Json(summary)))
}

#[utoipa::path(
    patch,
    path = "/api/v1/assets/{id}",
    request_body = UpdateAssetDto,
    responses(
        (status = 200, description = "Asset updated successfully", body = AssetSummaryDto),
        (status = 404, description = "Asset not found")
    ),
    tag = "Assets"
)]
pub async fn update_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAssetDto>,
) -> Result<impl IntoResponse, AppError> {
    let mut tx = state.pool.begin().await?;

    let existing = sqlx::query!("SELECT id FROM assets WHERE id = $1", id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Asset with ID '{}' not found", id)))?;

    if let Some(ref name) = payload.name {
        sqlx::query!("UPDATE assets SET name = $1, updated_at = NOW() WHERE id = $2", name, existing.id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(asset_type) = payload.asset_type {
        sqlx::query!("UPDATE assets SET asset_type = $1, updated_at = NOW() WHERE id = $2", asset_type.as_str(), existing.id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(status) = payload.status {
        sqlx::query!("UPDATE assets SET status = $1, updated_at = NOW() WHERE id = $2", status.as_str(), existing.id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(ref serial) = payload.serial_number {
        sqlx::query!("UPDATE assets SET serial_number = $1, updated_at = NOW() WHERE id = $2", serial, existing.id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(ref location) = payload.location {
        sqlx::query!("UPDATE assets SET location = $1, updated_at = NOW() WHERE id = $2", location, existing.id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(user_id) = payload.user_id {
        sqlx::query!("UPDATE assets SET user_id = $1, updated_at = NOW() WHERE id = $2", user_id, existing.id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(tech_id) = payload.technician_id {
        sqlx::query!("UPDATE assets SET technician_id = $1, updated_at = NOW() WHERE id = $2", tech_id, existing.id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(ref comments) = payload.comments {
        sqlx::query!("UPDATE assets SET comments = $1, updated_at = NOW() WHERE id = $2", comments, existing.id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(is_locked) = payload.is_locked {
        sqlx::query!("UPDATE assets SET is_locked = $1, updated_at = NOW() WHERE id = $2", is_locked, existing.id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(ref locked_fields) = payload.locked_fields {
        let json_lf = serde_json::to_value(locked_fields).unwrap_or(json!([]));
        sqlx::query!("UPDATE assets SET locked_fields = $1, updated_at = NOW() WHERE id = $2", json_lf, existing.id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(ref specs) = payload.specifications {
        sqlx::query!("UPDATE assets SET specifications = $1, updated_at = NOW() WHERE id = $2", specs, existing.id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    let row = sqlx::query(
        r#"
        SELECT
            a.id, a.entity_id, e.name as entity_name, a.name, a.asset_type, a.status,
            a.serial_number, a.inventory_number, a.uuid, a.manufacturer, a.model, a.location,
            u.username as user_name, t.username as technician_name, a.last_inventory_at,
            a.agent_version, a.is_locked, a.created_at, a.updated_at
        FROM assets a
        JOIN entities e ON a.entity_id = e.id
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN users t ON a.technician_id = t.id
        WHERE a.id = $1
        "#
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    let type_str: String = row.get("asset_type");
    let status_str: String = row.get("status");

    Ok(Json(AssetSummaryDto {
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
        user_name: row.get("user_name"),
        technician_name: row.get("technician_name"),
        last_inventory_at: row.get("last_inventory_at"),
        agent_version: row.get("agent_version"),
        is_locked: row.get("is_locked"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }))
}

#[utoipa::path(
    delete,
    path = "/api/v1/assets/{id}",
    responses(
        (status = 204, description = "Asset deleted successfully"),
        (status = 404, description = "Asset not found")
    ),
    tag = "Assets"
)]
pub async fn delete_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let result = sqlx::query!("DELETE FROM assets WHERE id = $1", id)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Asset with ID '{}' not found", id)));
    }

    Ok(StatusCode::NO_CONTENT)
}
