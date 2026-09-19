use std::collections::HashMap;
use sqlx::PgPool;

use crate::services::rules::engine::RuleEngine;

pub struct DictionaryService;

impl DictionaryService {
    /// Normalizes a raw hardware manufacturer string (e.g. "Hewlett-Packard" -> "HP")
    pub async fn normalize_manufacturer(pool: &PgPool, raw: &str) -> String {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return "Desconocido".to_string();
        }

        let rules = RuleEngine::load_rules_for_type(pool, "dict_manufacturer", None)
            .await
            .unwrap_or_default();

        let mut input = HashMap::new();
        input.insert("raw_manufacturer".to_string(), trimmed.to_string());

        let (output, _) = RuleEngine::evaluate_pipeline(&rules, &input);

        output
            .get("normalized_manufacturer")
            .cloned()
            .unwrap_or_else(|| trimmed.to_string())
    }

    /// Normalizes raw OS fields (name, version, architecture)
    pub async fn normalize_os(
        pool: &PgPool,
        raw_name: &str,
        raw_version: &str,
        raw_arch: &str,
    ) -> (String, String, String) {
        // 1. OS Name
        let name_rules = RuleEngine::load_rules_for_type(pool, "dict_os", None)
            .await
            .unwrap_or_default();
        let mut name_input = HashMap::new();
        name_input.insert("raw_os_name".to_string(), raw_name.trim().to_string());
        let (name_output, _) = RuleEngine::evaluate_pipeline(&name_rules, &name_input);
        let normalized_name = name_output
            .get("normalized_os_name")
            .cloned()
            .unwrap_or_else(|| raw_name.trim().to_string());

        // 2. OS Version
        let ver_rules = RuleEngine::load_rules_for_type(pool, "dict_os_version", None)
            .await
            .unwrap_or_default();
        let mut ver_input = HashMap::new();
        ver_input.insert("raw_version".to_string(), raw_version.trim().to_string());
        let (ver_output, _) = RuleEngine::evaluate_pipeline(&ver_rules, &ver_input);
        let normalized_version = ver_output
            .get("normalized_version")
            .cloned()
            .unwrap_or_else(|| raw_version.trim().to_string());

        // 3. Architecture
        let arch_rules = RuleEngine::load_rules_for_type(pool, "dict_os_architecture", None)
            .await
            .unwrap_or_default();
        let mut arch_input = HashMap::new();
        arch_input.insert("raw_arch".to_string(), raw_arch.trim().to_string());
        let (arch_output, _) = RuleEngine::evaluate_pipeline(&arch_rules, &arch_input);
        let normalized_arch = arch_output
            .get("normalized_arch")
            .cloned()
            .unwrap_or_else(|| raw_arch.trim().to_string());

        (normalized_name, normalized_version, normalized_arch)
    }

    /// Normalizes a software package name
    pub async fn normalize_software(pool: &PgPool, raw_sw: &str) -> String {
        let trimmed = raw_sw.trim();
        if trimmed.is_empty() {
            return "".to_string();
        }

        let rules = RuleEngine::load_rules_for_type(pool, "dict_software", None)
            .await
            .unwrap_or_default();

        let mut input = HashMap::new();
        input.insert("raw_software_name".to_string(), trimmed.to_string());

        let (output, _) = RuleEngine::evaluate_pipeline(&rules, &input);

        output
            .get("normalized_software_name")
            .cloned()
            .unwrap_or_else(|| trimmed.to_string())
    }

    /// Normalizes hardware model based on category
    pub async fn normalize_model(pool: &PgPool, category: &str, raw_model: &str) -> String {
        let trimmed = raw_model.trim();
        if trimmed.is_empty() {
            return "".to_string();
        }

        let rule_type = match category {
            "computer" | "server" => "dict_computer_model",
            "monitor" => "dict_monitor_model",
            "printer" => "dict_printer_model",
            "peripheral" => "dict_peripheral_model",
            "phone" => "dict_phone_model",
            _ => "dict_computer_model",
        };

        let rules = RuleEngine::load_rules_for_type(pool, rule_type, None)
            .await
            .unwrap_or_default();

        let mut input = HashMap::new();
        input.insert("raw_model".to_string(), trimmed.to_string());

        let (output, _) = RuleEngine::evaluate_pipeline(&rules, &input);

        output
            .get("normalized_model")
            .cloned()
            .unwrap_or_else(|| trimmed.to_string())
    }
}
