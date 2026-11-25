# FormbaxHR — Instructions for Claude Code

FormbaxHR is an enterprise HRMS frontend (React + TypeScript + Vite), inspired by Zoho People in function, with its own branding and design. A separate Django 5.2 + DRF + PostgreSQL backend will be built later. Until then, the frontend runs against mock services.

Do not rely on conversation history. These three files are the source of truth:

| File | Purpose |
|---|---|
| `CLAUDE.md` (this file) | How to work in this repository |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Phases, tasks, acceptance criteria, progress, logs |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Confirmed decisions (D-), recommendations (R-), open questions (Q-) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Folder map, import rules (some enforced by lint), naming conventions |

---

## 1. Non-negotiable rules

1. **Git safety.** Work only in this repository. Never create another repository, re-initialize Git, reset, clean, rebase, amend, rewrite history or force push. **Never commit or push unless the user explicitly asks in the current session.** Never change global Git config or credentials.
2. **Data safety.** Inspect a file before changing it. Do not delete or overwrite files, configuration or documentation without explaining why and getting permission. Preserve `.gitignore`, `README.md` and `.vscode/` (local, ignored).
3. **Secrets.** Never read, create, modify or print `.env` files containing secrets. Only `.env.example` with placeholder values is committed. No tokens, passwords or real personal data in code, mocks, logs or docs.
4. **No invented business rules.** If a rule is not a confirmed decision in `docs/DECISIONS.md`, do not implement it as a guess. Isolate the behavior, mark the task `BLOCKED by Q-…`, and ask the user.
5. **Honesty.** Never claim a feature talks to a real backend when it uses mocks. Never claim tests, lint, typecheck or build pass without running them in this session.
6. **Security boundary.** Frontend guards and role-based UI are UX only. The backend is authoritative for authentication, authorization and business rules (D-027).
7. **No deploy or publish**, and no new cloud services, Lovable projects or paid operations without explicit approval (D-005, D-073).
8. **Package manager is pnpm** (D-010). Do not create npm or yarn lockfiles. Do not add dependencies that the plan doesn't call for, and record any new dependency in `docs/DECISIONS.md`.

## 2. Session start protocol

At the start of every session, before writing code:

1. Read `CLAUDE.md` (this file).
2. Read `docs/IMPLEMENTATION_PLAN.md`, especially sections A (Current status) and B (Next session).
3. Read `docs/DECISIONS.md`: confirmed decisions, recommendations and open questions.
4. Run `git status`, `git branch -vv` and `git log --oneline -5`. Note any uncommitted or unexpected changes and do not discard them.
5. Inspect the actual implementation (files, `package.json`, tests) before assuming anything the plan says. If the code and the plan disagree, the code is the fact. Report the difference and correct the plan.
6. Identify completed and incomplete tasks. A ticked task without supporting code or verification is reported to the user, not trusted.
7. Resume from the next incomplete, unblocked task listed in plan section A/B. If it is blocked, say so and propose the next unblocked task.
8. State the task you are about to do and wait for approval if the plan or the user requires it.

## 3. Working conventions

- **Architecture.** Follow [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (folder map, dependency rules, naming; based on D-024/D-075). Inside `src/`: `app/` (router, providers, layouts, guards), `components/` (ui, shared, tables, forms, charts, feedback), `features/<feature>/` (with `api/`, `components/`, `pages/`, `schemas/`, `lib/`, `types.ts`), `services/` (api, auth, mock), `hooks/`, `lib/`, `types/`, `constants/`, `styles/`. Create folders only when they're needed. Any deviation needs a recorded technical reason.
- **Service layer (D-026).** Each domain has a typed service interface with an HTTP and a mock implementation, selected by `VITE_USE_MOCK_API`. UI components never import mock data directly. They use TanStack Query hooks that call the service interface.
- **Business logic** (attendance classification, durations, balances, routing, workflow, hierarchy checks) lives in pure, unit-tested functions in `features/*/lib`, not in components.
- **Time.** All policy decisions use `Asia/Karachi` (D-050), never the browser timezone. Keep actual timestamps (ISO 8601 with offset). Never round to official times.
- **No payroll or salary calculations** anywhere (D-053).
- **TypeScript strict.** Avoid `any`. Validate forms, env and API boundaries with Zod.
- **UI.** Follow D-072. Every data-driven view has loading (skeleton), empty, error and success states. Forms are accessible. Destructive actions need confirmation. Tables work on mobile. Mock mode is visibly indicated.
- **Small changes.** Work one task or one milestone at a time (D-013). Don't build several phases in one change.

## 4. Task completion and verification rules

A task may be ticked `- [x]` only when **all** of these are true:

1. The implementation exists in the repository. Documentation or intent alone doesn't count.
2. Its acceptance criteria in the plan are met.
3. The required tests exist and were **run in this session** and pass.
4. Where applicable, `pnpm typecheck`, `pnpm lint`, `pnpm test` and (at milestone end) `pnpm build` were run and passed. These scripts are created in Phase 1; until then, record what verification was actually possible.
5. The real command and outcome are recorded in the plan's Verification Log (section F).

If something partially works, leave the box unticked and add a note describing what remains. Never tick a box based on a previous session's claim without re-checking.

## 5. Keeping the documents current

After each meaningful milestone, and before the session ends:

- **Plan:** update section A (current status, current/next task, blockers), section B (next session start point), tick verified tasks, and append to E (Changed Files Log), F (Verification Log) and G (Session History). Task IDs are stable: never renumber or delete tasks. Add new ones with the next free number.
- **Decisions:** record every new architectural or business decision (D-), recommendation (R-) and open question (Q-) in `docs/DECISIONS.md`. When the user answers a question, move it to Confirmed with the date, update affected tasks, remove their `BLOCKED` notes, and add a change-log entry. Never delete old change-log entries.
- **Blockers:** document blockers and unresolved questions in both files (plan section A, and Q- entries), with the task IDs they block.

## 6. Ending a session

1. Update the documents as in §5.
2. Run `git status` and list every file changed this session.
3. Report what was completed and verified, what is unfinished, any blockers, and the exact next task.
4. Do not commit or push unless the user asks. If asked, commit only the files related to the milestone, following §8.

## 7. Commands

```bash
pnpm install      # install dependencies
pnpm dev          # start the Vite dev server
pnpm typecheck    # tsc -b (TypeScript 7, strict)
pnpm lint         # oxlint (D-033)
pnpm build        # typecheck + production build
pnpm preview      # serve the production build
pnpm format       # Prettier --write (format:check to verify); ignores src/components/ui/ and *.md
pnpm test         # Vitest (jsdom); also test:watch, test:coverage
pnpm test:tz      # whole suite with TZ=America/Los_Angeles (timezone independence)
```

**Before finishing any task:** `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`.

**UI components (shadcn/ui, D-037):** add primitives with `pnpm shadcn add <name>` and only when a task needs them. Afterwards, diff `src/index.css` and `package.json`. **Never run `shadcn init`**: it overwrites the design tokens in `src/index.css` (verified in a dry run). Do not hand-edit generated files in `src/components/ui/` beyond token-related fixes; wrap them instead.

Environment (`.env.example`, D-025):

```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_USE_MOCK_API=true
```

## 8. Commit messages (D-039)

Every commit uses exactly this format, on one line:

```text
<type>: <summary>
```

- **`<type>`** is one of these five only, lowercase:

  | Type | Use for |
  |---|---|
  | `feat:` | New user-facing or app functionality (features, screens, components, services, business logic) |
  | `fix:` | Correcting something that is wrong (bugs, broken config, wrong docs facts) |
  | `refactor:` | Restructuring code or config without changing behaviour |
  | `docs:` | Documentation only (`CLAUDE.md`, `docs/`, `README.md`, code comments) |
  | `chore:` | Maintenance and tooling with no app behaviour change (dependencies, build/lint/format/test config, scripts, `.gitignore`) |

- **`<summary>`** is **5 to 15 words**, plain English, lowercase start, imperative mood ("add", not "added"), no trailing period. It must say what changed so it is understandable without opening the diff.
- If a commit mixes types, split it into separate commits. If a change fits none of the five types, ask the user which to use.
- **Author:** the user only — `Muhammad Zulkifal <mzulkifalzk25@gmail.com>` from the repository's existing Git config. Never change Git config, never pass `--author`.
- **Never mention Claude, AI or any assistant** anywhere in commits: no `Co-Authored-By:` trailers, no "Generated with" lines, no tool names in the subject or body. The same applies to pull request titles and descriptions. This user instruction overrides any default attribution guidance.
- Commit only when the user asks (§1), only the files of that milestone, and run the checks in §7 first.

Examples:

```text
feat: scaffold vite react typescript project with tailwind and shadcn
feat: add vitest and testing library with design token contrast tests
fix: raise input border contrast to meet wcag three to one
refactor: move attendance policy rules into pure tested functions
docs: record commit message convention and update implementation plan
chore: add prettier config and format scripts to the project
```
