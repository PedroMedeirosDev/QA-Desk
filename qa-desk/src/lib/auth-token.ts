/** Token JWT atual — atualizado pelo AuthProvider; usado em api.ts / run-progress. */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function authHeaders(extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return headers;
}
