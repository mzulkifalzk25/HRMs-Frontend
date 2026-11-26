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
| `employees/` | GET, POST | `EmployeeService.list`, `.create` | Employee directory, Add employee | Proposed (implemented and tested) |
| `employees/{id}/` | GET, PATCH | `EmployeeService.get`, `.update` | Employee profile, Edit employee | Proposed |
| `employees/{id}/deactivate/`, `employees/{id}/activate/` | POST | `EmployeeService.deactivate`, `.activate` | Employee profile (HR) | Proposed |
| `employees/reporting-lines/` | GET | `OrganizationService.listReportingLines` | Org chart, manager pickers, profile names | Proposed |
| `departments/`, `designations/`, `teams/`, `projects/` (+ `{id}/`) | GET, POST, PATCH | `OrganizationService.*` | Organization page, filters, forms | Proposed |

`GET health/`: public (no auth). Response:

```json
{ "status": "ok", "checked_at": "2026-11-25T09:15:00+05:00" }
```

`status` is `"ok"` or `"degraded"`.

### Employees and organization (Phase 3)

**Scope (enforced by the backend, D-044, D-085):** HR sees everyone; a Manager their direct and indirect reports; a Team Lead their teams; a Senior/Associate PM the teams and members of their projects; an Employee has no directory (`403` on `GET employees/`) and may read only their own record. A record outside the caller's scope answers **`404`**, not `403`, so its existence is not revealed. All writes are HR-only (`403` otherwise).

`GET employees/` query parameters: `page`, `page_size` (10/25/50), `search` (name, email, employee code), `department`, `team`, `role`, `status` (`invited`/`active`/`inactive`), `manager` (direct reports of that id), `ordering` (`last_name`, `joining_date`, `employee_code`, with `-` for descending). Response: DRF page (§5) of list items:

```json
{
  "id": "e-103",
  "employee_code": "FBX-1009",
  "first_name": "Bilal",
  "last_name": "Rana",
  "email": "bilal.rana@formbaxhr.test",
  "role": "employee",
  "status": "active",
  "department_name": "Engineering",
  "designation_title": "Senior Software Engineer",
  "manager_names": ["Imran Demo", "Farah Demo"],
  "joining_date": "2020-10-12"
}
```

`GET employees/{id}/` (and the response of POST/PATCH/activate/deactivate):

```json
{
  "id": "e-103",
  "employee_code": "FBX-1009",
  "first_name": "Bilal",
  "last_name": "Rana",
  "email": "bilal.rana@formbaxhr.test",
  "phone": null,
  "role": "employee",
  "department_id": "d-eng",
  "designation_id": "g-sse",
  "joining_date": "2020-10-12",
  "status": "active",
  "manager_ids": ["u-mgr-001", "u-spm-001"],
  "team_ids": ["t-fe"],
  "project_ids": ["p-portal", "p-mobile"],
  "deactivation_reason": null
}
```

- **Create** (`POST employees/`): body has the fields above except `id`, `employee_code`, `status`, `deactivation_reason`. The backend assigns `employee_code` (provisional, Q-ORG-01), sets `status: "invited"` and emails an invitation (P2-T06 flow). No password is sent.
- **Update** (`PATCH employees/{id}/`): **only changed fields** are sent (the backend records before/after in the audit log). Lists (`manager_ids`, `team_ids`, `project_ids`) replace the whole list.
- **Deactivate** (`POST employees/{id}/deactivate/` with `{ "reason": "…" }`): reason required (provisional, Q-ORG-03). **Activate** (`POST …/activate/`): back to `active`, or `invited` if the person never activated. Nothing is deleted.
- **Validation errors** (`400`, DRF field errors) the UI shows in place: `email` (already exists), `department_id` / `designation_id` (must be active), `manager_ids` (inactive manager, self-reporting, or **reporting loop**, e.g. `"This would create a reporting loop: A → B → A."`), `team_ids`, `project_ids`, `role` (HR cannot change their own role, provisional Q-ORG-05). Changing your own status is refused.

`GET employees/reporting-lines/` (all signed-in roles, provisional): `[{ "id", "name", "designation", "department_name", "role", "status", "manager_ids" }]` for the org chart and pickers.

Organization resources (`departments/`, `designations/`, `teams/`, `projects/`): `GET` lists all (with `headcount` for departments/designations, `member_ids` for teams); `POST` creates; `PATCH {id}/` updates, and `PATCH {id}/ { "status": "inactive" }` deactivates (never delete). Rules the UI relies on: names/codes unique (`400` on `name`/`title`/`code`); teams have `department_id`, optional `team_lead_id`, and `member_ids` set as a whole list (updates each employee's teams); projects have `code`, optional `senior_pm_id` / `associate_pm_id` (must hold those roles, `400` otherwise) and `team_ids`.

### Attendance (Phase 4)

**The backend is authoritative** for the check-in/out instant (server clock), the Karachi calendar date, `check_in_status`, `check_out_status` and `duration_ms`, all computed in `Asia/Karachi` (D-050, plan D2). The frontend only displays them; its pure policy (`features/attendance/lib/policy.ts`) is used for live previews and tests. Instants are ISO 8601 with offset and millisecond precision; nothing is rounded and no break is deducted. Provisional rules: D-086 (Q-ATT-01…07).

Record (all endpoints below return this shape):

```json
{
  "id": "att-e-103-2026-11-24",
  "employee_id": "e-103",
  "employee_name": "Bilal Rana",
  "department_name": "Engineering",
  "date": "2026-11-24",
  "check_in_at": "2026-11-24T09:06:46.000+05:00",
  "check_out_at": "2026-11-24T18:39:37.000+05:00",
  "check_in_status": "on_time",
  "check_out_status": "within_window",
  "duration_ms": 34371000,
  "corrected": false
}
```

`check_in_status` ∈ `early` (before 09:00:00), `on_time` (09:00:00–09:15:00.000 inclusive), `late` (Late-In, from 09:15:00.001; tracking only). `check_out_status` ∈ `within_window` (from 17:45:00) or `before_window` (earlier; **no penalty**, policy open Q-ATT-01). `check_out_at`, `check_out_status` and `duration_ms` are `null` while the session is open; an open session from an earlier day is shown as "Missing check-out" (never auto-closed, Q-ATT-06).

| Method and path | Who | Notes |
|---|---|---|
| `GET attendance/me/today/` | everyone | `{ "date": "2026-11-25", "record": <record> \| null }` |
| `POST attendance/me/check-in/` | everyone | No body (the server takes the time). `409` `already_checked_in` if today has a record (one session per day, Q-ATT-03) |
| `POST attendance/me/check-out/` | everyone | No body. `400` `not_checked_in`; `409` `already_checked_out` |
| `GET attendance/me/?from=&to=` | everyone | Own records, newest first, dates inclusive (`YYYY-MM-DD`, Karachi) |
| `GET attendance/?from=&to=&page=&page_size=&employee=&department=&team=&filter=` | HR, Manager, Team Lead, Senior/Associate PM | DRF page (§5) within the caller's directory scope (D-085); Employee `403`. `filter` ∈ `late`, `incomplete`, `corrected`. Page sizes 25/50/100; CSV export asks for up to 5,000 |
| `GET attendance/{id}/` | in scope | `404` outside scope |
| `POST attendance/{id}/corrections/` | HR only (`403` otherwise) | `{ "check_in_at", "check_out_at", "reason" }`; reason required (min. 5 characters), times on the record's date, check-out after check-in (`400` field errors on `reason`, `check_in_at`, `check_out_at`). Returns the updated record with `corrected: true` |
| `GET attendance/{id}/corrections/` | in scope | Audit entries, newest first: `{ "id", "record_id", "actor_name", "at", "reason", "before": { "check_in_at", "check_out_at" }, "after": { … } }` |
| `GET attendance/summary/` | everyone (scoped) | Today in the caller's scope: `{ "date", "total", "present", "late", "on_leave", "not_checked_in", "absent", "incomplete" }`. `absent` is the backend's number (provisional, Q-ATT-02; 0 in mock mode); `incomplete` counts earlier open sessions |

Backend notes for the user's own implementation (not specified further here, D-080): one record per employee and date (unique), indexed on employee/date; corrections stored as an append-only audit table.

### Leave and approvals (Phase 5)

**The backend is authoritative** for routing, the workflow, balances, the ledger and every rule (D-027). Rules: D-060…D-069, D-088, D-089 (confirmed), D-090 (provisional), conventions D-091. Durations count Monday–Friday without public holidays, whole days only. A request may not exceed the remaining balance, may not overlap the requester's own pending or approved leave, and may be backdated (`backdated: true`). It must stay inside one leave year (calendar year, provisional).

Request detail (`GET leave/requests/{id}/` and the response of every write):

```json
{
  "id": "lr-41",
  "employee_id": "e-101",
  "employee_name": "Hamza Kareem",
  "department_name": "Engineering",
  "leave_type": "annual",
  "start_date": "2026-12-02",
  "end_date": "2026-12-04",
  "requested_days": 3,
  "reason": "Family trip planned in advance.",
  "status": "under_review",
  "backdated": false,
  "attachment": { "name": "ticket.pdf", "size": 48213, "content_type": "application/pdf" },
  "submitted_at": "2026-11-24T10:15:00.000+05:00",
  "version": 1,
  "routed_to": "managers",
  "steps": [
    { "id": "review", "kind": "review", "mode": "parallel", "completion": "all", "required": false, "assignee_ids": ["u-tl-001", "u-apm-001"] },
    { "id": "decision", "kind": "decision", "mode": "parallel", "completion": "any", "required": true, "assignee_ids": ["u-mgr-001"] }
  ],
  "participants": [
    { "employee_id": "u-mgr-001", "name": "Imran Demo", "kind": "decision_maker", "mandatory": false },
    { "employee_id": "u-tl-001", "name": "Zainab Demo", "kind": "reviewer", "mandatory": false },
    { "employee_id": "u-hr-001", "name": "Sana Demo", "kind": "recipient", "mandatory": true }
  ],
  "actions": [
    { "id": "act-77", "step_id": "review", "actor_id": "u-tl-001", "actor_name": "Zainab Demo", "kind": "recommend_approve", "comment": "Coverage arranged with the team.", "at": "2026-11-25T11:30:00.000+05:00" }
  ],
  "allowed_actions": ["approve", "decline", "comment"]
}
```

- `routed_to` ∈ `managers` (employee / Team Lead with active managers), `hr` (no manager, Manager, Senior PM, HR Administrator → another HR Administrator, Associate PM without a Senior PM), `senior_pm` (Associate PM). Nobody decides or reviews their own request.
- `steps`: `kind` ∈ `review`, `decision`; `mode` ∈ `parallel`, `sequential`; `completion` ∈ `any`, `all` (parallel only; sequential means in order, each must approve). Default: optional review by the Team Lead and Associate PM, then a decision where **any one** selected manager decides.
- `participants.kind` ∈ `decision_maker`, `reviewer`, `recipient`; HR Administrators are recipients with `mandatory: true` and cannot be removed.
- `actions.kind` ∈ `approve`, `decline`, `recommend_approve`, `recommend_decline`, `comment`, `override_approve`, `override_decline`, `cancel`. `allowed_actions` are what the caller may do now; the UI shows exactly these.
- `status` is derived: `pending` → `under_review` (recommendations/comments) → `pending_final_approval` (only with an `all` or sequential rule, partly approved) → `approved` / `declined` / `cancelled`.

| Method and path | Who | Notes |
|---|---|---|
| `GET leave/balances/?year=&employee=` | everyone; other employees HR only (`403`) | `[{ "leave_type", "allocated", "used", "remaining" }]` for the three types |
| `GET leave/ledger/?year=&employee=` | same | Newest first: `{ "id", "employee_id", "leave_type", "year", "kind", "days", "reason", "actor_name", "at", "request_id" }`; `kind` ∈ `allocation`, `adjustment` (signed `days`), `deduction`, `reversal`. Append-only |
| `POST leave/allocations/` | HR only | `{ "employee_id", "leave_type", "year", "days", "reason" }` → ledger entry. `400` on `days` (0, not whole, or below what is used) and `reason` (min. 5) |
| `GET leave/route/?manager=…` | everyone | Preview for the caller: `{ "routed_to", "manager_choices": [{ "id", "name" }], "participants", "problem" }`. `manager` may repeat; omitted = all managers. `problem` is set when nobody could decide |
| `GET leave/requests/me/` | everyone | Own requests (list shape: the detail without `version`, `routed_to`, `steps`, `participants`, `actions`, `allowed_actions`), newest first |
| `POST leave/requests/` | everyone | **multipart**: `leave_type`, `start_date`, `end_date`, `requested_days`, `reason`, `manager_ids` (repeated; only when routed to managers), optional `attachment` (PDF/JPG/PNG ≤ 5 MB). `400` field errors on any of these (dates, no working days, mismatching duration, overlap on `start_date`, balance on `leave_type`, managers, attachment); `400` `no_approver` when nobody could decide |
| `GET leave/requests/?page=&page_size=&status=&leave_type=&department=&employee=&from=&to=` | everyone except Employee (`403`) | DRF page of list items within scope (directory scope D-085, plus requests you take part in; HR all). `from`/`to` select requests overlapping the range |
| `GET leave/requests/{id}/` | requester, participants, scope, HR | `404` otherwise |
| `POST leave/requests/{id}/actions/` | per `allowed_actions` | `{ "action", "comment", "version" }`. `decline`, `override_*` and `comment` need a comment (min. 5). `409` `conflict` (stale version), `409` `already_decided`, `409` `insufficient_balance`; `403` when not allowed |
| `POST leave/requests/{id}/cancel/` | requester | `{ "reason", "version" }`. Pending: always; approved: until the day before the start, days returned by a `reversal`. `409` `cannot_cancel` |
| `GET leave/approvals/?tab=pending\|history` | everyone | List items plus `stage` ∈ `final_approval`, `recommendation`, `review`: pending = waiting for the caller's decision or recommendation (oldest first); history = requests the caller acted on |
| `GET leave/summary/` | everyone (scoped) | `{ "pending", "approved_this_month", "on_leave_today" }` |

Backend notes for the user's own implementation (D-080, D-069): decide, deduct and append the ledger in one transaction with `select_for_update` on the request and the balance; unique constraint on (`request`, `kind`) for deductions and reversals; the request status as a state machine; `version` as an optimistic-concurrency check; idempotency keys for submissions are recommended.

### Notifications and announcements (Phase 6)

**In-app only** (D-093): no email channel. The backend creates notifications from events and resolves recipients server-side; the app lists them, marks them read and edits preferences. Unread count is polled every 60 s and on window focus (D-094); no WebSocket is needed.

Notification:

```json
{
  "id": "ntf-118",
  "type": "approval_required",
  "title": "Decision needed: Hamza Kareem’s Annual leave",
  "body": "2 Dec 2026 – 4 Dec 2026 (3 days).",
  "link": "/leave/requests/lr-41",
  "actor_name": "Hamza Kareem",
  "created_at": "2026-11-25T10:15:00.000+05:00",
  "read": false
}
```

`type` ∈ `leave_submitted`, `approval_required`, `leave_approved`, `leave_declined`, `leave_cancelled`, `attendance_reminder`, `announcement`. `link` is an in-app path (`/leave/requests/{id}`, `/attendance`, `/announcements#{id}`) or null.

Events and recipients (D-064, D-089, D-093; the actor is never notified of their own action, one notification per person and event):

| Event | Recipients |
|---|---|
| Leave submitted | Decision-makers: `approval_required` (decide); optional reviewers: `approval_required` (review); HR Administrators: `leave_submitted` |
| Leave approved / declined (incl. HR override) | Requester and HR: `leave_approved` / `leave_declined` (decline reason in `body`) |
| Leave cancelled | HR; plus decision-makers and reviewers when it was still pending: `leave_cancelled` |
| Recommendation, comment | none |
| No check-in by 9:15 AM on a working day (not on approved leave) | the person: `attendance_reminder`, once per day |
| Missing check-out | the person, the next morning (9:00 AM, last 7 days): `attendance_reminder`, once per day |
| Announcement published | everyone in the audience (active people), except the author: `announcement` |

Muted types (`attendance_reminder`, `announcement`) are not delivered; leave and approval types cannot be muted.

| Method and path | Who | Notes |
|---|---|---|
| `GET notifications/?page=&page_size=&type=&status=&from=&to=` | everyone | Own notifications, newest first; `status` ∈ `read`, `unread`; `from`/`to` are Pakistan dates of `created_at`. DRF page (§5) |
| `GET notifications/unread-count/` | everyone | `{ "count": 3 }` |
| `POST notifications/{id}/read/` | recipient | Returns the notification; `404` for someone else's |
| `POST notifications/read-all/` | everyone | `{ "updated": 3 }` |
| `GET notifications/preferences/` | everyone | `{ "muted": ["attendance_reminder"] }` |
| `PUT notifications/preferences/` | everyone | Same shape; `400` on `muted` for types that cannot be muted |
| `GET announcements/?include_inactive=true` | everyone; `include_inactive` HR only (`403`) | Active announcements that reach the caller (HR: all active), newest first: `{ "id", "title", "body", "audience": { "kind", "ids" }, "audience_label", "author_name", "created_at", "expires_on", "archived" }` |
| `POST announcements/` | HR only | `{ "title", "body", "audience": { "kind": "everyone" \| "departments" \| "teams", "ids": [] }, "expires_on": "2026-12-02" \| null }`. `400` on `title` (3–120), `body` (5–2000), `audience` (ids required for departments/teams, must be active), `expires_on` (not in the past) |
| `POST announcements/{id}/archive/` | HR only | Returns the announcement with `archived: true` |

An announcement is shown through its `expires_on` date (inclusive), or until archived when it has none.

Backend notes for the user's own implementation (D-080): create notifications in the same transaction as the event (or from a reliable outbox); reminders from a scheduled job (for example Celery beat) at 9:15 AM and 9:00 AM Pakistan time, idempotent per person and date; index notifications on (`recipient`, `read`, `created_at`).

### Imports (Phase 7)

HR only. The backend reads `.xlsx`/`.xls` files (≤ 10 MB, ≤ 5,000 rows), validates every row against current data and runs one transaction per job (D-096). Job: `{ "id", "type", "file_name", "file_size", "status", "created_at", "created_by_name", "columns", "preview_rows", "total_rows", "sample_data", "mapping", "update_existing", "summary": { "create", "update", "skip", "error" } | null, "executed_at" }`; `type` ∈ `employees`, `attendance`, `leave_history`, `leave_balances`; `status` ∈ `uploaded`, `validated`, `completed`, `failed`. Row result: `{ "row", "action": "create" | "update" | "skip" | "error", "key", "messages", "changes": { "Field": ["before", "after"] } | null }`. Field keys per type: `src/features/imports/lib/import-definitions.ts`.

| Method and path | Notes |
|---|---|
| `POST imports/` | multipart `type`, `file`; `400` on `file` |
| `GET imports/`, `GET imports/{id}/`, `GET imports/{id}/rows/` | history (newest first), job, last row results |
| `POST imports/{id}/dry-run/` | `{ "mapping": { field: column \| null }, "update_existing": bool }` → `{ "job", "rows" }`; changes nothing; `400` per field on mapping problems |
| `POST imports/{id}/execute/` | → `{ "job", "rows" }`; `409` `dry_run_required`, `409` `already_executed`; re-validates, rows that fail become `error` |

Matching: employees by email (update only with `update_existing`); attendance by employee code + date (always skipped if present); historical leave by overlap (skipped); balances always count as updates. Attendance times are Pakistan local time. Balances: "Imported opening balance" ledger adjustment; historical leave: approved request + deduction, no notifications. Backend: idempotent execute, audit entry per import.

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

Further endpoints are added per phase: reports/settings/audit (P8-T20). The complete endpoint ↔ service ↔ screen table is finished in P9-T13.
