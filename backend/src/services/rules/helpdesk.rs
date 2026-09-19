use std::collections::HashMap;
use sqlx::PgPool;
use uuid::Uuid;

use crate::services::rules::engine::RuleEngine;

pub struct HelpdeskRulesService;

impl HelpdeskRulesService {
    /// Determines the corporate entity for a new ticket based on sender email, IP, domain, etc.
    pub async fn evaluate_ticket_entity(
        pool: &PgPool,
        from_email: &str,
        ip_address: Option<&str>,
        subject: &str,
    ) -> Option<Uuid> {
        let rules = RuleEngine::load_rules_for_type(pool, "ticket_entity", None)
            .await
            .unwrap_or_default();

        let mut input = HashMap::new();
        input.insert("from_email".to_string(), from_email.trim().to_string());
        input.insert("subject".to_string(), subject.trim().to_string());

        if let Some(domain) = from_email.split('@').nth(1) {
            input.insert("domain".to_string(), domain.trim().to_string());
        }

        if let Some(ip) = ip_address {
            input.insert("ip_address".to_string(), ip.trim().to_string());
        }

        let (output, _) = RuleEngine::evaluate_pipeline(&rules, &input);

        if let Some(entity_str) = output.get("entity_id") {
            Uuid::parse_str(entity_str).ok()
        } else {
            None
        }
    }

    /// Evaluates Ticket Business Rules and returns mutations to urgency, impact, category, technician, group, etc.
    pub async fn evaluate_ticket_business_rules(
        pool: &PgPool,
        entity_id: Uuid,
        subject: &str,
        content: &str,
        from_email: &str,
        current_urgency: i32,
        current_impact: i32,
    ) -> HashMap<String, String> {
        let rules = RuleEngine::load_rules_for_type(pool, "ticket_business", Some(entity_id))
            .await
            .unwrap_or_default();

        let mut input = HashMap::new();
        input.insert("subject".to_string(), subject.trim().to_string());
        input.insert("content".to_string(), content.trim().to_string());
        input.insert("from_email".to_string(), from_email.trim().to_string());
        input.insert("urgency".to_string(), current_urgency.to_string());
        input.insert("impact".to_string(), current_impact.to_string());

        if let Some(domain) = from_email.split('@').nth(1) {
            input.insert("domain".to_string(), domain.trim().to_string());
        }

        let (output, _) = RuleEngine::evaluate_pipeline(&rules, &input);
        output
    }
}
