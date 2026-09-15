use sqlx::PgPool;
use std::{sync::Arc, time::Instant};
use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub pool: PgPool,
    pub start_time: Instant,
}

impl AppState {
    pub fn new(config: Config, pool: PgPool) -> Self {
        Self {
            config: Arc::new(config),
            pool,
            start_time: Instant::now(),
        }
    }
}
