import type {
  HealthResponse,
  VersionResponse,
  AuthUser,
  LoginResponse,
  EntityTreeNode,
  CreateEntityPayload,
  UserSummary,
  TicketSummary,
  TicketDetail,
  CreateTicketPayload,
  UpdateTicketPayload,
  CreateFollowupPayload,
  TicketFollowup,
  TicketMetrics,
  TicketFilterOptions,
  TicketTemplate,
  CreateTicketTemplatePayload,
  MailSettings,
  UpdateMailSettingsDto,
  NotificationTemplate,
  UpdateNotificationTemplateDto,
  NotificationEvent,
  NotificationQueueItem,
  MailReceiver,
  CreateMailReceiverDto,
  UpdateMailReceiverDto,
  MailBlacklist,
  CreateBlacklistDto,
  SimulateIncomingMailDto,
  CollectResultDto,
  AssetSummary,
  AssetDetail,
  AssetMetrics,
  CreateAssetPayload,
  UpdateAssetPayload,
  AgentSimulationRequest,
  AgentSimulationResponse,
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

// ITIL Service Desk (v0.0.3 Tickets)
export async function fetchTickets(filters?: TicketFilterOptions): Promise<TicketSummary[]> {
  const params = new URLSearchParams();
  if (filters?.entity_id) params.append('entity_id', filters.entity_id);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.ticket_type) params.append('ticket_type', filters.ticket_type);
  if (filters?.priority) params.append('priority', filters.priority.toString());
  if (filters?.assigned_to) params.append('assigned_to', filters.assigned_to);
  if (filters?.search) params.append('search', filters.search);

  const url = `${API_BASE_URL}/api/v1/tickets${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tickets (${response.status})`);
  }

  return response.json();
}

export async function fetchTicketById(id: string): Promise<TicketDetail> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ticket details (${response.status})`);
  }

  return response.json();
}

export async function createTicket(payload: CreateTicketPayload): Promise<TicketSummary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || errorData?.message || `Failed to create ticket (${response.status})`);
  }

  return response.json();
}

export async function updateTicket(id: string, payload: UpdateTicketPayload): Promise<TicketSummary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || errorData?.message || `Failed to update ticket (${response.status})`);
  }

  return response.json();
}

export async function addTicketFollowup(
  ticketId: string,
  payload: CreateFollowupPayload
): Promise<TicketFollowup> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/${ticketId}/followups`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || errorData?.message || `Failed to add followup (${response.status})`);
  }

  return response.json();
}

export async function fetchTicketMetrics(): Promise<TicketMetrics> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/metrics`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ticket metrics (${response.status})`);
  }

  return response.json();
}

// ITIL Ticket Templates (Inspired by GLPI)
export async function fetchTicketTemplates(filters?: {
  entity_id?: string;
  category?: string;
  ticket_type?: string;
}): Promise<TicketTemplate[]> {
  const params = new URLSearchParams();
  if (filters?.entity_id) params.append('entity_id', filters.entity_id);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.ticket_type) params.append('ticket_type', filters.ticket_type);

  const url = `${API_BASE_URL}/api/v1/ticket-templates${
    params.toString() ? `?${params.toString()}` : ''
  }`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ticket templates (${response.status})`);
  }

  return response.json();
}

export async function fetchTicketTemplateById(id: string): Promise<TicketTemplate> {
  const response = await fetch(`${API_BASE_URL}/api/v1/ticket-templates/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ticket template (${response.status})`);
  }

  return response.json();
}

export async function createTicketTemplate(
  payload: CreateTicketTemplatePayload
): Promise<TicketTemplate> {
  const response = await fetch(`${API_BASE_URL}/api/v1/ticket-templates`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error?.message || errorData?.message || `Failed to create template (${response.status})`
    );
  }

  return response.json();
}

// ==========================================
// Mail & Notification API Service (GLPI 11 Inspired)
// ==========================================

export async function fetchMailSettings(): Promise<MailSettings> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mail/settings`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch mail settings (${response.status})`);
  }
  return response.json();
}

export async function updateMailSettings(dto: UpdateMailSettingsDto): Promise<MailSettings> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mail/settings`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to update mail settings (${response.status})`);
  }
  return response.json();
}

export async function testSmtpConnection(dto: {
  to_email: string;
  custom_smtp_host?: string;
  custom_smtp_port?: number;
}): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mail/test-smtp`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `SMTP Test failed (${response.status})`);
  }
  return response.json();
}

export async function fetchNotificationQueue(status?: string): Promise<NotificationQueueItem[]> {
  const url = `${API_BASE_URL}/api/v1/mail/queue${status ? `?status=${encodeURIComponent(status)}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch notification queue (${response.status})`);
  }
  return response.json();
}

export async function retryNotificationQueueItem(id: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mail/queue/${id}/retry`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to retry queue item (${response.status})`);
  }
  return response.json();
}

export async function processNotificationQueueNow(): Promise<{
  status: string;
  processed_count: number;
  message: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/v1/mail/queue/process`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to process queue (${response.status})`);
  }
  return response.json();
}

export async function fetchNotificationTemplates(): Promise<NotificationTemplate[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications/templates`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch notification templates (${response.status})`);
  }
  return response.json();
}

export async function fetchNotificationTemplateById(id: string): Promise<NotificationTemplate> {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications/templates/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch template (${response.status})`);
  }
  return response.json();
}

export async function updateNotificationTemplate(
  id: string,
  dto: UpdateNotificationTemplateDto
): Promise<NotificationTemplate> {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications/templates/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to update template (${response.status})`);
  }
  return response.json();
}

export async function fetchNotificationEvents(): Promise<NotificationEvent[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications/events`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch notification events (${response.status})`);
  }
  return response.json();
}

export async function fetchMailReceivers(): Promise<MailReceiver[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/receivers`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch mail receivers (${response.status})`);
  }
  return response.json();
}

export async function fetchMailReceiverById(id: string): Promise<MailReceiver> {
  const response = await fetch(`${API_BASE_URL}/api/v1/receivers/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch mail receiver (${response.status})`);
  }
  return response.json();
}

export async function createMailReceiver(dto: CreateMailReceiverDto): Promise<MailReceiver> {
  const response = await fetch(`${API_BASE_URL}/api/v1/receivers`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to create receiver (${response.status})`);
  }
  return response.json();
}

export async function updateMailReceiver(id: string, dto: UpdateMailReceiverDto): Promise<MailReceiver> {
  const response = await fetch(`${API_BASE_URL}/api/v1/receivers/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to update receiver (${response.status})`);
  }
  return response.json();
}

export async function deleteMailReceiver(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/receivers/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete receiver (${response.status})`);
  }
}

export async function collectFromReceiver(id: string): Promise<CollectResultDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/receivers/${id}/collect`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to collect emails (${response.status})`);
  }
  return response.json();
}

export async function fetchMailBlacklists(): Promise<MailBlacklist[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/receivers/blacklists`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch blacklist rules (${response.status})`);
  }
  return response.json();
}

export async function createMailBlacklist(dto: CreateBlacklistDto): Promise<MailBlacklist> {
  const response = await fetch(`${API_BASE_URL}/api/v1/receivers/blacklists`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to create blacklist rule (${response.status})`);
  }
  return response.json();
}

export async function deleteMailBlacklist(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/receivers/blacklists/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete blacklist rule (${response.status})`);
  }
}

export async function simulateIncomingMail(dto: SimulateIncomingMailDto): Promise<{ status: string; result: any }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/receivers/simulate-incoming`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to simulate incoming mail (${response.status})`);
  }
  return response.json();
}

// ----------------------------------------------------
// ITAM / CMDB Asset Management Endpoints (v0.0.4)
// ----------------------------------------------------

export async function fetchAssets(filter?: {
  entity_id?: string;
  asset_type?: string;
  status?: string;
  search?: string;
}): Promise<AssetSummary[]> {
  const params = new URLSearchParams();
  if (filter?.entity_id) params.append('entity_id', filter.entity_id);
  if (filter?.asset_type && filter.asset_type !== 'all') params.append('asset_type', filter.asset_type);
  if (filter?.status && filter.status !== 'all') params.append('status', filter.status);
  if (filter?.search) params.append('search', filter.search);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/api/v1/assets${queryString}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch assets (${response.status})`);
  }
  return response.json();
}

export async function fetchAssetMetrics(): Promise<AssetMetrics> {
  const response = await fetch(`${API_BASE_URL}/api/v1/assets/metrics`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch asset metrics (${response.status})`);
  }
  return response.json();
}

export async function fetchAssetById(id: string): Promise<AssetDetail> {
  const response = await fetch(`${API_BASE_URL}/api/v1/assets/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to fetch asset details (${response.status})`);
  }
  return response.json();
}

export async function createAsset(payload: CreateAssetPayload): Promise<AssetSummary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/assets`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to create asset (${response.status})`);
  }
  return response.json();
}

export async function updateAsset(id: string, payload: UpdateAssetPayload): Promise<AssetSummary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/assets/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to update asset (${response.status})`);
  }
  return response.json();
}

export async function deleteAsset(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/assets/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete asset (${response.status})`);
  }
}

export async function simulateAgentInventory(
  req: AgentSimulationRequest
): Promise<AgentSimulationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory/agent/simulate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || err?.message || `Failed to simulate GLPI-Agent (${response.status})`);
  }
  return response.json();
}




