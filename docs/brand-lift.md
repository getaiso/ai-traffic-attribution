# Brand Lift Estimation Methodology

## The Attribution Gap

Traditional web analytics (Google Analytics, Plausible, etc.) track **direct referrals** — users who click a link from an AI platform to your site. But this captures only a fraction of AI's true influence.

**The hidden journey:**

```
User asks ChatGPT: "What's the best tool for X?"
         |
         v
ChatGPT mentions your brand in the response
         |
         v
User opens Google, searches "[your brand name]"
         |
         v
User clicks your site from Google results
         |
         v
GA attributes this to "organic search" — NOT to AI
```

This is the **brand lift** from AI — and it's invisible to analytics.

## Measuring Brand Lift

### Step 1: Add a "Where did you hear about us?" survey

Add this to your sign-up or onboarding flow. We use [Tally](https://tally.so) but any form works.

**Recommended options:**
- A) Google Search
- B) LinkedIn
- C) ChatGPT
- D) Other AI (Claude, Perplexity, Gemini)
- E) Word of mouth
- F) Other

### Step 2: Measure GA referral traffic from AI

In Google Analytics 4, check your traffic sources:
- Go to **Reports > Acquisition > Traffic Acquisition**
- Filter by source containing: `chatgpt`, `claude`, `perplexity`
- Note the percentage of total traffic

Or use the GA4 Data API (as this framework does):
```typescript
// Filter for AI referral sources
dimensionFilter: {
  filter: {
    fieldName: 'sessionSource',
    stringFilter: {
      matchType: 'CONTAINS',
      value: 'chatgpt', // or claude, perplexity, etc.
    },
  },
}
```

### Step 3: Calculate the multiplier

```
Brand Lift Multiplier = Survey AI Attribution % / GA AI Referral %
```

**Our real data (Aiso):**

| Metric | Value |
|--------|-------|
| Survey: "ChatGPT" responses | 5% |
| Survey: "Other AI" responses | 5% |
| Survey: Total AI attribution | 10% |
| GA: AI referral traffic | ~1.4% |
| **Brand Lift Multiplier** | **~7x** |

### Step 4: Apply the multiplier

```
Adjusted AI Clicks = Direct AI Referrals × Multiplier
Adjusted AI Conversions = Direct AI Conversions × Multiplier
```

**Important:** Impressions (bot hits) are NOT affected — they're measured independently at the edge.

### Step 5: Sanity check

Your adjusted AI-influenced traffic should **not exceed** your total branded/direct search traffic in GA.

```
Rule: Adjusted AI Clicks ≤ Branded Search Traffic

Why? Because AI brand lift manifests AS branded search.
If your adjustment exceeds branded search, your multiplier is too high.
```

To find branded search traffic in GA4:
- Go to **Reports > Acquisition > Traffic Acquisition**
- Look at `google / organic` traffic
- Cross-reference with Google Search Console for branded query volume

## Multiplier Ranges

Based on our research and data:

| Scenario | Multiplier | Notes |
|----------|-----------|-------|
| B2B SaaS (niche) | 5x - 10x | Users research before buying |
| B2B SaaS (broad) | 3x - 7x | More direct clicks |
| E-commerce | 2x - 5x | More impulse behavior |
| Content/Media | 1.5x - 3x | Users may bookmark directly |

These are estimates. **Your own survey data is the ground truth.**

## Limitations

1. **Survey bias**: Users may not accurately recall where they first heard about you
2. **Multi-touch**: Users may have seen you in AI AND other channels
3. **Sample size**: Need enough survey responses for statistical significance (100+ recommended)
4. **Time lag**: Brand lift may have a delayed effect (days/weeks between AI mention and search)

## Updating Your Multiplier

Recalculate monthly or quarterly:
- Survey data shifts as your traffic mix changes
- AI platforms' citation behavior evolves
- Your brand awareness from other channels changes

## References

- [Aiso Analytics](https://getaiso.com/analytics) — Live implementation of this methodology
- Survey tool: [Tally](https://tally.so) (free, embeddable forms)
