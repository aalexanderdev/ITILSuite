use std::net::SocketAddr;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod api;
mod config;
mod db;
mod domain;
mod error;
pub mod services;
mod state;

use config::Config;
use state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing for structured logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,itilsuite_backend=debug,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    let addr_str = format!("{}:{}", config.server_host, config.server_port);
    let socket_addr: SocketAddr = addr_str.parse()?;

    info!("🚀 Starting ITILSuite Backend v0.0.2 (Inspired by GLPI 11)...");

    // 1. Initialize PostgreSQL Connection Pool
    let pool = db::create_pool(&config).await?;

    // 2. Run Database Migrations
    db::run_migrations(&pool).await?;

    // 3. Seed Default Admin and Entity
    db::seed_default_admin(&pool).await?;

    let app_state = AppState::new(config.clone(), pool);

    // CORS configuration for local development and web clients
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = api::create_router(app_state.clone())
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    // 4. Start Background Notification Queue Worker (queuednotification equivalent)
    let worker_pool = app_state.pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
        loop {
            interval.tick().await;
            if let Err(e) = services::mail_service::MailService::process_queue_batch(&worker_pool).await {
                tracing::warn!("Error processing notification queue: {}", e);
            }
        }
    });

    let listener = tokio::net::TcpListener::bind(&socket_addr).await?;
    info!("✅ Server listening on: http://{}", socket_addr);
    info!("📖 Swagger UI Documentation: http://{}/swagger-ui", socket_addr);
    info!("🩺 Healthcheck Endpoint: http://{}/api/v1/health", socket_addr);

    axum::serve(listener, app).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;
    use domain::auth::{create_jwt, hash_password, verify_jwt, verify_password, Claims};
    use domain::entity::{build_entity_tree, Entity};

    #[test]
    fn test_argon2_password_hashing() {
        let password = "admin_super_secret";
        let hash = hash_password(password).expect("Hashing should succeed");

        assert!(verify_password(&hash, password));
        assert!(!verify_password(&hash, "wrong_password"));
    }

    #[test]
    fn test_jwt_generation_and_validation() {
        let secret = "test_jwt_secret_key_long_enough_123!";
        let now = Utc::now().timestamp() as usize;
        let claims = Claims {
            sub: Uuid::new_v4().to_string(),
            username: "alex_tech".to_string(),
            display_name: "Alex Tech".to_string(),
            profile_id: Uuid::new_v4().to_string(),
            profile_name: "Technician".to_string(),
            entity_id: Uuid::new_v4().to_string(),
            exp: now + 3600,
            iat: now,
        };

        let token = create_jwt(&claims, secret).expect("Token creation should succeed");
        let decoded = verify_jwt(&token, secret).expect("Token verification should succeed");

        assert_eq!(decoded.username, "alex_tech");
        assert_eq!(decoded.profile_name, "Technician");
    }

    #[test]
    fn test_entity_tree_builder() {
        let root_id = Uuid::new_v4();
        let child1_id = Uuid::new_v4();
        let child2_id = Uuid::new_v4();
        let grandchild_id = Uuid::new_v4();

        let entities = vec![
            Entity {
                id: root_id,
                parent_id: None,
                name: "Root Entity".to_string(),
                completeness: "Root Entity".to_string(),
                level: 0,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
            Entity {
                id: child1_id,
                parent_id: Some(root_id),
                name: "North Branch".to_string(),
                completeness: "Root Entity > North Branch".to_string(),
                level: 1,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
            Entity {
                id: child2_id,
                parent_id: Some(root_id),
                name: "South Branch".to_string(),
                completeness: "Root Entity > South Branch".to_string(),
                level: 1,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
            Entity {
                id: grandchild_id,
                parent_id: Some(child1_id),
                name: "IT Support".to_string(),
                completeness: "Root Entity > North Branch > IT Support".to_string(),
                level: 2,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
        ];

        let tree = build_entity_tree(&entities);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].name, "Root Entity");
        assert_eq!(tree[0].children.len(), 2);
        assert_eq!(tree[0].children[0].children.len(), 1);
        assert_eq!(tree[0].children[0].children[0].name, "IT Support");
    }

    #[test]
    fn test_batch_user_import_models() {
        use domain::user::{BatchUserImportItem, ConflictResolutionMode};

        let item = BatchUserImportItem {
            username: "carlos_admin".to_string(),
            email: "carlos@company.com".to_string(),
            firstname: Some("Carlos".to_string()),
            realname: Some("Gómez".to_string()),
            password: None,
            profile_name: Some("Technician".to_string()),
            entity_name: None,
            group_name: Some("Infraestructura & Redes".to_string()),
            is_active: Some(true),
        };

        let json = serde_json::to_string(&item).expect("Should serialize item");
        assert!(json.contains("carlos_admin"));
        assert!(json.contains("Infraestructura & Redes"));

        let mode = ConflictResolutionMode::Skip;
        let mode_json = serde_json::to_string(&mode).unwrap();
        assert_eq!(mode_json, "\"skip\"");

        let overwrite_mode = ConflictResolutionMode::Overwrite;
        let overwrite_json = serde_json::to_string(&overwrite_mode).unwrap();
        assert_eq!(overwrite_json, "\"overwrite\"");
    }

    #[test]
    fn test_group_summary_dto_creation() {
        use domain::group::GroupSummaryDto;

        let dto = GroupSummaryDto {
            id: Uuid::new_v4(),
            entity_id: None,
            entity_name: None,
            name: "Soporte Nivel 1".to_string(),
            comment: Some("Helpdesk L1".to_string()),
            is_recursive: true,
            is_task: true,
            is_requester: false,
            is_user_group: true,
            member_count: 5,
            manager_count: 1,
            created_at: Utc::now(),
        };

        assert_eq!(dto.name, "Soporte Nivel 1");
        assert!(dto.is_task);
        assert!(!dto.is_requester);
        assert_eq!(dto.member_count, 5);
        assert_eq!(dto.manager_count, 1);
    }
}
