/**
 * Analytics API — Combines Cloudflare Analytics Engine + GA4 + Bing CSV
 * into unified funnel metrics.
 *
 * This is a Next.js API route. Adapt for your framework as needed.
 *
 * Data sources:
 * 1. Cloudflare Analytics Engine SQL API — Bot impressions from Worker logs
 * 2. Google Analytics 4 Data API — Referral clicks + conversion events
 * 3. Bing CSV — Manual citation import from Bing Webmaster Tools
 *
 * Query params:
 *   ?days=30    (1, 7, 30, 90)
 *   ?bot=all    (all, chatgpt, claude, gemini, perplexity, bing)
 *   ?debug=1    (returns raw Analytics Engine data for troubleshooting)
 *
 * Part of the AI Traffic Attribution framework.
 * https://github.com/BenUsername/ai-traffic-attribution
 */

import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

// Simple in-memory rate limiter: max 30 requests per minute per IP
const rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW = 60_000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  entry.count++
  return entry.count <= RATE_LIMIT
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GoogleAnalyticsData {
  chatgptReferrals: number
  conversions: number
  conversionRate: number
  topConversionEvents: Array<{ event: string; count: number }>
}

// ---------------------------------------------------------------------------
// 1. Google Analytics 4 — Referral Clicks & Conversions
// ---------------------------------------------------------------------------

async function getGoogleAnalyticsData(days: number = 1, bot: string = 'all'): Promise<GoogleAnalyticsData> {
  try {
    const gaPropertyId = process.env.GA4_PROPERTY_ID
    const gaServiceAccountKey = process.env.GA4_SERVICE_ACCOUNT_KEY

    const gaSourceMap: Record<string, string[]> = {
      chatgpt: ['chatgpt'],
      claude: ['claude'],
      gemini: ['google'],
      perplexity: ['perplexity'],
      bing: ['bing'],
      all: ['chatgpt', 'claude', 'perplexity', 'bing'],
    }
    const gaSourceFilters = gaSourceMap[bot] || gaSourceMap.all

    if (!gaPropertyId || !gaServiceAccountKey) {
      console.log('GA4 credentials not found, returning zeroed data')
      return { chatgptReferrals: 0, conversions: 0, conversionRate: 0, topConversionEvents: [] }
    }

    const credentials = JSON.parse(gaServiceAccountKey)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })

    const analyticsData = google.analyticsdata('v1beta')
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - (days || 1) * 24 * 60 * 60 * 1000)

    // Build source dimension filter
    const sourceExpressions = gaSourceFilters.map(s => ({
      filter: {
        fieldName: 'sessionSource',
        stringFilter: { matchType: 'CONTAINS' as const, value: s },
      },
    }))

    const sourceFilter = sourceExpressions.length === 1
      ? sourceExpressions[0]
      : { orGroup: { expressions: sourceExpressions } }

    // Query for referrals
    const referralResponse = await analyticsData.properties.runReport({
      auth,
      property: `properties/${gaPropertyId}`,
      requestBody: {
        dateRanges: [{
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        }],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: sourceFilter as any,
      },
    })

    // Query for conversions
    const conversionResponse = await analyticsData.properties.runReport({
      auth,
      property: `properties/${gaPropertyId}`,
      requestBody: {
        dateRanges: [{
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        }],
        dimensions: [{ name: 'eventName' }, { name: 'sessionSource' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              sourceFilter as any,
              {
                orGroup: {
                  expressions: [
                    // Add your conversion events here:
                    { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'contact_form_submit' } } },
                    { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'demo_booking' } } },
                    { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'sign_up' } } },
                  ],
                },
              },
            ],
          },
        } as any,
      },
    })

    const chatgptReferrals = referralResponse.data.rows?.reduce((total, row) => {
      return total + parseInt(row.metricValues?.[0]?.value || '0')
    }, 0) || 0

    const conversionEvents = conversionResponse.data.rows || []
    const conversions = conversionEvents.reduce((total, row) => {
      return total + parseInt(row.metricValues?.[0]?.value || '0')
    }, 0)

    const topConversionEvents = conversionEvents
      .map(row => ({
        event: row.dimensionValues?.[0]?.value || 'Unknown',
        count: parseInt(row.metricValues?.[0]?.value || '0')
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const conversionRate = chatgptReferrals > 0 ? (conversions / chatgptReferrals) * 100 : 0

    return {
      chatgptReferrals,
      conversions,
      conversionRate: Math.round(conversionRate * 100) / 100,
      topConversionEvents
    }
  } catch (error) {
    console.error('Error fetching GA data:', error)
    return { chatgptReferrals: 0, conversions: 0, conversionRate: 0, topConversionEvents: [] }
  }
}

// ---------------------------------------------------------------------------
// 2. Bing CSV Import — Supplementary Citations
// ---------------------------------------------------------------------------

async function getBingDataFromCSV(days: number = 30): Promise<Map<string, number>> {
  const bingMap = new Map<string, number>()
  try {
    const csvPath = path.join(process.cwd(), 'data', 'bing-analytics.csv')
    if (!fs.existsSync(csvPath)) return bingMap

    const content = fs.readFileSync(csvPath, 'utf8')
    const lines = content.split('\n').slice(1)

    lines.forEach(line => {
      if (!line.trim()) return
      const parts = line.split(',')
      if (parts.length < 2) return

      const rawDate = parts[0].replace(/"/g, '')
      const dateParts = rawDate.split(' ')[0].split('/')
      if (dateParts.length === 3) {
        const month = dateParts[0].padStart(2, '0')
        const day = dateParts[1].padStart(2, '0')
        const year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2]
        const dateStr = `${year}-${month}-${day}`
        const citations = parseInt(parts[1].replace(/"/g, '')) || 0
        bingMap.set(dateStr, citations)
      }
    })
  } catch (err) {
    console.error('Error reading Bing CSV:', err)
  }
  return bingMap
}

// ---------------------------------------------------------------------------
// 3. Main API Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Max 30 requests per minute.' }, { status: 429 })
  }

  try {
    const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN
    const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID

    if (!cloudflareToken) {
      return NextResponse.json({ error: 'Missing CLOUDFLARE_API_TOKEN environment variable.' }, { status: 500 })
    }

    // Get filters from query parameters
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '1')
    const bot = searchParams.get('bot') || 'all'

    // Calculation time range
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
    const useDailyGranularity = days > 1

    // Bot filter for Analytics Engine SQL (blob6 = detectedBots comma-separated)
    const botSqlFilters: Record<string, string> = {
      chatgpt: `AND (blob6 LIKE '%ChatGPT%' OR blob6 LIKE '%GPTBot%' OR blob6 LIKE '%OAI_SearchBot%')`,
      claude: `AND blob6 LIKE '%Claude%'`,
      gemini: `AND blob6 LIKE '%Googlebot%'`,
      perplexity: `AND blob6 LIKE '%Perplexity%'`,
      bing: `AND blob6 LIKE '%Bingbot%'`,
      all: `AND double2 = 1`, // isAIBot = 1
    }
    const botFilter = botSqlFilters[bot] || botSqlFilters.all

    // Time grouping for SQL
    const timeGroup = useDailyGranularity
      ? `toDate(timestamp) AS day`
      : `toHour(timestamp) AS hour`
    const timeGroupBy = useDailyGranularity ? 'day' : 'hour'
    const timeOrder = useDailyGranularity ? 'day' : 'hour'

    // Analytics Engine SQL API uses toDateTime() for timestamp comparisons
    const sinceTs = startDate.toISOString().replace('T', ' ').replace('Z', '')
    const untilTs = endDate.toISOString().replace('T', ' ').replace('Z', '')

    // Debug mode: if ?debug=1, return raw blob6 values
    const isDebug = searchParams.get('debug') === '1'

    const sqlQuery = isDebug
      ? `SELECT blob6, double2, count() AS cnt FROM BOT_ANALYTICS WHERE timestamp >= toDateTime('${sinceTs}') AND double2 = 1 GROUP BY blob6, double2 ORDER BY cnt DESC LIMIT 50`
      : `SELECT ${timeGroup}, count() AS visits
         FROM BOT_ANALYTICS
         WHERE timestamp >= toDateTime('${sinceTs}')
           AND timestamp <= toDateTime('${untilTs}')
           ${botFilter}
         GROUP BY ${timeGroupBy}
         ORDER BY ${timeOrder} ASC`

    // Fetch Analytics Engine + GA4 + Bing in parallel
    const analyticsEngineUrl = cloudflareAccountId
      ? `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/analytics_engine/sql`
      : null

    const [aeResponse, gaData, bingMap] = await Promise.all([
      analyticsEngineUrl
        ? fetch(analyticsEngineUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${cloudflareToken}`,
              'Content-Type': 'text/plain',
            },
            body: sqlQuery,
          })
        : Promise.resolve(null),
      getGoogleAnalyticsData(days, bot),
      getBingDataFromCSV(days),
    ])

    // Parse Analytics Engine response
    let totalVisits = 0
    const timeSeriesMap = new Map<string, number>()

    if (aeResponse) {
      const aeText = await aeResponse.text()
      try {
        const aeJson = JSON.parse(aeText)
        if (isDebug) {
          return NextResponse.json({ debug: true, sqlQuery, status: aeResponse.status, response: aeJson })
        }
        if (aeResponse.ok) {
          const rows = aeJson.data || []
          rows.forEach((row: any) => {
            const count = parseInt(row.visits) || 0
            totalVisits += count
            const key = useDailyGranularity
              ? (row.day || '')
              : String(row.hour || 0).padStart(2, '0')
            if (key) timeSeriesMap.set(key, (timeSeriesMap.get(key) || 0) + count)
          })
        } else {
          console.error('Analytics Engine error:', aeResponse.status, aeJson)
        }
      } catch {
        if (isDebug) {
          return NextResponse.json({ debug: true, sqlQuery, status: aeResponse.status, rawText: aeText })
        }
        console.error('Analytics Engine parse error:', aeText)
      }
    } else {
      if (isDebug) {
        return NextResponse.json({ debug: true, error: 'No CLOUDFLARE_ACCOUNT_ID set', sqlQuery })
      }
      console.log('CLOUDFLARE_ACCOUNT_ID not set — skipping Analytics Engine query')
    }

    // If bot is 'bing' or 'all', add Bing CSV data to the series
    let totalBingCitations = 0
    if (bot === 'all' || bot === 'bing') {
      bingMap.forEach((count, date) => {
        if (new Date(date) >= startDate && new Date(date) <= endDate) {
          totalBingCitations += count
          if (useDailyGranularity) {
            timeSeriesMap.set(date, (timeSeriesMap.get(date) || 0) + count)
          }
        }
      })
    }

    const finalTotalVisits = totalVisits + totalBingCitations

    // Generate full time range to ensure no gaps
    let timeSeriesData: Array<{ label: string; visits: number; conversions: number; convRate: number }> = []

    if (useDailyGranularity) {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = d.toISOString().split('T')[0]
        const visits = timeSeriesMap.get(dateStr) || 0
        const conversions = finalTotalVisits > 0 ? (visits / finalTotalVisits) * gaData.conversions : 0
        timeSeriesData.push({
          label: dateStr,
          visits,
          conversions: Math.round(conversions * 10) / 10,
          convRate: visits > 0 ? (conversions / visits) * 100 : 0
        })
      }
    } else {
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0')
        const visits = timeSeriesMap.get(hour) || 0
        const conversions = finalTotalVisits > 0 ? (visits / finalTotalVisits) * gaData.conversions : 0
        timeSeriesData.push({
          label: hour,
          visits,
          conversions: Math.round(conversions * 10) / 10,
          convRate: visits > 0 ? (conversions / visits) * 100 : 0
        })
      }
    }

    const result = {
      totalVisits: finalTotalVisits,
      timeSeriesData,
      isDaily: useDailyGranularity,
      funnel: {
        impressions: finalTotalVisits,
        clicks: gaData.chatgptReferrals,
        conversions: gaData.conversions,
        conversionRate: gaData.conversionRate,
        topConversionEvents: gaData.topConversionEvents,
        clickThroughRate: finalTotalVisits > 0 ? Math.round((gaData.chatgptReferrals / finalTotalVisits) * 10000) / 100 : 0
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
