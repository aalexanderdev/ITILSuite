import type {
  HealthResponse,
  VersionResponse,
  AuthUser,
  LoginResponse,
  EntityTreeNode,
  CreateEntityPayload,
  UserSummary,
} from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

const TOKEN_KEY = 'itilsuite_jwt_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface PingResult {
  success: boolean;
  latencyMs: number;
  health?: HealthResponse;
  version?: VersionResponse;
  rawJson?: string;
  error?: string;
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getBackendVersion(): Promise<VersionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/version`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function pingBackendDiagnostics(): Promise<PingResult> {
  const startTime = performance.now();
  try {
    const [health, version] = await Promise.all([
      checkBackendHealth(),
      getBackendVersion(),
    ]);
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      success: true,
      latencyMs,
      health,
      version,
      rawJson: JSON.stringify({ health, version }, null, 2),
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error connecting to the Rust backend';
    return {
      success: false,
      latencyMs,
      error: errorMessage,
    };
  }
}

// Authentication Endpoints
export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    let msg = `Authentication failed (${response.status})`;
    if (errorData?.error && typeof errorData.error === 'object' && errorData.error.message) {
      msg = errorData.error.message;
    } else if (typeof errorData?.error === 'string') {
      msg = errorData.error;
    } else if (errorData?.message) {
      msg = errorData.message;
    }
    throw new Error(msg);
  }

  const data: LoginResponse = await response.json();
  setStoredToken(data.token);
  return data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to authenticate user (${response.status})`);
  }

  return response.json();
}

// Entity Tree Endpoints
export async function fetchEntities(): Promise<EntityTreeNode[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/entities`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to load entities (${response.status})`);
  }

  return response.json();
}

export async function createEntity(payload: CreateEntityPayload): Promise<EntityTreeNode> {
  const response = await fetch(`${API_BASE_URL}/api/v1/entities`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Failed to create entity' }));
    throw new Error(err.message || err.error || `Entity creation failed (${response.status})`);
  }

  return response.json();
}

// Users Endpoints
export async function fetchUsers(): Promise<UserSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch users (${response.status})`);
  }

  return response.json();
}
