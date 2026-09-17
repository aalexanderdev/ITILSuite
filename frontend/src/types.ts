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
