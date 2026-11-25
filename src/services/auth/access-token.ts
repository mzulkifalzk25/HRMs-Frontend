// In-memory access token holder (D-079). The access token is NEVER written to localStorage,
// sessionStorage or cookies by the frontend: an XSS bug then cannot read a stored token, and a
// page reload restores the session through the httpOnly refresh cookie instead.

let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function clearAccessToken(): void {
  accessToken = null
}
