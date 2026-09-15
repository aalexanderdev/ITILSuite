import type { HealthResponse, VersionResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

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
