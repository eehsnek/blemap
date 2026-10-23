# Backend Admin Action Map

This document maps the planned admin feature to the backend that exists today.

## Existing Backend Entry Points

| Admin action | Existing route | Current implementation | Admin readiness |
| --- | --- | --- | --- |
| View cases | `GET /api/cases`, `GET /api/cases/:id` | `caseRoutes.js` -> `caseService.js` -> `caseRepository.js` | Reusable read path; add admin authorization and filters/pagination |
| View pre-cases | `GET /api/precases` | `precaseRoutes.js` -> `precaseRepository.js` | Reusable read path; add admin authorization and processing-state filters |
| View submissions | None | `submissionRepository.js` only inserts and updates embeddings | Add an admin list/detail read path |
| Review or manage cases | `GET /api/cases/assign/:precaseId`; case claim/pain/solve routes | `caseRoutes.js` -> `caseService.js` | Assignment is reusable; add explicit admin update/archive/delete actions and audit logging |
| Manage users | None | Supabase Auth and profile lookup are used by the frontend | Add admin-only user list, role/status update, and disable/delete actions |
| Moderate problematic content | None | No report or moderation persistence exists | Add reports, moderation status, and admin decision actions |
| Confirm submissions as cases | `POST /api/submit` automatically processes a submission | `submissionRoutes.js` -> `submissionService.js` -> `caseService.js` | Change intake to pending review; add admin confirm/reject/duplicate actions |

## Proposed Admin API

All routes below should be mounted under `/api/admin` and protected by the authenticated Supabase user plus an `admin` role check. The admin identity must come from the verified access token, never from `req.body.user_id` or a query parameter.

### Queue and detail views

| Method | Route | Backing data | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/admin/cases` | `cases` | List cases with lifecycle, AI status, report count, and pagination |
| `GET` | `/api/admin/cases/:id` | `cases`, `case_solves`, `case_pains` | Inspect one case and its community activity |
| `GET` | `/api/admin/precases` | `precase` | Review scraped/pre-case records before promotion |
| `GET` | `/api/admin/submissions` | `submissions` | Review pending, processed, rejected, and confirmed submissions |
| `GET` | `/api/admin/submissions/:id` | `submissions` | Inspect raw text, embedding/processing state, and resulting case |
| `GET` | `/api/admin/reports` | `content_reports` | Work the problematic-content queue |

### Decisions and management

| Method | Route | Backing service | Purpose |
| --- | --- | --- | --- |
| `PATCH` | `/api/admin/cases/:id` | `caseService.js` -> `updateCase()` | Edit permitted case fields and lifecycle state |
| `POST` | `/api/admin/cases/:id/archive` | `caseService.js` | Hide a case without deleting its history |
| `POST` | `/api/admin/cases/:id/restore` | `caseService.js` | Restore an archived or moderated case |
| `POST` | `/api/admin/submissions/:id/confirm` | `submissionService.js` / `caseService.js` | Approve a submission and create or attach its case |
| `POST` | `/api/admin/submissions/:id/reject` | submission repository/service | Reject a submission with a reason and retain the audit record |
| `POST` | `/api/admin/submissions/:id/duplicate` | `caseService.js` | Attach a submission to an existing case |
| `POST` | `/api/admin/reports/:id/resolve` | moderation service | Clear, hide, or remove reported content |
| `GET` | `/api/admin/users` | Supabase Admin Auth API + `profiles` | List users with role and account status |
| `PATCH` | `/api/admin/users/:id` | Supabase Admin Auth API + `profiles` | Change role, suspend, or restore a user |

## Required Schema Work

The current SQL files define `user` and `guest` roles only. Before enabling the proposed routes, add a migration that provides:

- an `admin` role and a controlled way to grant it;
- submission ownership and review fields: `user_id`, `review_status`, `reviewed_by`, `reviewed_at`, `review_reason`, and `case_id`;
- case moderation fields: `moderation_status`, `moderated_by`, `moderated_at`, and `moderation_reason`;
- a `content_reports` table with reporter, target type/id, reason, status, reviewer, decision, and timestamps;
- an `admin_actions` audit table recording actor, action, target, before/after data, reason, and timestamp;
- indexes for review queues and report status.

Use archive/moderation states instead of hard deletion for cases and submissions. Confirmed submissions must remain traceable to the case they produced or matched.

## Security Boundary

The service-role client in `database/supabaseAdmin.js` bypasses Row Level Security. It must only be reached after the admin middleware has verified the bearer token and checked the user's role in `profiles`.

The current public routes trust request-supplied user IDs for user actions. That is separate technical debt, but admin routes must not copy that pattern. Admin mutations should derive `actorId` from the verified token and write an `admin_actions` record in the same operation as the decision.

## Implementation Order

1. Add the `admin` role, review/moderation columns, reports, and audit migration.
2. Add token verification and `requireAdmin` middleware.
3. Add admin repositories for queues, users, reports, and audit writes.
4. Add read-only case/pre-case/submission admin routes.
5. Add submission confirm/reject and case archive/restore/edit actions.
6. Add report resolution and user management.
7. Add focused route/service tests with mocked Supabase responses.

Until steps 1 and 2 exist, existing public routes can display data but do not constitute a secure admin backend.
