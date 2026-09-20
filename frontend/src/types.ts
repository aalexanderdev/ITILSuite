export interface HealthResponse {
  status: string;
  uptime_seconds: number;
  timestamp: string;
  environment: string;
}

export interface VersionResponse {
  app_name: string;
  version: string;
  description: string;
  git_commit?: string;
}

export interface AuthUser {
  user_id: string;
  username: string;
  display_name: string;
  email?: string;
  profile_name: string;
  entity_id: string;
  entity_name: string;
  permissions?: Record<string, any>;
}

export interface LoginResponse {
  token: string;
  user_id: string;
  username: string;
  display_name: string;
  profile_name: string;
  entity_id: string;
  entity_name: string;
}

export interface EntityTreeNode {
  id: string;
  parent_id: string | null;
  name: string;
  completeness: string;
  level: number;
  children: EntityTreeNode[];
}

export interface CreateEntityPayload {
  name: string;
  parent_id?: string | null;
}

export interface UserSummary {
  id: string;
  username: string;
  display_name: string;
  email: string;
  profile_name: string;
  is_active: boolean;
  groups?: string[];
}

export interface MetricCardData {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  category: string;
  iconName: string;
}

// ITIL Service Desk (v0.0.3)
export type TicketType = 'incident' | 'request';
export type TicketStatus = 'new' | 'assigned' | 'planned' | 'pending' | 'solved' | 'closed';

export interface TicketSummary {
  id: string;
  ticket_number: string;
  entity_id: string;
  entity_name: string;
  name: string;
  content: string;
  ticket_type: TicketType;
  status: TicketStatus;
  urgency: number;
  impact: number;
  priority: number;
  requester_id: string | null;
  requester_name: string | null;
  assigned_technician_id: string | null;
  assigned_technician_name: string | null;
  assigned_group_id?: string | null;
  assigned_group_name?: string | null;
  requester_group_id?: string | null;
  requester_group_name?: string | null;
  category: string | null;
  time_to_resolve: string | null;
  solved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketFollowup {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  item_type: 'followup' | 'task' | 'solution';
  is_private: boolean;
  created_at: string;
}

export interface TicketDetail extends TicketSummary {
  followups: TicketFollowup[];
}

export interface CreateTicketPayload {
  name: string;
  content: string;
  ticket_type?: TicketType;
  urgency?: number;
  impact?: number;
  entity_id?: string;
  assigned_technician_id?: string;
  assigned_group_id?: string;
  requester_group_id?: string;
  category?: string;
}

export interface UpdateTicketPayload {
  name?: string;
  content?: string;
  status?: TicketStatus;
  urgency?: number;
  impact?: number;
  assigned_technician_id?: string | null;
  assigned_group_id?: string | null;
  requester_group_id?: string | null;
  category?: string;
}

export interface CreateFollowupPayload {
  content: string;
  item_type?: 'followup' | 'task' | 'solution';
  is_private?: boolean;
}

export interface TicketMetrics {
  total_open: number;
  incidents_count: number;
  requests_count: number;
  sla_at_risk_count: number;
  solved_count: number;
  closed_count: number;
  average_priority: number;
}

export interface TicketFilterOptions {
  entity_id?: string;
  status?: string;
  ticket_type?: string;
  priority?: number;
  assigned_to?: string;
  assigned_group_id?: string;
  search?: string;
}

// ITIL Ticket Templates (Inspired by GLPI)
export interface TicketTemplate {
  id: string;
  entity_id: string;
  entity_name?: string;
  name: string;
  description?: string | null;
  ticket_type: TicketType;
  category?: string | null;
  predefined_title?: string | null;
  predefined_content?: string | null;
  predefined_urgency?: number | null;
  predefined_impact?: number | null;
  default_technician_id?: string | null;
  default_technician_name?: string | null;
  mandatory_fields: string[];
  hidden_fields: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketTemplatePayload {
  name: string;
  description?: string;
  entity_id?: string;
  ticket_type?: TicketType;
  category?: string;
  predefined_title?: string;
  predefined_content?: string;
  predefined_urgency?: number;
  predefined_impact?: number;
  default_technician_id?: string;
  mandatory_fields?: string[];
  hidden_fields?: string[];
}

// Mail & Notification System (Inspired by GLPI 11)
export interface MailSettings {
  id: string;
  entity_id: string | null;
  notifications_enabled: boolean;
  email_followups_enabled: boolean;
  admin_email: string;
  admin_name: string;
  from_email: string;
  from_name: string;
  reply_to_email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_encryption: 'none' | 'ssl' | 'tls' | string;
  smtp_username: string;
  subject_prefix: string;
  email_signature: string;
  max_retries: number;
  retry_interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateMailSettingsDto {
  notifications_enabled?: boolean;
  email_followups_enabled?: boolean;
  admin_email?: string;
  admin_name?: string;
  from_email?: string;
  from_name?: string;
  reply_to_email?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_encryption?: string;
  smtp_username?: string;
  smtp_password?: string;
  subject_prefix?: string;
  email_signature?: string;
  max_retries?: number;
  retry_interval_minutes?: number;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  item_type: string;
  subject_template: string;
  html_template: string;
  text_template: string;
  css_styles?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateNotificationTemplateDto {
  subject_template?: string;
  html_template?: string;
  text_template?: string;
  css_styles?: string;
  is_active?: boolean;
}

export interface NotificationEvent {
  id: string;
  event_key: string;
  name: string;
  template_id: string;
  is_active: boolean;
  recipients: {
    requester?: boolean;
    technician?: boolean;
    admin?: boolean;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface NotificationQueueItem {
  id: string;
  event_key: string;
  ticket_id?: string | null;
  recipient_email: string;
  recipient_name?: string | null;
  subject: string;
  body_html: string;
  body_text: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | string;
  attempts: number;
  last_attempt_at?: string | null;
  last_error?: string | null;
  created_at: string;
}

export interface MailReceiver {
  id: string;
  entity_id: string;
  entity_name?: string | null;
  name: string;
  protocol: 'imap' | 'pop3' | string;
  host: string;
  port: number;
  ssl_mode: 'none' | 'ssl' | 'tls' | string;
  username: string;
  mail_folder: string;
  archive_folder?: string | null;
  refused_folder?: string | null;
  max_attachment_mb: number;
  is_active: boolean;
  sync_interval_seconds: number;
  last_sync_at?: string | null;
  last_error?: string | null;
  consecutive_errors: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMailReceiverDto {
  entity_id: string;
  name: string;
  protocol: string;
  host: string;
  port: number;
  ssl_mode: string;
  username: string;
  password?: string;
  mail_folder?: string;
  archive_folder?: string;
  refused_folder?: string;
  max_attachment_mb?: number;
  is_active?: boolean;
  sync_interval_seconds?: number;
}

export interface UpdateMailReceiverDto {
  name?: string;
  protocol?: string;
  host?: string;
  port?: number;
  ssl_mode?: string;
  username?: string;
  password?: string;
  mail_folder?: string;
  archive_folder?: string;
  refused_folder?: string;
  max_attachment_mb?: number;
  is_active?: boolean;
  sync_interval_seconds?: number;
}

export interface MailBlacklist {
  id: string;
  rule_type: 'sender_email' | 'domain' | 'subject_regex' | string;
  pattern: string;
  reason?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateBlacklistDto {
  rule_type: string;
  pattern: string;
  reason?: string;
}

export interface SimulateIncomingMailDto {
  from_email: string;
  from_name?: string;
  subject: string;
  body: string;
  receiver_id?: string;
}

export interface CollectResultDto {
  receiver_id: string;
  receiver_name: string;
  emails_checked: number;
  tickets_created: number;
  followups_added: number;
  rejected_blacklisted: number;
  message: string;
}

// ITAM / CMDB Asset Management (v0.0.4)
export type AssetType =
  | 'computer'
  | 'network_equipment'
  | 'monitor'
  | 'printer'
  | 'peripheral'
  | 'server'
  | 'phone'
  | 'other';

export type AssetStatus =
  | 'active'
  | 'in_stock'
  | 'in_repair'
  | 'decommissioned'
  | 'reserved';

export interface AssetSummary {
  id: string;
  entity_id: string;
  entity_name: string;
  name: string;
  asset_type: AssetType;
  status: AssetStatus;
  serial_number: string | null;
  inventory_number: string | null;
  uuid: string | null;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  user_name: string | null;
  technician_name: string | null;
  last_inventory_at: string | null;
  agent_version: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetConnectionSummary {
  connection_id: string;
  connected_asset_id: string;
  name: string;
  asset_type: AssetType;
  connection_type: string;
  model: string | null;
}

export interface ComputerSpecs {
  os?: {
    name?: string;
    version?: string;
    arch?: string;
    kernel?: string;
    install_date?: string;
  };
  cpu?: {
    name?: string;
    speed_mhz?: number;
    cores?: number;
    threads?: number;
  };
  memory?: {
    total_mb?: number;
    type?: string;
    slots_used?: number;
    slots_total?: number;
  };
  storage?: Array<{
    name: string;
    size_gb: number;
    free_gb: number;
    filesystem?: string;
    mount_point?: string;
    drive_type?: string;
  }>;
  networks?: Array<{
    name: string;
    mac?: string;
    ip?: string;
    netmask?: string;
    status: string;
    speed?: string;
  }>;
  softwares?: Array<{
    name: string;
    version?: string;
    publisher?: string;
  }>;
}

export interface NetworkEquipmentSpecs {
  device_type?: string;
  firmware_version?: string;
  ports_count?: number;
  management_ip?: string;
  mac_address?: string;
  vlans?: Array<{
    id: number;
    name: string;
    subnet: string;
  }>;
  poe_budget_watts?: number;
  poe_consumed_watts?: number;
}

export interface MonitorSpecs {
  screen_size_inches?: number;
  resolution?: string;
  refresh_rate_hz?: number;
  inputs?: string[];
  has_speakers?: boolean;
}

export interface AssetDetail {
  id: string;
  entity_id: string;
  entity_name: string;
  name: string;
  asset_type: AssetType;
  status: AssetStatus;
  serial_number: string | null;
  inventory_number: string | null;
  uuid: string | null;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  user_id: string | null;
  user_name: string | null;
  technician_id: string | null;
  technician_name: string | null;
  group_in_charge: string | null;
  comments: string | null;
  last_inventory_at: string | null;
  agent_version: string | null;
  is_locked: boolean;
  locked_fields: string[];
  specifications: ComputerSpecs & NetworkEquipmentSpecs & MonitorSpecs & Record<string, any>;
  connections: AssetConnectionSummary[];
  created_at: string;
  updated_at: string;
}

export interface CreateAssetPayload {
  entity_id?: string;
  name: string;
  asset_type: AssetType;
  status?: AssetStatus;
  serial_number?: string;
  inventory_number?: string;
  uuid?: string;
  manufacturer?: string;
  model?: string;
  location?: string;
  user_id?: string;
  technician_id?: string;
  group_in_charge?: string;
  comments?: string;
  specifications?: Record<string, any>;
}

export interface UpdateAssetPayload {
  name?: string;
  asset_type?: AssetType;
  status?: AssetStatus;
  serial_number?: string;
  inventory_number?: string;
  manufacturer?: string;
  model?: string;
  location?: string;
  user_id?: string;
  technician_id?: string;
  group_in_charge?: string;
  comments?: string;
  is_locked?: boolean;
  locked_fields?: string[];
  specifications?: Record<string, any>;
}

export interface AssetMetrics {
  total_assets: number;
  computers_count: number;
  servers_count: number;
  network_equipment_count: number;
  monitors_count: number;
  active_count: number;
  in_stock_count: number;
  in_repair_count: number;
  agent_inventoried_count: number;
}

export interface AgentSimulationRequest {
  preset_name: 'thinkpad_laptop' | 'new_macbook' | 'dl380_server' | 'ubuntu_workstation' | string;
  entity_id?: string;
}

export interface AgentSimulationResponse {
  status: string;
  message: string;
  asset_id: string;
  action_taken: 'created' | 'reconciled_updated';
  asset_name: string;
}

// ---------------------------------------------------------------------------
// HelpdeskChat & Real-Time Collaboration Types
// ---------------------------------------------------------------------------

export interface MessageReactionSummary {
  emoji: string;
  count: number;
  user_reacted: boolean;
  user_names: string[];
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id?: string | null;
  sender_name: string;
  sender_username?: string | null;
  content: string;
  link_url?: string | null;
  attachment_name?: string | null;
  attachment_url?: string | null;
  attachment_size?: number | null;
  created_at: string;
  is_self: boolean;
  reactions: MessageReactionSummary[];
  converted_ticket_id?: string | null;
  converted_ticket_number?: string | null;
}

export interface ConversationSummary {
  id: string;
  entity_id: string;
  name: string;
  is_group: boolean;
  is_self: boolean;
  is_featured: boolean;
  unread_count: number;
  last_message?: string | null;
  last_message_time?: string | null;
  is_online?: boolean | null;
}

export interface ChatMember {
  id: string;
  username: string;
  display_name: string;
  email: string;
  is_online: boolean;
  role: string;
}

export interface OnlineUser {
  user_id: string;
  username: string;
  display_name: string;
  email: string;
  status: string;
  last_seen: string;
  active_seconds: number;
}

export interface SessionInterval {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
}

export interface ChatDashboardMetrics {
  total_messages: number;
  daily_avg_messages: number;
  group_messages_pct: number;
  online_users_count: number;
  daily_active_users_avg: number;
  daily_online_seconds_avg: number;
  recent_intervals: SessionInterval[];
}

export interface ChatSettings {
  launcher_color: string;
  bubble_color: string;
  panel_width_px: number;
  max_message_length: number;
  ticket_conversion_enabled: boolean;
  allow_attachments: boolean;
  max_attachment_size_mb: number;
  auto_notify_ticket_events: boolean;
}

export interface ShortcutButton {
  id: string;
  label: string;
  url: string;
  is_active: boolean;
  ranking: number;
}

export interface ConvertToTicketPayload {
  name: string;
  category?: string;
  urgency?: number;
  impact?: number;
  content_override?: string;
  entity_id?: string;
}

export interface ConvertToTicketResponse {
  ticket_id: string;
  ticket_number: string;
  message_id: string;
  notice_message_id: string;
}

export type ChatWsEvent =
  | { type: 'new_message'; payload: ChatMessage }
  | { type: 'user_typing'; payload: { conversation_id: string; user_id: string; username: string } }
  | { type: 'reaction_updated'; payload: { message_id: string; reactions: MessageReactionSummary[] } }
  | { type: 'presence_updated'; payload: { user_id: string; status: string; last_seen: string } }
  | { type: 'ticket_converted'; payload: { message_id: string; ticket_id: string; ticket_number: string; ticket_name: string } };

// Business Rules & Dictionaries Engine
export interface Rule {
  id: string;
  rule_type: string;
  name: string;
  description: string | null;
  is_active: boolean;
  ranking: number;
  match_logic: string;
  stop_on_first_match: boolean;
  entity_id: string | null;
  is_recursive: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleCriteria {
  id: string;
  rule_id: string;
  field: string;
  operator: string;
  pattern: string;
  created_at: string;
}

export interface RuleAction {
  id: string;
  rule_id: string;
  action_type: string;
  field: string;
  value: string;
  created_at: string;
}

export interface RuleWithDetails {
  rule: Rule;
  criteria: RuleCriteria[];
  actions: RuleAction[];
}

export interface CreateRuleCriteriaDto {
  field: string;
  operator: string;
  pattern: string;
}

export interface CreateRuleActionDto {
  action_type: string;
  field: string;
  value: string;
}

export interface CreateRulePayload {
  rule_type: string;
  name: string;
  description?: string;
  is_active?: boolean;
  ranking?: number;
  match_logic?: string;
  stop_on_first_match?: boolean;
  entity_id?: string;
  is_recursive?: boolean;
  criteria: CreateRuleCriteriaDto[];
  actions: CreateRuleActionDto[];
}

export interface UpdateRulePayload {
  name?: string;
  description?: string;
  is_active?: boolean;
  ranking?: number;
  match_logic?: string;
  stop_on_first_match?: boolean;
  entity_id?: string;
  is_recursive?: boolean;
  criteria?: CreateRuleCriteriaDto[];
  actions?: CreateRuleActionDto[];
}

export interface CriteriaEvaluationResult {
  field: string;
  operator: string;
  pattern: string;
  actual_value: string | null;
  matched: boolean;
}

export interface ActionEvaluationResult {
  action_type: string;
  field: string;
  computed_value: string;
}

export interface EvaluatedRuleStep {
  rule_id: string;
  rule_name: string;
  ranking: number;
  matched: boolean;
  criteria_results: CriteriaEvaluationResult[];
  actions_executed: ActionEvaluationResult[];
  stopped_pipeline: boolean;
}

export interface DryRunRequest {
  rule_type: string;
  entity_id?: string;
  input_fields: Record<string, any>;
}

export interface DryRunResult {
  rule_type: string;
  total_rules_evaluated: number;
  total_rules_matched: number;
  final_output_fields: Record<string, any>;
  steps: EvaluatedRuleStep[];
  execution_time_us: number;
}

// Transversal Groups Architecture (v0.0.6)
export interface GroupSummary {
  id: string;
  entity_id: string | null;
  entity_name: string | null;
  name: string;
  comment: string | null;
  is_recursive: boolean;
  is_task: boolean;
  is_requester: boolean;
  is_user_group: boolean;
  member_count: number;
  manager_count: number;
  created_at: string;
}

export interface GroupMember {
  user_id: string;
  username: string;
  display_name: string;
  email: string;
  profile_name: string;
  is_manager: boolean;
  is_user: boolean;
  joined_at: string;
}

export interface GroupDetail {
  id: string;
  entity_id: string | null;
  entity_name: string | null;
  name: string;
  comment: string | null;
  is_recursive: boolean;
  is_task: boolean;
  is_requester: boolean;
  is_user_group: boolean;
  members: GroupMember[];
  created_at: string;
  updated_at: string;
}

export interface CreateGroupPayload {
  name: string;
  entity_id?: string | null;
  comment?: string;
  is_recursive?: boolean;
  is_task?: boolean;
  is_requester?: boolean;
  is_user_group?: boolean;
  initial_member_ids?: string[];
}

export interface UpdateGroupPayload {
  name?: string;
  entity_id?: string | null;
  comment?: string;
  is_recursive?: boolean;
  is_task?: boolean;
  is_requester?: boolean;
  is_user_group?: boolean;
}

export interface AddGroupMemberPayload {
  user_id: string;
  is_manager?: boolean;
  is_user?: boolean;
}

// User Ingestion & Directory Management (v0.0.6)
export interface UserGroupMembership {
  group_id: string;
  group_name: string;
  is_manager: boolean;
}

export interface UserDetail {
  id: string;
  username: string;
  email: string;
  realname: string;
  firstname: string;
  display_name: string;
  is_active: boolean;
  profile_name: string;
  profile_id?: string | null;
  entity_name: string;
  entity_id?: string | null;
  groups: UserGroupMembership[];
  created_at: string;
  updated_at: string;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password?: string;
  firstname?: string;
  realname?: string;
  is_active?: boolean;
  profile_id?: string;
  entity_id?: string;
  initial_group_ids?: string[];
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  firstname?: string;
  realname?: string;
  is_active?: boolean;
  profile_id?: string;
  entity_id?: string;
}

export type ConflictResolution = 'skip' | 'overwrite';

export interface BatchUserImportItem {
  username: string;
  email: string;
  firstname?: string;
  realname?: string;
  password?: string;
  profile_name?: string;
  entity_name?: string;
  group_name?: string;
  is_active?: boolean;
}

export interface BatchUserImportPayload {
  users: BatchUserImportItem[];
  conflict_resolution: ConflictResolution;
  default_entity_id?: string;
  default_profile_id?: string;
  default_group_id?: string;
  default_password?: string;
}

export interface BatchUserImportRowResult {
  username: string;
  email: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  message?: string;
}

export interface BatchUserImportResponse {
  total_processed: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  results: BatchUserImportRowResult[];
}

