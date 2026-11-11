# FactSphere

**The world is more interesting than you think.**

FactSphere is a curiosity-first website for discovering short, surprising facts from across science, space, history, nature, technology, and more. Browse by topic, search for something specific, or shuffle to find an unexpected discovery.

## What you can do

- **Discover something new** with a daily feature, recent discoveries, and trending facts.
- **Explore 16 topics**, from animals and geography to music and economics.
- **Follow a curiosity** with fact pages that link to their sources and available supporting evidence.
- **Save favorites** in your browser, share discoveries, and report a fact for review.
- **Browse your own way** with search, a non-repeating shuffle, and light or dark themes.

## Facts and verification

FactSphere automatically gathers candidate facts and checks their sources and supporting evidence. Only facts that meet the publishing threshold appear publicly; candidates that need more evidence are held back. Administrators can monitor the pipeline, review evidence and community reports, and correct or withdraw a fact.

Automated verification is a helpful filter, **not a guarantee of truth**. It can miss mistakes or misread a source. Each fact links to its source and available evidence, so readers can check the references themselves.

## Built with

React, Vite, and Supabase. Supabase provides the database, authentication, storage, scheduled jobs, and Edge Functions; the responsive interface also includes animations and light and dark themes.

## Run locally

Requires Node.js 20+ and a Supabase project.

1. Install dependencies:
   ```sh
   npm install
   ```
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using your Supabase project's public API credentials.
3. Start the development server:
   ```sh
   npm run dev
   ```

Build for production with `npm run build`. Only use the public anon/publishable key in frontend configuration; never put a service-role key in the browser or in a `VITE_*` variable.
