use std::{sync::Arc, time::Instant};
use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub start_time: Instant,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            config: Arc::new(config),
            start_time: Instant::now(),
        }
    }
}
