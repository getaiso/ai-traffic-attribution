/**
 * Cloudflare Worker for AI Bot Detection & Logging
 *
 * Deploy this worker at the Cloudflare edge to detect and log AI bot visits.
 * This measures "impressions" — the number of times AI platforms crawl/cite your site.
 *
 * Detects: ChatGPT, Claude, Perplexity, Gemini, Bing/Copilot, Meta, and more.
 *
 * Part of the AI Traffic Attribution framework.
 * https://github.com/BenUsername/ai-traffic-attribution
 * https://getaiso.com
 */

// Bot detection patterns based on official documentation
const BOT_PATTERNS = {
  // OpenAI bots
  OAI_SearchBot: /OAI-SearchBot\/1\.0/i,
  ChatGPT_User: /ChatGPT-User\/1\.0/i,
  GPTBot: /GPTBot\/1\.1/i,

  // Anthropic bots
  ClaudeBot: /ClaudeBot/i,
  Claude: /Claude/i,

  // Perplexity bots
  PerplexityBot: /PerplexityBot/i,
  PerplexityUser: /Perplexity-User/i,

  // Search engines
  Googlebot: /Googlebot/i,
  Bingbot: /bingbot/i,
  Amazonbot: /Amazonbot/i,
  Applebot: /Applebot/i,

  // Social media / Meta
  FacebookBot: /FacebookBot/i,
  FacebookExternalHit: /facebookexternalhit/i,
  MetaExternalAgent: /meta-externalagent/i
};

/**
 * Detect AI bots from user-agent string
 */
function detectAIBot(userAgent) {
  const detections = {};

  for (const [botName, pattern] of Object.entries(BOT_PATTERNS)) {
    detections[botName] = pattern.test(userAgent);
  }

  // Additional validation for OpenAI bots (RFC 9110 compliance)
  if (detections.ChatGPT_User && !userAgent.includes('+https://openai.com/bot')) {
    detections.ChatGPT_User = false;
  }

  if (detections.GPTBot && !userAgent.includes('+https://openai.com/gptbot')) {
    detections.GPTBot = false;
  }

  const isAIBot = Object.values(detections).some(Boolean);
  const detectedBots = Object.entries(detections)
    .filter(([_, detected]) => detected)
    .map(([botName, _]) => botName);

  return { isAIBot, detectedBots, detections };
}

/**
 * Create comprehensive request log entry
 */
function createRequestLog(request, response, botDetection, env) {
  const url = new URL(request.url);

  return {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    pathname: url.pathname,
    searchParams: Object.fromEntries(url.searchParams),

    // Bot detection results
    isAIBot: botDetection.isAIBot,
    detectedBots: botDetection.detectedBots,
    botDetections: botDetection.detections,

    // Request details
    userAgent: request.headers.get('user-agent') || '',
    ip: request.headers.get('cf-connecting-ip') || 'unknown',
    country: request.cf?.country || 'unknown',
    city: request.cf?.city || 'unknown',
    region: request.cf?.region || 'unknown',
    timezone: request.cf?.timezone || 'unknown',

    // Response
    responseStatus: response.status,

    // Cloudflare metadata
    rayId: request.headers.get('cf-ray') || 'unknown',
    colo: request.cf?.colo || 'unknown',

    // Client identification
    clientApiKey: env.CLIENT_API_KEY || 'default',

    requestId: crypto.randomUUID(),
    workerVersion: '1.0.0'
  };
}

/**
 * Log to Cloudflare Analytics Engine (optional)
 */
async function logToAnalytics(requestLog, env) {
  try {
    if (!env.BOT_ANALYTICS) return;

    await env.BOT_ANALYTICS.writeDataPoint({
      blobs: [
        requestLog.timestamp,
        requestLog.userAgent,
        requestLog.pathname,
        requestLog.ip,
        requestLog.country,
        requestLog.detectedBots.join(','),
      ],
      doubles: [
        requestLog.responseStatus,
        requestLog.isAIBot ? 1 : 0
      ],
      indexes: [requestLog.clientApiKey]
    });
  } catch (error) {
    console.error('Analytics Engine error:', error);
  }
}

/**
 * Send log to your API endpoint (optional)
 */
async function sendToAPI(requestLog, env) {
  if (!env.API_ENDPOINT) return;

  try {
    await fetch(env.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.WEBHOOK_SECRET || ''}`,
        'X-Client-API-Key': requestLog.clientApiKey
      },
      body: JSON.stringify(requestLog)
    });
  } catch (error) {
    console.error('API send error:', error);
  }
}

/**
 * Main worker handler
 */
export default {
  async fetch(request, env, ctx) {
    try {
      const userAgent = request.headers.get('user-agent') || '';
      const botDetection = detectAIBot(userAgent);

      // Forward request to origin (pass-through)
      const response = await fetch(request);

      // Log the request (non-blocking)
      const requestLog = createRequestLog(request, response, botDetection, env);
      ctx.waitUntil(
        Promise.all([
          logToAnalytics(requestLog, env),
          sendToAPI(requestLog, env)
        ])
      );

      // Add security headers
      const modifiedResponse = new Response(response.body, response);
      modifiedResponse.headers.set('X-Content-Type-Options', 'nosniff');
      modifiedResponse.headers.set('X-Frame-Options', 'DENY');
      modifiedResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

      return modifiedResponse;
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
