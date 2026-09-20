import type {
  HealthResponse,
  VersionResponse,
  AuthUser,
  LoginResponse,
  EntityTreeNode,
  CreateEntityPayload,
  UserSummary,
  UserDetail,
  CreateUserPayload,
  UpdateUserPayload,
  BatchUserImportPayload,
  BatchUserImportResponse,
  GroupSummary,
  GroupDetail,
  CreateGroupPayload,
  UpdateGroupPayload,
  AddGroupMemberPayload,
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
  ConversationSummary,
  ChatMessage,
  MessageReactionSummary,
  ChatMember,
  OnlineUser,
  ChatDashboardMetrics,
  ChatSettings,
  ShortcutButton,
  ConvertToTicketPayload,
  ConvertToTicketResponse,
  RuleWithDetails,
  CreateRulePayload,
  UpdateRulePayload,
  DryRunRequest,
  DryRunResult,
  Calendar,
  CalendarSegment,
  CalendarHoliday,
  CalendarDetail,
  SlaSummary,
  SlaLevel,
  SlaDetail,
  CreateSlaPayload,
  UpdateSlaPayload,
  CreateSlaLevelPayload,
  UpdateSlaLevelPayload,
  CreateCalendarPayload,
  SlaSimulationRequest,
  SlaSimulationResponse,
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
export async function fetchUsers(filters?: {
  is_active?: boolean;
  group_id?: string;
  profile_id?: string;
  search?: string;
}): Promise<UserSummary[]> {
  const params = new URLSearchParams();
  if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
  if (filters?.group_id) params.append('group_id', filters.group_id);
  if (filters?.profile_id) params.append('profile_id', filters.profile_id);
  if (filters?.search) params.append('search', filters.search);

  const url = `${API_BASE_URL}/api/v1/users${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch users (${response.status})`);
  }

  return response.json();
}

export async function fetchUserById(id: string): Promise<UserDetail> {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch user (${response.status})`);
  }
  return response.json();
}

export async function createUser(payload: CreateUserPayload): Promise<UserDetail> {
  const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Error al crear usuario' }));
    throw new Error(err.message || `Error al crear usuario (${response.status})`);
  }
  return response.json();
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Error al actualizar usuario' }));
    throw new Error(err.message || `Error al actualizar usuario (${response.status})`);
  }
}

export async function deleteUser(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al eliminar usuario (${response.status})`);
  }
}

export async function batchImportUsers(payload: BatchUserImportPayload): Promise<BatchUserImportResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/batch-import`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Error en importación masiva' }));
    throw new Error(err.message || `Error en importación masiva (${response.status})`);
  }
  return response.json();
}

// Transversal Groups Endpoints (v0.0.6)
export async function fetchGroups(params?: { entity_id?: string; search?: string }): Promise<GroupSummary[]> {
  const q = new URLSearchParams();
  if (params?.entity_id) q.append('entity_id', params.entity_id);
  if (params?.search) q.append('search', params.search);

  const url = `${API_BASE_URL}/api/v1/groups${q.toString() ? `?${q.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch groups (${response.status})`);
  }
  return response.json();
}

export async function fetchGroupById(id: string): Promise<GroupDetail> {
  const response = await fetch(`${API_BASE_URL}/api/v1/groups/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch group details (${response.status})`);
  }
  return response.json();
}

export async function createGroup(payload: CreateGroupPayload): Promise<GroupSummary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/groups`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Error al crear grupo' }));
    throw new Error(err.message || `Error al crear grupo (${response.status})`);
  }
  return response.json();
}

export async function updateGroup(id: string, payload: UpdateGroupPayload): Promise<GroupSummary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/groups/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Error al actualizar grupo' }));
    throw new Error(err.message || `Error al actualizar grupo (${response.status})`);
  }
  return response.json();
}

export async function deleteGroup(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/groups/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al eliminar grupo (${response.status})`);
  }
}

export async function addGroupMember(groupId: string, payload: AddGroupMemberPayload): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/groups/${groupId}/members`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Error al agregar miembro' }));
    throw new Error(err.message || `Error al agregar miembro (${response.status})`);
  }
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al remover miembro (${response.status})`);
  }
}

export async function updateGroupMemberRole(groupId: string, userId: string, is_manager: boolean): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/groups/${groupId}/members/${userId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ is_manager }),
  });
  if (!response.ok) {
    throw new Error(`Error al actualizar rol de miembro (${response.status})`);
  }
}

// ITIL Service Desk (v0.0.3 Tickets)
export async function fetchTickets(filters?: TicketFilterOptions): Promise<TicketSummary[]> {
  const params = new URLSearchParams();
  if (filters?.entity_id) params.append('entity_id', filters.entity_id);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.ticket_type) params.append('ticket_type', filters.ticket_type);
  if (filters?.priority) params.append('priority', filters.priority.toString());
  if (filters?.assigned_to) params.append('assigned_to', filters.assigned_to);
  if (filters?.assigned_group_id) params.append('assigned_group_id', filters.assigned_group_id);
  if (filters?.sla_status) params.append('sla_status', filters.sla_status);
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
// Mail & Notification API Service
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

// ---------------------------------------------------------------------------
// HelpdeskChat & WebSocket Client Functions
// ---------------------------------------------------------------------------

export function getChatWsUrl(): string {
  const token = getStoredToken() || '';
  const httpUrl = new URL(API_BASE_URL);
  const wsProtocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${httpUrl.host}/api/v1/chat/ws?token=${encodeURIComponent(token)}`;
}

export async function fetchChatConversations(entityId?: string): Promise<ConversationSummary[]> {
  const query = entityId ? `?entity_id=${entityId}` : '';
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/conversations${query}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch conversations (${response.status})`);
  }
  return response.json();
}

export async function createChatConversation(payload: {
  name?: string;
  is_group?: boolean;
  participant_ids: string[];
  entity_id?: string;
}): Promise<ConversationSummary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/conversations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || `Failed to create conversation (${response.status})`);
  }
  return response.json();
}

export async function toggleChatFeatured(conversationId: string): Promise<{ is_featured: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/conversations/${conversationId}/featured`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to toggle featured (${response.status})`);
  }
  return response.json();
}

export async function fetchChatMessages(conversationId: string, limit = 100): Promise<ChatMessage[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/conversations/${conversationId}/messages?limit=${limit}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch messages (${response.status})`);
  }
  return response.json();
}

export async function sendChatMessage(
  conversationId: string,
  payload: {
    content: string;
    link_url?: string;
    attachment_name?: string;
    attachment_url?: string;
    attachment_size?: number;
    attachment_mime?: string;
  }
): Promise<ChatMessage> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || `Failed to send message (${response.status})`);
  }
  return response.json();
}

export async function toggleMessageReaction(
  messageId: string,
  emoji: string
): Promise<MessageReactionSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/messages/${messageId}/react`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ emoji }),
  });
  if (!response.ok) {
    throw new Error(`Failed to toggle reaction (${response.status})`);
  }
  return response.json();
}

export async function convertMessageToTicket(
  messageId: string,
  payload: ConvertToTicketPayload
): Promise<ConvertToTicketResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/messages/${messageId}/convert-to-ticket`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || `Failed to convert message to ticket (${response.status})`);
  }
  return response.json();
}

export async function sendPresenceHeartbeat(status = 'online'): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/chat/presence/heartbeat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  }).catch(() => {});
}

export async function fetchOnlineUsers(): Promise<OnlineUser[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/presence/online`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch online users (${response.status})`);
  }
  return response.json();
}

export async function fetchConversationMembers(conversationId: string): Promise<ChatMember[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/conversations/${conversationId}/members`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch members (${response.status})`);
  }
  return response.json();
}

export async function postChatTyping(conversationId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/chat/conversations/${conversationId}/typing`, {
    method: 'POST',
    headers: getAuthHeaders(),
  }).catch(() => {});
}

export async function fetchChatDashboardMetrics(): Promise<ChatDashboardMetrics> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/dashboard`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch chat dashboard metrics (${response.status})`);
  }
  return response.json();
}

export async function fetchChatSettings(): Promise<ChatSettings> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/settings`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch chat settings (${response.status})`);
  }
  return response.json();
}

export async function updateChatSettings(settings: ChatSettings): Promise<ChatSettings> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/settings`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    throw new Error(`Failed to update chat settings (${response.status})`);
  }
  return response.json();
}

export async function fetchChatShortcuts(): Promise<ShortcutButton[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/shortcuts`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch chat shortcuts (${response.status})`);
  }
  return response.json();
}

export function getChatMessagesExportCsvUrl(): string {
  return `${API_BASE_URL}/api/v1/chat/dashboard/export`;
}

// ==========================================
// Business Rules & Dictionaries Engine API
// ==========================================

export async function fetchRules(ruleType?: string, entityId?: string): Promise<RuleWithDetails[]> {
  const params = new URLSearchParams();
  if (ruleType) params.append('rule_type', ruleType);
  if (entityId) params.append('entity_id', entityId);

  const url = `${API_BASE_URL}/api/v1/rules${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch rules (${response.status})`);
  }
  return response.json();
}

export async function fetchRule(id: string): Promise<RuleWithDetails> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rules/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch rule (${response.status})`);
  }
  return response.json();
}

export async function createRule(payload: CreateRulePayload): Promise<RuleWithDetails> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rules`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Failed to create rule (${response.status})`);
  }
  return response.json();
}

export async function updateRule(id: string, payload: UpdateRulePayload): Promise<RuleWithDetails> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rules/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Failed to update rule (${response.status})`);
  }
  return response.json();
}

export async function deleteRule(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rules/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete rule (${response.status})`);
  }
}

export async function reorderRules(rules: { id: string; ranking: number }[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rules/reorder`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ rules }),
  });
  if (!response.ok) {
    throw new Error(`Failed to reorder rules (${response.status})`);
  }
}

export async function dryRunRules(payload: DryRunRequest): Promise<DryRunResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rules/dry-run`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Failed to execute dry-run (${response.status})`);
  }
  return response.json();
}

// ============================================================================
// SLA Engine & Business Calendars API (v0.0.7)
// ============================================================================

export async function fetchSlas(): Promise<SlaSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/slas`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al consultar perfiles SLA (${response.status})`);
  }
  return response.json();
}

export async function fetchSlaById(id: string): Promise<SlaDetail> {
  const response = await fetch(`${API_BASE_URL}/api/v1/slas/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al consultar detalle de SLA (${response.status})`);
  }
  return response.json();
}

export async function createSla(payload: CreateSlaPayload): Promise<SlaSummary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/slas`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || err?.error || `Error al crear perfil SLA (${response.status})`);
  }
  return response.json();
}

export async function updateSla(id: string, payload: UpdateSlaPayload): Promise<SlaSummary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/slas/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || err?.error || `Error al actualizar perfil SLA (${response.status})`);
  }
  return response.json();
}

export async function deleteSla(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/slas/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al eliminar SLA (${response.status})`);
  }
}

export async function fetchSlaLevels(slaId: string): Promise<SlaLevel[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/slas/${slaId}/levels`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al consultar niveles de escalamiento (${response.status})`);
  }
  return response.json();
}

export async function createSlaLevel(slaId: string, payload: CreateSlaLevelPayload): Promise<SlaLevel> {
  const response = await fetch(`${API_BASE_URL}/api/v1/slas/${slaId}/levels`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || err?.error || `Error al crear regla de escalamiento (${response.status})`);
  }
  return response.json();
}

export async function updateSlaLevel(slaId: string, levelId: string, payload: UpdateSlaLevelPayload): Promise<SlaLevel> {
  const response = await fetch(`${API_BASE_URL}/api/v1/slas/${slaId}/levels/${levelId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || err?.error || `Error al actualizar regla de escalamiento (${response.status})`);
  }
  return response.json();
}

export async function deleteSlaLevel(slaId: string, levelId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/slas/${slaId}/levels/${levelId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al eliminar nivel de escalamiento (${response.status})`);
  }
}

export async function fetchCalendars(): Promise<Calendar[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calendars`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al consultar calendarios laborales (${response.status})`);
  }
  return response.json();
}

export async function fetchCalendarById(id: string): Promise<CalendarDetail> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calendars/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al consultar detalle de calendario (${response.status})`);
  }
  return response.json();
}

export async function createCalendar(payload: CreateCalendarPayload): Promise<CalendarDetail> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calendars`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || err?.error || `Error al crear calendario (${response.status})`);
  }
  return response.json();
}

export async function updateCalendar(id: string, payload: Partial<Calendar>): Promise<Calendar> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calendars/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || err?.error || `Error al actualizar calendario (${response.status})`);
  }
  return response.json();
}

export async function deleteCalendar(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calendars/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al eliminar calendario (${response.status})`);
  }
}

export async function saveCalendarSegments(
  calendarId: string,
  segments: Array<{ day_of_week: number; start_time: string; end_time: string }>
): Promise<CalendarSegment[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calendars/${calendarId}/segments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(segments),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || err?.error || `Error al guardar franjas horarias (${response.status})`);
  }
  return response.json();
}

export async function addCalendarHoliday(
  calendarId: string,
  payload: { name: string; holiday_date: string }
): Promise<CalendarHoliday> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calendars/${calendarId}/holidays`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || err?.error || `Error al registrar día festivo (${response.status})`);
  }
  return response.json();
}

export async function deleteCalendarHoliday(calendarId: string, holidayId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calendars/${calendarId}/holidays/${holidayId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error al eliminar día festivo (${response.status})`);
  }
}

export async function simulateSlaDeadlines(payload: SlaSimulationRequest): Promise<SlaSimulationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/slas/simulate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || err?.error || `Error en simulación SLA (${response.status})`);
  }
  return response.json();
}

