# FormbaxHR — API Integration Guide

> Contract between this frontend and the future Django 5.2 + DRF backend (D-021, D-030, D-031).
> Created in P1-T17 (2026-11-25) as a **skeleton**: sections are filled as each phase defines its endpoints.
> Status labels: **Implemented** (frontend code exists and is tested), **Proposed** (frontend expectation; the backend must confirm), **Open** (blocked by a question in `docs/DECISIONS.md`).
> Nothing here describes a running backend: none exists yet.

---

## 1. Base URL and environment

| Variable | Default (development) | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | http(s) only; trailing slashes are removed. All paths below are relative to it. |
| `VITE_USE_MOCK_API` | `true` | `true` uses mock services; `false` calls the API. Production builds require both variables (D-076). |

**Implemented**: `src/lib/env.ts`, `src/services/api/http-client.ts`.

- Paths are relative and end with a slash (DRF convention), e.g. `employees/`, `leaves/42/approve/`.
- The client refuses absolute URLs, so auth headers are never sent to another origin.
- Requests time out after 20 s by default; callers can cancel via `AbortSignal`.

## 2. Requests and responses

**Implemented** in the HTTP client:

| Aspect | Behaviour |
|---|---|
| Request headers | `Accept: application/json`; `Content-Type: application/json` when a JSON body is sent |
| File uploads | `multipart/form-data` via `FormData` (content type set by the browser) |
| Empty responses | `204`/`205` or an empty body → `undefined` |
| Response validation | Each service validates responses with a Zod schema; a mismatch becomes `invalid_response` |
| Credentials | `same-origin` by default (may change with Q-TECH-01) |

**Proposed** conventions for the backend:

- JSON field names in `snake_case` (DRF default). Services map them to `camelCase` types.
- Timestamps: ISO 8601 **with an explicit offset** (`2026-11-25T09:15:00+05:00` or `...Z`). Strings without an offset are rejected by the frontend.
- Dates without time: `YYYY-MM-DD`.
- Attendance and leave calculations are done by the backend in `Asia/Karachi` (D-028); the frontend only displays and previews.
- IDs: opaque strings or integers; the frontend never derives meaning from them.

## 3. Errors

**Implemented**: every failure becomes an `ApiError` (`src/services/api/api-error.ts`) with `status`, `code`, `message`, `fieldErrors`. The client understands these response bodies:

```json
{ "detail": "You do not have permission to perform this action." }
```

```json
{ "email": ["Enter a valid email address."], "non_field_errors": ["End date must be after start date."] }
```

**Proposed** envelope for custom errors (optional; the client supports both):

```json
{ "error": { "code": "already_decided", "message": "This request was already approved.", "fields": {} } }
```

| Status | Frontend `code` (unless the body provides one) | Frontend behaviour |
|---|---|---|
| 0 | `network_error` / `timeout` / `aborted` | Retry allowed for network/timeout; aborted is silent |
| 400 | `bad_request`, or `validation_error` when field errors are present | Field errors shown next to inputs |
| 401 | `unauthorized` | Refresh once, then retry; otherwise session expired (Open: Q-TECH-01) |
| 403 | `forbidden` | Permission message; never retried |
| 404 | `not_found` | Not-found state |
| 409 | `conflict` | "Changed by someone else" (concurrent approvals, D-069) |
| 422 | `validation_error` | As 400 with field errors |
| 429 | `rate_limited` | Retried by queries |
| 5xx | `server_error` | Generic message; retried by queries |

Messages from `ApiError` are shown to users, so the backend must keep `detail`/`message` user-safe (no stack traces, SQL or personal data). Mutations are never retried automatically; approvals and imports should accept an idempotency key (R-013, Proposed).

## 4. Authentication

**Open** (Q-TECH-01 token storage and refresh, Q-AUTH-*). Implemented hooks only:

- `Authorization: Bearer <access token>` is added when a token provider is installed.
- On `401`, the client calls one shared `refreshSession()` and retries the request once; if refresh fails, `onSessionExpired()` runs.
- Public endpoints (login, password reset, invitation) are called with `auth: false`: no token, no refresh.

Endpoints, token lifetimes and cookie settings are documented in Phase 2 (P2-T20).

## 5. Pagination, filtering and sorting

**Proposed** (DRF `PageNumberPagination` style, to be confirmed in Phase 3):

```http
GET employees/?page=2&page_size=25&search=demo&department=eng&status=active&status=on_leave&ordering=-joining_date
```

```json
{ "count": 132, "next": "…?page=3", "previous": "…?page=1", "results": [] }
```

- Repeated keys for multi-value filters (`status=active&status=on_leave`); the client already serializes arrays this way and drops empty values. **Implemented** (query serialization).
- `ordering` uses DRF syntax (`-field` for descending).

## 6. Endpoints

| Endpoint | Method | Service method | Used by | Status |
|---|---|---|---|---|
| `health/` | GET | `HealthService.getStatus` | Overview page (system status) | Proposed (frontend implemented and tested against this contract) |

`GET health/`: public (no auth). Response:

```json
{ "status": "ok", "checked_at": "2026-11-25T09:15:00+05:00" }
```

`status` is `"ok"` or `"degraded"`.

Further endpoints are added per phase: authentication (P2-T20), employees and organization (P3-T15), attendance (P4-T14), leave and approvals (P5-T18), notifications (P6-T10), imports (P7-T13), reports/settings/audit (P8-T20). The complete endpoint ↔ service ↔ screen table is finished in P9-T13.
