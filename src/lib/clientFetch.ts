/**
 * Browser fetch for same-origin /api calls. Ensures the session cookie is sent
 * (some environments are stricter about default credentials).
 */
export function clientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? "include",
  });
}
