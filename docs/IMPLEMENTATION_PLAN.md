# FormbaxHR — Implementation Plan and Progress Tracker

> Single source of truth for implementation progress.
> Claude Code: read `CLAUDE.md` and `docs/DECISIONS.md` before using this file. Update this file after every meaningful milestone.
> Checkbox rules: `- [ ]` incomplete, `- [x]` complete. A box may be ticked only after verification (see CLAUDE.md §4).
> Task IDs (e.g. `P4-T03`) are stable references. Do not renumber them.
> Plan created: 2026-11-25.

---

## A. CURRENT STATUS

| Field | Value |
|---|---|
| Overall state | Phases 1–5 implemented in mock mode: foundation, authentication and role dashboards, employees and organization, attendance, leave and approvals (balances, ledger, application, routing, approval workflow, HR overrides, cancellation, HR allocation, live dashboards). 536 tests; all checks pass. |
| Current phase | Phase 5 complete (PR into `dev-main` open); Phase 6 next after the user merges. |
| Current task | User review and merge of the Phase 5 PR; manual browser checks pending |
| Next task | Phase 6 — P6-T01 (notifications). Still provisional: Q-LEAVE-01…03, Q-APPR-07 (D-090), Q-ATT-01…07 (D-086), Q-ORG-01…05 (D-084) |
| Branch | `phase-5-leave-approvals` (from `dev-main` @ `a8e04c6`, published; PR into `dev-main`). Phases 1–4 merged into `dev-main` (PRs #1–#4). |
| Last known commits | `main`: `4c7560c`, `3ffa6c8`, `d0fc183`, `96c69c7`, `b25a165`, `0c67b6f` (ahead of `origin/main` by 4, not pushed). `phase-1-foundation`: `3c73b5d` feat: toolchain; `0001379` docs: progress + commit convention; `451be26` docs: chore type (local only, no upstream). |
| Working tree | Phase 5 committed and pushed (see `git log`). Verify with `git status`. |
| Mock mode | Implemented: all services run on in-memory mocks (`VITE_USE_MOCK_API=true`), "Mock data" badge in the top bar |
| Backend | Out of scope for this work: the user builds it independently after the frontend (D-080). Everything runs in mock mode. Do not inspect or plan backend code or folders. |

### Blockers
- None blocking Phase 1. P1-T18 needs a manual browser check by the user.
- Phase 2 token handling is decided (D-078, D-079). Password, invitation and session-timeout rules are still open (Q-AUTH-01…04).
- Several later tasks are blocked by open questions; see section D and `docs/DECISIONS.md` (Q-IDs).

### Unresolved issues
- pnpm reports agent skills from `@tanstack/react-table` awaiting approval. Not approved by Claude Code; user decision (R-020).
- Account name resolved: `mzulkifalzk25` (D-035).
- The `CLAUDE.md` originally supplied was a byte-identical copy of `DECISIONS.md` (same SHA-256), so the intended instructions file was missing. `CLAUDE.md` was rewritten from the documented requirements. If the user has the original intended version, compare and merge (Q-PROJ-01).

---

## B. NEXT SESSION

Update this section at the end of every session.

- Follow `CLAUDE.md` §2 and §9: check `gh pr list --base dev-main`. Phase 6 starts only after the user has merged the Phase 5 PR: update `dev-main`, create `phase-6-notifications`, publish it.
- Ask about the open notification questions (Q-NOTIF-*) before building those rules. HR must receive every leave lifecycle event (D-064): requests already list HR as `mandatory` recipients, and Phase 6 turns those into notifications.
- Phase 6 builds on: `services/mock/leave-store.ts` (lifecycle events: submit, recommend, decide, override, cancel), `services/mock/attendance-store.ts`, dashboards' notification previews (P2), the top bar.
- Patterns: registry-reachable modules import other features' **pure modules directly**, never their `index.ts` (lint catches cycles). Pure rules in `features/*/lib`, mock backends run the same functions. Shared controls: `NativeSelect`, `CheckboxList`, `FormField`, `applyServerErrors`, `PaginationBar`, `ConfirmDialog` (with reason).
- Testing: `renderApp(path, { signedInAs })`; setup resets the HR, leave and attendance stores, the viewer and TanStack Query's `onlineManager`. Freeze the clock with `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime` and reseed the stores. jsdom renders both desktop table and mobile list (scope with `within(table)`); Radix dialogs hide the page (`aria-hidden`) while open or closing, so grab regions before opening a dialog. Run long suites with `timeout` and `--testTimeout`.
- **Small commits (D-092):** commit and push after each small task step, 20–30 commits per phase; per commit run typecheck, lint, format check and the touched tests; full checks at the end of the phase.
- Frontend focus (D-080); commit per `CLAUDE.md` §8; never merge PRs.

---

## C. GLOBAL DEFINITION OF DONE (applies to every task)

- [ ] Code compiles under strict TypeScript (`pnpm typecheck`).
- [ ] Lint passes (`pnpm lint`).
- [ ] Required tests exist, were run, and pass (`pnpm test`).
- [ ] Production build succeeds at milestone end (`pnpm build`).
- [ ] Loading, empty, error and success states exist for data-driven UI.
- [ ] Forms validate with Zod and show accessible error messages.
- [ ] Accessible controls: labels, focus order, keyboard use, ARIA where needed.
- [ ] No real personal data, secrets or tokens in code, mocks, logs or docs.
- [ ] Mock data is visibly identified in the UI.
- [ ] UI never imports mock data directly; it goes through service interfaces.
- [ ] Plan, Changed Files Log and Verification Log updated.
- [ ] Any new decision or open question recorded in `docs/DECISIONS.md`.

---

## D. CROSS-CUTTING REQUIREMENTS (referenced by phases)

### D1. Roles
Six frontend roles: **HR Administrator, Manager, Senior Project Manager, Associate Project Manager, Team Lead, Employee.** The Django superuser / technical administrator is separate from HR Administrator and manages HR accounts via Django Admin (not a frontend role).

Confirmed access principles:
- Employees see only their own private records.
- Managers see only their authorized reporting scope.
- HR has organization-wide HR access.
- Backend permissions are authoritative. Frontend guards are UX only.
- No public signup. HR creates employee accounts. Technical admin creates HR admin accounts through Django Admin. Secure invitations and password setup are required. Password reset must be supported.

### D2. Attendance policy (confirmed)
- Timezone: `Asia/Karachi` (UTC+05:00). Never use the browser timezone for policy decisions. Django will be authoritative.
- Official check-in 09:00. Grace 15 minutes.
  - Before 09:00:00 → early/on-time.
  - 09:00:00 through 09:15:00 inclusive → on time.
  - After 09:15:00 (i.e., 09:15:01 and later) → **Late-In**.
  - 09:15:00 exactly is NOT late. 09:15:01 IS late.
- Employees may check in before 09:00; the actual timestamp is preserved.
- Late-In is **tracking only**. It never affects payroll or salary. No payroll calculation anywhere.
- Official checkout 18:00. Checkout from 17:45 onward carries no early-departure penalty.
- Checkout before 17:45: **policy not decided** (Q-ATT-01). Do not invent one.
- Record actual checkout timestamp.
- Working duration = actual checkout − actual check-in. No rounding to official times. No lunch/break deductions.
- Incomplete sessions (check-in without checkout) must be clearly identified.
- HR corrections require a mandatory reason and produce correction audit history.

### D3. Leave policy (confirmed)
- Annual allowance: Medical/Sick 7, Casual 7, Annual 7 (total 21 days).
- Separate balance per category. Approved leave deducts from the selected category only.
- Pending, declined and cancelled leave do not deduct.
- Auditable transaction ledger. HR can configure allocations. Employees see allocated, used and remaining.
- Leave application fields: leave type, start date, end date, requested duration, reason, optional attachment, selected manager(s) where applicable.
- HR automatically receives leave lifecycle notifications and cannot be removed from recipients.
- Distinguish notification recipients, reviewers, approvers and final decision-makers (as separate concepts in types and UI).
- Confirmed 2026-11-25 (D-088): duration counts Monday–Friday, public holidays excluded, whole days only; no negative balances; no overlapping requests; backdating allowed; requester may cancel approved leave until the day before it starts (days returned); attachments optional, PDF/JPG/PNG up to 5 MB.
- Confirmed 2026-11-25 (D-089): Team Lead → own manager(s); Senior PM → HR; HR Administrator → another HR Administrator; with several managers any one decides; Team Lead and Associate PM are optional reviewers; HR may decide any pending request with a reason.
- **Not decided (do not assume):** carry-forward, encashment, expiration, calendar vs anniversary year, mid-year proration, escalation (Q-LEAVE-01…03, Q-APPR-07; provisional D-090).

### D4. Approval hierarchy (confirmed)
- Manager is the final approval authority for their team.
- An authorized Associate PM can participate but cannot override the Project Manager's final authority.
- Team Lead can review, comment and recommend.
- Senior PM approves Associate PM's own leave.
- Managers submit their own leave directly to HR.
- Employees without a manager submit directly to HR.
- Associate PM submits their own leave to Senior PM.
- HR monitors all leave requests and balances.
- Support configurable sequential and parallel review. Do not assume multiple selected managers must all approve.
- Prevent self-approval. Rejection requires a reason.
- Future Django backend must prevent duplicate deductions and approval race conditions using transactions and row locking.

### D5. API and integration requirements
- Env: `VITE_API_BASE_URL=http://localhost:8000/api/v1`, `VITE_USE_MOCK_API=true`.
- Typed service interface per domain; mock and HTTP implementations share the contract.
- Centralized API client (base URL, auth header, refresh handling, error normalization, request cancellation).
- Contracts documented in `docs/API_INTEGRATION.md` as features land.
- Timestamps: ISO 8601 with explicit offset. Dates: `YYYY-MM-DD`. Pagination, filtering and error shapes defined once and reused (final shapes recorded in `API_INTEGRATION.md`).

### D6. Security requirements
- No secrets in Git. `.env.example` with placeholders only.
- Token strategy decided (D-078, D-079): access token in memory only, refresh token in an httpOnly cookie with rotation; never store tokens in localStorage/sessionStorage.
- Frontend guards are UX only; document that the backend enforces authorization.
- Validate uploads client-side for UX; backend must revalidate.
- No `dangerouslySetInnerHTML` with unsanitized data. Escape/neutralize spreadsheet formula injection on exports (cells beginning with `=`, `+`, `-`, `@`).
- Do not log tokens or personal data.
- Idempotent mutation design for leave approval and imports (document the backend expectation).

### D7. UI/UX requirements
Premium enterprise SaaS look: modern, clean, light theme, neutral backgrounds, blue/indigo primary, semantic green/red/amber/blue/gray, clear typography, whitespace, subtle borders/shadows, responsive. App shell: sidebar, top nav, global search, notification center, user menu, breadcrumbs, responsive mobile navigation. Include loading states, skeletons, empty states, error states, success feedback, form validation, confirmation dialogs, accessible controls, mobile-friendly tables. Do not produce a generic dashboard template.

---

## PHASE 0 — Repository analysis and architecture

**Objectives:** Understand the repository and fix the architecture and workflow.
**Dependencies:** None.
**Status:** Complete (2026-11-25).

### Tasks
- [x] **P0-T01** Inspect repository state (verified by command in Claude Code on 2026-11-25: nearly empty; clean; on `main`; no `package.json`, `src/`, Vite config or installed dependencies; Git history intact).
- [x] **P0-T02** Verify tooling availability (verified 2026-11-25: `node -v` v26.13.0, `npm -v` 11.20.0, `pnpm -v` 12.16.1, `yarn -v` 1.22.22; pnpm chosen, D-010).
- [x] **P0-T03** Produce recommendations (stack, feature-based architecture, mock/real service split, typed HTTP client, Asia/Karachi handling, pure policy functions, backend-authoritative rules).
- [x] **P0-T04** Identify unresolved business and technical decisions (listed in `docs/DECISIONS.md`).
- [x] **P0-T05** Create `CLAUDE.md` (root) and `docs/DECISIONS.md`; expand this plan to nine phases. (Done 2026-11-25. The supplied `CLAUDE.md` duplicated `DECISIONS.md` and was rewritten; see section A.)
- [x] **P0-T06** Verify the three tracking documents are in place, consistent with each other, and that `git status` shows only the expected files. (Verified 2026-11-25; see section F.)
- [x] **P0-T07** Confirm with the user the account-name discrepancy (`mzulkifalzk25` vs `mzulkifalkz25`) and record the answer. (User confirmed `mzulkifalzk25` on 2026-11-25; D-035.)

### Required tests
- No automated tests (documentation-only phase). Verification is by inspection: file locations, content hashes, internal links and `git status` (recorded in section F).

### Acceptance criteria
- Three tracking files exist at the correct paths.
- Open questions are recorded and none were answered by assumption.

### Deliverables
- `CLAUDE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/DECISIONS.md`.

---

## PHASE 1 — Project foundation

**Objectives:** A working, strictly-typed, linted, tested, buildable React app skeleton with the service-layer pattern and app shell, preserving existing repository files.
**Dependencies:** Phase 0 complete.
**Status:** Implementation complete (P1-T01–T17 done and verified). Open: P1-T18 manual visual check at desktop/mobile widths.

### Tasks and subtasks

- [x] **P1-T01** Verify environment and plan a non-destructive scaffold.
  - [x] Confirm Node/pnpm versions with commands. (2026-11-25: Node v26.13.0, pnpm 12.16.1; all core packages' `engines` accept Node 26.)
  - [x] Check `git status` is clean (or only docs files). (2026-11-25: only staged doc changes.)
  - [x] Propose scaffold method to user (scaffold in temp dir outside repo and merge; or an equivalent that never overwrites `.gitignore`, `README.md`, `.vscode`). Proposal presented and approved 2026-11-25 (scratchpad scaffold with `create-vite@9.3.4 --template react-ts`; TS 7 + oxlint per D-033).
- [x] **P1-T02** Scaffold React + TypeScript + Vite using pnpm. (Completed 2026-11-25 when P1-T07 added `format`.)
  - [x] `package.json` with `"packageManager"` field and scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `test`. (2026-11-25: `packageManager: pnpm@12.16.1`, `engines.node >=26`, `.nvmrc` = 26; all seven scripts exist, plus `format:check`, `test:watch`, `test:coverage`, `test:tz`.)
  - [x] `tsconfig` with `strict: true` and path alias `@/` → `src/` (alias choice recorded in DECISIONS). (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` in `tsconfig.app.json`; alias in tsconfig `paths` and `vite.config.ts`; R-006. Alias exercised by `@/components/ui/button` import in P1-T04.)
  - [x] Existing `.gitignore` and `README.md` preserved; `.gitignore` only extended if something is missing (show diff). (Appended `dist-ssr/`, `*.local`, `.idea/`; template README and demo assets not copied.)
  - [x] Only `pnpm-lock.yaml` is present (no npm/yarn lockfiles).
- [x] **P1-T03** Configure Tailwind CSS and design tokens. (2026-11-25)
  - [x] Blue/indigo primary; semantic green, red, amber, blue, gray; neutral light background. (`src/index.css`: shadcn-compatible variable names plus `success`/`warning`/`info`/`destructive` solid and `-subtle` variants; all 21 text/background pairs ≥ 4.5:1; input border 3.11:1 and ring 4.43:1 on card.)
  - [x] Typography scale, spacing, radius, subtle shadows defined in one place. (`src/index.css` `@theme inline`: font stacks, radius scale from `--radius`, `shadow-xs…lg`; Tailwind's default type and spacing scales are kept.)
  - [x] Tailwind major version choice recorded in DECISIONS. (D-036.)
- [x] **P1-T04** Install and configure shadcn/ui and Lucide React. (2026-11-25, D-037.) `shadcn init` was dry-run in the scratchpad and **not** run in the repo because it overwrote the P1-T03 tokens; the equivalent setup was applied by hand: `components.json` (radix-nova), root `tsconfig.json` paths, `src/lib/utils.ts` (`cn`), CSS imports `tw-animate-css` + `shadcn/tailwind.css`, extra radius/heading tokens. Lucide used in the placeholder page.
  - [x] Base primitives added only as needed (button, input, label, card, dialog, dropdown, sheet, table, badge, skeleton, toast, tabs, select, calendar/date picker as needed later). (Only `button` added, via `pnpm shadcn add button`; `index.css` and `package.json` unchanged by `add`. Others are added by the tasks that use them: P1-T13 toast, P1-T14 shell primitives, P1-T15 skeleton/dialog.)
- [x] **P1-T05** Install core libraries: React Router, TanStack Query, TanStack Table, React Hook Form, Zod (+ resolver), Recharts, date/timezone library (library choice recorded in DECISIONS). (2026-11-25: react-router 8.5.2, @tanstack/react-query 5.108.4, @tanstack/react-table 9.3.1, react-hook-form 7.92.0, @hookform/resolvers 7.0.9, zod 4.6.7, recharts 3.11.1 + react-is 19.3.1 peer, date-fns 4.4.0 + @date-fns/tz 1.5.0 (D-038). All type-check under TS 7 strict; Karachi conversion verified under 4 process timezones.)
  - Note for P3-T03: **TanStack Table v9** changed the API vs v8 — features are opt-in (`tableFeatures({ rowSortingFeature, ... })`) and `createColumnHelper<TFeatures, TData>()` takes two type arguments. Use v9 docs, not v8 examples.
- [x] **P1-T06** Test tooling: Vitest + React Testing Library + jsdom; coverage config; test setup file. (2026-11-25: vitest 5.1.1 + @vitest/coverage-v8 5.1.1, jsdom 31.0.1, @testing-library/react 16.3.3 / dom 10.4.2 / user-event 14.6.13 / jest-dom 8.0.0. Config in `vite.config.ts` `test`; setup `src/test/setup.ts`; tests type-checked via `tsconfig.test.json`. Scripts `test`, `test:watch`, `test:coverage`, `test:tz`. 36 tests: App smoke, `cn`, contrast helper, 25 design-token contrast checks, TZ sanity.)
  - [x] Tests run with `TZ` set to a non-Karachi timezone in at least one CI-style script to prove timezone independence (see Phase 4). (`pnpm test:tz` = `TZ=America/Los_Angeles vitest run`; `environment.test.ts` asserts the TZ took effect. POSIX shells only.)
- [x] **P1-T07** Lint and format: oxlint (react, react-hooks, jsx-a11y, typescript; D-033), Prettier; scripts wired. (2026-11-25: prettier 3.10.1; `.prettierrc.json` = no semicolons, single quotes, trailing commas, 100 cols, LF; `.prettierignore` excludes `src/components/ui/` (shadcn-generated), `*.md`, lockfile, build/coverage output. Scripts `format`, `format:check`. Initial run reformatted 4 files, line wrapping only.)
- [x] **P1-T08** Create folder structure per architecture: `src/app/{router,providers,layouts,guards}`, `src/components/{ui,shared,tables,forms,charts,feedback}`, `src/features/{authentication,dashboard,employees,attendance,leaves,approvals,organization,imports,reports,notifications,audit,settings}`, `src/services/{api,auth,mock}`, `src/hooks`, `src/lib`, `src/types`, `src/constants`, `src/styles`. (2026-11-25, D-075: Git cannot track empty folders and placeholder files are forbidden, so the structure is defined in `docs/ARCHITECTURE.md` and each folder is created by the task that first adds a real file. Import boundaries enforced by oxlint: no mock imports outside the service layer, components may not import features, no cycles.)
  - [x] Empty folders get only what is needed (no speculative files). (No empty folders or `.gitkeep` files created.)
- [x] **P1-T09** Environment configuration. (2026-11-25, D-076.)
  - [x] Typed env module validating `VITE_API_BASE_URL` and `VITE_USE_MOCK_API` with Zod; fails clearly if invalid. (`src/lib/env.ts`: pure `parseEnv()` + validated `env` export; `EnvError` lists every issue; http(s) URLs only, trailing slashes removed; boolean must be exactly `"true"`/`"false"`. Missing values default only outside production; production builds with missing values throw at startup. Imported first in `src/main.tsx`. Types in `src/types/vite-env.d.ts`. 16 tests.)
  - [x] `.env.example` with `VITE_API_BASE_URL=http://localhost:8000/api/v1` and `VITE_USE_MOCK_API=true`.
  - [x] Confirm `.env` / `.env.local` are ignored by Git. (`git check-ignore`: `.env`, `.env.local`, `.env.development`, `.env.production` ignored; `.env.example` not ignored.)
- [x] **P1-T10** Centralized typed API client. (2026-11-25: `src/services/api/` — `http-client.ts`, `api-error.ts`, shared `apiClient`. Native fetch (R-016). 25 tests.)
  - [x] Base URL, JSON handling, auth header injection point, timeout/abort support. (Relative paths only, so tokens never go to other origins; query arrays repeated, empty values dropped; FormData passthrough; 204 → undefined; optional Zod response validation; default 20 s timeout + caller `AbortSignal`.)
  - [x] Normalized `ApiError` type (status, code, message, field errors). (DRF `detail`, serializer field errors, `non_field_errors`, proposed `{error:{…}}` envelope; network/timeout/aborted/invalid_response codes; `isRetryable`; `userMessage()` shows only user-safe text.)
  - [x] Refresh-on-401 hook point (implementation blocked by Q-TECH-01; leave a typed interface and a documented stub). (`AuthHooks` + `setAuthHooks`: one shared refresh for concurrent 401s, single retry, `onSessionExpired`; `auth:false` for public endpoints. No token storage implemented.)
- [x] **P1-T11** Service-contract pattern and service registry. (2026-11-25: `src/services/registry.ts` (`createServices`, `services`, `mode`), reference `HealthService` in `src/services/health/` (contract + Zod schema, `.http.ts`, `.mock.ts`), `src/services/mock/latency.ts` (abortable simulated latency). 7 tests.)
  - [x] Pattern: `XService` interface in `features/<x>/api/`, `x.http.ts`, `x.mock.ts`, and a registry selecting by `VITE_USE_MOCK_API`. (Registry location `src/services/registry.ts`, shared mock infrastructure in `src/services/mock/`; see `docs/ARCHITECTURE.md` §3.)
  - [x] One reference implementation (e.g., a `HealthService`) proving the swap works. (Tests: mock vs HTTP chosen by flag, same contract schema for both, HTTP rejects contract-breaking responses. Overview page consumes it through a TanStack Query hook.)
- [x] **P1-T12** Time/date library for `Asia/Karachi`. (2026-11-25: `src/lib/datetime.ts`, 32 tests.)
  - [x] Pure helpers: convert instant → Karachi wall-clock, Karachi calendar date of an instant, format helpers. (`toDate` rejects offset-less strings; `toAppZone`, `appDateKey`, `appTimeKey`, `msSinceAppMidnight` (keeps ms for exact boundaries), `appOffset`, `toAppIsoString`, `appWallClockToInstant`; display formatters with provisional formats (Q-TECH-04). Offsets from IANA rules — verified +06:00 during Pakistan's 2009 DST.)
  - [x] Constant `APP_TIMEZONE = "Asia/Karachi"` in `src/constants`. (`src/constants/app.ts`, plus `APP_NAME`, `DISPLAY_FORMATS`.)
  - [x] Tests pass when process timezone is UTC, `America/Los_Angeles` and `Asia/Karachi`. (`pnpm test:timezones`; also checked under `Pacific/Kiritimati`.)
- [x] **P1-T13** Providers and router skeleton: QueryClientProvider, router, error boundary, toast provider. (2026-11-25: `src/app/providers/` — `query-client.ts` (retries only network/timeout/429/5xx, max 2; mutations never retried), `app-providers.tsx` (QueryClient, TooltipProvider, Toaster), `app-error-boundary.tsx`; `src/app/router/` — route table, browser router, route error page, not-found page, typed route `handle` for breadcrumbs; sonner 2.0.8 with token-styled `Toaster` (shadcn's sonner wrapper avoided: needs next-themes). `App.tsx`/`App.test.tsx` placeholders removed. Tests: retry policy, both error boundaries (no internal message leaks), routing.)
- [x] **P1-T14** Application shell (static, role-agnostic for now): sidebar, top nav, breadcrumbs, user menu placeholder, notification center placeholder, global search placeholder, responsive mobile navigation. (2026-11-25: `src/app/layouts/app-layout.tsx` + `shell/`: skip link, fixed desktop sidebar, sticky top bar, Sheet-based mobile nav, breadcrumbs from route handles, disabled search with an explanation, notification and account placeholders that say when they arrive, planned modules shown as non-link entries with their phase (D-077). Shadcn primitives added: sheet, dropdown-menu, separator, input, skeleton, alert-dialog, badge, tooltip, breadcrumb (no CSS/package changes). 10 shell tests in jsdom. **Not visually checked in a browser** — see P1-T18.)
- [x] **P1-T15** Shared feedback components: skeleton, empty state, error state, confirmation dialog, page header. (2026-11-25: `src/components/feedback/` — `EmptyState`, `ErrorState` (role=alert, retry), `ConfirmDialog` (destructive style, optional mandatory trimmed reason, pending state), `CardSkeleton`/`ListSkeleton`, `Toaster`; `src/components/shared/page-header.tsx`. 9 tests.)
- [x] **P1-T16** Mock-mode indicator: persistent visible "Mock data" badge when `VITE_USE_MOCK_API=true`. (2026-11-25: `shell/mock-mode-badge.tsx` driven by `services.mode`; a real button so keyboard users get the tooltip; full explanation in its accessible name; absent in HTTP mode. 3 tests.)
- [x] **P1-T17** Documentation: update `README.md` (setup, scripts, env, mock mode, structure) without removing existing content; create `docs/API_INTEGRATION.md` skeleton (base URL, env vars, conventions placeholder sections to be filled as contracts are defined). (2026-11-25: README keeps its original `# HRMs` heading; API doc labels each item Implemented / Proposed / Open; first endpoint `GET health/` (Proposed).)
- [ ] **P1-T18** Foundation verification run: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and a manual dev-server check of the shell at desktop and mobile widths.
  - [x] Automated checks in the repo and in a simulated clean clone (no `node_modules`, no `.env`): typecheck, lint, format:check, test (158), test:timezones (3 × 158), build; `pnpm dev` serves the app. (2026-11-25, section F.)
  - [ ] **Manual visual check at desktop and mobile widths — not done**: no browser was available in the Claude Code session. Needs the user (`pnpm dev`, check ≥1024 px and ~375 px), or Playwright later (R-004).

### Required tests
- Env module: valid values, missing values, invalid boolean.
- API client: success, error normalization, abort, 401 hook invocation.
- Service registry: returns mock vs HTTP implementation based on env.
- Time helpers across three process timezones.
- Smoke render of the app shell.

### Acceptance criteria
- `pnpm install && pnpm dev` runs from a clean clone.
- All four checks pass and results are in the Verification Log.
- Existing `.gitignore`/`README.md` content preserved; no secrets present; only `pnpm-lock.yaml` exists.
- Switching `VITE_USE_MOCK_API` changes the service implementation without touching UI code.
- Mock indicator visible in mock mode.

### Deliverables
- Running skeleton app, config files, folder structure, shell, API client, service pattern, time helpers, updated README, `API_INTEGRATION.md` skeleton.

---

## PHASE 2 — Authentication and role dashboards

**Objectives:** Complete authentication UX against mock services, role-based routing, and six role dashboards.
**Dependencies:** Phase 1 complete.
**Status:** Complete (2026-11-25): P2-T01…T20 implemented and verified in mock mode. Not visually checked in a browser (no browser in the Claude Code session); HTTP mode not run against a real backend (none exists yet).
**Open items touching this phase:** Q-AUTH-* (password policy, invitation expiry, session timeout) — handled provisionally (D-081). Token handling decided: D-078, D-079.

### Tasks and subtasks

- [x] **P2-T01** Domain types and Zod schemas for authentication: `User`, `Role`, `AuthSession`, login/forgot/reset/set-password payloads. (`features/authentication/types.ts`, `schemas/auth.schema.ts`: login, forgot, set-password with provisional policy, snake_case API user/session/token-check schemas; unknown roles such as a superuser rejected.)
- [x] **P2-T02** `AuthService` interface; mock and HTTP implementations. (`api/auth.service.ts`, `auth.http.ts` (proposed endpoints, cookies on login/refresh/logout, tokens in request bodies), `auth.mock.ts` (in-memory state per instance).)
  - [x] Login, logout, current user (`me`), forgot password, reset password, invitation/set-password, token refresh (interface).
  - [x] Mock accounts: one per role, fictional, clearly labelled. (Surname "Demo", `@formbaxhr.test`; shown on the login page only in mock mode via `services.mockFixtures`.)
- [x] **P2-T03** Session handling (mock mode). (`session/auth-provider.tsx`: restore on start, API client hooks, cross-tab logout; `services/auth/`: in-memory access token, Web Locks refresh lock, BroadcastChannel.)
  - [x] In-memory session for mock mode (HTTP mode follows D-079: access token in memory, refresh cookie). (A page reload ends the mock session; HTTP mode restores via the cookie.)
  - [x] HTTP-mode session per D-078/D-079 (no longer blocked): access token in memory; refresh via httpOnly cookie with rotation; restore session on reload with one refresh call; `credentials: 'include'` on auth calls; coordinate refreshes across tabs (BroadcastChannel/Web Locks). (Implemented and unit-tested against a fake fetch; not run against a real backend, which does not exist yet.)
- [x] **P2-T04** Login page: validation, error states, loading state, no account enumeration in messages, no public signup link. (Also: session-expired notice, server field errors mapped to inputs, mock demo-account panel.)
- [x] **P2-T05** Forgot password and reset password pages (token from URL; invalid/expired token states). (Identical confirmation for any email; missing/invalid/expired/valid states; live password checklist.)
- [x] **P2-T06** Invitation / set-password page (token-based; expiry rules BLOCKED by Q-AUTH-02 for specific values, UI states for expired/invalid still built). (`/invite?token=`: missing/invalid/expired/used/valid; expiry values stay with the backend.)
- [x] **P2-T07** Route guards: authenticated guard, role guard, redirect-to-login with return path, forbidden (403) page, not-found page. Documented as UX only. (`app/guards/guards.tsx`: RequireAuth, RequireRole, GuestOnly, RoleHomeRedirect; open-redirect protection via `safeRedirectPath`.)
- [x] **P2-T08** Role-based post-login redirect to each role's dashboard. (`postLoginPath`; a safe `?redirect=` wins. Bug found by tests and fixed: GuestOnly now uses the same rule, so it no longer races the login page.)
- [x] **P2-T09** Current-user profile page (read-only basics for now; edit fields decided in Phase 3). (`/profile`.)
- [x] **P2-T10** Logout (clears session and cached queries; confirmation not required). Per D-078: call the backend logout endpoint so the token is blacklisted, then clear the local session even if that call fails. (Also signs out other tabs.)
- [x] **P2-T11** Role-aware navigation: sidebar items per role (only modules that exist so far; others hidden, not dead links). (`app/navigation.ts` `navigationForRole`; Phase 1's "planned" entries removed.)
- [x] **P2-T12** Dashboard data services (mock) with typed interfaces per dashboard. (`features/dashboard/schemas/dashboard.schema.ts` (types inferred from Zod), service, HTTP (camelized + validated), mock (dates relative to Karachi today; every mock passes its schema).)
- [x] **P2-T13** HR dashboard: total employees, present today, absent today, late arrivals, pending leave requests, department overview, attendance trends (Recharts), recent activity. (Chart has a screen-reader table; Late-In labelled "tracking only".)
  - [x] "Absent today" display **BLOCKED by Q-ATT-02** (definition). Build the card with the metric clearly labelled as provisional/mock until decided; do not encode a business definition in logic. (Labelled "Provisional definition"; value comes from the service, never derived.)
- [x] **P2-T14** Manager dashboard: team attendance, team leave requests, approval inbox preview, team overview.
- [x] **P2-T15** Senior PM dashboard: Associate PM and project-team overview, pending approvals, team summaries.
- [x] **P2-T16** Associate PM dashboard: assigned team, attendance, review and recommendation tasks.
- [x] **P2-T17** Team Lead dashboard: team attendance, leave review and comments, team overview.
- [x] **P2-T18** Employee dashboard: personal attendance, check-in/check-out widget (UI shell; behavior in Phase 4), leave balances, leave requests, notifications. (Check-in button disabled with an explanation; balances use the confirmed 7/7/7 allowances.)
- [x] **P2-T19** Handle 401/403 centrally (expired session → login; forbidden → 403 page). (401 → one refresh → `onSessionExpired` → login with notice + return path; role guard → 403 page; API 403 in data views shows the permission message via `ErrorState`.)
- [x] **P2-T20** Update `API_INTEGRATION.md` with authentication endpoints and payloads (marked proposed until backend exists). (Also dashboard endpoints.)

### Required tests
- Auth schemas (valid/invalid inputs).
- Login form: validation, error display, loading, success redirect per role (six cases).
- Guards: unauthenticated redirect with return path; wrong role → 403; correct role → access.
- Logout clears session and query cache.
- Each dashboard renders loading, empty, error and loaded states.
- Mock accounts contain no real personal data (review).

### Acceptance criteria
- Each of the six mock roles can log in and lands on its own dashboard.
- Direct URL access to another role's dashboard shows 403 (UX guard) and docs state the backend is authoritative.
- Forgot/reset/invitation flows work against mocks with all token states.
- No tokens or passwords in logs; no secrets in repo.
- HTTP-mode token behavior follows D-078/D-079 (access token in memory, httpOnly refresh cookie, rotation, logout blacklist).

### Deliverables
- Auth feature, guards, six dashboards, role-aware navigation, updated API docs.

---

## PHASE 3 — Employee and organization management

**Objectives:** Employee directory/profile CRUD and organization structure against mock services.
**Dependencies:** Phase 2 complete.
**Status:** Complete (2026-11-25): P3-T01…T15 implemented and verified in mock mode on `phase-3-employees-organization`. Not visually checked in a browser.
**Open items touching this phase:** Q-ORG-01…05 handled provisionally in `features/employees/lib/employee-policy.ts` (D-084); Q-LEAVE-11 / Q-APPR-04 / Q-APPR-05 still open (affect Phase 5).

### Tasks and subtasks

- [x] **P3-T01** Types and Zod schemas: `Employee`, `Department`, `Team`, `Designation`, `Project`, `ReportingRelation`, `EmploymentStatus`. (`features/employees/schemas/employee.schema.ts`, `features/organization/schemas/organization.schema.ts`; types inferred from Zod; statuses invited/active/inactive; `src/types/api.ts` page envelope.)
  - [x] Supports multiple managers per employee and employees with no manager.
- [x] **P3-T02** `EmployeeService`, `OrganizationService` interfaces with mock and HTTP implementations. (Contracts, HTTP (snake_case bodies, DRF pagination) and mocks over the shared in-memory store `src/services/mock/hr-store.ts`, which emulates the server: scoping by viewer, 403/404/400, cycle and duplicate checks.)
- [x] **P3-T03** Employee directory (TanStack Table): server-style pagination, sorting, filtering (department, team, role, status, manager), search; mobile-friendly rendering. (TanStack Table v9 on desktop, card list on mobile; search (debounced), department/team/role/status/manager filters, sortable name/ID/joined with `aria-sort`, page sizes 10/25/50; all state in the URL.)
- [x] **P3-T04** Employee profile page: personal/work info, department, designation, role, joining date, employment status, managers, teams, projects. (`/employees/:id`; names resolved; several managers; "No manager (leave requests go to HR)"; 404 state for unknown/out-of-scope ids.)
- [x] **P3-T05** Create employee (HR only in UX): validated form; triggers invitation (mock) rather than setting passwords. (`/employees/new`; status `invited`; backend assigns the code (provisional Q-ORG-01); mock-mode toast says no email is sent.)
- [x] **P3-T06** Edit employee with change-tracking payload suitable for audit (before/after captured by backend; frontend sends only changed fields). (`lib/employee-diff.ts`: only changed fields, ids compared as sets; "No changes to save" when nothing changed.)
- [x] **P3-T07** Activate/deactivate employee with confirmation dialog and reason field if required (reason requirement **BLOCKED by Q-ORG-03**; build the dialog so the reason field is configurable). (Reason required provisionally (`EMPLOYEE_POLICY`, Q-ORG-03); reactivation returns never-activated accounts to `invited`; not offered on your own record.)
- [x] **P3-T08** Department management (list, create, edit, deactivate). (Organization page, Departments tab: create/edit/deactivate; unique names; headcounts; warning when people are still assigned.)
- [x] **P3-T09** Team management (list, create, edit, members, team lead assignment). (Teams tab: department, optional team lead, members set as a whole list.)
- [x] **P3-T10** Designation management. (Designations tab.)
- [x] **P3-T11** Project management and employee–project/team relationships. (Projects tab: Senior PM / Associate PM (must hold those roles), teams; employee–project/team links in the employee form.)
- [x] **P3-T12** Reporting hierarchy management: assign/remove one or more managers; detect and block circular reporting; allow no-manager state. (`features/organization/lib/hierarchy.ts`: `findReportingCycle` (names the loop), `transitiveReports`; live preview blocks saving; backend re-checks.)
- [x] **P3-T13** Organizational chart view (tree/graph) with large-tree handling, keyboard navigation, mobile fallback (list view). (`/organization/chart`: ARIA tree with roving tabindex (arrows, Home/End, Enter/Space), collapsed below level 2, search keeps the manager chain, show-inactive toggle; list view grouped by manager is the default below 768 px.)
- [x] **P3-T14** Scope-aware views: Manager/Team Lead/Senior PM/Associate PM see their authorized scope (mocked scope rules; defined as UX only; real scoping by backend). (Mock store scopes like the backend should: HR all; Manager transitive reports; Team Lead their teams; Senior/Associate PM their projects' teams; Employee only self (no directory, 403). Out-of-scope ids answer 404.)
- [x] **P3-T15** Update `API_INTEGRATION.md` and begin backend specification notes for `employees` and `organization` apps (models, constraints, deletion behavior: prefer deactivation over deletion). (`docs/API_INTEGRATION.md` §6 employees/organization endpoints. Backend specification stays in P9-T12 per D-080.)

### Required tests
- Schemas and form validation (required fields, email format, joining date).
- Circular reporting detection (pure function) including multi-manager graphs.
- Directory table: pagination, sorting, filter combinations, empty and error states.
- Role UX: only HR sees create/edit/deactivate controls.
- Org chart renders hierarchy with multiple managers and no-manager employees.

### Acceptance criteria
- HR can create, edit, deactivate employees (mock); employees cannot see others' private records via UI.
- Hierarchy supports multiple managers and no manager; cycles are rejected with a clear message.
- No hard delete of employees in UI.
- All mock data is fictional.

### Deliverables
- Employee and organization features, org chart, updated API docs.

---

## PHASE 4 — Attendance

**Objectives:** Attendance recording, display, classification and correction against mock services, with policy logic in pure tested functions.
**Dependencies:** Phase 3 complete (employees/teams exist), Phase 1 time helpers.
**Status:** Complete (2026-11-25): P4-T01…T14 implemented and verified in mock mode on `phase-4-attendance`. Not visually checked in a browser.
**Open items touching this phase:** Q-ATT-01…07 handled provisionally (D-086): before-17:45 check-out shown neutrally, absent not derived, single session, HR-only corrections, no weekend/holiday rules, forgotten check-outs flagged only, no location.

### Tasks and subtasks

- [x] **P4-T01** Types and schemas: `AttendanceRecord`, `AttendanceSession`, `AttendanceCorrection`, `CorrectionAuditEntry`. (`features/attendance/schemas/attendance.schema.ts`: with one session per day (Q-ATT-03) the record *is* the session (`AttendanceRecord`); the correction request is `CorrectionInput`, the audit entry `CorrectionEntry`; plus `TodayAttendance`, `AttendanceSummary`, list query and filters. Types inferred from Zod.)
  - [x] Store actual timestamps as ISO 8601 with offset; never store rounded times. (Millisecond precision; `durationMs` exact.)
- [x] **P4-T02** Pure policy module `features/attendance/lib/policy.ts` using `Asia/Karachi`:
  - [x] `classifyCheckIn(instant)` → `early | on_time | late` with exact boundaries (09:00:00, 09:15:00 inclusive on time, 09:15:01 late). (09:15:00.000 on time, 09:15:00.001 late, D-086.)
  - [x] `classifyCheckOut(instant)` → at/after 17:45 = no early-departure flag; before 17:45 = **returns "unclassified (policy undecided)"; BLOCKED by Q-ATT-01** (no penalty logic). (`within_window` / `before_window`; shown as neutral "Left before 5:45 PM", provisional D-086.)
  - [x] `workingDuration(checkIn, checkOut)` = exact difference; no rounding; no break deduction. (`workingDurationMs`; RangeError if negative.)
  - [x] `isIncomplete(session)`. (`sessionState(record, today)` → `not_checked_in | in_progress | complete | incomplete`.)
  - [x] Karachi calendar-date derivation for an instant (day-boundary behavior at midnight Karachi). (`attendanceDate`.)
  - [x] No payroll or salary fields anywhere.
- [x] **P4-T03** `AttendanceService` interface, mock and HTTP implementations: check-in, check-out, my history, team attendance, org attendance, record detail, HR correction, correction history. (Plus today and summary. Mock over `services/mock/attendance-store.ts`: 30 days of fictional data, server-side classification, scope from the HR store, 400/403/404/409.)
- [x] **P4-T04** Check-in/check-out widget: current state, live Karachi clock display, disabled states, duplicate-click protection, error and offline handling. Multiple sessions per day **BLOCKED by Q-ATT-03**; implement single-session behavior only as a clearly isolated rule or ask the user before building. (`CheckInCard`: live clock and running duration, buttons disabled while pending and offline, single session per day provisional D-086; used on My attendance and the Employee dashboard.)
- [x] **P4-T05** Personal attendance history: table with date, check-in, check-out, duration, Late-In badge, Incomplete badge; filters by date range. (`/attendance` History tab; range validated; table on desktop, list on mobile.)
- [x] **P4-T06** Attendance calendar view with status indicators; holiday/weekend rendering **BLOCKED by Q-ATT-05** (display only data supplied by service). (Month calendar, Monday first; days without data say "No record", never "absent".)
- [x] **P4-T07** Incomplete-session identification: clear UI marker and filter; no automatic checkout is invented. ("Missing check-out" badge from the next day; "Missing check-out only" filter; dashboards count earlier open sessions.)
- [x] **P4-T08** Team attendance (Manager, Team Lead, Senior PM, Associate PM within scope) with filters (date, team, status, late only, incomplete only). (`/attendance/records` "Team attendance"; filters From/To, Team, Employee, Show (Late-In / Missing check-out / Corrected); server-style pagination; Employee 403.)
- [x] **P4-T09** Organization-wide attendance for HR with department/team/employee filters. (Same page for HR, title "Attendance records", plus Department filter.)
- [x] **P4-T10** HR correction workflow: edit record with **mandatory reason**; confirm dialog; shows before/after. (Dialog with before → after preview; reason min. 5 characters; check-out after check-in; same date.)
  - [x] Rules about who may correct, time limits and approvals **BLOCKED by Q-ATT-04**; only HR correction with reason is built. (Provisional D-086.)
- [x] **P4-T11** Correction audit history view per record (who, when, reason, before, after). ("Correction history" dialog.)
- [x] **P4-T12** Exports of attendance lists (CSV at minimum; format choice recorded in DECISIONS), with formula-injection neutralization. (`src/lib/csv.ts`, D-087; own history and filtered records.)
- [x] **P4-T13** Dashboards integration: replace placeholder attendance data in Phase 2 dashboards with the attendance service; "absent" remains provisional until Q-ATT-02 is answered. (Manager, Team Lead, Senior/Associate PM: `LiveTeamAttendance`; Employee: real `CheckInCard`; HR: present/late/absent from the summary.)
- [x] **P4-T14** Update `API_INTEGRATION.md` and backend specification notes (attendance models, Karachi calculation location, indexes on employee/date, uniqueness constraints, correction audit). (§6 Attendance; backend notes kept short per D-080, full specification in P9-T12.)

### Required tests (pure policy tests are mandatory and exhaustive)
- Check-in classification: 08:00:00, 08:59:59, 09:00:00, 09:14:59, 09:15:00 (on time), 09:15:01 (late), 09:15:00.001 (late; define millisecond handling and record it), 12:00:00.
- Same instants evaluated with process timezone set to UTC, `America/Los_Angeles` and `Asia/Karachi` produce identical results.
- Checkout: 17:44:59, 17:45:00, 18:00:00, 18:30:00 (before-17:45 result is "unclassified", with no penalty).
- Duration: exact seconds, no rounding, crossing no breaks, incomplete session returns null/flag.
- Karachi date derivation near midnight (instants at 18:59:59Z/19:00:00Z).
- Components: history table states, badge rendering, widget state transitions, correction form requires reason.
- Export: formula-injection cells neutralized.

### Acceptance criteria
- Boundary behavior exactly matches D2 (09:15:00 on time; 09:15:01 late).
- Browser timezone never affects classification (proved by tests).
- Actual timestamps preserved; no rounding; no break deductions; no payroll fields.
- Incomplete sessions clearly flagged.
- Every correction needs a reason and appears in correction history.
- Blocked policy items are not implemented by assumption.

### Deliverables
- Attendance feature, tested policy module, exports, correction and audit UI, updated API/backend docs.

---

## PHASE 5 — Leave and approvals

**Objectives:** Leave balances, ledger, application, approval workflows and cancellation against mock services, with deterministic pure balance logic.
**Dependencies:** Phases 3 and 4 complete (organization, scope), Phase 2 dashboards.
**Status:** Complete (2026-11-25): P5-T01…T18 implemented and verified in mock mode on `phase-5-leave-approvals`. Not visually checked in a browser.
**Open items touching this phase:** user answered Q-LEAVE-04…11, Q-APPR-01…06 and Q-APPR-08 (D-088, D-089). Still open, handled provisionally (D-090): Q-LEAVE-01…03 (leave year, proration, carry-forward), Q-APPR-07 (escalation).

### Tasks and subtasks

- [x] **P5-T01** Types and schemas: `LeaveType` (`medical_sick`, `casual`, `annual`), `LeaveRequest`, `LeaveBalance`, `LeaveLedgerEntry`, `ApprovalStep`, `ApprovalAction`, `ReviewComment`, `Recommendation`, `NotificationRecipient`. (`features/leave/schemas/leave.schema.ts`: `LeaveRequest`, `LeaveRequestDetail`, `LeaveBalance`, `LedgerEntry`, `ApprovalStep`, `ApprovalAction` (comments and recommendations are action kinds), `Participant` (recipients), `RoutePreview`, `ApprovalTask`, `LeaveSummary`, application form schema.)
  - [x] Roles in a request modelled separately: recipient, reviewer, approver, final decision-maker. (`participant.kind` ∈ decision_maker / reviewer / recipient; with "any one decides" (D-089) approver and final decision-maker are the same people; `all`/sequential rules are supported by the engine.)
- [x] **P5-T02** Pure balance module: allocated, used (approved only), remaining; per-category isolation; pending/declined/cancelled never deduct. (`lib/balance.ts` computed from the ledger.)
  - [x] Negative-balance behavior **answered: not allowed (D-088)**. Submission and approval are refused when the balance does not cover the request; pending requests do not reserve days.
- [x] **P5-T03** Ledger model and view: every change (allocation, approval deduction, reversal if cancellation allowed, HR adjustment) is an immutable entry with actor, timestamp, reason and reference to the request. (Append-only; one deduction/reversal per request; Ledger tab on My leave and HR balances page.)
- [x] **P5-T04** `LeaveService` and `ApprovalService` interfaces; mock and HTTP implementations.
  - [x] Mock implementation simulates idempotency (double approve is rejected) and concurrent-decision conflict responses. (409 `already_decided`; 409 `conflict` on a stale `version`; 409 `insufficient_balance`.)
- [x] **P5-T05** Leave balances page for employees (allocated/used/remaining per category) and HR view for any employee. (`/leave`, `/leave/balances`.)
- [x] **P5-T06** Leave application form: type, start date, end date, requested duration, reason, optional attachment, selected manager(s) where applicable. (`/leave/apply` with live duration, balance after the request, participants preview.)
  - [x] Duration computation **answered (D-088)**: Monday–Friday, public holidays excluded (none defined until P8-T14), whole days only (`lib/duration.ts`).
  - [x] Overlap, backdated and past-dated leave rules **answered (D-088)**: no overlap with own pending/approved leave; past dates allowed and marked backdated.
  - [x] Attachment rules **answered (D-088)**: optional, PDF/JPG/PNG up to 5 MB (`LEAVE_ATTACHMENT_RULES`).
- [x] **P5-T07** Routing logic (pure, tested) implementing confirmed rules: Employee → selected manager(s); Employee without manager → HR; Manager → HR; Associate PM → Senior PM. HR, Senior PM and Team Lead own-leave routing **answered (D-089)**: Team Lead → own manager(s), Senior PM → HR, HR Administrator → another HR Administrator. (`lib/routing.ts`; Associate PM without a Senior PM → HR, provisional D-090.)
- [x] **P5-T08** Workflow engine representation supporting configurable **sequential** and **parallel** review. Parallel completion rule **answered (D-089): any one decides**; the field stays configurable (`any`/`all`) and every rule is tested. (`lib/workflow.ts`; no escalation, provisional D-090 / Q-APPR-07.)
- [x] **P5-T09** Approval inbox for approvers (pending, history), filtering and sorting. (`/leave/approvals`: type filter, sort by submission or start.)
- [x] **P5-T10** Review actions: Manager final approve/decline; Associate PM participation (cannot override Manager's final authority); Team Lead review, comment, recommend; Senior PM approval of Associate PM leave; HR monitoring view. (Request page; HR monitoring = Leave records; HR override with reason, D-089.)
  - [x] Authorization of Associate PM **answered (D-089)**: the Associate PM of the requester's project is an optional reviewer automatically.
  - [x] "Project Manager's final authority" **answered (D-089)**: means the Manager.
- [x] **P5-T11** Self-approval prevention (UI disabling and pure rule tests; backend must enforce). (Requester gets only `cancel`; routing never assigns the requester.)
- [x] **P5-T12** Rejection requires a reason (form validation and tests). (Declines, HR overrides and comments: min. 5 characters, UI and mock.)
- [x] **P5-T13** Cancellation by requester for pending requests; cancellation of **approved** leave **answered (D-088)**: requester until the day before the start, days returned by a ledger reversal.
- [x] **P5-T14** Leave history for employees; HR-wide leave list with filters (status, type, department, dates). (`/leave` requests tab; `/leave/records` with status, type, department (HR), employee, dates, pagination and CSV export; managers and leads see their scope.)
- [x] **P5-T15** Leave allocation configuration UI for HR (allocations per category per employee or policy level; entry points only; calendar/anniversary logic **BLOCKED by Q-LEAVE-01/02/03**). (Per-employee adjustments with a reason; policy 7/7/7 shown read-only; calendar year, no proration/carry-forward, provisional D-090.)
- [x] **P5-T16** HR as mandatory notification recipient on leave lifecycle events (cannot be removed in UI; tests). (HR is a `mandatory` recipient on every request and shown locked; the notifications themselves come in Phase 6.)
- [x] **P5-T17** Dashboard integration: replace placeholder leave data on all dashboards with the leave services. (Approval inbox, team/own requests, own balances, Senior PM and HR leave counts; attendance "on leave" count from approved leave.)
- [x] **P5-T18** Update `API_INTEGRATION.md` and backend specification notes: transactional approval with `select_for_update`, unique constraints preventing duplicate deductions, ledger immutability, state machine for request status, idempotency keys. (§6 Leave and approvals; full specification in P9-T12, D-080.)

### Required tests
- Balance: approved deducts from selected category only; pending/declined/cancelled do not; categories independent; allocated/used/remaining consistency.
- Ledger: entries immutable in mock; sums reconcile with balance.
- Routing: each confirmed rule, including no-manager employee, manager's own leave, Associate PM's own leave; multi-manager selection.
- Workflow: sequential order enforcement; parallel independent actions; no default parallel completion rule assumed (tests parameterize all configured rules).
- Self-approval blocked; rejection without reason blocked; double-approval rejected (idempotency); concurrent conflict surfaces a clear error.
- HR cannot be removed from recipients.
- Associate PM cannot override Manager's final decision.
- Form: validation, attachments (type/size via configurable constants), date range validation (end ≥ start).

### Acceptance criteria
- All confirmed routing and authority rules are implemented and tested.
- No unresolved policy is silently decided; each blocked item is documented and isolated.
- Balances and ledger reconcile in all test scenarios.
- Employee sees allocated/used/remaining per category.
- Mock behavior clearly indicated as mock.

### Deliverables
- Leave and approvals features, ledger, workflow representation, updated API/backend docs.

---

## PHASE 6 — Notifications

**Objectives:** In-app notification center and notification preferences against mock services.
**Dependencies:** Phase 5 (events), Phase 2 shell.
**Status:** Not started.
**Open items:** Q-NOT-01 (email channel scope), Q-NOT-02 (attendance reminder rules), Q-NOT-03 (announcement targeting and retention).

### Tasks and subtasks

- [ ] **P6-T01** Types/schemas: `Notification`, `NotificationType` (leave submitted, approved, declined, cancelled, approval required, attendance reminder, HR announcement), read/unread state.
- [ ] **P6-T02** `NotificationService` (mock/HTTP): list (paginated), unread count, mark read, mark all read.
- [ ] **P6-T03** Notification center in the top navigation: unread badge, dropdown list, link to the related item.
- [ ] **P6-T04** Notification history page with filters (type, read/unread, date).
- [ ] **P6-T05** Leave lifecycle notifications wired to Phase 5 events; HR always included (mock logic mirrors the rule).
- [ ] **P6-T06** Approval-required notifications to the relevant approvers/reviewers.
- [ ] **P6-T07** Attendance reminders (display only; schedule rules **BLOCKED by Q-NOT-02**).
- [ ] **P6-T08** HR announcements: create (HR only) and display; targeting/retention **BLOCKED by Q-NOT-03**.
- [ ] **P6-T09** Polling or refetch strategy for unread count using TanStack Query (real-time transport such as WebSockets is not introduced without a requirement; record decision).
- [ ] **P6-T10** Update API docs and backend notes (event-driven creation, recipient resolution server-side, Celery/email only if Q-NOT-01 requires it).

### Required tests
- Unread count updates after mark-read; mark-all-read; pagination.
- Each notification type renders correctly with its link.
- HR present in leave notification recipients.
- Empty and error states; accessible dropdown (keyboard, focus trap/escape).

### Acceptance criteria
- Notifications appear for each confirmed lifecycle event in mock mode.
- Read/unread state persists in mock session.
- No external infrastructure introduced.

### Deliverables
- Notification center, history, announcements UI, updated docs.

---

## PHASE 7 — Excel imports

**Objectives:** Safe import UX for employees, historical attendance, historical leave and leave balances, with preview, mapping, validation, duplicate detection, dry run, row errors, execution and history. Real processing is done by Django.
**Dependencies:** Phases 3, 4, 5.
**Status:** Not started.
**Open items:** Q-IMP-01 (client vs server preview), Q-IMP-02 (duplicate/overwrite policy details), Q-IMP-03 (templates and required columns), Q-IMP-04 (size limits), Q-IMP-05 (historical data effect on ledger/balances).

### Tasks and subtasks

- [ ] **P7-T01** Types/schemas: `ImportJob`, `ImportType`, `ColumnMapping`, `RowValidationResult`, `ImportError`, `ImportSummary`.
- [ ] **P7-T02** `ImportService` (mock/HTTP): create job (upload), get preview, submit mapping, dry run, execute, list history, get job, download error report.
- [ ] **P7-T03** Upload step: `.xlsx` and `.xls` only; size/type validation for UX; clear rejection messages; untrusted-file handling documented.
- [ ] **P7-T04** Preview step: show first N rows and detected columns. Parsing location **BLOCKED by Q-IMP-01** (client parse library vs server preview). Build the UI against the service contract so either approach fits.
- [ ] **P7-T05** Column mapping UI: map spreadsheet columns to system fields, required-field indicators, saved mapping suggestions (local only).
- [ ] **P7-T06** Validation results: row-level errors and warnings grouped by type; filter to errors only.
- [ ] **P7-T07** Duplicate detection display (by configurable keys). **Never silently overwrite** existing data; any overwrite requires explicit per-import user choice (policy details **BLOCKED by Q-IMP-02**).
- [ ] **P7-T08** Dry run: shows what would be created/updated/skipped with no persistence; required before execution.
- [ ] **P7-T09** Execution: confirmation dialog summarizing counts; progress and result states; partial-failure handling displayed per row.
- [ ] **P7-T10** Import history list and detail.
- [ ] **P7-T11** Error report download (CSV/XLSX; format recorded in DECISIONS) with formula-injection neutralization.
- [ ] **P7-T12** Per-import-type specifics: employees; historical attendance (Karachi timezone interpretation of timestamps stated explicitly in UI); historical leave; leave balances (effect on ledger **BLOCKED by Q-IMP-05**).
- [ ] **P7-T13** Update API docs and backend notes: background processing only if justified (Celery decision), transactional per-job behavior, idempotency, audit entries for imports.

### Required tests
- File type/size rejection; `.xls` and `.xlsx` accepted.
- Mapping validation (missing required fields, duplicate target mappings).
- Dry run does not mutate mock state; execute requires prior dry run.
- Duplicate rows flagged; no overwrite without explicit choice.
- Error report content correct; formula-injection neutralized.
- History displays outcomes accurately.

### Acceptance criteria
- Full flow upload → preview → mapping → validate → dry run → execute → history works in mock mode.
- No silent overwrite path exists.
- UI states that authoritative processing is done by the backend.

### Deliverables
- Imports feature, error report downloads, updated docs.

---

## PHASE 8 — Reports, settings and audit

**Objectives:** Reporting, administrative settings and audit log views against mock services.
**Dependencies:** Phases 3–7.
**Status:** Not started.
**Open items:** Q-REP-01 (export formats), Q-SET-01 (settings versioning and effective dates), Q-SET-02 (holiday calendar scope), Q-AUD-01 (retention and visibility), plus any Phase 4/5 questions that affect reports.

### Tasks and subtasks

#### Reports
- [ ] **P8-T01** `ReportService` (mock/HTTP) with typed filters and results.
- [ ] **P8-T02** Attendance report (date range, department/team/employee).
- [ ] **P8-T03** Late arrival report (uses Late-In tracking only; no payroll implications).
- [ ] **P8-T04** Leave utilization report.
- [ ] **P8-T05** Leave balances report.
- [ ] **P8-T06** Department report.
- [ ] **P8-T07** Employee report.
- [ ] **P8-T08** Filtering, sorting, pagination, charts (Recharts) where useful.
- [ ] **P8-T09** Exports (formats recorded in DECISIONS), formula-injection neutralized, large-export UX.
- [ ] **P8-T10** Role-scoped report access (UX; backend authoritative).

#### Settings
- [ ] **P8-T11** Attendance policy settings screen (displays confirmed policy; editing of values **only if** the user confirms policies are editable, see Q-SET-01).
- [ ] **P8-T12** Leave allocation settings (per category; HR-configurable). Year definition, proration and carry-forward fields **BLOCKED** until Q-LEAVE-01/02/03 are answered.
- [ ] **P8-T13** Working days settings (**BLOCKED by Q-LEAVE-04** / Q-ATT-05 for semantics).
- [ ] **P8-T14** Holidays management (**scope BLOCKED by Q-SET-02**).
- [ ] **P8-T15** Approval workflow settings (sequential/parallel configuration; parallel completion rule **BLOCKED by Q-APPR-03**).
- [ ] **P8-T16** Company information and organization settings.

#### Audit
- [ ] **P8-T17** `AuditService` (mock/HTTP): list with filters (actor, action, entity, date), detail with before/after.
- [ ] **P8-T18** Audit views for: employee changes, attendance corrections, leave approvals, leave rejections, leave ledger transactions, imports, administrative changes.
- [ ] **P8-T19** Audit log is read-only in UI; no edit/delete controls.
- [ ] **P8-T20** Update API docs and backend notes (audit model, append-only guarantees, retention per Q-AUD-01).

### Required tests
- Each report: filter combinations, empty/error states, export content.
- Settings forms validation; permission UX (HR only).
- Audit list filters, detail rendering, read-only behavior.
- Late arrival report uses the confirmed boundary (reuses Phase 4 policy; no duplicate logic).

### Acceptance criteria
- All listed reports, settings and audit categories are available in mock mode.
- Blocked settings are not implemented by assumption.
- Audit UI offers no mutation actions.

### Deliverables
- Reports, settings and audit features, updated docs.

---

## PHASE 9 — Testing, hardening, documentation and integration readiness

**Objectives:** Production-quality frontend ready to integrate with the Django backend; complete backend and API documentation.
**Dependencies:** Phases 1–8 complete (or explicitly scoped by the user).
**Status:** Not started.

### Tasks and subtasks

#### Testing and quality
- [ ] **P9-T01** Coverage review: all pure policy modules (attendance, leave, routing, workflow, hierarchy) have thorough unit tests; document coverage numbers actually measured.
- [ ] **P9-T02** Integration tests for critical flows per role (login → dashboard; check-in/out; leave apply → approve; import dry run).
- [ ] **P9-T03** End-to-end tests (tool choice recorded in DECISIONS) for the critical flows in mock mode.
- [ ] **P9-T04** Accessibility audit (keyboard navigation, focus management, contrast, labels, landmarks, screen-reader checks on key pages).
- [ ] **P9-T05** Responsive review (mobile navigation, mobile tables) at defined breakpoints.
- [ ] **P9-T06** Performance review: bundle analysis, route-level code splitting, large-table and org-chart behavior.
- [ ] **P9-T07** Error-handling review: network failure, 401, 403, 404, 409 (conflict), 422 (validation), 5xx.

#### Security hardening
- [ ] **P9-T08** Dependency audit (`pnpm audit`) with results recorded; address or document findings.
- [ ] **P9-T09** Token storage/refresh implementation per D-078/D-079 (review in hardening); XSS review; Content Security Policy guidance documented.
- [ ] **P9-T10** Review that no secrets, tokens or personal data appear in code, mocks, logs or docs.
- [ ] **P9-T11** Verify all frontend guards are documented as UX-only and that no business-critical decision relies on frontend-only enforcement.

#### Integration readiness
- [ ] **P9-T12** Create `docs/BACKEND_SPECIFICATION.md`: Django app responsibilities (accounts, employees, organization, attendance, leaves, approvals, notifications, imports, reports, audit); models, fields, relationships, indexes, constraints, deletion behavior; JWT authentication; roles and object permissions; attendance calculations in `Asia/Karachi`; leave calculations; approval workflows with transactions and row locking; notifications; Excel imports; audit logs; security; API endpoints with request/response examples; implementation roadmap. Unresolved questions are listed as open, not answered.
- [ ] **P9-T13** Complete `docs/API_INTEGRATION.md`: base URL, authentication, JWT refresh, request/response formats, pagination, filtering, errors, date/timestamp formats, file uploads, endpoint-to-frontend mapping table (every service method ↔ endpoint ↔ screen), environment variables.
- [ ] **P9-T14** Contract check: for every service interface, confirm the documented endpoint contract matches the TypeScript types (a documented checklist or a contract test).
- [ ] **P9-T15** HTTP service implementations completed for every domain against the documented contracts (testable with a mock HTTP server in tests).
- [ ] **P9-T16** Dry-run switch to `VITE_USE_MOCK_API=false` against a stub/mock HTTP server to prove no screen rewrite is needed.
- [ ] **P9-T17** Final documentation pass: README (setup, scripts, structure, env, mock vs real mode, testing), plan and decisions are accurate.
- [ ] **P9-T18** Final verification: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, e2e suite; results recorded.

### Acceptance criteria
- All checks pass with recorded results; coverage numbers are real.
- Backend specification and API integration docs are complete enough for a backend developer to implement without the frontend source.
- Mock-to-real switch requires configuration only.
- Open questions that remain are explicitly listed, not silently resolved.

### Deliverables
- Hardened app, test suites, `docs/BACKEND_SPECIFICATION.md`, `docs/API_INTEGRATION.md`, final README.

---

## E. CHANGED FILES LOG

Append entries; do not rewrite history.

| Date | Session | File | Change (created/modified/deleted) | Notes |
|---|---|---|---|---|
| 2026-11-25 | Planning | `CLAUDE.md` | created (generated outside Claude Code) | Awaiting placement and verification |
| 2026-11-25 | Planning | `docs/IMPLEMENTATION_PLAN.md` | rewritten (replaces basic Phase 1 checklist) | Awaiting placement and verification |
| 2026-11-25 | Planning | `docs/DECISIONS.md` | created | Awaiting placement and verification |
| 2026-11-25 | Doc integration | `docs/IMPLEMENTATION_PLAN.md` | moved from repo root (content unchanged at move, SHA-256 verified), then modified | Status, next session, Phase 0 progress, per-phase Status lines, "Goal" → "Objectives", Phase 0 test note, logs |
| 2026-11-25 | Doc integration | `docs/DECISIONS.md` | moved from repo root (SHA-256 verified), then modified | Added D-032, R-015, R-016, Q-GIT-01, Q-PROJ-01, Q-PROJ-02; R-003 status; D-011 verified; change log |
| 2026-11-25 | P1-T02 | `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `.oxlintrc.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css` | created | Adapted from `create-vite@9.3.4` react-ts template (scaffolded in scratchpad) |
| 2026-11-25 | P1-T02 | `.gitignore` | modified (append only) | Added `dist-ssr/`, `*.local`, `.idea/` |
| 2026-11-25 | P1-T03 | `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `src/index.css`, `src/App.tsx` | modified | Tailwind v4 plugin, design tokens, token preview placeholder |
| 2026-11-25 | P1-T04 | `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx` | created | shadcn config, `cn` helper, Button (via `shadcn add`) |
| 2026-11-25 | P1-T05 | `package.json`, `pnpm-lock.yaml` | modified | Core libraries added (no source changes) |
| 2026-11-25 | P1-T06 | `tsconfig.test.json`, `src/test/setup.ts`, `src/test/color-contrast.ts`, `src/test/color-contrast.test.ts`, `src/test/design-tokens.test.ts`, `src/test/environment.test.ts`, `src/lib/utils.test.ts`, `src/App.test.tsx` | created | Test config, helpers and first tests |
| 2026-11-25 | P1-T06 | `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `src/index.css` | modified | Test deps + scripts; Vitest config; test tsconfig reference; app tsconfig excludes tests; Tailwind `@source not` for tests |
| 2026-11-25 | P1-T07 | `.prettierrc.json`, `.prettierignore` | created | Prettier config |
| 2026-11-25 | Workflow | `CLAUDE.md`, `docs/DECISIONS.md` | modified | Commit message convention (`CLAUDE.md` §8, D-039) |
| 2026-11-25 | Workflow | `CLAUDE.md`, `docs/DECISIONS.md` | modified | Added `chore:` commit type (D-039) |
| 2026-11-25 | P1-T08 | `docs/ARCHITECTURE.md` | created | Folder map, dependency rules, service pattern, naming, deviations |
| 2026-11-25 | P1-T08 | `.oxlintrc.json`, `CLAUDE.md`, `docs/DECISIONS.md` | modified | Import-boundary and no-cycle lint rules; links to ARCHITECTURE.md; D-075 |
| 2026-11-25 | P1-T09 | `src/lib/env.ts`, `src/lib/env.test.ts`, `src/types/vite-env.d.ts`, `.env.example` | created | Typed env module, tests, env types, example file |
| 2026-11-25 | P1-T09 | `src/main.tsx`, `tsconfig.test.json`, `CLAUDE.md`, `docs/DECISIONS.md` | modified | Env validated at startup; test tsconfig includes `src/types`; preview note; D-076, R-021 |
| 2026-11-25 | P1-T10 | `src/services/api/{api-error,http-client,index}.ts`, `src/services/api/http-client.test.ts` | created | HTTP client, ApiError, tests |
| 2026-11-25 | P1-T11 | `src/services/registry.ts`, `src/services/registry.test.ts`, `src/services/health/{health.service,health.http,health.mock}.ts`, `src/services/mock/latency.ts` | created | Registry and reference service |
| 2026-11-25 | P1-T12 | `src/constants/app.ts`, `src/lib/datetime.ts`, `src/lib/datetime.test.ts` | created | Karachi time helpers; `package.json` gains `test:timezones` |
| 2026-11-25 | P1-T13 | `src/app/providers/{query-client,app-providers,app-error-boundary}.tsx?`, `src/app/router/{routes.tsx,router.ts,route-handle.ts,route-error-page.tsx,not-found-page.tsx}`, `src/components/feedback/toaster.tsx`, tests, `src/test/render.tsx` | created | Providers, router, error handling |
| 2026-11-25 | P1-T13 | `src/App.tsx`, `src/App.test.tsx` | deleted | Temporary placeholders replaced by router + shell (as planned) |
| 2026-11-25 | P1-T13 | `src/main.tsx`, `src/test/setup.ts`, `.oxlintrc.json`, `package.json`, `pnpm-lock.yaml` | modified | Mount providers/router; ResizeObserver stub; a11y rule scoped for generated UI; sonner |
| 2026-11-25 | P1-T14/T16 | `src/app/navigation.ts`, `src/app/layouts/app-layout.tsx`, `src/app/layouts/shell/*`, `src/app/app-shell.test.tsx`, 9 `src/components/ui/*.tsx` (generated) | created | App shell and mock badge |
| 2026-11-25 | P1-T15 | `src/components/feedback/{empty-state,error-state,confirm-dialog,loading-skeletons}.tsx`, `src/components/shared/page-header.tsx`, `src/components/feedback/feedback.test.tsx` | created | Feedback components |
| 2026-11-25 | P1-T13 | `src/features/dashboard/{index.ts,api/use-system-health.ts,pages/overview-page.tsx,pages/overview-page.test.tsx}` | created | Phase 1 landing page exercising the full data path |
| 2026-11-25 | P1-T17 | `README.md`, `docs/ARCHITECTURE.md` | modified | Full README (original heading kept); architecture map updated |
| 2026-11-25 | P1-T17 | `docs/API_INTEGRATION.md` | created | API integration skeleton |
| 2026-11-25 | P2 | `src/services/auth/{access-token,refresh-lock,auth-channel}.ts` + test | created | In-memory token, cross-tab refresh lock and logout channel |
| 2026-11-25 | P2 | `src/services/api/{http-client,index}.ts`, `src/services/api/response.ts` (+test), `src/services/registry.ts` (+test), `src/services/mock/latency.ts` | created/modified | Per-request credentials; camelize + contract parsing; registry adds auth, dashboard, mockFixtures; 0 ms mock latency under Vitest |
| 2026-11-25 | P2 | `src/features/authentication/**` | created | Types, schemas, password policy, role routes, AuthService (+http, mock), session provider/context, flow hooks, components, 5 pages, tests |
| 2026-11-25 | P2 | `src/features/dashboard/**` | created/deleted | Dashboard schemas, service (+http, mock), hooks, components, 6 pages, tests; Phase 1 overview page, its hook and test removed |
| 2026-11-25 | P2 | `src/types/hr.ts`, `src/lib/datetime.ts` (+test) | created/modified | Shared HR vocabulary; `shiftDateKey`, `formatDateKey` |
| 2026-11-25 | P2 | `src/components/forms/*`, `src/components/shared/{stat-card,section-card,status-badge,user-avatar}.tsx`, `src/components/ui/{label,card}.tsx` | created | Form field/password input, dashboard building blocks, shadcn label/card |
| 2026-11-25 | P2 | `src/app/guards/*`, `src/app/layouts/auth-layout.tsx`, `src/app/router/{routes.tsx,forbidden-page.tsx}`, `src/app/navigation.ts`, `src/app/layouts/{app-layout.tsx,shell/sidebar-nav.tsx,shell/user-menu.tsx}`, app tests, `src/test/{render.tsx,setup.ts}` | created/modified | Guards, auth layout, route factory with lazy dashboards, role-aware nav, real account menu; old shell test replaced |
| 2026-11-25 | P2 | `.oxlintrc.json` | modified | `jsx-a11y/prefer-tag-over-role` off (ARIA roles kept deliberately, D-082) |
| 2026-11-25 | P3 | `src/features/employees/**`, `src/features/organization/**` | created | Schemas, policy, diff, URL params, hierarchy lib, services (+http, mock), hooks, components, pages, tests |
| 2026-11-25 | P3 | `src/services/mock/{hr-store,mock-session}.ts` (+test), `src/services/registry.ts`, `src/features/authentication/api/auth.mock.ts` | created/modified | Shared mock HR backend, viewer, registry wiring |
| 2026-11-25 | P3 | `src/components/forms/{native-select,checkbox-list,server-errors}.tsx?`, `src/components/tables/pagination-bar.tsx`, `src/components/ui/{tabs,textarea,dialog,table}.tsx`, `src/hooks/use-media-query.ts`, `src/types/api.ts` | created | Shared controls and primitives |
| 2026-11-25 | P3 | `src/app/router/routes.tsx`, `src/app/navigation.ts` (+test), `src/app/layouts/shell/global-search.tsx`, `src/app/app-shell.test.tsx`, `src/test/setup.ts` | modified | Lazy Phase 3 routes, nav items, working global search, store reset in tests |
| 2026-11-25 | P4 | `src/features/attendance/**` | created | Schemas, pure policy (+tests), export, service (+http, mock), hooks, badges, check-in card, record list, calendar, correction dialogs, two pages, tests |
| 2026-11-25 | P4 | `src/services/mock/attendance-store.ts` (+test), `src/lib/csv.ts` (+test), `src/hooks/{use-now,use-online-status}.ts`, `src/features/dashboard/components/live-team-attendance.tsx` | created | Mock attendance backend, CSV helper, clock/online hooks, live team attendance widget |
| 2026-11-25 | P4 | `src/services/mock/hr-store.ts`, `src/services/registry.ts`, `src/test/setup.ts`, `src/app/router/routes.tsx`, `src/app/navigation.ts` (+test), `src/app/app-shell.test.tsx`, dashboard pages, widgets and tests | modified | Scope helpers for attendance, registry wiring, test resets (stores, `onlineManager`), routes and nav, dashboards use the attendance service |
| 2026-11-25 | P4 | `docs/{IMPLEMENTATION_PLAN,DECISIONS,API_INTEGRATION,ARCHITECTURE}.md`, `README.md` | modified | Phase 4 progress, D-086/D-087, attendance endpoints, status |
| 2026-11-25 | P5 | `src/features/leave/**` | created | Policy, duration, balance, routing, workflow (+tests), labels, export, schemas, services (+http, mock), hooks, components, six pages, tests |
| 2026-11-25 | P5 | `src/services/mock/leave-store.ts` (+test), `src/features/dashboard/components/live-leave.tsx` | created | Mock leave backend, live leave dashboard widgets |
| 2026-11-25 | P5 | `src/services/mock/{hr-store,attendance-store}.ts` (+test), `src/services/registry.ts`, `src/test/setup.ts`, `src/app/router/routes.tsx`, `src/app/navigation.ts` (+test), `src/app/app-shell.test.tsx`, dashboard pages, lists and tests | modified | Leave org view, "on leave" count, registry, store reset, routes and nav, dashboards on the leave service |
| 2026-11-25 | P5 | `docs/{IMPLEMENTATION_PLAN,DECISIONS,API_INTEGRATION,ARCHITECTURE}.md`, `README.md` | modified | User answers D-088/D-089, D-090, D-091, leave endpoints, progress |
| 2026-11-25 | P1-T07 | `package.json`, `pnpm-lock.yaml`, `src/App.tsx`, `src/index.css`, `src/lib/utils.test.ts`, `tsconfig.json`, `CLAUDE.md` | modified | Prettier dep + scripts; formatting (wrapping only); command list |
| 2026-11-25 | P1-T04 | `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `src/index.css`, `src/App.tsx`, `.oxlintrc.json`, `CLAUDE.md` | modified | Deps; root paths; CSS imports + radius/heading tokens (colour tokens unchanged); preview uses Button + Lucide; lint override for `src/components/ui/**`; §7 commands corrected |
| 2026-11-25 | Doc integration | `CLAUDE.md` | rewritten | Supplied file was an exact duplicate of `DECISIONS.md` (content preserved in `docs/DECISIONS.md` and in commit `d0fc183`); replaced with Claude Code session instructions |

## F. VERIFICATION LOG

Record real command outputs only. Never invent results.

| Date | Command / check | Result | Notes |
|---|---|---|---|
| 2026-11-25 | `node -v`, `npm -v`, `pnpm -v`, `yarn -v` | v26.13.0, 11.20.0, 12.16.1, 1.22.22 | Phase 0 inspection |
| 2026-11-25 | `sha256sum CLAUDE.md DECISIONS.md` (as supplied) | Identical hashes (`b98617a9…`) | Supplied `CLAUDE.md` was a copy of `DECISIONS.md` |
| 2026-11-25 | `sha256sum docs/*.md` after move | Unchanged vs pre-move; `git hash-object` equals committed blobs `b90758b` (plan) and `0f4e116` (decisions) | Move lost no content |
| 2026-11-25 | `git status`, `git log` | `main` ahead of `origin/main` by 3 (user commits `d0fc183`, `96c69c7`, `b25a165`); only doc files changed | No commit/push by Claude Code |
| 2026-11-25 | `pnpm view <pkg> version engines.node` for core packages | vite 8.3.8, react 19.3.1, typescript 7.0.2, tailwindcss 4.3.5, shadcn 4.23.0, react-router 8.5.3, @tanstack/react-query 5.108.4, @tanstack/react-table 9.3.1, react-hook-form 7.92.0, zod 4.6.7, recharts 3.11.1, vitest 5.1.1, jsdom 31.0.1, eslint 10.15.0; all accept Node 26 | P1-T01 |
| 2026-11-25 | `pnpm dlx create-vite@9.3.4 scaffold-p1 --template react-ts --no-interactive` (in scratchpad, outside repo; no install) | Succeeded; template uses oxlint and TS ~7.0.2; tsconfig has no explicit `strict` | P1-T01; nothing copied into repo |
| 2026-11-25 | `pnpm view typescript-eslint peerDependencies` | `typescript >=4.8.4 <6.1.0` | Conflict recorded as Q-TECH-05 |
| 2026-11-25 | `pnpm install` (first attempt) | pnpm auto-created `pnpm-workspace.yaml` with `minimumReleaseAgeExclude: @types/node@26.6.10` (published < 24 h) | Bypass removed; range relaxed to `^26.6.0`; `pnpm clean --lockfile --yes` + `pnpm install` resolved `@types/node@26.6.6` with no exclusions |
| 2026-11-25 | `pnpm typecheck` | exit 0 | P1-T02, TS 7.0.2 |
| 2026-11-25 | `pnpm lint` | exit 0, no findings | oxlint 1.95.0 |
| 2026-11-25 | `oxlint -c .oxlintrc.json` on a scratchpad probe file (outside repo) | Reported rules-of-hooks error, exhaustive-deps error, jsx-a11y alt-text warning | Confirms config is active |
| 2026-11-25 | `pnpm build` | exit 0; `dist/assets/index-*.js` 219.72 kB (68.68 kB gzip) | Vite 8.3.8 |
| 2026-11-25 | `pnpm add -D tailwindcss@^4.3.0 @tailwindcss/vite@^4.3.0` | Installed 4.3.5; no release-age exclusion needed | P1-T03 |
| 2026-11-25 | WCAG contrast script (OKLCH → sRGB, scratchpad) over `src/index.css` tokens | First run: `info` 4.46:1 FAIL, `input` 1.44:1. After fix (`--info` L 0.53, `--input` L 0.66): all 21 text pairs PASS (min 4.75:1); input 3.11:1; ring 4.43:1 | P1-T03 |
| 2026-11-25 | `pnpm typecheck`, `pnpm lint`, `pnpm build` (after P1-T03) | All exit 0; CSS 11.79 kB (3.13 kB gzip); token utilities (`bg-primary`, `bg-success-subtle`, `shadow-sm`, …) present in built CSS | P1-T03 |
| 2026-11-25 | `shadcn@4.23.0 init -t vite -b radix -p nova` in scratchpad copy (dry run) | Wrote `components.json`, `button.tsx`, `utils.ts`; **overwrote P1-T03 colour tokens** with neutral values (input border back to ~1.3:1), added Geist font, dark block, and `shadcn` as a runtime dependency | Not applied to repo; setup done by hand |
| 2026-11-25 | `pnpm view cn/shadcn/tw-animate-css/radix-ui repository maintainers` | `cn` and `shadcn` published by shadcn from `github.com/shadcn-ui`; `radix-ui` from `radix-ui/primitives`; `tw-animate-css` from `Wombosvideo/tw-animate-css` | Provenance check |
| 2026-11-25 | Node script calling `cn()` on 8 cases (scratchpad) | 8/8 PASS, incl. `text-sm` + `text-success-foreground` kept, `bg-primary` + `bg-success-subtle` → last wins | Custom tokens merge correctly |
| 2026-11-25 | `shadcn add badge` in scratchpad; `shadcn add button` in repo | `index.css` and `package.json` unchanged by `add` (diff) | P1-T04 |
| 2026-11-25 | `pnpm typecheck`, `pnpm lint`, `pnpm build` (after P1-T04) | typecheck 0; lint 0 after scoping `only-export-components` off for `src/components/ui/**` (probe still reports 3 rules); build 0, CSS 23.53 kB / JS 258.38 kB (83.86 kB gzip); contrast script 21/21 PASS | P1-T04 |
| 2026-11-25 | `vite --port 5179` + `curl` `/`, `/src/App.tsx`, `/src/components/ui/button.tsx`, `/src/index.css` | All 200; App imports button and lucide-react; no errors in log; server stopped | P1-T04 |
| 2026-11-25 | `pnpm view <pkg> dist-tags.latest peerDependencies` for P1-T05 libraries | All latest stable; peers satisfied by React 19.3 / Zod 4; recharts needs `react-is` | P1-T05 |
| 2026-11-25 | `pnpm add` P1-T05 libraries | Installed without release-age exclusions; `pnpm ls` shows no peer warnings; pnpm reported `@tanstack/react-table` agent skills awaiting approval (not approved) | P1-T05 |
| 2026-11-25 | `pnpm typecheck` with temporary probe importing all 9 libraries (deleted afterwards) | First run: TS2558 on `createColumnHelper` (v9 needs `<TFeatures, TData>`); after fix: exit 0 | TS 7 compatibility confirmed |
| 2026-11-25 | `TZ=<zone> node` probe: `@date-fns/tz` and `Intl` vs expected Karachi wall-clock for 6 instants (09:15:00/09:15:01 boundary, midnight, summer, offset input) | 6/6 pass under UTC, America/Los_Angeles, Asia/Karachi, Pacific/Kiritimati | D-038 |
| 2026-11-25 | `pnpm typecheck`, `pnpm lint`, `pnpm build` (after P1-T05) | All exit 0; bundle unchanged (258.38 kB JS) as new libraries are not yet imported | P1-T05 |
| 2026-11-25 | `pnpm add -D` vitest, coverage-v8, jsdom, Testing Library packages | Installed; vitest and coverage-v8 both 5.1.1; no peer warnings; no new permission requests (`pnpm permissions list`: only `@tanstack/react-table` skills pending) | P1-T06 |
| 2026-11-25 | `pnpm test` (first runs) | 26 failures: CSS `?raw` import is `''` in Vitest; then `import.meta.url` not `file:` under jsdom. Fixed by `node:fs` + `@vitest-environment node` | P1-T06 |
| 2026-11-25 | `pnpm test` / `pnpm test:tz` | 5 files, 36 tests pass in both (TZ=America/Los_Angeles) | P1-T06 |
| 2026-11-25 | Mutation check: `--info` set back to `oklch(0.55 …)` | Token test failed exactly `--info-foreground on --info`; file restored (hash `bf31e5ac…` unchanged) | Test proves it catches regressions |
| 2026-11-25 | `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage`, `pnpm build` (after P1-T06) | All exit 0; coverage 100% of 1 measurable statement (App/utils only); CSS grew to 23.96 kB from test-only classes → `@source not` added → back to 23.53 kB, same hash as before P1-T06; no test code in JS bundle | P1-T06 |
| 2026-11-25 | `pnpm add -D prettier@^3.10.0` | 3.10.1; no exclusions; no new permission requests | P1-T07 |
| 2026-11-25 | `prettier --list-different .` then per-file diff preview | 4 files (`App.tsx`, `index.css`, `utils.test.ts`, `tsconfig.json`), line wrapping only; applied with `pnpm format` | P1-T07 |
| 2026-11-25 | `pnpm typecheck`, `lint`, `format:check`, `test`, `test:tz`, `build` | All exit 0; 36/36 tests in both runs; build output hashes unchanged (`index-DNW-yCox.css`, `index-8f33dHgQ.js`); `src/components/ui/button.tsx` untouched | P1-T07 |
| 2026-11-25 | `oxlint --rules` | `eslint/no-restricted-imports` and `import/no-cycle` available | P1-T08 |
| 2026-11-25 | Boundary probe (scratchpad project) with the final repo `.oxlintrc.json` | Blocked: 6 violations (feature→`@/services/mock/*`, relative and nested; feature→`./x.mock`, `../api/x.mock`; component→feature); cycle a↔b reported. Allowed: `src/services/registry.ts`, `src/services/api/*`, `*.mock.ts`, `*.test.ts`. First attempt missed nested paths (`*` vs `**`), fixed | P1-T08 |
| 2026-11-25 | `pnpm lint`, `pnpm format:check` on repo after P1-T08 | Exit 0 | P1-T08 |
| 2026-11-25 | `git check-ignore -v .env .env.local .env.development .env.production`; `git check-ignore .env.example` | First four ignored; `.env.example` not ignored; no `.env` files exist | P1-T09 |
| 2026-11-25 | `vitest run src/lib/env.test.ts` | 16/16 pass first run (valid, missing dev/prod, empty-as-missing, 5 invalid booleans, 4 invalid URLs incl. `javascript:`, combined errors) | P1-T09 |
| 2026-11-25 | `pnpm typecheck`, `lint`, `format:check`, `test`, `test:tz`, `build` (after P1-T09) | All exit 0; 52/52 tests in both runs | P1-T09 |
| 2026-11-25 | `pnpm build` without env; and with `VITE_API_BASE_URL=https://hr.example.test/api/v1 VITE_USE_MOCK_API=false` | No-env bundle contains the production check; env bundle inlines the configured URL | P1-T09 (runtime throw itself covered by unit tests, not run in a browser) |
| 2026-11-25 | `vitest run src/services/api` | 25/25 pass first run (URL building, JSON/FormData/204, schema validation, DRF/envelope error normalization, network/timeout/abort, bearer token, single shared refresh, single retry, auth:false, setAuthHooks) | P1-T10 |
| 2026-11-25 | `vitest run src/services` | 32/32 (client + registry: mock vs HTTP by flag, shared contract schema, contract violation rejected, abortable latency) | P1-T11 |
| 2026-11-25 | `node` check of `TZDate(…,'Asia/Karachi')` for 2009-06-01 | `+06:00` (Pakistan DST 2009); 2026 dates `+05:00` | P1-T12: never hardcode +05:00 |
| 2026-11-25 | `TZ=<zone> vitest run src/lib/datetime.test.ts` for UTC, America/Los_Angeles, Asia/Karachi, Pacific/Kiritimati | 32/32 in all four | P1-T12 |
| 2026-11-25 | `pnpm shadcn add sheet dropdown-menu separator input skeleton alert-dialog badge tooltip breadcrumb` | 9 files created; `index.css` and `package.json` unchanged (diff) | P1-T13–T15 |
| 2026-11-25 | `pnpm add sonner@^2.0.0` | 2.0.8 (repo emilkowalski/sonner); no exclusions; no new permission requests | P1-T13 |
| 2026-11-25 | `pnpm lint` after shell | 3 a11y warnings: focusable `span` badge (fixed: real button), `role=status` (removed), shadcn breadcrumb `role=link` (rule scoped off for `src/components/ui/**`) → 0 warnings | P1-T14/T16 |
| 2026-11-25 | `vitest run src/app src/features` | First: 1 failure, `ResizeObserver is not defined` (jsdom); stub added in test setup → 35/35 | P1-T13–T16 |
| 2026-11-25 | `pnpm typecheck`, `lint`, `format:check`, `test`, `test:timezones`, `build` (repo) | All exit 0; 13 files / 158 tests; 3 × 158 in timezone runs; build JS 651.60 kB (203.53 kB gzip), CSS 52.96 kB; Vite warns chunk > 500 kB (single route, no code splitting yet → P9-T06, R-022) | P1-T18 |
| 2026-11-25 | Clean-copy check: `git ls-files -co --exclude-standard` copied to empty dir (88 files, no node_modules, no .env); `pnpm install --frozen-lockfile`; all six checks | All exit 0; 158 tests in each run | P1-T18 acceptance "runs from a clean clone" |
| 2026-11-25 | `pnpm dev` in clean copy + `curl` `/`, `/src/main.tsx`, `/src/lib/env.ts`; repo dev server + deep link `/some/deep/link` | All 200 (SPA fallback works); no errors in logs; servers stopped (ports closed) | P1-T18 (not a visual check) |
| 2026-11-25 | `shadcn add label card` (Phase 2) | 2 files; `index.css`/`package.json` unchanged | P2 |
| 2026-11-25 | `vitest run src/services/api` (credentials option) | 26/26 | P2-T03 |
| 2026-11-25 | `vitest run src/services/auth` | 6/6 (in-memory token, Web Lock name + serialization, real BroadcastChannel between two instances) | P2-T03 |
| 2026-11-25 | `vitest run src/features/authentication` | 44/44 first run (redirect safety incl. `//`, backslash, control chars, auth pages; schemas; mock enumeration-safe errors, rotation, logout, reset, single-use invite; HTTP endpoints, cookies, tokens in body, 503 not treated as signed out) | P2-T01/T02/T05/T06 |
| 2026-11-25 | `vitest run` dashboard services + registry + navigation | 63/63 (all six mock dashboards pass their schemas; 7/7/7 balances; Karachi-relative dates; HTTP camelize + contract rejection) | P2-T12 |
| 2026-11-25 | `vitest run src/app/auth-flow.test.tsx` | First run 19/20: "returns to the requested page after login" failed — GuestOnly redirected to the dashboard and raced the login page's `?redirect=`; fixed (GuestOnly uses `postLoginPath`) → 20/20 | P2-T07/T08 bug fix |
| 2026-11-25 | `vitest run` dashboards (6 × loading/empty/error/loaded + details) | 26/26 | P2-T13…T18 |
| 2026-11-25 | `vitest run src/app src/features` | First 4 failures: 2 wrong test assertions; lazy route needs waitFor; reset/invite pages used the global `services.auth` instead of the session's service (design flaw) → service exposed via auth context → 146/146 | P2 |
| 2026-11-25 | `pnpm typecheck`, `lint`, `format:check`, `test`, `test:timezones`, `build` (Phase 2) | All exit 0; 22 files / 289 tests; 3 × 289 in timezone runs. Build: dashboards split into own chunks (HR chunk with Recharts 413.85 kB / 117.58 kB gzip); main chunk 737.09 kB / 230.34 kB gzip, still above Vite's 500 kB warning (R-022, P9-T06) | P2 acceptance |
| 2026-11-25 | Dev server `curl` of `/`, `/login`, `/forgot-password`, `/reset-password?token=…`, `/invite?token=…`, `/dashboard/hr`, `/profile` and key modules | All 200; no errors in log; server stopped. Not a visual check | P2 |
| 2026-11-25 | `git fetch`, `dev-main` fast-forward to `0dea658` (PRs #1, #2 merged); `phase-3-employees-organization` created and pushed | Baseline typecheck/lint/test/build pass | Phase 3 start (D-083) |
| 2026-11-25 | `shadcn add select checkbox tabs textarea dialog table` | No CSS/package changes; `select` and `checkbox` later removed as unused (native controls chosen) | P3 |
| 2026-11-25 | `vitest run src/features/organization` (hierarchy) | 11/11 first run (self, direct, multi-level, second-manager cycles; transitive reports; tree with multi-manager and cyclic data) | P3-T12/T13 |
| 2026-11-25 | `pnpm lint` after services | `import/no-cycle`: schemas imported `ROLES` from `@/features/authentication` index → registry cycle; fixed by importing `authentication/types` directly | Architecture rule recorded |
| 2026-11-25 | `vitest run src/services/mock` (HR store) | 21/23 first run: two wrong expectations (next code FBX-1021; Engineering headcount 11) → 23/23 | P3-T02/T14 |
| 2026-11-25 | `vitest run` employee + organization pages | Run hung >400 s. Cause: reporting-loop `useEffect` depended on a new array each render → infinite re-render (real bug); also duplicate "Search" accessible names (real a11y bug: directory vs global search) and a test needing table scoping. Fixed: effect depends on message string; labels "Search employees"/"Search people"; global search made functional | P3 bug fixes |
| 2026-11-25 | `pnpm typecheck`, `lint`, `format:check`, `test`, `test:timezones`, `build` (Phase 3) | All exit 0; 28 files / 374 tests; 3 × 374 in timezone runs. Main chunk 488.09 kB / 152.01 kB gzip (below Vite's 500 kB warning now); every Phase 3 page its own chunk | P3 acceptance |
| 2026-11-25 | Dev server `curl` of `/employees`, `/employees/new`, `/employees/e-103`, `/employees/e-103/edit`, `/organization`, `/organization/chart` | All 200; no errors; server stopped. Not a visual check | P3 |
| 2026-11-25 | `git fetch`, `dev-main` fast-forward to `79797cd` (PR #3 merged); `phase-4-attendance` created and pushed | Baseline checks pass | Phase 4 start (D-083) |
| 2026-11-25 | `TZ=<zone> vitest run src/features/attendance/lib` for UTC, America/Los_Angeles, Asia/Karachi | 22/22 in each (check-in 08:00:00…12:00:00 incl. 09:15:00 on time, 09:15:00.001 and 09:15:01 late; checkout 17:44:59/17:45:00/18:00:00/18:30:00; exact durations; midnight 18:59:59Z/19:00:00Z) | P4-T02 required tests |
| 2026-11-25 | `vitest run src/lib/csv.test.ts src/services/mock/attendance-store.test.ts` | 10/10 and 11/11 (formula prefixes `= + - @ tab CR`, quoting, BOM; store 409/400/403/404, scope, filters, correction audit) | P4-T03, P4-T12 |
| 2026-11-25 | `vitest run src/features/attendance/pages` | First 6/10 failed (tables "not found"). Isolated run passed in 100 ms → cause: the offline test's `offline` event set TanStack Query's global `onlineManager` offline, pausing every later query (test-isolation bug). Fixed: test dispatches `online` again and setup resets `onlineManager` → 10/10 | P4 |
| 2026-11-25 | `pnpm typecheck`, `lint`, `format:check`, `vitest run` (whole suite), suite under TZ=UTC / America/Los_Angeles / Asia/Karachi, `build` (Phase 4) | All exit 0; 32 files / 428 tests; 3 × 428 in timezone runs. Main chunk 533.30 kB / 167.52 kB gzip (above Vite's 500 kB warning again, R-022); attendance pages own chunks (6.01 kB, 9.52 kB) | P4 acceptance |
| 2026-11-25 | Dev server `curl` of `/`, `/attendance` and attendance modules | All 200; no errors; server stopped. Not a visual check | P4 |
| 2026-11-25 | `git fetch`, `dev-main` fast-forward to `a8e04c6` (PR #4 merged); `phase-5-leave-approvals` created and pushed | — | Phase 5 start (D-083) |
| 2026-11-25 | User answers to Q-LEAVE-04…11, Q-APPR-01…06, Q-APPR-08 (two question rounds) | Recorded as D-088, D-089 | Phase 5 rules |
| 2026-11-25 | `vitest run src/features/leave/lib` | 65/65 first run (duration incl. weekends/holidays/year boundary, attachments, balances and reconciliation, every routing rule incl. self-exclusion, workflow any/all/sequential, required vs optional review, overrides, cancel windows, status derivation) | P5-T02, T07, T08, T11 |
| 2026-11-25 | `vitest run src/services/mock src/features/leave` | 130/130 first run (leave store: submission validation, routing, recommend → approve with single deduction, 409 already_decided / conflict / insufficient_balance, decline reason, self-approval 403, any-one-manager, HR override, cancellation with reversal, scope, HR adjustments; attendance store updated for "on leave") | P5-T03, T04, T12, T13 |
| 2026-11-25 | `vitest run src/app src/features/dashboard src/features/attendance` | First 6 failures: dashboard unit tests rendered without a router (new links) and expected leave empty states from the stubbed dashboard service; wrapped in `MemoryRouter`, leave empty texts moved to the leave tests, new live-leave dashboard test → 139/139 | P5-T17 |
| 2026-11-25 | `vitest run src/features/leave/pages` | First runs: duplicate links (desktop table + mobile list), section and picker both named "Employee" (section renamed), curly quotes, page `aria-hidden` while dialogs close (test timing) → 11/11 | P5 screens |
| 2026-11-25 | `pnpm typecheck`, `lint`, `format:check`, `vitest run` (whole suite), suite under TZ=UTC / America/Los_Angeles / Asia/Karachi, `build` (Phase 5) | All exit 0; 38 files / 536 tests; 3 × 536 in timezone runs. Main chunk 464.69 kB / 145.79 kB gzip (under Vite's 500 kB warning); leave pages own chunks (2.4–5.0 kB) | P5 acceptance |
| 2026-11-25 | Dev server `curl` of `/leave`, `/leave/apply`, `/leave/approvals` and leave modules | All 200; no errors; server stopped. Not a visual check | P5 |
| 2026-11-25 | `vite --port 5179` + `curl /` | Served `<title>FormbaxHR</title>`; server stopped afterwards | Dev server smoke test |
| 2026-11-25 | Markdown link check + ID cross-reference (grep) | 2 relative links in `CLAUDE.md` resolve; all Q-/D- IDs referenced in the plan and `CLAUDE.md` are defined in `DECISIONS.md`; all 10 phases have Objectives, Dependencies, Status, Required tests, Acceptance criteria, Deliverables | No application code exists yet; no build/test checks possible |

## G. SESSION HISTORY

| Date | Summary | Tasks completed | Blockers found | Next session start point |
|---|---|---|---|---|
| 2026-11-25 | Planning documents generated | None | None | P0-T06 then P1-T01 |
| 2026-11-25 | Documentation integrated into `CLAUDE.md` + `docs/`; audit performed | P0-T05, P0-T06 | Supplied `CLAUDE.md` was a duplicate (resolved by rewrite, Q-PROJ-01); concurrent user commits during session | User review; P0-T07; then P1-T01 after approval |
| 2026-11-25 | User answered Q-TECH-05 (TS 7 + oxlint), Q-GIT-01 (branch per phase), P0-T07; branch `phase-1-foundation` created; P1-T01 done; P1-T02 scaffold done and verified | P0-T07, P1-T01, P1-T02 (except `format`/`test` scripts) | pnpm release-age bypass auto-added and reverted | P1-T03 |
| 2026-11-25 | P1-T03: Tailwind v4 + design tokens with verified contrast | P1-T03 | None | P1-T04 |
| 2026-11-25 | P1-T04: shadcn/ui (Radix, nova) set up manually after dry run showed `init` overwrites tokens; Button + Lucide verified | P1-T04 | None | P1-T05 |
| 2026-11-25 | P1-T05: core libraries installed and verified (TS 7 types, Karachi conversion) | P1-T05 | Agent-skills approval pending user (R-020) | P1-T06 |
| 2026-11-25 | P1-T06: Vitest + Testing Library + jsdom; 36 tests incl. token contrast guard and TZ run | P1-T06 | None | P1-T07 |
| 2026-11-25 | P1-T07: Prettier configured; toolchain complete (P1-T02 closed) | P1-T07, P1-T02 | None | P1-T08 |
| 2026-11-25 | P1-T08: architecture guide + lint-enforced import boundaries (no empty folders) | P1-T08 | None | P1-T09 |
| 2026-11-25 | P1-T09: validated env module (dev defaults, strict production) + `.env.example` | P1-T09 | None | P1-T10 |
| 2026-11-25 | P1-T10…T17 implemented and verified (also from a clean copy); P1-T18 automated part done | P1-T10–T17 | P1-T18 manual browser check pending (no browser available) | User visual check, then Phase 2 |
| 2026-11-25 | Phase 2 implemented and verified: auth (login, reset, invitations, JWT session D-078/D-079, cross-tab), guards, role nav, six dashboards; tests found and fixed a redirect race and a service-instance flaw | P2-T01…T20 | Manual browser checks pending (user); Q-AUTH-01…04 provisional (D-081) | Phase 3 (Q-ORG-* first) |
| 2026-11-25 | Phase 3 implemented and verified: employees directory/profile/create/edit/deactivate, organization management, reporting hierarchy with cycle checks, org chart, scope-aware mock backend; tests found a render loop and duplicate field names (fixed) | P3-T01…T15 | Q-ORG-01…05 provisional (D-084); manual browser checks pending | Phase 4 after PR merge |
| 2026-11-25 | Phase 4 implemented and verified: pure Karachi attendance policy, mock attendance backend, check-in/out card, history, calendar, team/org records with filters, HR corrections with reason and audit history, CSV export, live dashboards; tests found a query-pausing test-isolation bug (fixed) | P4-T01…T14 | Q-ATT-01…07 provisional (D-086); manual browser checks pending | Phase 5 after PR merge |
| 2026-11-25 | Phase 5 implemented and verified: user answered the leave/approval questions (D-088, D-089); pure duration, balance, routing and workflow modules; mock leave backend with concurrency, idempotency and an append-only ledger; balances, application, request page, approvals inbox, leave records, HR balances; live dashboards | P5-T01…T18 | Q-LEAVE-01…03, Q-APPR-07 provisional (D-090); manual browser checks pending | Phase 6 after PR merge |
