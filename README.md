# Experience Hub

Internal, staff-only case tracking for the **Quality Analyst**, **Curriculum** and
**Mentor** teams, plus the **Experience Hub Dashboard** for super-admins.

Built with Next.js, Tailwind CSS and Supabase (Postgres, Auth and row-level security).
The full specification is in [BRIEF.md](BRIEF.md).

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Foundation: schema, RLS, audit, auth, app shell | Done |
| 2 | Quality Analyst section | Done (with sample records) |
| 3 | Curriculum and Mentor sections | Done (with sample records) |
| 4 | Admin Dashboard and data import | Not started |
| 5 | Netlify deployment | Not started |

## Decisions that differ from the brief

| Date | Decision |
|---|---|
| 2026-09-30 | **Quality Analyst import uses the visible tabs only** (Instructor Complaints, Course Complaints, Low Survey Scores, Returned Cases). Hidden tabs, including Low Survey Scores 2025 and the Provisional Instructor List, are ignored. The instructor list is built from the names in these tabs. |
| 2026-09-30 | **No Course data gap.** The dashboard shows what the Course Complaints tab contains (it has rows inside Jul 2025 – Jan 2026). |
| 2026-09-30 | **No Home page.** The app opens on the Quality Analyst dashboard; the Phase 1 "Test my write access" button was removed (the same checks run in `npm run db:test`). |
| 2026-09-30 | **Records are shown by customer name, not number.** Case tables start with Date, Case (customer name; requester for Instructor requests), Link. Panel titles and the Activity Log also use the name. Case numbers were removed entirely (migration 019). |
| 2026-09-30 | **Mentor import:** the sheet’s Case Type column is kept as a new “Case type” field; “Developmental Psychology” maps to Human Growth and Development; blank Email / SMS previews stay blank. |
| 2026-09-30 | **Courses added:** Allegany College of Maryland Entrance Exam Prep, HESI Mobility/Challenge Prep, ODT Anatomy & Physiology 1, Tutoring - Chemistry, ODT Eng Composition. |
| 2026-09-28 | **Instructor requests have no continuation lines.** Every sheet row is its own request; a blank requester or course stays blank (replaces brief section 6B, "import them as child lines"). |

## Running locally

Setup steps for the project owner are in [docs/setup-phase-1.md](docs/setup-phase-1.md).

| Command | What it does |
|---|---|
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run db:migrate` | Apply new files from `supabase/migrations/` to the Supabase database |
| `npm run db:test` | Check every security rule with temporary users (all rolled back) |
| `npm run db:sample` | Add the clearly marked sample records |
| `npm run db:sample:remove` | Delete every sample record |
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
