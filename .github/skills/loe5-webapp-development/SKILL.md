---
name: loe5-webapp-development
description: "Use when continuing, extending, fixing, or reviewing the LOE5 garment-factory operations webapp, including its Next.js pages, server actions, domain modules, Prisma schema, RBAC, and client data isolation."
---

# LOE5 Webapp Development

Use this skill for work in this repository so changes made by different team members follow the same architecture and business rules.

## Project Context

LOE5 is a garment-factory operations platform for multi-client inventory, sample management, production allocation and output, QC, payroll, client portal, and owner AI. The stack is Next.js 15 App Router, React 19, TypeScript, PostgreSQL 16, Prisma, and Amazon Bedrock.

Read the relevant parts of `README.md`, nearby code, and the applicable requirements before changing behavior. The README documents local setup, roles, end-to-end scenarios, Bedrock configuration, and current MVP boundaries. Do not assume a feature or requirement exists just because it is common in similar systems.

## Architecture Rules

- Keep routes and UI in `src/app`. Use `src/app/(app)/<module>/page.tsx` for authenticated module pages and colocate mutations in that module's `actions.ts`.
- Keep business rules and database operations in `src/modules/<module>/service.ts`. Pages and server actions should call services rather than implement domain rules themselves.
- Put reusable infrastructure and cross-module helpers in `src/lib`. Reuse `auth.ts`, `rbac.ts`, `action.ts`, and `db.ts` rather than creating competing mechanisms.
- Keep Prisma models for each business module in their own file under `prisma/schema/`. Put only shared foundation models, enums, generator, and datasource in `base.prisma`.
- Preserve the existing TypeScript, naming, import-alias, and formatting conventions. Keep changes focused and avoid adding dependencies unless they are necessary.

## Security and Business Invariants

- Enforce authentication and module permissions on the server with `requireUser(...)` in every protected page and mutation. Hiding a menu or button is not authorization.
- Enforce client data isolation in server-side reads and writes. A `KLIEN_MAKLON` user may access only records belonging to their own `clientId`; never trust a client ID supplied by a form when the authenticated user determines the scope.
- Preserve warehouse anti-contamination: stock must remain tied to its client and order, and issuing it to a mismatched client/order must be rejected and audited.
- Keep protected business rules in services, including verified production output immutability, QC category requirements, and payroll period finalization constraints. Validate input at the server boundary and in the service where needed to protect non-UI callers.
- Use database transactions for multi-record state changes and preserve existing audit logging for blocked or sensitive operations. Do not turn errors into success-shaped fallbacks or silently ignore failures.
- Treat secrets and `.env` values as private. Never put credentials, real customer data, or secret values in source, logs, examples, or commits.

## Working Across Three Contributors

1. Before editing, identify the feature's module, existing service/action/page, related Prisma models, and any shared callers.
2. Prefer work that stays within one module's `service.ts`, route, actions, and module schema file.
3. Coordinate before changing shared files such as `base.prisma`, `src/lib/*`, root layouts, shared components, or common types. Agree on contracts first when one feature depends on another.
4. Avoid having parallel contributors edit the same files. Keep module schema changes in that module's Prisma schema file to reduce merge conflicts.
5. If a feature requires a shared contract or cross-module behavior, update all affected callers and document the dependency in the implementation summary; do not leave placeholders that appear complete.
6. Review the diff for unintended changes and preserve existing user work.

## Implementation Workflow

1. Inspect the existing implementation and relevant requirements. Trace the full path from page/form through server action to service and database.
2. State or record the intended behavior and important invariants before editing; ask for clarification when requirements leave materially different behavior choices.
3. Implement the smallest complete change in the established layers. Add or update tests when the repository has an applicable test setup; otherwise verify the exact behavior with the available build, Prisma validation, and documented scenarios.
4. For Prisma changes, update the correct schema file, regenerate the client, and create/commit the required migration as part of the coordinated database change. Do not independently apply competing migrations while another contributor is changing the schema.
5. Run the narrowest meaningful validation. `npm run build` checks the app; Prisma commands require a configured database where applicable. The repository may not have dedicated test or lint scripts, so do not claim those ran unless they did.
6. Report files changed, behavior added or preserved, checks run and their results, and any remaining setup or coordination needs.

## Existing Domain Scenarios

When changing a flow, preserve and verify its related scenario from `README.md` where applicable:

- Warehouse: prevent issuing one client's stock to another client's order and record blocked attempts.
- Sample: revisions remain linked and only approved samples can be converted to orders.
- Production: allocation, output recording, and verification are consistent; verified output cannot be edited by a tailor.
- QC: repair/defect outcomes require their categories.
- Payroll: finalized periods cannot be finalized twice.
- Client portal: a client sees only its own data.
- Owner AI: answers derive from application data and unavailable Bedrock configuration does not prevent the rest of the app from running.

## Out of Scope Unless Requested

Do not silently expand the MVP, including login rate limiting, per-article or historical rates, overhead per unit, scrap tracking, or notifications. Raise scope changes explicitly before implementing them.