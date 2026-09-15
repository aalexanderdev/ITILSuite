use sqlx::{postgres::PgPoolOptions, PgPool};
use tracing::info;
use uuid::Uuid;
use crate::config::Config;
use crate::domain::auth::hash_password;

pub async fn create_pool(config: &Config) -> Result<PgPool, sqlx::Error> {
    info!("Connecting to PostgreSQL database at: {}", config.database_url);
    PgPoolOptions::new()
        .max_connections(config.database_max_connections)
        .connect(&config.database_url)
        .await
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    info!("Executing pending SQLx database migrations...");
    sqlx::migrate!("./migrations").run(pool).await?;
    info!("✅ Database migrations applied successfully");
    Ok(())
}

pub async fn seed_default_admin(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // Check if the admin user exists
    let existing_admin: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM users WHERE username = $1")
        .bind("admin")
        .fetch_optional(pool)
        .await?;

    if existing_admin.is_none() {
        info!("Seeding default super-administrator user 'admin'...");
        let admin_id = Uuid::parse_str("00000000-0000-0000-0000-000000000100")?;
        let root_entity_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001")?;
        let superadmin_profile_id = Uuid::parse_str("00000000-0000-0000-0000-000000000010")?;

        let password_hash = hash_password("admin")
            .map_err(|e| format!("Failed to hash default password: {:?}", e))?;

        sqlx::query(
            "INSERT INTO users (id, username, password_hash, email, realname, firstname, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING"
        )
        .bind(admin_id)
        .bind("admin")
        .bind(password_hash)
        .bind("admin@itilsuite.local")
        .bind("Administrator")
        .bind("System")
        .bind(true)
        .execute(pool)
        .await?;

        // Link admin user with Super-Admin profile on Root Entity recursively
        sqlx::query(
            "INSERT INTO user_profiles_entities (user_id, profile_id, entity_id, is_recursive)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, profile_id, entity_id) DO NOTHING"
        )
        .bind(admin_id)
        .bind(superadmin_profile_id)
        .bind(root_entity_id)
        .bind(true)
        .execute(pool)
        .await?;

        info!("✅ Default super-administrator 'admin' (password: 'admin') initialized");
    }

    Ok(())
}
