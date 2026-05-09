# Vercel deployment — g-pay dashboard

The Next.js dashboard lives at `apps/dashboard/`. It is a 100% static-friendly
frontend that talks to the API gateway over HTTPS at runtime, so Vercel is the
right home for it.

## One-time setup (CLI)

```sh
# 1. Vercel CLI
npm install -g vercel
vercel login          # browser opens, paste the magic link

# 2. Link the project (run from apps/dashboard/)
cd apps/dashboard
vercel link
#   ? Set up and deploy “apps/dashboard”? Yes
#   ? Which scope? <your account>
#   ? Link to existing project? No → create new "gpay-dashboard"
#   ? In which directory is your code? ./
#   ? Want to modify settings? No (Next.js auto-detected)
```

## Configure environment variable

```sh
# Production env: dashboard talks to the server's gateway over HTTP for V1
vercel env add NEXT_PUBLIC_API_URL production
# → enter: http://212.64.210.20
# (Once you have a domain, switch to https://api.your-domain.com)
```

Or in the Vercel UI:
1. Project → Settings → Environment Variables
2. Add `NEXT_PUBLIC_API_URL` = `http://212.64.210.20`
3. Apply to **Production**

## Deploy

```sh
# From apps/dashboard/
vercel --prod
# → returns the public URL: https://gpay-dashboard-<hash>.vercel.app
```

## Verify

1. Open the Vercel URL.
2. Login screen appears.
3. Paste API key `demo-key-please-rotate` (or whichever key you've set on the server).
4. Should redirect to `/deposits` and show the live aggregate from the server.

## Troubleshooting

**Mixed content blocked**: browsers refuse to call `http://` from `https://`. For V1
deployment without a server-side TLS cert, this means you need to either:
- Visit dashboard via Vercel's `https://...vercel.app` and accept that fetches to
  `http://212.64.210.20` may be blocked, OR
- Point a domain at the server, enable Caddy auto-TLS, expose `https://api.gpay.xxx`,
  and point `NEXT_PUBLIC_API_URL` at it.

Recommended next step before going to demo with anyone: get a domain, point an
A record at `212.64.210.20`, edit `deploy/Caddyfile` to use it, redeploy.

**CORS**: the API gateway accepts requests from any origin currently. To restrict,
add the `cors` middleware in `apps/api-gateway/src/index.ts` with explicit origins.

## Future: GitHub Actions auto-deploy

Once the repo lands on GitHub, Vercel can watch the `main` branch and deploy
on every push. From the project's "Git" settings, link the GitHub repo. No
extra config needed — Vercel will run `npm install && npm run build` from
`apps/dashboard/`.
