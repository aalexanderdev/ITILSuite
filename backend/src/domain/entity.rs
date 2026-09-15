use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Entity {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub completeness: String,
    pub level: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct EntityTreeNode {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub completeness: String,
    pub level: i32,
    pub children: Vec<EntityTreeNode>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateEntityDto {
    /// Name of the new entity/organizational branch
    pub name: String,
    /// Parent Entity ID (None for Root Entity)
    pub parent_id: Option<Uuid>,
}

/// Recursively build an Entity Tree structure from a flat vector of entities
pub fn build_entity_tree(entities: &[Entity]) -> Vec<EntityTreeNode> {
    fn build_nodes(parent_id: Option<Uuid>, entities: &[Entity]) -> Vec<EntityTreeNode> {
        entities
            .iter()
            .filter(|e| e.parent_id == parent_id)
            .map(|e| EntityTreeNode {
                id: e.id,
                parent_id: e.parent_id,
                name: e.name.clone(),
                completeness: e.completeness.clone(),
                level: e.level,
                children: build_nodes(Some(e.id), entities),
            })
            .collect()
    }

    build_nodes(None, entities)
}
