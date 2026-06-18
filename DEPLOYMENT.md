# MailOS — Free Deployment Plan 🚀

All services below are 100% free tier — no credit card required.

## Architecture

```text
┌──────────────┐                  ┌──────────────┐
│    Vercel    │                  │     Neon     │
│ (Next.js App)│◀────────────────▶│ (PostgreSQL) │
│ Front + APIs │                  │   Free DB    │
└──────────────┘                  └──────────────┘
```

| Service | What | Free Tier |
| :--- | :--- | :--- |
| **Vercel** | Next.js Frontend & Serverless API Routes | Unlimited deploys, custom domain |
| **Neon** | PostgreSQL database | 0.5 GB storage, 1 project |

*(Note: Since MailOS is a single unified Next.js App, we do not need a separate Render service for Express or Upstash for Redis. Vercel hosts both the user interface and the API routes, while Neon handles database storage.)*

---

## Step 1: Database — Neon (PostgreSQL)

1. Go to [neon.tech](https://neon.tech/) → Sign up free
2. Create a new project → name it `mailos-db`
3. Select PostgreSQL version 16 (default)
4. Copy the connection string (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)
5. Save it — this is your **`DATABASE_URL`**

---

## Step 2: Frontend & API — Vercel

Vercel natively supports Next.js applications and handles the automatic routing of backend API endpoints (such as `/api/ai/chat`, `/api/auth/login`, and `/api/settings`) as serverless functions.

1. Go to [vercel.com](https://vercel.com/) → Sign up free
2. Click **Add New Project** → Import your GitHub repository
3. Configure settings:
   *   **Framework Preset**: Next.js
   *   **Root Directory**: (leave default - repository root `./`)
   *   **Build Command**: (leave default - Vercel runs `next build` automatically)
   *   **Output Directory**: (leave default - `.next`)
4. Add these **Environment Variables**:
   *   `NODE_ENV` = `production`
   *   `NEXT_PUBLIC_APP_URL` = `https://yourdomain.vercel.app` *(replace with your actual Vercel URL)*
   *   `DATABASE_URL` = `postgresql://...your-neon-url...`
   *   `JWT_ACCESS_SECRET` = `your-random-32-char-secret` *(generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)*
   *   `CORSAIR_KEK` = `your-random-32-char-secret-starting-with-kek_` *(e.g. kek_abc123xyz7890123456789012345)*
   *   `CORSAIR_DEV_KEY` = `your-corsair-dev-key`
   *   `OPENROUTER_API_KEY` = `your-openrouter-key`
   *   `GOOGLE_OAUTH_CLIENT_ID` = `your-google-oauth-id`
   *   `GOOGLE_OAUTH_CLIENT_SECRET` = `your-google-oauth-secret`
   *   `GOOGLE_OAUTH_REDIRECT_URI` = `https://yourdomain.vercel.app/api/auth/callback` *(replace with your Vercel URL)*
5. Click **Deploy** and wait for the build to complete.
6. Your deployed application URL will be: `https://yourdomain.vercel.app`

---

## Step 3: Run Database Migrations

After Vercel deploys the application, run migrations against your production Neon database. You can do this from your local computer:

```bash
# 1. Update the DATABASE_URL in your local .env file to your Neon production connection string:
DATABASE_URL="postgresql://...your-neon-url..."

# 2. Push the schema to the production Neon database
npx drizzle-kit push
```

---

## Step 4: Update Google OAuth Callback

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project and navigate to **APIs & Services > Credentials**.
3. Under **OAuth 2.0 Client IDs**, edit your web application credentials.
4. Update the fields:
   *   **Authorized JavaScript origins**: `https://yourdomain.vercel.app`
   *   **Authorized redirect URIs**: `https://yourdomain.vercel.app/api/auth/callback`
5. Click **Save**.

---

## Quick Checklist

*   [ ] Neon database created + `DATABASE_URL` copied
*   [ ] Vercel app deployed with all environment variables configured
*   [ ] `npx drizzle-kit push` run against Neon production DB
*   [ ] Google OAuth redirect URI and JavaScript origin updated in Google Cloud Console
*   [ ] Test: registering and logging in on production works
*   [ ] Test: Settings page allows configuration of Google Client credentials
*   [ ] Test: connecting Gmail/Calendar and querying the AI assistant works
