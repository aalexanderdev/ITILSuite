use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

// --- Enums ---

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum QuestionType {
    Rating5,
    Nps,
    Yesno,
    ChoiceSingle,
    ChoiceMultiple,
    Dropdown,
    Text,
    Textarea,
    Date,
}

impl QuestionType {
    pub fn as_str(&self) -> &'static str {
        match self {
            QuestionType::Rating5 => "rating5",
            QuestionType::Nps => "nps",
            QuestionType::Yesno => "yesno",
            QuestionType::ChoiceSingle => "choice_single",
            QuestionType::ChoiceMultiple => "choice_multiple",
            QuestionType::Dropdown => "dropdown",
            QuestionType::Text => "text",
            QuestionType::Textarea => "textarea",
            QuestionType::Date => "date",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "rating5" => Some(QuestionType::Rating5),
            "nps" => Some(QuestionType::Nps),
            "yesno" => Some(QuestionType::Yesno),
            "choice_single" => Some(QuestionType::ChoiceSingle),
            "choice_multiple" => Some(QuestionType::ChoiceMultiple),
            "dropdown" => Some(QuestionType::Dropdown),
            "text" => Some(QuestionType::Text),
            "textarea" => Some(QuestionType::Textarea),
            "date" => Some(QuestionType::Date),
            _ => None,
        }
    }
}

// --- Survey Domain Models ---

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Survey {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub is_recursive: bool,
    pub name: String,
    pub comment: Option<String>,
    pub header_content: Option<String>,
    pub footer_content: Option<String>,
    pub success_content: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
    pub ttl_days_override: i32,
    pub allow_reentry_override: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SurveySummaryDto {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub entity_name: Option<String>,
    pub is_recursive: bool,
    pub name: String,
    pub comment: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
    pub ttl_days_override: i32,
    pub allow_reentry_override: i32,
    pub questions_count: i64,
    pub completed_tokens_count: i64,
    pub average_rating: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SurveyDetailDto {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub entity_name: Option<String>,
    pub is_recursive: bool,
    pub name: String,
    pub comment: Option<String>,
    pub header_content: Option<String>,
    pub footer_content: Option<String>,
    pub success_content: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
    pub ttl_days_override: i32,
    pub allow_reentry_override: i32,
    pub questions: Vec<SurveyQuestionDto>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateSurveyDto {
    pub entity_id: Option<Uuid>,
    pub is_recursive: Option<bool>,
    pub name: String,
    pub comment: Option<String>,
    pub header_content: Option<String>,
    pub footer_content: Option<String>,
    pub success_content: Option<String>,
    pub is_active: Option<bool>,
    pub is_default: Option<bool>,
    pub ttl_days_override: Option<i32>,
    pub allow_reentry_override: Option<i32>,
    pub template_preset: Option<String>, // 'csat_standard', 'nps_standard', 'it_support_quality', 'custom'
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateSurveyDto {
    pub entity_id: Option<Uuid>,
    pub is_recursive: Option<bool>,
    pub name: Option<String>,
    pub comment: Option<String>,
    pub header_content: Option<String>,
    pub footer_content: Option<String>,
    pub success_content: Option<String>,
    pub is_active: Option<bool>,
    pub is_default: Option<bool>,
    pub ttl_days_override: Option<i32>,
    pub allow_reentry_override: Option<i32>,
}

// --- Question Domain Models ---

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SurveyQuestion {
    pub id: Uuid,
    pub survey_id: Uuid,
    pub name: String,
    pub question_type: String,
    pub is_mandatory: bool,
    pub ranking: i32,
    pub condition_question_id: Option<Uuid>,
    pub condition_value: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SurveyQuestionDto {
    pub id: Uuid,
    pub survey_id: Uuid,
    pub name: String,
    pub question_type: String,
    pub is_mandatory: bool,
    pub ranking: i32,
    pub condition_question_id: Option<Uuid>,
    pub condition_value: Option<String>,
    pub options: Vec<SurveyQuestionOptionDto>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SurveyQuestionOption {
    pub id: Uuid,
    pub question_id: Uuid,
    pub value: String,
    pub ranking: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SurveyQuestionOptionDto {
    pub id: Uuid,
    pub question_id: Uuid,
    pub value: String,
    pub ranking: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateQuestionDto {
    pub name: String,
    pub question_type: String,
    pub is_mandatory: Option<bool>,
    pub ranking: Option<i32>,
    pub condition_question_id: Option<Uuid>,
    pub condition_value: Option<String>,
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateQuestionDto {
    pub name: Option<String>,
    pub question_type: Option<String>,
    pub is_mandatory: Option<bool>,
    pub ranking: Option<i32>,
    pub condition_question_id: Option<Uuid>,
    pub condition_value: Option<String>,
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReorderQuestionsDto {
    pub question_ids: Vec<Uuid>,
}

// --- Survey Tokens & Answering ---

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SurveyToken {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub ticket_id: Option<Uuid>,
    pub item_type: Option<String>,
    pub item_id: Option<Uuid>,
    pub survey_id: Uuid,
    pub token: String,
    pub status: String, // 'pending', 'in_progress', 'completed', 'expired'
    pub requester_email: Option<String>,
    pub ip_answered: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub answered_at: Option<DateTime<Utc>>,
    pub last_accessed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SurveyTokenDto {
    pub id: Uuid,
    pub entity_id: Option<Uuid>,
    pub entity_name: Option<String>,
    pub ticket_id: Option<Uuid>,
    pub ticket_number: Option<String>,
    pub ticket_name: Option<String>,
    pub survey_id: Uuid,
    pub survey_name: String,
    pub token: String,
    pub status: String,
    pub requester_email: Option<String>,
    pub public_url: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub answered_at: Option<DateTime<Utc>>,
    pub last_accessed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GenerateTokenDto {
    pub survey_id: Option<Uuid>,
    pub ticket_id: Option<Uuid>,
    pub requester_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SurveyAnswer {
    pub id: Uuid,
    pub token_id: Uuid,
    pub question_id: Uuid,
    pub answer: Option<String>,
    pub status: String, // 'draft', 'final'
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SurveyAnswerDto {
    pub question_id: Uuid,
    pub question_name: String,
    pub question_type: String,
    pub answer: Option<String>,
    pub status: String,
}

// --- Public Survey Models ---

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicQuestionOptionDto {
    pub value: String,
    pub ranking: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicQuestionDto {
    pub id: Uuid,
    pub name: String,
    pub question_type: String,
    pub is_mandatory: bool,
    pub ranking: i32,
    pub condition_question_id: Option<Uuid>,
    pub condition_value: Option<String>,
    pub options: Vec<PublicQuestionOptionDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicSurveyDto {
    pub token: String,
    pub status: String,
    pub survey_name: String,
    pub header_content: Option<String>,
    pub footer_content: Option<String>,
    pub success_content: Option<String>,
    pub allow_reentry: bool,
    pub ticket_number: Option<String>,
    pub ticket_title: Option<String>,
    pub technician_name: Option<String>,
    pub requester_name: Option<String>,
    pub questions: Vec<PublicQuestionDto>,
    pub draft_answers: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QuestionAnswerInput {
    pub question_id: Uuid,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SaveDraftDto {
    pub answers: Vec<QuestionAnswerInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SubmitSurveyDto {
    pub answers: Vec<QuestionAnswerInput>,
}

// --- Dashboard & Analytics Models ---

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CsatDistributionDto {
    pub star: i32,
    pub count: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct NpsDistributionDto {
    pub promoters: i64,
    pub passives: i64,
    pub detractors: i64,
    pub score: i32,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecentSurveyResponseDto {
    pub token_id: Uuid,
    pub ticket_number: Option<String>,
    pub ticket_title: Option<String>,
    pub survey_name: String,
    pub requester_email: Option<String>,
    pub answered_at: DateTime<Utc>,
    pub csat_rating: Option<i32>,
    pub nps_score: Option<i32>,
    pub answers_summary: Vec<SurveyAnswerDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SurveyDashboardMetricsDto {
    pub total_surveys: i64,
    pub active_surveys: i64,
    pub total_links_issued: i64,
    pub completed_surveys: i64,
    pub pending_surveys: i64,
    pub expired_surveys: i64,
    pub response_rate: f64,
    pub average_csat: f64,
    pub csat_distribution: Vec<CsatDistributionDto>,
    pub nps: NpsDistributionDto,
    pub recent_responses: Vec<RecentSurveyResponseDto>,
}

// --- Starter Presets ---

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PresetQuestionDef {
    pub name: String,
    pub question_type: String,
    pub is_mandatory: bool,
    pub ranking: i32,
    pub condition_on_prev_index: Option<usize>,
    pub condition_value: Option<String>,
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SurveyPresetDef {
    pub key: String,
    pub name: String,
    pub badge: String,
    pub description: String,
    pub header: String,
    pub success: String,
    pub questions: Vec<PresetQuestionDef>,
}

impl SurveyPresetDef {
    pub fn get_by_key(key: &str) -> Option<SurveyPresetDef> {
        Self::get_all().into_iter().find(|p| p.key == key)
    }

    pub fn get_all() -> Vec<SurveyPresetDef> {
        vec![
            SurveyPresetDef {
                key: "csat_standard".to_string(),
                name: "CSAT Estándar".to_string(),
                badge: "1-5 Estrellas".to_string(),
                description: "Valoración rápida de 1 a 5 estrellas con pregunta condicional de mejora para puntajes bajos (<=3).".to_string(),
                header: "<h3>Tu opinión nos ayuda a mejorar continuamente</h3><p>Por favor califica el servicio recibido para el ticket <strong>##ticket.title##</strong> atendido por <strong>##ticket.technician##</strong>.</p>".to_string(),
                success: "<h3>¡Muchas gracias por tu valoración!</h3><p>Tu opinión ha sido registrada y nos ayuda a elevar el nivel de soporte.</p>".to_string(),
                questions: vec![
                    PresetQuestionDef {
                        name: "¿Cómo califica el nivel de atención y solución brindada?".to_string(),
                        question_type: "rating5".to_string(),
                        is_mandatory: true,
                        ranking: 10,
                        condition_on_prev_index: None,
                        condition_value: None,
                        options: None,
                    },
                    PresetQuestionDef {
                        name: "¿Qué aspectos considera que podríamos mejorar en nuestro servicio?".to_string(),
                        question_type: "textarea".to_string(),
                        is_mandatory: false,
                        ranking: 20,
                        condition_on_prev_index: Some(0), // depends on Q1
                        condition_value: Some("<=3".to_string()),
                        options: None,
                    },
                    PresetQuestionDef {
                        name: "Comentarios o sugerencias adicionales".to_string(),
                        question_type: "textarea".to_string(),
                        is_mandatory: false,
                        ranking: 30,
                        condition_on_prev_index: None,
                        condition_value: None,
                        options: None,
                    },
                ],
            },
            SurveyPresetDef {
                key: "nps_standard".to_string(),
                name: "Net Promoter Score (NPS)".to_string(),
                badge: "Escala 0-10".to_string(),
                description: "Estándar de la industria para medir la lealtad y recomendación del servicio de 0 a 10.".to_string(),
                header: "<h3>Evaluación de Servicios TI</h3><p>Valore la probabilidad de recomendar nuestro soporte para el ticket ##ticket.title##.</p>".to_string(),
                success: "<h3>¡Gracias por su recomendación!</h3><p>Su puntuación ha sido guardada.</p>".to_string(),
                questions: vec![
                    PresetQuestionDef {
                        name: "En base a esta experiencia de soporte, ¿con qué probabilidad recomendaría nuestros servicios a un colega?".to_string(),
                        question_type: "nps".to_string(),
                        is_mandatory: true,
                        ranking: 10,
                        condition_on_prev_index: None,
                        condition_value: None,
                        options: None,
                    },
                    PresetQuestionDef {
                        name: "¿Cuál es el motivo principal de su puntuación?".to_string(),
                        question_type: "textarea".to_string(),
                        is_mandatory: false,
                        ranking: 20,
                        condition_on_prev_index: None,
                        condition_value: None,
                        options: None,
                    },
                ],
            },
            SurveyPresetDef {
                key: "it_support_quality".to_string(),
                name: "Calidad de Soporte Técnico".to_string(),
                badge: "Multi-Criterio".to_string(),
                description: "Evalúa resolución al primer contacto (FCR), comunicación del especialista y tiempo de respuesta.".to_string(),
                header: "<h3>Evaluación de Calidad de Soporte</h3><p>Ayúdenos a evaluar la atención del ticket ##ticket.title##.</p>".to_string(),
                success: "<h3>¡Muchas gracias por su tiempo!</h3><p>Su evaluación ha sido enviada al equipo de calidad de TI.</p>".to_string(),
                questions: vec![
                    PresetQuestionDef {
                        name: "¿Su requerimiento o problema fue resuelto en el primer contacto?".to_string(),
                        question_type: "yesno".to_string(),
                        is_mandatory: true,
                        ranking: 10,
                        condition_on_prev_index: None,
                        condition_value: None,
                        options: None,
                    },
                    PresetQuestionDef {
                        name: "¿Cómo califica la comunicación y profesionalismo del técnico?".to_string(),
                        question_type: "rating5".to_string(),
                        is_mandatory: true,
                        ranking: 20,
                        condition_on_prev_index: None,
                        condition_value: None,
                        options: None,
                    },
                    PresetQuestionDef {
                        name: "¿Cómo califica la rapidez y tiempo de respuesta?".to_string(),
                        question_type: "rating5".to_string(),
                        is_mandatory: true,
                        ranking: 30,
                        condition_on_prev_index: None,
                        condition_value: None,
                        options: None,
                    },
                    PresetQuestionDef {
                        name: "¿Tiene alguna sugerencia adicional para el equipo?".to_string(),
                        question_type: "textarea".to_string(),
                        is_mandatory: false,
                        ranking: 40,
                        condition_on_prev_index: None,
                        condition_value: None,
                        options: None,
                    },
                ],
            },
            SurveyPresetDef {
                key: "custom".to_string(),
                name: "Personalizada (En Blanco)".to_string(),
                badge: "En blanco".to_string(),
                description: "Comience con un formulario en blanco y agregue preguntas a medida.".to_string(),
                header: "<h3>Encuesta de Satisfacción</h3><p>Por favor complete el siguiente cuestionario.</p>".to_string(),
                success: "<h3>¡Muchas gracias!</h3><p>Sus respuestas han sido registradas con éxito.</p>".to_string(),
                questions: vec![],
            },
        ]
    }
}

// --- Logic Helpers ---

pub fn is_question_visible(condition_val: Option<&str>, answer_val: Option<&str>) -> bool {
    let cond = match condition_val {
        Some(c) if !c.trim().is_empty() => c.trim(),
        _ => return true, // No condition means always visible
    };

    let ans = match answer_val {
        Some(a) => a.trim(),
        None => return false, // Conditioned on a question that has no answer yet
    };

    if cond == "<=3" {
        if let Ok(num) = ans.parse::<i32>() {
            return num <= 3;
        }
    } else if cond == ">=4" {
        if let Ok(num) = ans.parse::<i32>() {
            return num >= 4;
        }
    } else if cond.contains(',') {
        let parts: Vec<&str> = cond.split(',').map(|s| s.trim()).collect();
        return parts.contains(&ans);
    }

    cond.eq_ignore_ascii_case(ans)
}

pub fn calculate_nps_score(promoters: i64, detractors: i64, total: i64) -> i32 {
    if total <= 0 {
        return 0;
    }
    let p_pct = (promoters as f64 / total as f64) * 100.0;
    let d_pct = (detractors as f64 / total as f64) * 100.0;
    (p_pct - d_pct).round() as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_presets_exist_and_have_questions() {
        let presets = SurveyPresetDef::get_all();
        assert_eq!(presets.len(), 4);

        let csat = presets.iter().find(|p| p.key == "csat_standard").unwrap();
        assert_eq!(csat.questions.len(), 3);
        assert_eq!(csat.questions[0].question_type, "rating5");
        assert_eq!(csat.questions[1].condition_on_prev_index, Some(0));

        let nps = presets.iter().find(|p| p.key == "nps_standard").unwrap();
        assert_eq!(nps.questions[0].question_type, "nps");
    }

    #[test]
    fn test_is_question_visible_unconditional() {
        assert!(is_question_visible(None, None));
        assert!(is_question_visible(Some(""), None));
    }

    #[test]
    fn test_is_question_visible_condition_lte_3() {
        assert!(is_question_visible(Some("<=3"), Some("1")));
        assert!(is_question_visible(Some("<=3"), Some("2")));
        assert!(is_question_visible(Some("<=3"), Some("3")));
        assert!(!is_question_visible(Some("<=3"), Some("4")));
        assert!(!is_question_visible(Some("<=3"), Some("5")));
    }

    #[test]
    fn test_is_question_visible_exact_match() {
        assert!(is_question_visible(Some("yes"), Some("yes")));
        assert!(is_question_visible(Some("1"), Some("1")));
        assert!(!is_question_visible(Some("1"), Some("0")));
    }

    #[test]
    fn test_nps_calculation() {
        // 10 promoters, 2 detractors out of 20 total -> (50% - 10%) = +40
        assert_eq!(calculate_nps_score(10, 2, 20), 40);
        // 0 promoters, 10 detractors out of 10 -> -100
        assert_eq!(calculate_nps_score(0, 10, 10), -100);
        // Empty responses
        assert_eq!(calculate_nps_score(0, 0, 0), 0);
    }
}
