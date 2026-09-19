use std::collections::HashMap;
use sqlx::PgPool;
use uuid::Uuid;

use crate::services::rules::engine::RuleEngine;

pub struct AssetRulesService;

impl AssetRulesService {
    /// Determines which entity an incoming discovered asset belongs to (based on subnet, tag, domain, etc.)
    pub async fn evaluate_asset_entity(
        pool: &PgPool,
        ip_address: Option<&str>,
        inventory_tag: Option<&str>,
        hostname: Option<&str>,
        domain: Option<&str>,
    ) -> Option<Uuid> {
        let rules = RuleEngine::load_rules_for_type(pool, "asset_entity", None)
            .await
            .unwrap_or_default();

        let mut input = HashMap::new();
        if let Some(ip) = ip_address {
            input.insert("ip_address".to_string(), ip.trim().to_string());
        }
        if let Some(tag) = inventory_tag {
            input.insert("inventory_tag".to_string(), tag.trim().to_string());
        }
        if let Some(h) = hostname {
            input.insert("hostname".to_string(), h.trim().to_string());
        }
        if let Some(d) = domain {
            input.insert("domain".to_string(), d.trim().to_string());
        }

        let (output, _) = RuleEngine::evaluate_pipeline(&rules, &input);

        if let Some(ent_str) = output.get("entity_id") {
            Uuid::parse_str(ent_str).ok()
        } else {
            None
        }
    }

    /// Evaluates dynamic reconciliation decision (link_by_uuid, link_by_serial, link_by_mac, reject, trash, create_new)
    pub async fn evaluate_reconciliation_decision(
        pool: &PgPool,
        entity_id: Uuid,
        bios_uuid: Option<&str>,
        serial_number: Option<&str>,
        mac_address: Option<&str>,
        hostname: Option<&str>,
    ) -> String {
        let rules = RuleEngine::load_rules_for_type(pool, "asset_import_link", Some(entity_id))
            .await
            .unwrap_or_default();

        let mut input = HashMap::new();
        if let Some(u) = bios_uuid {
            input.insert("bios_uuid".to_string(), u.trim().to_string());
        }
        if let Some(s) = serial_number {
            input.insert("serial_number".to_string(), s.trim().to_string());
        }
        if let Some(m) = mac_address {
            input.insert("mac_address".to_string(), m.trim().to_string());
        }
        if let Some(h) = hostname {
            input.insert("hostname".to_string(), h.trim().to_string());
        }

        let (output, _) = RuleEngine::evaluate_pipeline(&rules, &input);

        output
            .get("reconciliation_decision")
            .cloned()
            .unwrap_or_else(|| "create_new".to_string())
    }
}
