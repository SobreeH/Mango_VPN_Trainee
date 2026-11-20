function normalizeUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim().replace(/\/+$/, '');
  return trimmed ? trimmed : undefined;
}

export function getApiBaseUrl(): string {
  const runtimeUrl =
    typeof window !== 'undefined'
      ? normalizeUrl(window.__MANGO_ENV__?.VITE_API_URL)
      : undefined;
  const buildUrl = normalizeUrl(import.meta.env.VITE_API_URL as string | undefined);
  return runtimeUrl ?? buildUrl ?? 'http://localhost:4000';
}

export function getAgentBaseUrl(): string {
  const runtimeUrl =
    typeof window !== 'undefined'
      ? normalizeUrl(window.__MANGO_ENV__?.VITE_AGENT_URL)
      : undefined;
  const buildUrl = normalizeUrl(import.meta.env.VITE_AGENT_URL as string | undefined);
  return runtimeUrl ?? buildUrl ?? 'http://127.0.0.1:47821';
}
