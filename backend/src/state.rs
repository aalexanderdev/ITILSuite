use crate::config::Config;
use crate::domain::chat::WsEvent;
use sqlx::PgPool;
use std::{sync::Arc, time::Instant};
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub pool: PgPool,
    pub start_time: Instant,
    pub chat_hub: broadcast::Sender<WsEvent>,
}

impl AppState {
    pub fn new(config: Config, pool: PgPool) -> Self {
        let (chat_hub, _) = broadcast::channel(2048);
        Self {
            config: Arc::new(config),
            pool,
            start_time: Instant::now(),
            chat_hub,
        }
    }
}

