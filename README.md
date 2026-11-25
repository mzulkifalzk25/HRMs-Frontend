# HRMs

**FormbaxHR** is an enterprise HR management system (employees, attendance, leave and approvals, organization, imports, reports, notifications, audit) inspired by Zoho People in functionality, with its own design. This repository is the **frontend**. A separate Django 5.2 + Django REST Framework + PostgreSQL backend will be built later; until then the app runs on **mock services with fictional data**.

> Status: **Phase 1 (project foundation)**. The app shell, service layer, API client, time helpers and tooling are in place. Business modules start in Phase 2. Progress: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

## Technology

| Area | Choice |
|---|---|
| UI | React 19, TypeScript 7 (strict), Vite 8 |
| Styling | Tailwind CSS 4 (design tokens in `src/index.css`), shadcn/ui on Radix, Lucide icons |
| Data | TanStack Query 5, TanStack Table 9, native `fetch` client |
| Forms | React Hook Form + Zod 4 |
| Routing | React Router 8 |
| Dates | date-fns 4 + @date-fns/tz (organization timezone `Asia/Karachi`) |
| Charts | Recharts 3 |
| Quality | Vitest 5 + Testing Library + jsdom, oxlint, Prettier |
| Package manager | pnpm 12 (Node.js ≥ 26, see `.nvmrc`) |

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:5173, mock mode by default
```

No `.env` file is needed for development: missing variables fall back to the defaults in `.env.example` (a console warning says so).

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Type-check and build for production |
| `pnpm preview` | Serve the production build (needs environment variables, see below) |
| `pnpm typecheck` | TypeScript (strict) for app, tests and config |
| `pnpm lint` | oxlint, including architecture import rules |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm test` | Run all tests once |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm test:coverage` | Tests with a coverage report (`coverage/`) |
| `pnpm test:tz` / `pnpm test:timezones` | Tests under `America/Los_Angeles` / under UTC, Los Angeles and Karachi (proves timezone independence; POSIX shells) |

Before finishing a change: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`.

## Environment

| Variable | Example | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Django REST API base URL (http or https) |
| `VITE_USE_MOCK_API` | `true` | `true` = mock services with fictional data, `false` = call the API |

- Copy `.env.example` to `.env.local` to override values locally. `.env*` files are gitignored (except `.env.example`).
- These values are bundled into the browser app: **never put secrets in them**.
- Invalid values always stop the app with a clear error. **Production builds refuse missing values** (they never silently fall back to mock data). To preview a production build locally, create `.env.production.local` from `.env.example` first.

## Mock mode and backend integration

- Every domain has a typed service interface with two implementations: HTTP (`*.http.ts`) and mock (`*.mock.ts`). `src/services/registry.ts` picks one set based on `VITE_USE_MOCK_API`; screens never change.
- In mock mode a **"Mock data"** badge is always visible in the top bar. Mock data is fictional.
- Lint blocks importing mock modules from screens or components.
- The HTTP client (`src/services/api/`) normalizes every failure into an `ApiError`, validates responses with Zod, supports timeouts and cancellation, and has refresh-on-401 hooks (token storage is still an open decision, Q-TECH-01).
- Frontend role checks are for user experience only; the backend is authoritative for authentication, permissions and business rules.
- API conventions and endpoints: [`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md).

## Project structure

```text
src/
  app/          router, providers, layouts (app shell), navigation
  components/   ui/ (shadcn, generated), feedback/, shared/
  features/     one folder per domain (api/, components/, pages/, schemas/, lib/)
  services/     api/ (HTTP client), mock/ (mock infrastructure), registry.ts
  lib/          env, date/time helpers, utilities
  constants/    APP_TIMEZONE, display formats
  test/         test setup and helpers
```

Full rules (dependency directions, naming, deviations): [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Documentation

| File | Contents |
|---|---|
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Phases, tasks, acceptance criteria, progress and verification logs |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Confirmed decisions, recommendations, open questions |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Folder map, import rules, naming |
| [`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md) | API conventions and endpoint contracts for the Django backend |
| [`CLAUDE.md`](CLAUDE.md) | Working rules and session checklist for this repository |

## Commit messages

One line: `<type>: <summary>`, where type is `feat`, `fix`, `refactor`, `docs` or `chore` and the summary is 5–15 words in imperative mood. Details in `CLAUDE.md` §8.
