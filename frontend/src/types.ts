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

export interface EntityItem {
  id: string;
  name: string;
  path: string;
  isCurrent: boolean;
}

export interface MetricCardData {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  category: string;
  iconName: string;
}
