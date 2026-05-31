# Vibeship

Bring your own AI provider keys, vibe-code a single-file web app from a chat
prompt, watch it render live, and publish it to a public HTTPS URL or your own
domain.

- **Connections** — store keys for OpenAI, Anthropic, Groq, NVIDIA NIM,
  OpenRouter, Ollama, or any OpenAI-compatible endpoint. Keys are sealed with
  AES-256-GCM envelope encryption and only ever decrypted server-side.
- **Build** — describe an app; the model streams a self-contained HTML document
  that renders in a sandboxed preview. Iterate with follow-up instructions.
- **Publish** — snapshot the app to `/(s)/<slug>` over the app's TLS, then
  attach a custom domain (DNS `TXT` verification + `CNAME`).

Built on Next.js 16 (App Router) + Supabase (Postgres, Auth, RLS).

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in real values (see below)
npm run dev                  # http://localhost:3000
```

Quality gates:

```bash
npm run typecheck && npm test && npm run build
```

## Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | build + runtime | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build + runtime | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | **secret** — never expose to the browser |
| `APP_ENCRYPTION_KEY` | server only | 32 random bytes, base64 (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | build + runtime | public origin, e.g. `https://vibeship.onrender.com` |

The two `NEXT_PUBLIC_*` Supabase values are inlined into the client bundle at
build time, so they must be present when the build runs. The service-role key
and encryption key are read only on the server.

## Database

Apply the SQL in `supabase/migrations/` to your Supabase project (SQL Editor, or
`supabase db push` with the CLI). They create the provider-connection vault,
usage/rate-limit tables, projects + chat history, and the publishing tables,
all with row-level security.

## Deploy to Render (free)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/the123maiac/random-stuff)

This repo ships a [`render.yaml`](./render.yaml) Blueprint that provisions a free
Node web service with managed TLS at `https://<service-name>.onrender.com`.

1. Push this repo to GitHub (already wired to `origin`).
2. Click the button above, or in the Render dashboard choose
   **New → Blueprint** and select this repo.
3. When prompted, paste the secret env vars: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `APP_ENCRYPTION_KEY`. Leave `NEXT_PUBLIC_APP_URL` blank for now.
4. Wait for the first deploy, then copy the service URL
   (`https://<name>.onrender.com`). Set `NEXT_PUBLIC_APP_URL` to it and trigger a
   redeploy — this turns on full publish links and custom-domain routing.
5. Make sure your Supabase **Auth → URL Configuration** lists the Render URL as
   a redirect URL so email confirmation links work.

Notes:

- Free Render services sleep after inactivity; the first request after a sleep
  is a slow cold start.
- To put a *published app* on your own domain, use the **Publish** panel in the
  builder: add your hostname, create the shown DNS records, and verify. Render
  issues the certificate once DNS resolves to the service.
