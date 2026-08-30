# AGENTS.md

## Commands
- `npm run dev` — start the Vite dev server
- `npm run build` — production build (includes PWA)
- `npm run lint` — ESLint with auto-fix (note: `dev-dist/` and `src/DumpingGround/` have pre-existing errors and should be ignored)
- `npm run format` — Prettier on `src/`

## Environment variables
- **Frontend** (`.env`, `VITE_` prefixed, browser-visible):
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Serverless** (`api/`, set in Vercel project settings, NOT in `.env`):
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY`
  - `EMAIL_USER`, `EMAIL_PASS` (Gmail app password)
  - `API_EMAIL_SECRET` — shared secret for cron/batch endpoints (`new_event_email`, `newFaculty_event_email`, `reminder`). Callers must send it as `x-api-secret` header.
- **Never** put server-only secrets (OpenAI, service role, email passwords) in `VITE_` vars — they get bundled into the client.

## Migrations
Apply in order: `supabase/migrations/20260829000001_*`, `20260829000002_*`, `20260829000003_*`.
The Stage 3 migration (`20260829000003`) alters `events.user_id` and `registration_forms.organizer_id` from text to uuid and rewrites dependent RLS policies + the `publish_registration_form` RPC. Review the NOTICE output when applying.
