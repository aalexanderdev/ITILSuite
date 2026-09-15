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
