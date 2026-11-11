# FactSphere

FactSphere is a React/Vite discovery app backed by Supabase. Scheduled Edge Functions collect and verify short facts; only facts that pass the automated evidence threshold are published. Admins can monitor the pipeline, inspect evidence, correct or withdraw a fact, and review reports. There is no separate API server and no manual approval queue.

> **Verification is heuristic, not proof.** The pipeline compares source text, evidence overlap, numeric details, domain reputation, and independent domains. It can miss errors or misread a source. Each published fact links to its source and available evidence; readers should check those references.

## Requirements

- Node.js 20+
- A Supabase project and Supabase CLI
- Optional Unsplash API access key (the pipeline uses category defaults if absent)

## Run the frontend locally

```sh
npm install
```

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Supabase → Project Settings → API**. Use only the public anon/publishable key in the browser. Then run:

```sh
npm run dev
```

Without those values, the frontend shows setup and empty states. It never calls fact or image sources directly.

## Set up the Supabase project

### 1. Apply the database migrations

Apply the SQL files in filename order, either from the Supabase SQL Editor or with the linked Supabase CLI:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migrations create the facts and reports tables, verification metadata and history, admin membership, RLS policies, counter/report RPCs, a public `category-defaults` Storage bucket, and cron jobs:

- `fetch-facts`: every six hours (`0 */6 * * *`)
- `reverify-facts`: daily (`30 3 * * *`), in batches of up to 10

The first migration contains the original schema; the second adds automated verification and dashboard support. Legacy facts without verification evidence are unpublished and held for re-verification.

### 2. Add fallback images

Upload optional `.jpg` images to the public `category-defaults` Storage bucket using these exact filenames:

`science`, `space`, `history`, `animals`, `technology`, `geography`, `food`, `human-body`, `math`, `art`, `sports`, `psychology`, `nature`, `language`, `music`, `economics`

The UI uses an illustrated fallback when an object is missing.

### 3. Create an administrator

Create the user in **Supabase → Authentication → Users**, then add that user to the admin allowlist from the SQL Editor:

```sql
insert into public.admin_users (id)
select id from auth.users where email = 'admin@example.com'
on conflict (id) do nothing;
```

Only membership in `public.admin_users` grants dashboard access. The authenticated dashboard is at `/admin`; sign-in is at `/admin/login`.

### 4. Configure server-side secrets

Add the Unsplash key as an Edge Function secret if you have one:

```sh
supabase secrets set UNSPLASH_ACCESS_KEY=YOUR_UNSPLASH_ACCESS_KEY
```

The scheduled SQL jobs read the project URL and **service-role key** from Supabase Vault. Add them once from the SQL Editor; use your own project values and never paste the service-role key into frontend configuration:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to deployed Edge Functions by Supabase. Never expose the service-role or Unsplash key in a `VITE_*` variable, source control, or browser bundle. The cron jobs are installed by the migration and will fail until both Vault secrets exist.

### 5. Deploy the Edge Functions

```sh
supabase functions deploy fetch-facts
supabase functions deploy reverify-facts
```

Both functions require HTTPS POST. Fetch calls are authorized with the service-role bearer token; re-verification accepts either the scheduled service-role caller or an authenticated admin JWT. The function configuration disables platform JWT verification so each handler can perform its own authorization check.

The fetch pipeline collects Reddit `r/todayilearned`, Wikipedia, Numbers API, and REST Countries data; cleans and filters the text (40–300 characters); deduplicates titles; classifies candidates; looks up Wikimedia Commons or Unsplash imagery; checks source pages and independent references; and stores the result with evidence, verification history, and image attribution. Rejected claims are discarded, and claims that do not meet the threshold remain private. Public pages only query verified, published facts.

For a one-time fetch, invoke the deployed function from a trusted PowerShell terminal using the service-role key without saving it in the project:

```powershell
$headers = @{ Authorization = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY" }
Invoke-RestMethod -Method Post `
  -Uri "https://YOUR_PROJECT_REF.supabase.co/functions/v1/fetch-facts" `
  -Headers $headers -ContentType "application/json" -Body "{}"
```

Set `$env:SUPABASE_SERVICE_ROLE_KEY` only in the current terminal before running the command. Do not use the anon key for this operation. Inspect **Database → Cron Jobs**, `public.pipeline_runs`, and `/admin` to monitor executions.

To pause a scheduled job, run the matching command in the SQL Editor:

```sql
select cron.unschedule('fetch-facts-every-six-hours');
select cron.unschedule('reverify-facts-daily');
```

## Build and deploy

```sh
npm run build
npm run preview
```

Deploy `dist/` to Vercel or Netlify and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's build environment. The included Vercel and Netlify rewrite configuration supports React Router routes. No custom backend deployment is needed.

## Routes

- `/` — fact of the day, trending and recent discoveries
- `/categories` and `/category/:slug` — topic index and paginated facts
- `/fact/:id` — source, evidence, views, likes, related facts, sharing and reports
- `/random` — session-based non-repeating shuffle
- `/search` — search published facts
- `/favorites` — browser-local saved facts
- `/admin/login` and `/admin` — protected monitoring and investigation dashboard
- `/about` — project and data-source notes
