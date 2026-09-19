use std::collections::HashMap;
use std::net::IpAddr;
use std::str::FromStr;
use std::time::Instant;

use ipnet::IpNet;
use regex::Regex;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::rule::{
    ActionEvaluationResult, CriteriaEvaluationResult, DryRunRequest, DryRunResult,
    EvaluatedRuleStep, Rule, RuleAction, RuleCriteria, RuleWithDetails,
};
use crate::error::AppError;

pub struct RuleEngine;

impl RuleEngine {
    /// Loads all active rules of a given type, ordered by ranking ASC, with their criteria and actions.
    pub async fn load_rules_for_type(
        pool: &PgPool,
        rule_type: &str,
        entity_id: Option<Uuid>,
    ) -> Result<Vec<RuleWithDetails>, AppError> {
        let rules: Vec<Rule> = if let Some(ent_id) = entity_id {
            sqlx::query_as(
                r#"
                SELECT * FROM rules
                WHERE rule_type = $1 
                  AND is_active = TRUE
                  AND (entity_id IS NULL OR entity_id = $2 OR is_recursive = TRUE)
                ORDER BY ranking ASC, created_at ASC
                "#,
            )
            .bind(rule_type)
            .bind(ent_id)
            .fetch_all(pool)
            .await?
        } else {
            sqlx::query_as(
                r#"
                SELECT * FROM rules
                WHERE rule_type = $1 AND is_active = TRUE
                ORDER BY ranking ASC, created_at ASC
                "#,
            )
            .bind(rule_type)
            .fetch_all(pool)
            .await?
        };

        let mut results = Vec::with_capacity(rules.len());

        for rule in rules {
            let criteria: Vec<RuleCriteria> = sqlx::query_as(
                r#"
                SELECT * FROM rule_criteria
                WHERE rule_id = $1
                ORDER BY created_at ASC
                "#,
            )
            .bind(rule.id)
            .fetch_all(pool)
            .await?;

            let actions: Vec<RuleAction> = sqlx::query_as(
                r#"
                SELECT * FROM rule_actions
                WHERE rule_id = $1
                ORDER BY created_at ASC
                "#,
            )
            .bind(rule.id)
            .fetch_all(pool)
            .await?;

            results.push(RuleWithDetails {
                rule,
                criteria,
                actions,
            });
        }

        Ok(results)
    }

    /// Evaluates a single criterion against an input value.
    /// Returns (matched, captured_groups)
    pub fn evaluate_criterion(
        actual_val_opt: Option<&str>,
        operator: &str,
        pattern: &str,
    ) -> (bool, Vec<String>) {
        let actual = actual_val_opt.unwrap_or("").trim();

        match operator {
            "equals" | "is" => {
                let matched = actual.eq_ignore_ascii_case(pattern.trim());
                (matched, vec![])
            }
            "not_equals" | "is_not" => {
                let matched = !actual.eq_ignore_ascii_case(pattern.trim());
                (matched, vec![])
            }
            "contains" => {
                let matched = actual.to_lowercase().contains(&pattern.trim().to_lowercase());
                (matched, vec![])
            }
            "not_contains" => {
                let matched = !actual.to_lowercase().contains(&pattern.trim().to_lowercase());
                (matched, vec![])
            }
            "starts_with" => {
                let matched = actual.to_lowercase().starts_with(&pattern.trim().to_lowercase());
                (matched, vec![])
            }
            "ends_with" => {
                let matched = actual.to_lowercase().ends_with(&pattern.trim().to_lowercase());
                (matched, vec![])
            }
            "regex_match" => {
                if let Ok(re) = Regex::new(pattern) {
                    if let Some(caps) = re.captures(actual) {
                        let mut groups = Vec::new();
                        for i in 0..caps.len() {
                            if let Some(m) = caps.get(i) {
                                groups.push(m.as_str().to_string());
                            } else {
                                groups.push("".to_string());
                            }
                        }
                        (true, groups)
                    } else {
                        (false, vec![])
                    }
                } else {
                    tracing::warn!("Invalid regex pattern in rule criterion: {}", pattern);
                    (false, vec![])
                }
            }
            "regex_not_match" => {
                if let Ok(re) = Regex::new(pattern) {
                    (!re.is_match(actual), vec![])
                } else {
                    (false, vec![])
                }
            }
            "is_empty" => {
                (actual.is_empty(), vec![])
            }
            "is_not_empty" => {
                (!actual.is_empty(), vec![])
            }
            "in_subnet" => {
                if let (Ok(ip), Ok(subnet)) = (IpAddr::from_str(actual), IpNet::from_str(pattern.trim())) {
                    (subnet.contains(&ip), vec![])
                } else {
                    (false, vec![])
                }
            }
            _ => {
                tracing::warn!("Unknown operator in rule criterion: {}", operator);
                (false, vec![])
            }
        }
    }

    /// Resolves action value with captured regex groups ($1, $2, etc.)
    pub fn resolve_action_value(template: &str, captures: &[String]) -> String {
        let mut result = template.to_string();
        for (i, cap) in captures.iter().enumerate() {
            let placeholder = format!("${}", i);
            result = result.replace(&placeholder, cap);
        }
        result
    }

    /// Evaluates a pipeline of rules against input fields.
    /// Mutates `current_fields` in place according to matched actions.
    pub fn evaluate_pipeline(
        rules: &[RuleWithDetails],
        input_fields: &HashMap<String, String>,
    ) -> (HashMap<String, String>, Vec<EvaluatedRuleStep>) {
        let mut current_fields = input_fields.clone();
        let mut steps = Vec::new();

        for item in rules {
            let rule = &item.rule;
            let mut criteria_results = Vec::new();
            let mut all_captures = Vec::new();

            let mut match_count = 0;
            let total_criteria = item.criteria.len();

            for crit in &item.criteria {
                let actual = current_fields.get(&crit.field).map(|s| s.as_str());
                let (matched, caps) = Self::evaluate_criterion(actual, &crit.operator, &crit.pattern);

                if matched {
                    match_count += 1;
                    if !caps.is_empty() {
                        all_captures = caps;
                    }
                }

                criteria_results.push(CriteriaEvaluationResult {
                    field: crit.field.clone(),
                    operator: crit.operator.clone(),
                    pattern: crit.pattern.clone(),
                    actual_value: actual.map(|s| s.to_string()),
                    matched,
                });
            }

            // Determine if the rule matches based on match_logic
            let rule_matched = if total_criteria == 0 {
                // If a rule has 0 criteria, it acts as a default fallback catch-all rule
                true
            } else if rule.match_logic.eq_ignore_ascii_case("OR") {
                match_count > 0
            } else {
                // Default: AND logic
                match_count == total_criteria
            };

            let mut actions_executed = Vec::new();
            let mut stopped_pipeline = false;

            if rule_matched {
                for act in &item.actions {
                    let computed_value = Self::resolve_action_value(&act.value, &all_captures);
                    current_fields.insert(act.field.clone(), computed_value.clone());

                    actions_executed.push(ActionEvaluationResult {
                        action_type: act.action_type.clone(),
                        field: act.field.clone(),
                        computed_value,
                    });
                }

                if rule.stop_on_first_match {
                    stopped_pipeline = true;
                }
            }

            steps.push(EvaluatedRuleStep {
                rule_id: rule.id,
                rule_name: rule.name.clone(),
                ranking: rule.ranking,
                matched: rule_matched,
                criteria_results,
                actions_executed,
                stopped_pipeline,
            });

            if stopped_pipeline {
                break;
            }
        }

        (current_fields, steps)
    }

    /// Performs a complete Dry-Run test for the admin UI simulator
    pub async fn execute_dry_run(
        pool: &PgPool,
        req: DryRunRequest,
    ) -> Result<DryRunResult, AppError> {
        let start = Instant::now();

        // Convert input_fields JSON object to HashMap<String, String>
        let mut input_map = HashMap::new();
        if let Some(obj) = req.input_fields.as_object() {
            for (k, v) in obj {
                let str_val = match v {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Number(n) => n.to_string(),
                    serde_json::Value::Bool(b) => b.to_string(),
                    serde_json::Value::Null => "".to_string(),
                    other => other.to_string(),
                };
                input_map.insert(k.clone(), str_val);
            }
        }

        let rules = Self::load_rules_for_type(pool, &req.rule_type, req.entity_id).await?;
        let total_rules = rules.len();

        let (final_map, steps) = Self::evaluate_pipeline(&rules, &input_map);

        let total_matched = steps.iter().filter(|s| s.matched).count();
        let execution_time_us = start.elapsed().as_micros() as u64;

        let final_output_json = serde_json::to_value(final_map).unwrap_or_default();

        Ok(DryRunResult {
            rule_type: req.rule_type,
            total_rules_evaluated: total_rules,
            total_rules_matched: total_matched,
            final_output_fields: final_output_json,
            steps,
            execution_time_us,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::rule::{Rule, RuleAction, RuleCriteria, RuleWithDetails};
    use uuid::Uuid;

    #[test]
    fn test_match_criterion_operators() {
        // equals
        assert!(RuleEngine::evaluate_criterion(Some("hp"), "equals", "HP").0);
        assert!(!RuleEngine::evaluate_criterion(Some("Dell"), "equals", "HP").0);

        // contains
        assert!(RuleEngine::evaluate_criterion(Some("HP ProBook 450 G8"), "contains", "ProBook").0);
        assert!(!RuleEngine::evaluate_criterion(Some("HP ProBook 450 G8"), "contains", "ThinkPad").0);

        // regex_match with capture
        let (matched, caps) = RuleEngine::evaluate_criterion(
            Some("Windows 11 Pro 64-bit"),
            "regex_match",
            r"^Windows\s+(1[01])\s+(Pro|Enterprise)",
        );
        assert!(matched);
        assert_eq!(caps.get(1).map(|s| s.as_str()), Some("11"));
        assert_eq!(caps.get(2).map(|s| s.as_str()), Some("Pro"));

        // in_subnet CIDR check
        assert!(RuleEngine::evaluate_criterion(Some("192.168.1.50"), "in_subnet", "192.168.1.0/24").0);
        assert!(!RuleEngine::evaluate_criterion(Some("10.0.0.50"), "in_subnet", "192.168.1.0/24").0);

        // is_empty / is_not_empty
        assert!(RuleEngine::evaluate_criterion(None, "is_empty", "").0);
        assert!(RuleEngine::evaluate_criterion(Some(""), "is_empty", "").0);
        assert!(RuleEngine::evaluate_criterion(Some("valid_value"), "is_not_empty", "").0);
    }

    #[test]
    fn test_resolve_action_value() {
        let caps = vec!["full".to_string(), "11".to_string(), "Enterprise".to_string()];
        let resolved = RuleEngine::resolve_action_value("Windows $1 $2", &caps);
        assert_eq!(resolved, "Windows 11 Enterprise");
    }

    #[test]
    fn test_evaluate_pipeline_and_stop_on_first_match() {
        let rule1_id = Uuid::new_v4();
        let rule2_id = Uuid::new_v4();

        let r1 = RuleWithDetails {
            rule: Rule {
                id: rule1_id,
                rule_type: "dict_manufacturer".to_string(),
                name: "Normalize HP".to_string(),
                description: None,
                is_active: true,
                ranking: 10,
                match_logic: "OR".to_string(),
                stop_on_first_match: true,
                entity_id: None,
                is_recursive: true,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            criteria: vec![
                RuleCriteria {
                    id: Uuid::new_v4(),
                    rule_id: rule1_id,
                    field: "raw_manufacturer".to_string(),
                    operator: "contains".to_string(),
                    pattern: "Hewlett-Packard".to_string(),
                    created_at: chrono::Utc::now(),
                },
                RuleCriteria {
                    id: Uuid::new_v4(),
                    rule_id: rule1_id,
                    field: "raw_manufacturer".to_string(),
                    operator: "equals".to_string(),
                    pattern: "HP Inc.".to_string(),
                    created_at: chrono::Utc::now(),
                },
            ],
            actions: vec![RuleAction {
                id: Uuid::new_v4(),
                rule_id: rule1_id,
                action_type: "assign".to_string(),
                field: "normalized_manufacturer".to_string(),
                value: "HP".to_string(),
                created_at: chrono::Utc::now(),
            }],
        };

        let r2 = RuleWithDetails {
            rule: Rule {
                id: rule2_id,
                rule_type: "dict_manufacturer".to_string(),
                name: "Fallback Rule".to_string(),
                description: None,
                is_active: true,
                ranking: 20,
                match_logic: "AND".to_string(),
                stop_on_first_match: false,
                entity_id: None,
                is_recursive: true,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            criteria: vec![],
            actions: vec![RuleAction {
                id: Uuid::new_v4(),
                rule_id: rule2_id,
                action_type: "assign".to_string(),
                field: "normalized_manufacturer".to_string(),
                value: "Other".to_string(),
                created_at: chrono::Utc::now(),
            }],
        };

        let rules = vec![r1, r2];

        let mut input = HashMap::new();
        input.insert("raw_manufacturer".to_string(), "Hewlett-Packard".to_string());

        let (output, steps) = RuleEngine::evaluate_pipeline(&rules, &input);
        assert_eq!(output.get("normalized_manufacturer").map(|s| s.as_str()), Some("HP"));
        // Since r1 stopped on first match, step 2 should not have run
        assert_eq!(steps.len(), 1);
        assert!(steps[0].matched);
        assert!(steps[0].stopped_pipeline);
    }
}
