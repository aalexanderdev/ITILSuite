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
  category?: string;
}

export interface UpdateTicketPayload {
  name?: string;
  content?: string;
  status?: TicketStatus;
  urgency?: number;
  impact?: number;
  assigned_technician_id?: string | null;
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


