/**
 * AI Bot Detection Worker — Drop-in Template
 *
 * Deploy this on any Cloudflare-proxied site to start tracking AI bot visits.
 *
 * Setup:
 * 1. Replace CLIENT_API_KEY with your identifier
 * 2. Replace API_ENDPOINT with your webhook URL (or remove to use Analytics Engine only)
 * 3. Deploy: npx wrangler deploy worker-template.js --name ai-bot-tracker
 * 4. Add a route: yourdomain.com/* → ai-bot-tracker
 *
 * Part of the AI Traffic Attribution framework.
 * https://github.com/BenUsername/ai-traffic-attribution
 */

// ============================================================================
// CONFIGURATION — Replace these with your values
// ============================================================================

const CLIENT_API_KEY = 'YOUR_API_KEY_HERE';
const API_ENDPOINT = 'YOUR_WEBHOOK_URL_HERE'; // e.g. https://yoursite.com/api/bot-logs

// ============================================================================
// BOT DETECTION PATTERNS
// ============================================================================

const BOT_PATTERNS = {
  // OpenAI
  OAI_SearchBot: /OAI-SearchBot\/1\.0/i,
  ChatGPT_User: /ChatGPT-User\/1\.0/i,
  GPTBot: /GPTBot\/1\.1/i,

  // Anthropic
  ClaudeBot: /ClaudeBot\/1\.0/i,
  Claude: /Claude/i,

  // Perplexity
  PerplexityBot: /PerplexityBot/i,
  PerplexityUser: /Perplexity-User/i,

  // Meta
  MetaExternalAgent: /meta-externalagent/i,

  // Google
  GoogleBot: /Googlebot/i,

  // Microsoft
  BingBot: /BingBot/i,
};

// ============================================================================
// WORKER
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const userAgent = request.headers.get('User-Agent') || '';

      // Detect bots
      const detectedBots = [];
      for (const [botName, pattern] of Object.entries(BOT_PATTERNS)) {
        if (pattern.test(userAgent)) {
          detectedBots.push(botName);
        }
      }
      const isAIBot = detectedBots.length > 0;

      // Forward to origin
      const response = await fetch(request);

      // Build log entry
      const logEntry = {
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        pathname: url.pathname,
        isAIBot,
        detectedBots,
        userAgent,
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        country: request.headers.get('CF-IPCountry') || 'unknown',
        responseStatus: response.status,
        clientApiKey: CLIENT_API_KEY,
        requestId: crypto.randomUUID(),
      };

      // Send to your API (non-blocking)
      if (API_ENDPOINT !== 'YOUR_WEBHOOK_URL_HERE') {
        ctx.waitUntil(
          fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Client-API-Key': CLIENT_API_KEY,
            },
            body: JSON.stringify(logEntry),
          }).catch(err => console.error('API error:', err))
        );
      }

      // Log to Cloudflare Analytics Engine (if configured)
      if (env.BOT_ANALYTICS) {
        ctx.waitUntil(
          env.BOT_ANALYTICS.writeDataPoint({
            blobs: [logEntry.timestamp, logEntry.userAgent, logEntry.pathname, logEntry.country, detectedBots.join(',')],
            doubles: [logEntry.responseStatus, isAIBot ? 1 : 0],
            indexes: [CLIENT_API_KEY],
          }).catch(err => console.error('Analytics Engine error:', err))
        );
      }

      if (isAIBot) {
        console.log('AI Bot detected:', { bots: detectedBots, path: url.pathname, country: logEntry.country });
      }

      return response;
    } catch (error) {
      console.error('Worker error:', error);
      return fetch(request); // Fallback: pass through
    }
  }
};
