# Setup Guide

Complete setup instructions for the AI Traffic Attribution framework.

## Prerequisites

- A website with a domain on Cloudflare (free plan works)
- Google Analytics 4 set up on your site
- A Vercel/Next.js deployment (or adapt the API for your framework)

## Step 1: Cloudflare DNS — Enable Proxy

Your domain's DNS records **must** be set to **Proxied** (orange cloud) in Cloudflare for the Worker to intercept traffic.

1. Go to **Cloudflare Dashboard > your domain > DNS > Records**
2. For your root domain (A or CNAME record) and `www` (CNAME), click **Edit**
3. Toggle **Proxy status** from "DNS only" (grey cloud) to **"Proxied"** (orange cloud)
4. Save


✅ getaiso.com A → Proxied (orange cloud)
✅ www CNAME → Proxied (orange cloud)
❌ DNS only (grey cloud) = Worker will NOT run


**Why this matters:** Cloudflare Workers only execute when traffic passes through Cloudflare's proxy. With "DNS only", requests go straight to your origin (Vercel) and the Worker never sees them.

## Step 2: Deploy the Cloudflare Worker

### Option A: Via Wrangler CLI

```bash
cd cloudflare-worker/
npx wrangler deploy bot-logger.js --name ai-bot-tracker
```

### Option B: Via Cloudflare Dashboard

1. Go to **Workers & Pages > Create Application > Create Worker**
2. Name it (e.g. `ai-bot-tracker`)
3. Paste the contents of `cloudflare-worker/bot-logger.js`
4. Deploy

### Add the Analytics Engine binding

1. Go to your Worker > **Settings > Bindings**
2. Click **Add binding > Analytics Engine**
3. Set:
   - **Variable name:** `BOT_ANALYTICS`
   - **Dataset:** `ai_bot_visits` (or any name — it auto-creates)
4. Save and deploy

### Add Worker Routes

1. Go to your domain > **Workers Routes**
2. Add routes:
   - `yourdomain.com/*` → your worker
   - `www.yourdomain.com/*` → your worker

## Step 3: Environment Variables

Set these in your deployment platform (Vercel, Netlify, etc.):

| Variable | Required | Where to find it |
|----------|----------|-------------------|
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare Dashboard > My Profile > API Tokens > Create Token. Use the "Read analytics and logs" template, or create custom with Account Analytics: Read permission |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare Dashboard > any domain > right sidebar under "Account ID" |
| `CLOUDFLARE_ZONE_ID` | Optional | Cloudflare Dashboard > your domain > Overview > right sidebar. Auto-discovered if not set |
| `GA4_PROPERTY_ID` | Yes | Google Analytics > Admin > Property Settings > Property ID |
| `GA4_SERVICE_ACCOUNT_KEY` | Yes | Google Cloud Console > IAM > Service Accounts > Create key (JSON). Grant "Viewer" role on your GA4 property |

### Creating the GA4 Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable the **Google Analytics Data API**
4. Go to **IAM & Admin > Service Accounts > Create Service Account**
5. Download the JSON key
6. In GA4: **Admin > Property Access Management** > Add the service account email with "Viewer" role
7. Set `GA4_SERVICE_ACCOUNT_KEY` to the full JSON string (or base64-encode it)

### Creating the Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use the "Read analytics and logs" template, OR create a custom token with:
   - Account > Analytics > Read
   - Zone > Analytics > Read (for the specific zone)
4. Copy the token to `CLOUDFLARE_API_TOKEN`

## Step 4: Add "Where did you hear about us?" Survey

Add a survey to your sign-up/onboarding flow. We recommend [Tally](https://tally.so) (free).

**Suggested options:**

- A) Google Search
- B) LinkedIn
- C) ChatGPT
- D) Other AI (Claude, Perplexity, Gemini)
- E) Word of mouth
- F) Other

This powers the **Brand Lift Measurement** — comparing survey attribution against GA referral data.

## Step 5: Optional — Bing CSV Import

1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters) > your site
2. Download the AI citations/performance report as CSV
3. Place it at `data/bing-analytics.csv` in your project
4. Format: `"Date","Citations","Cited Pages"` with dates as `M/DD/YYYY HH:MM:SS AM`

## Verifying the Setup

### Check the Worker is running

Visit your site, then check:

- **Cloudflare Dashboard > Workers > your worker > Metrics** — should show requests
- Look for increasing request counts

### Check the Analytics Engine

Use the debug endpoint:

```
GET /api/analytics?days=7&debug=1&bot=all
```

You should see `blob6` values containing bot names like `ChatGPT_User`, `ClaudeBot`, etc.

### Check the full pipeline

```
GET /api/analytics?days=30&bot=all
```

Should return:

- `totalVisits` > 0 (bot impressions from Analytics Engine + Bing CSV)
- `funnel.clicks` > 0 (GA4 referral sessions)
- `funnel.conversions` ≥ 0 (GA4 conversion events)

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| 0 bot impressions | DNS set to "DNS only" | Enable Proxied (orange cloud) on DNS records |
| Worker shows 0 requests | Routes not configured | Add `yourdomain.com/*` route to your worker |
| Analytics Engine empty | Missing binding | Add `BOT_ANALYTICS` Analytics Engine binding to worker |
| GA4 returns 0 | Wrong service account | Verify GA4 property access for the service account email |
| API returns 500 | Missing env vars | Check all required environment variables are set |
| "Rate limit exceeded" | Too many requests | Wait 1 minute (30 req/min limit) |

## Architecture Recap

```
User visits your site
    ↓
Cloudflare Proxy (orange cloud required!)
    ↓
Worker intercepts → detects bot? → logs to Analytics Engine
    ↓
Request forwarded to origin (Vercel)
    ↓
GA4 tracks referral source + conversion events
    ↓
Analytics API combines: Analytics Engine + GA4 + Bing CSV
    ↓
Dashboard shows: Impressions → Clicks → Conversions → Brand Lift
```
