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
| Credentials | `same-origin` by default; auth calls will use `include` for the httpOnly refresh cookie (D-079, Phase 2) |

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
| 401 | `unauthorized` | Refresh once (cookie, rotation), then retry; otherwise session expired → login (D-079) |
| 403 | `forbidden` | Permission message; never retried |
| 404 | `not_found` | Not-found state |
| 409 | `conflict` | "Changed by someone else" (concurrent approvals, D-069) |
| 422 | `validation_error` | As 400 with field errors |
| 429 | `rate_limited` | Retried by queries |
| 5xx | `server_error` | Generic message; retried by queries |

Messages from `ApiError` are shown to users, so the backend must keep `detail`/`message` user-safe (no stack traces, SQL or personal data). Mutations are never retried automatically; approvals and imports should accept an idempotency key (R-013, Proposed).

## 4. Authentication

**Confirmed (D-078, D-079):** JWT authentication. The **access token** lives only in memory; the **refresh token** is an **httpOnly, Secure, SameSite cookie** set by Django. Refresh tokens **rotate** on every refresh and the old one is blacklisted; logout blacklists the current one.
**Open:** password, invitation and session-timeout rules (Q-AUTH-01…04).

**Proposed** flow (endpoint names to be fixed with the backend in P2-T20):

| Step | Frontend | Backend |
|---|---|---|
| Login | `POST` login endpoint with credentials (`auth: false`, cookies included) | Returns the access token in the JSON body; sets the refresh token as an httpOnly cookie |
| Page reload | One refresh call (cookie) before showing protected routes | Returns a new access token and a rotated refresh cookie |
| API calls | `Authorization: Bearer <access>` | Validates the access token |
| Access token expired | On `401`: one shared refresh call (cookie), then retry once | Issues a new access token, rotates the refresh cookie, blacklists the old refresh token; rejects blacklisted/expired ones |
| Logout | `POST` logout endpoint (cookie), then **always** clear the in-memory token and query cache and go to login, even if the call fails | Blacklists the refresh token and clears the cookie |
| Refresh fails | `onSessionExpired()` → login with return path | — |

Backend requirements that follow from this design:

- Keep access-token lifetimes short: blacklisting covers refresh tokens, so an access token stays valid until it expires.
- Cookie: `HttpOnly`, `Secure` (except local HTTP development), `SameSite=Lax` or `Strict`, path limited to the auth endpoints where possible.
- The frontend (`localhost:5173`) and API (`localhost:8000`) are different origins: allow credentialed CORS for the exact frontend origin only (never `*`), and the frontend sends `credentials: 'include'` on refresh/logout/login.
- Protect refresh and logout against CSRF (Django CSRF token header and/or SameSite plus a custom header).
- With rotation, two browser tabs refreshing at once can race (the second uses a just-blacklisted token). The frontend will coordinate refreshes across tabs in Phase 2; a short grace period on the backend is an alternative to discuss.

Implemented hooks only:

- `Authorization: Bearer <access token>` is added when a token provider is installed.
- On `401`, the client calls one shared `refreshSession()` and retries the request once; if refresh fails, `onSessionExpired()` runs.
- Public endpoints (login, password reset, invitation) are called with `auth: false`: no token, no refresh.

**Proposed endpoints** (frontend implemented and tested in `features/authentication/api/auth.http.ts`, P2-T20). All are `POST` except `auth/me/`. Bodies are JSON; field names snake_case.

| Endpoint | Auth | Cookies | Request body | Success response | Errors the UI handles |
|---|---|---|---|---|---|
| `auth/login/` | none | include | `{ "email", "password" }` | `200 { "access": "<jwt>", "user": User }` + sets refresh cookie | `401` generic "Email or password is incorrect." (same for unknown email: no enumeration); `400` field errors |
| `auth/token/refresh/` | none | include | — (refresh token in cookie) | `200 { "access", "user" }` + rotated refresh cookie | `401/403` → signed out (also used on page reload) |
| `auth/logout/` | Bearer | include | — | `204`; blacklists the refresh token, clears the cookie | Any failure: the frontend still signs out locally |
| `auth/me/` (GET) | Bearer | — | — | `200 User` | `401` → refresh once, then session expired |
| `auth/password-reset/` | none | — | `{ "email" }` | `204` **always**, whether or not the account exists | `400` invalid email |
| `auth/password-reset/validate/` | none | — | `{ "token" }` | `200 { "status": "valid" \| "invalid" \| "expired" \| "used" }` | — |
| `auth/password-reset/confirm/` | none | — | `{ "token", "password" }` | `204` | `400` token no longer valid or password rejected (message shown) |
| `auth/invitations/validate/` | none | — | `{ "token" }` | `200 { "status", "email"? }` (`email` when valid) | — |
| `auth/invitations/accept/` | none | — | `{ "token", "password" }` | `204` (account activated) | `400` token no longer valid or password rejected |

`User`:

```json
{
  "id": 42,
  "email": "employee@formbaxhr.test",
  "first_name": "Ali",
  "last_name": "Demo",
  "role": "employee",
  "employee_code": "FBX-1006",
  "designation": "Software Engineer",
  "department": "Engineering"
}
```

`role` is one of `hr_admin`, `manager`, `senior_pm`, `associate_pm`, `team_lead`, `employee`; any other value (for example a Django superuser) is rejected by the frontend (D-041). `employee_code`, `designation`, `department` may be `null`.

Reset and invitation tokens are sent in request bodies (never in API URLs) so they do not end up in server access logs. Password rules shown in the UI are provisional (D-081, Q-AUTH-01); the backend's validators are authoritative and their messages are displayed.

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
| `health/` | GET | `HealthService.getStatus` | — (reference service; Phase 1 overview page removed in Phase 2) | Proposed |
| `auth/*` | see §4 | `AuthService.*` | Login, forgot/reset password, invitation, session restore, account menu | Proposed (implemented and tested) |
| `dashboard/hr/` | GET | `DashboardService.getHrDashboard` | HR dashboard | Proposed (implemented and tested) |
| `dashboard/manager/` | GET | `DashboardService.getManagerDashboard` | Manager dashboard | Proposed |
| `dashboard/senior-pm/` | GET | `DashboardService.getSeniorPmDashboard` | Senior PM dashboard | Proposed |
| `dashboard/associate-pm/` | GET | `DashboardService.getAssociatePmDashboard` | Associate PM dashboard | Proposed |
| `dashboard/team-lead/` | GET | `DashboardService.getTeamLeadDashboard` | Team Lead dashboard | Proposed |
| `dashboard/employee/` | GET | `DashboardService.getEmployeeDashboard` | Employee dashboard | Proposed |

`GET health/`: public (no auth). Response:

```json
{ "status": "ok", "checked_at": "2026-11-25T09:15:00+05:00" }
```

`status` is `"ok"` or `"degraded"`.

### Dashboards (P2-T12)

Each `GET dashboard/<role>/` returns data **already scoped by the backend** to the signed-in user (own team, own records, D-044); a user calling another role's endpoint should get `403`. The exact response shapes are the Zod schemas in `src/features/dashboard/schemas/dashboard.schema.ts` (written in camelCase; the API sends snake_case, converted automatically). Example (`dashboard/team-lead/`):

```json
{
  "team": [{ "id": "e-103", "name": "Mariam S.", "designation": "QA Engineer", "today_status": "present" }],
  "team_attendance": { "total": 4, "present": 2, "late": 0, "on_leave": 1, "not_checked_in": 1, "absent": 0 },
  "review_tasks": [
    {
      "id": "apr-review-2",
      "employee_name": "Mariam S.",
      "leave_type": "annual",
      "start_date": "2026-12-05",
      "end_date": "2026-12-07",
      "requested_days": 3,
      "stage": "review",
      "submitted_at": "2026-11-25T10:05:00+05:00"
    }
  ]
}
```

Vocabulary shared with later phases (`src/types/hr.ts`): `leave_type` ∈ `medical_sick`, `casual`, `annual`; leave `status` ∈ `draft`, `pending`, `under_review`, `pending_final_approval`, `approved`, `declined`, `cancelled`; `today_status` ∈ `present`, `late`, `on_leave`, `not_checked_in`, `absent`; approval `stage` ∈ `review`, `recommendation`, `final_approval`. Attendance counts (Late-In, absent) are computed by the backend in `Asia/Karachi`; "absent" is provisional until Q-ATT-02 is answered.

Further endpoints are added per phase: employees and organization (P3-T15), attendance (P4-T14), leave and approvals (P5-T18), notifications (P6-T10), imports (P7-T13), reports/settings/audit (P8-T20). The complete endpoint ↔ service ↔ screen table is finished in P9-T13.
