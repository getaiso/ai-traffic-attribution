# Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA COLLECTION                               │
│                                                                         │
│  ┌─────────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │  Cloudflare Worker   │  │   GA4 (gtag)    │  │  User Survey       │  │
│  │                     │  │                 │  │  (Tally/Typeform)  │  │
│  │  Runs at edge for   │  │  Tracks clicks  │  │                    │  │
│  │  every request.     │  │  & conversions  │  │  "Where did you    │  │
│  │  Detects AI bots    │  │  from AI        │  │   hear about us?"  │  │
│  │  by user-agent.     │  │  referral       │  │                    │  │
│  │                     │  │  sources.       │  │  Reports AI        │  │
│  │  Measures:          │  │                 │  │  attribution %.    │  │
│  │  IMPRESSIONS        │  │  Measures:      │  │                    │  │
│  │                     │  │  CLICKS +       │  │  Measures:         │  │
│  │                     │  │  CONVERSIONS    │  │  TRUE ATTRIBUTION  │  │
│  └──────────┬──────────┘  └────────┬────────┘  └─────────┬──────────┘  │
│             │                      │                      │             │
└─────────────┼──────────────────────┼──────────────────────┼─────────────┘
              │                      │                      │
              v                      v                      v
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES                                  │
│                                                                         │
│  ┌─────────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │  Cloudflare         │  │  GA4 Data API   │  │  Manual Input /    │  │
│  │  GraphQL API        │  │  (googleapis)   │  │  Bing CSV Import   │  │
│  │                     │  │                 │  │                    │  │
│  │  Query by:          │  │  Query by:      │  │  Supplementary     │  │
│  │  - User-agent       │  │  - Source       │  │  data for Bing/    │  │
│  │    patterns         │  │  - Event name   │  │  Copilot citations │  │
│  │  - Date range       │  │  - Date range   │  │                    │  │
│  │  - Zone ID          │  │  - Property ID  │  │                    │  │
│  └──────────┬──────────┘  └────────┬────────┘  └─────────┬──────────┘  │
│             │                      │                      │             │
└─────────────┼──────────────────────┼──────────────────────┼─────────────┘
              │                      │                      │
              v                      v                      v
┌─────────────────────────────────────────────────────────────────────────┐
│                        ANALYTICS API                                    │
│                        /api/analytics                                   │
│                                                                         │
│  1. Fetch Cloudflare bot hits (impressions) via GraphQL                 │
│  2. Fetch GA4 referral sessions (clicks) via Data API                  │
│  3. Fetch GA4 conversion events via Data API                           │
│  4. Parse Bing CSV for additional citations                            │
│  5. Merge into unified time-series + funnel metrics                    │
│  6. Calculate: CTR, conversion rate, pipeline efficiency               │
│                                                                         │
│  Output:                                                                │
│  {                                                                      │
│    totalVisits: 1247,         // impressions                            │
│    funnel: {                                                            │
│      impressions: 1247,       // bot hits (CF + Bing)                  │
│      clicks: 89,              // AI referrals (GA4)                    │
│      conversions: 12,         // AI-attributed events (GA4)            │
│      conversionRate: 13.48,   // conversions / clicks × 100           │
│      clickThroughRate: 7.14   // clicks / impressions × 100           │
│    },                                                                   │
│    brandLift: {                                                         │
│      surveyAttributionPct: 10,   // from user survey                   │
│      gaReferralPct: 1.4,         // from GA4                           │
│      liftMultiplier: 7.1,        // survey / GA ratio                  │
│      adjustedClicks: 632,        // clicks × multiplier               │
│      adjustedConversions: 85     // conversions × multiplier           │
│    },                                                                   │
│    timeSeriesData: [...]      // daily/hourly breakdown                │
│  }                                                                      │
│                                                                         │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   v
┌─────────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD UI                                    │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  FUNNEL CARDS                                                     │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │  │
│  │  │Bot Hits  │ │Referral  │ │Conversns │ │Conv Rate │            │  │
│  │  │(CF/Bing) │ │Clicks    │ │(GA4)     │ │          │            │  │
│  │  │  1,247   │ │(GA4)  89 │ │    12    │ │  13.5%   │            │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  PIPELINE EFFICIENCY (funnel drop-off visualization)              │  │
│  │  Discovery:  ████████████████████████████████████████ 100%       │  │
│  │  Intent:     ███████                                   7%        │  │
│  │  Success:    ██████████████                            13%       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  BRAND LIFT MEASUREMENT                                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │  │
│  │  │Lift: 7.1x│ │Adj Click │ │Adj Conv  │ │Branded   │            │  │
│  │  │survey/GA │ │   632    │ │    85    │ │Srch 3420 │            │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │  │
│  │                                                                   │  │
│  │  Survey: 10% said AI  vs  GA: 1.4% referral                     │  │
│  │  Sanity: 632 adjusted ≤ 3420 branded search  ✓                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  TREND CHARTS (Recharts)                                          │  │
│  │  [Bot Discovery Over Time]  [Conversion Efficacy Over Time]      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  TOP CONVERSION SIGNALS                                           │  │
│  │  ● demo_booking: 8  ● contact_form: 3  ● sign_up: 1            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Bot Detection Patterns

The Cloudflare Worker uses user-agent pattern matching based on official bot documentation:

| Bot | Pattern | Validation |
|-----|---------|------------|
| OAI-SearchBot | `/OAI-SearchBot\/1\.0/i` | — |
| ChatGPT-User | `/ChatGPT-User\/1\.0/i` | Must include `+https://openai.com/bot` |
| GPTBot | `/GPTBot\/1\.1/i` | Must include `+https://openai.com/gptbot` |
| ClaudeBot | `/ClaudeBot/i` | — |
| PerplexityBot | `/PerplexityBot/i` | — |
| Googlebot | `/Googlebot/i` | — |
| Bingbot | `/bingbot/i` | — |
| meta-externalagent | `/meta-externalagent/i` | — |

## Data Flow

### Impressions (Cloudflare → GraphQL API)

```
Request → Cloudflare Edge → Worker inspects User-Agent
                              → Matches bot pattern?
                              → Yes: Log to Analytics Engine
                              → API queries via GraphQL:
                                 httpRequestsAdaptiveGroups(
                                   filter: { userAgent_like: "%ChatGPT%" }
                                 )
```

### Clicks (GA4 → Data API)

```
User clicks citation in AI response
  → Lands on your site with referrer = chatgpt.com
  → GA4 tracks session with source = "chatgpt.com"
  → API queries GA4 Data API:
     dimensionFilter: { sessionSource contains "chatgpt" }
     metric: sessions
```

### Conversions (GA4 → Data API)

```
User from AI referral triggers event
  → GA4 logs event (demo_booking, sign_up, etc.)
  → API queries GA4 with both source + event filters
  → Returns top conversion events with counts
```

### Brand Lift (Survey + GA → Calculation)

```
Survey: X% of users attribute discovery to AI
GA: Y% of traffic is direct AI referral
Multiplier = X / Y
Adjusted = Measured × Multiplier
Check: Adjusted ≤ Branded search traffic
```
