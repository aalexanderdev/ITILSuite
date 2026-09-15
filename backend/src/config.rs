use std::env;

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct Config {
    pub server_host: String,
    pub server_port: u16,
    pub environment: String,
    pub database_url: String,
    pub cors_allowed_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> Self {
        // Load .env file if present
        dotenvy::dotenv().ok();

        let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let server_port = env::var("SERVER_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8081);
        let environment = env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string());
        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://itilsuite:itilsuite_dev_password@localhost:5432/itilsuite_db".to_string()
        });

        let cors_origins_raw = env::var("CORS_ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:5173,http://127.0.0.1:5173".to_string());
        let cors_allowed_origins = cors_origins_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Self {
            server_host,
            server_port,
            environment,
            database_url,
            cors_allowed_origins,
        }
    }
}
