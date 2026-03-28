# AI Traffic Attribution

**Open-source framework for measuring AI-driven website traffic.**

Track how AI platforms like ChatGPT, Claude, Perplexity, and Gemini drive traffic to your website — including the hidden "brand lift" that traditional analytics miss.

Built and maintained by [Aiso](https://getaiso.com) — we can help with implementation.

```
              AI TRAFFIC ATTRIBUTION FRAMEWORK
              ================================

    +------------------+     +------------------+     +------------------+
    |   IMPRESSIONS    |     |      CLICKS      |     |   CONVERSIONS    |
    |   (Bot Hits)     | --> |   (Referrals)    | --> |    (Events)      |
    +------------------+     +------------------+     +------------------+
    |                  |     |                  |     |                  |
    | Cloudflare Edge  |     | Google Analytics |     | Google Analytics |
    | + Bing CSV       |     | (GA4 Referrals)  |     | (GA4 Events)     |
    |                  |     |                  |     |                  |
    | Detects AI bots: |     | Tracks clicks    |     | demo_booking     |
    | - ChatGPT        |     | from AI sources  |     | sign_up          |
    | - Claude         |     | to your site     |     | contact_form     |
    | - Perplexity     |     |                  |     |                  |
    | - Gemini         |     |                  |     |                  |
    | - Bing/Copilot   |     |                  |     |                  |
    +------------------+     +------------------+     +------------------+
             |                        |                        |
             v                        v                        v
    +------------------------------------------------------------------+
    |                     BRAND LIFT ESTIMATION                         |
    |                                                                    |
    |  The Missing Piece: Most AI influence is invisible to analytics.  |
    |                                                                    |
    |  User sees your brand    User Googles     User converts           |
    |  mentioned in ChatGPT -> your brand   ->  on your site            |
    |                          (not a click!)                            |
    |                                                                    |
    |  +--------------------+    +--------------------+                  |
    |  | Survey Attribution |    | GA Referral Data   |                  |
    |  | "Where did you     |    | Direct AI referral |                  |
    |  |  hear about us?"   |    | traffic measured   |                  |
    |  |                    |    |                    |                  |
    |  | e.g. 10% said AI   |    | e.g. 1.4% from AI |                  |
    |  +--------------------+    +--------------------+                  |
    |            |                        |                              |
    |            v                        v                              |
    |  +------------------------------------------------+               |
    |  |        BRAND LIFT MULTIPLIER = 7.1x             |               |
    |  |        (survey % / GA referral %)               |               |
    |  +------------------------------------------------+               |
    |            |                                                       |
    |            v                                                       |
    |  +------------------------------------------------+               |
    |  | Adjusted Clicks    = Referral Clicks x 7.1     |               |
    |  | Adjusted Conversions = Conversions x 7.1       |               |
    |  +------------------------------------------------+               |
    |                                                                    |
    |  Sanity Check: Adjusted traffic <= Branded search traffic in GA   |
    +------------------------------------------------------------------+
```

---

## The Problem

Google Analytics only tracks **direct referral clicks** from AI platforms. But most users who discover your brand in ChatGPT will **Google your brand name** instead of clicking the link. This means GA massively undercounts AI's true influence.

**Our data:**
- Survey: 10% of sign-ups said they found us via AI/ChatGPT
- GA referral: Only ~1.4% of traffic came as direct AI referrals
- **Brand lift multiplier: 5x to 10x**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR WEBSITE                              │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Cloudflare   │  │   GA4 Tag    │  │  "Where did you hear   │ │
│  │   Worker      │  │  (gtag.js)   │  │   about us?" Survey    │ │
│  │              │  │              │  │  (Tally / Typeform)    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘ │
│         │                 │                      │               │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │                 │                      │
          v                 v                      v
   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
   │  Bot Hits     │  │  Referrals   │  │  Survey Responses    │
   │  (Impressions)│  │  + Events    │  │  (Attribution %)     │
   │              │  │  (Clicks &   │  │                      │
   │  Cloudflare   │  │  Conversions)│  │  Manual / API        │
   │  GraphQL API  │  │  GA4 API     │  │                      │
   └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘
          │                 │                      │
          v                 v                      v
   ┌──────────────────────────────────────────────────────────────┐
   │              ANALYTICS API  (/api/analytics)                  │
   │                                                               │
   │  Combines all sources into unified funnel:                    │
   │  Impressions → Clicks → Conversions → Brand Lift             │
   └──────────────────────────────┬────────────────────────────────┘
                                  │
                                  v
   ┌──────────────────────────────────────────────────────────────┐
   │                    DASHBOARD UI                               │
   │                                                               │
   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                │
   │  │Bot Hits│ │Clicks  │ │Converts│ │Conv %  │                │
   │  │ 1,247  │ │   89   │ │   12   │ │ 13.5%  │                │
   │  └────────┘ └────────┘ └────────┘ └────────┘                │
   │                                                               │
   │  ┌─────────────────────────────────────────────┐             │
   │  │  Brand Lift: 7.1x  │  Adj. Clicks: 632     │             │
   │  │  Survey: 10% AI    │  Adj. Conversions: 85  │             │
   │  │  GA Ref: 1.4% AI   │  Branded Traffic: 3420 │             │
   │  └─────────────────────────────────────────────┘             │
   └──────────────────────────────────────────────────────────────┘
```

## Components

### 1. Cloudflare Worker — Bot Detection (`/cloudflare-worker/`)

Runs at the edge to detect and log AI bot visits (impressions). Detects:
- **OpenAI**: ChatGPT-User, GPTBot, OAI-SearchBot
- **Anthropic**: ClaudeBot
- **Perplexity**: PerplexityBot
- **Google**: Googlebot (Gemini)
- **Microsoft**: Bingbot (Copilot)
- **Meta**: meta-externalagent

Two versions:
- `bot-logger.js` — Full production worker with Analytics Engine + API logging
- `worker-template.js` — Drop-in template for any site (just add your API key)

### 2. Analytics API (`/api/`)

Next.js API route that combines three data sources:

| Source | What it measures | How |
|--------|-----------------|-----|
| **Cloudflare GraphQL** | Bot impressions | User-agent pattern matching at edge |
| **Google Analytics 4** | Referral clicks + conversions | GA4 Data API with source filtering |
| **Bing CSV** | Bing/Copilot citations | Manual CSV import from Bing Webmaster |

### 3. Dashboard UI (`/dashboard/`)

React dashboard showing the full funnel + brand lift measurement.

### 4. Brand Lift Estimation (`/docs/brand-lift.md`)

The methodology for estimating AI's true influence on your traffic.

## Quick Start

### 1. Deploy the Cloudflare Worker

```bash
# Copy the template
cp cloudflare-worker/worker-template.js my-worker.js

# Edit: set your API key and endpoint
# Then deploy via Cloudflare dashboard or wrangler:
npx wrangler deploy my-worker.js --name ai-bot-tracker
```

### 2. Set up GA4 tracking

```bash
# Required environment variables:
GA4_PROPERTY_ID=your-ga4-property-id
GA4_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_API_TOKEN=your-api-token
```

### 3. Add "Where did you hear about us?" survey

Add a simple survey to your sign-up flow. We use [Tally](https://tally.so) but any form tool works. Include options like:
- Google Search
- LinkedIn
- ChatGPT
- Other AI (Claude, Perplexity, etc.)
- Other

### 4. Calculate your brand lift

```
Brand Lift Multiplier = Survey AI Attribution % / GA AI Referral %

Example:
  Survey says 10% found you via AI
  GA shows 1.4% referral traffic from AI
  Multiplier = 10 / 1.4 = 7.1x

Adjusted Clicks = Direct AI Referrals × 7.1
Adjusted Conversions = AI Conversions × 7.1

Sanity check: Adjusted clicks ≤ Total branded search traffic in GA
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Your Cloudflare account ID (Dashboard > right sidebar) |
| `CLOUDFLARE_ZONE_ID` | Yes | Your Cloudflare zone ID (Dashboard > Overview) |
| `CLOUDFLARE_API_TOKEN` | Yes | API token with Zone:Analytics:Read permission |
| `GA4_PROPERTY_ID` | Yes | Your GA4 property ID |
| `GA4_SERVICE_ACCOUNT_KEY` | Yes | Service account JSON for GA4 API access |
| `WEBHOOK_SECRET` | Optional | Secret for Cloudflare Worker webhook auth |

## How Brand Lift Works

Most people who encounter your brand in an AI response don't click the citation link. Instead, they:

1. See your brand mentioned in ChatGPT/Claude/etc.
2. Open a new tab and Google your brand name
3. Click your site from Google results
4. Convert (sign up, book demo, etc.)

This traffic shows up as **branded organic search** in GA — not as an AI referral. The only way to measure this is to **ask your users directly**.

Compare the survey-reported AI attribution against GA's measured AI referral traffic. The ratio is your brand lift multiplier.

> "We consider the brand lift to be 5x to 10x" — based on our own survey data showing 5-10% AI attribution vs 1% GA referral.

## Data Flow

```
AI Bot visits your site
        |
        v
Cloudflare Worker detects bot (user-agent matching)
        |
        v
Logged as "Impression" (bot hit)
        |
        v
Some users click citation link in AI response
        |
        v
GA4 tracks as referral from chatgpt.com / claude.ai / etc.
        |
        v
Logged as "Click" (referral)
        |
        v
Some clicking users convert (sign up, book demo)
        |
        v
GA4 tracks conversion event with AI source attribution
        |
        v
Logged as "Conversion"
        |
        v
Meanwhile: Survey reveals many MORE users came from AI
but arrived via Google search (brand lift)
        |
        v
Multiply clicks & conversions by lift factor
        |
        v
TRUE AI ATTRIBUTION = Measured + Brand Lift
```

## Contributing

PRs welcome! Areas where we'd love help:

- Additional bot detection patterns (new AI agents appear regularly)
- Alternative analytics backends (Plausible, Umami, Matomo)
- Brand lift estimation refinements
- Dashboard improvements
- Documentation and guides

## Need Help?

We built this at [Aiso](https://getaiso.com) and use it in production. We're happy to help with implementation:

- **Website**: [getaiso.com](https://getaiso.com)
- **Analytics demo**: [getaiso.com/analytics](https://getaiso.com/analytics)
- **Issues**: Open a GitHub issue

## License

MIT License — see [LICENSE](LICENSE)
