# Experience Hub

Internal, staff-only case tracking for the **Quality Analyst**, **Curriculum** and
**Mentor** teams, plus the **Experience Hub Dashboard** for super-admins.

Built with Next.js, Tailwind CSS and Supabase (Postgres, Auth and row-level security).
The full specification is in [BRIEF.md](BRIEF.md).

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Foundation: schema, RLS, audit, auth, app shell | Done |
| 2 | Quality Analyst section | Not started |
| 3 | Curriculum and Mentor sections | Not started |
| 4 | Admin Dashboard and data import | Not started |
| 5 | Netlify deployment | Not started |

## Running locally

Setup steps for the project owner are in [docs/setup-phase-1.md](docs/setup-phase-1.md).

| Command | What it does |
|---|---|
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run db:migrate` | Apply new files from `supabase/migrations/` to the Supabase database |
| `npm run db:test` | Check every security rule with temporary users (all rolled back) |
| `npm run build` | Production build (checks everything compiles) |

## How access works

- **Viewer**: reads all three sections.
- **Admin**: reads all three sections; adds, edits and deletes cases only in their assigned sections.
- **Super-admin flag**: opens the Experience Hub Dashboard and changes other users' access. It is separate from role and sections.
- **Deactivated**: banned in Supabase Auth and denied everything by RLS.
- New accounts start deactivated unless created by the Admin Dashboard (Phase 4).

These rules are enforced in the database (`supabase/migrations/`); the UI only reflects them.

## Where things are

```
app/                 pages (app/(app)/ = signed-in pages)
components/          shared UI
lib/                 Supabase clients, auth helpers, navigation
supabase/migrations/ database schema, security rules, audit triggers, seed data
scripts/             migration runner and database security test
data/                instructor master list (placeholder) and import folder
docs/reference/      design prototypes (read-only reference)
```
