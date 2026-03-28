/**
 * Analytics API — Combines Cloudflare + GA4 + Bing CSV into unified funnel metrics.
 *
 * This is a Next.js API route. Adapt for your framework as needed.
 *
 * Data sources:
 * 1. Cloudflare GraphQL API — Bot impressions (user-agent pattern matching)
 * 2. Google Analytics 4 Data API — Referral clicks + conversion events
 * 3. Bing CSV — Manual citation import from Bing Webmaster Tools
 *
 * Query params:
 *   ?days=30    (1, 7, 30, 90)
 *   ?bot=all    (all, chatgpt, claude, gemini, perplexity, bing)
 *
 * Part of the AI Traffic Attribution framework.
 * https://github.com/BenUsername/ai-traffic-attribution
 */

import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GoogleAnalyticsData {
  chatgptReferrals: number
  conversions: number
  conversionRate: number
  topConversionEvents: Array<{ event: string; count: number }>
}

interface FunnelResult {
  totalVisits: number
  timeSeriesData: Array<{
    label: string
    visits: number
    conversions: number
    convRate: number
  }>
  isDaily: boolean
  funnel: {
    impressions: number
    clicks: number
    conversions: number
    conversionRate: number
    clickThroughRate: number
    topConversionEvents: Array<{ event: string; count: number }>
  }
}

// ---------------------------------------------------------------------------
// 1. Google Analytics 4 — Referral Clicks & Conversions
// ---------------------------------------------------------------------------

async function getGoogleAnalyticsData(
  days: number = 1,
  bot: string = 'all'
): Promise<GoogleAnalyticsData> {
  try {
    const gaPropertyId = process.env.GA4_PROPERTY_ID
    const gaServiceAccountKey = process.env.GA4_SERVICE_ACCOUNT_KEY

    if (!gaPropertyId || !gaServiceAccountKey) {
      console.log('GA4 credentials not configured — returning zeros')
      return { chatgptReferrals: 0, conversions: 0, conversionRate: 0, topConversionEvents: [] }
    }

    // Map bot filter to GA source string
    let sourceFilterValue = 'chatgpt'
    if (bot === 'claude') sourceFilterValue = 'claude'
    if (bot === 'gemini') sourceFilterValue = 'google'
    if (bot === 'perplexity') sourceFilterValue = 'perplexity'

    const credentials = JSON.parse(gaServiceAccountKey)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })

    const analyticsData = google.analyticsdata('v1beta')
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - (days || 1) * 24 * 60 * 60 * 1000)
    const dateRange = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }

    // Query referral sessions from AI sources
    const referralResponse = await analyticsData.properties.runReport({
      auth,
      property: `properties/${gaPropertyId}`,
      requestBody: {
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionSource',
            stringFilter: { matchType: 'CONTAINS', value: sourceFilterValue },
          },
        },
      },
    })

    // Query conversion events from AI traffic
    const conversionResponse = await analyticsData.properties.runReport({
      auth,
      property: `properties/${gaPropertyId}`,
      requestBody: {
        dateRanges: [dateRange],
        dimensions: [{ name: 'eventName' }, { name: 'sessionSource' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'sessionSource',
                  stringFilter: { matchType: 'CONTAINS', value: sourceFilterValue },
                },
              },
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
        },
      },
    })

    const chatgptReferrals = referralResponse.data.rows?.reduce(
      (total, row) => total + parseInt(row.metricValues?.[0]?.value || '0'), 0
    ) || 0

    const conversionEvents = conversionResponse.data.rows || []
    const conversions = conversionEvents.reduce(
      (total, row) => total + parseInt(row.metricValues?.[0]?.value || '0'), 0
    )

    const topConversionEvents = conversionEvents
      .map(row => ({
        event: row.dimensionValues?.[0]?.value || 'Unknown',
        count: parseInt(row.metricValues?.[0]?.value || '0'),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const conversionRate = chatgptReferrals > 0 ? (conversions / chatgptReferrals) * 100 : 0

    return {
      chatgptReferrals,
      conversions,
      conversionRate: Math.round(conversionRate * 100) / 100,
      topConversionEvents,
    }
  } catch (error) {
    console.error('GA4 fetch error:', error)
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
    const lines = content.split('\n').slice(1) // Skip header

    const now = new Date()
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

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

        if (new Date(dateStr) >= cutoff) {
          const citations = parseInt(parts[1].replace(/"/g, '')) || 0
          bingMap.set(dateStr, citations)
        }
      }
    })
  } catch (err) {
    console.error('Bing CSV read error:', err)
  }
  return bingMap
}

// ---------------------------------------------------------------------------
// 3. Cloudflare GraphQL — Bot Impressions
// ---------------------------------------------------------------------------

async function getCloudflareImpressions(
  days: number,
  bot: string,
  zoneId: string,
  token: string
) {
  const botPatterns: Record<string, string[]> = {
    chatgpt: ['%ChatGPT_User%'],
    claude: ['%ClaudeBot%', '%Claude%', '%anthropic%'],
    gemini: ['%Googlebot%', '%Google-Extended%'],
    perplexity: ['%Perplexity%', '%PerplexityBot%'],
    all: [
      '%openai%', '%ChatGPT%', '%GPTBot%', '%OAI-SearchBot%',
      '%ClaudeBot%', '%Claude%', '%anthropic%',
      '%Googlebot%', '%Google-Extended%',
      '%Perplexity%', '%PerplexityBot%',
      '%bingbot%', '%Amazonbot%', '%Applebot%',
    ],
  }

  const patterns = botPatterns[bot] || botPatterns.all
  const orFilters = patterns.map(p => `{userAgent_like: "${p}"}`).join(',\n')

  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
  const useDailyGranularity = days > 1
  const timeDimension = useDailyGranularity ? 'date' : 'datetimeHour'

  const query = `
    query GetAnalytics($zoneId: String!, $since: String!, $until: String!) {
      viewer {
        zones(filter: {zoneTag: $zoneId}) {
          httpRequestsAdaptiveGroups(
            filter: {
              datetime_geq: $since
              datetime_leq: $until
              OR: [${orFilters}]
            }
            limit: 1000
          ) {
            count
            dimensions { ${timeDimension} }
          }
        }
      }
    }
  `

  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { zoneId, since: startDate.toISOString(), until: endDate.toISOString() },
    }),
  })

  if (!response.ok) throw new Error(`Cloudflare API error: ${response.status}`)

  const json = await response.json()
  const groups = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || []

  let totalVisits = 0
  const timeSeriesMap = new Map<string, number>()

  groups.forEach((group: any) => {
    totalVisits += group.count
    let key = ''
    if (useDailyGranularity) {
      key = group.dimensions.date || group.dimensions.datetimeHour.split('T')[0]
    } else {
      key = new Date(group.dimensions.datetimeHour).getHours().toString().padStart(2, '0')
    }
    timeSeriesMap.set(key, (timeSeriesMap.get(key) || 0) + group.count)
  })

  return { totalVisits, timeSeriesMap, useDailyGranularity, endDate, startDate }
}

// ---------------------------------------------------------------------------
// 4. Main API Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const cloudflareZoneId = process.env.CLOUDFLARE_ZONE_ID
    const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN

    if (!cloudflareZoneId || !cloudflareToken) {
      return NextResponse.json(
        { error: 'Missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '1')
    const bot = searchParams.get('bot') || 'all'

    // Fetch all data sources in parallel
    const [cfData, gaData, bingMap] = await Promise.all([
      getCloudflareImpressions(days, bot, cloudflareZoneId, cloudflareToken),
      getGoogleAnalyticsData(days, bot),
      getBingDataFromCSV(days),
    ])

    // Merge Bing data
    let totalBingCitations = 0
    if (bot === 'all' || bot === 'bing') {
      bingMap.forEach((count, date) => {
        if (new Date(date) >= cfData.startDate && new Date(date) <= cfData.endDate) {
          totalBingCitations += count
          if (cfData.useDailyGranularity) {
            cfData.timeSeriesMap.set(date, (cfData.timeSeriesMap.get(date) || 0) + count)
          }
        }
      })
    }

    const finalTotalVisits = cfData.totalVisits + totalBingCitations

    // Build time-series array
    const timeSeriesData = []
    if (cfData.useDailyGranularity) {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(cfData.endDate.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = d.toISOString().split('T')[0]
        const visits = cfData.timeSeriesMap.get(dateStr) || 0
        const conversions = finalTotalVisits > 0 ? (visits / finalTotalVisits) * gaData.conversions : 0
        timeSeriesData.push({
          label: dateStr,
          visits,
          conversions: Math.round(conversions * 10) / 10,
          convRate: visits > 0 ? (conversions / visits) * 100 : 0,
        })
      }
    } else {
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0')
        const visits = cfData.timeSeriesMap.get(hour) || 0
        const conversions = finalTotalVisits > 0 ? (visits / finalTotalVisits) * gaData.conversions : 0
        timeSeriesData.push({
          label: hour,
          visits,
          conversions: Math.round(conversions * 10) / 10,
          convRate: visits > 0 ? (conversions / visits) * 100 : 0,
        })
      }
    }

    const result: FunnelResult = {
      totalVisits: finalTotalVisits,
      timeSeriesData,
      isDaily: cfData.useDailyGranularity,
      funnel: {
        impressions: finalTotalVisits,
        clicks: gaData.chatgptReferrals,
        conversions: gaData.conversions,
        conversionRate: gaData.conversionRate,
        topConversionEvents: gaData.topConversionEvents,
        clickThroughRate: finalTotalVisits > 0
          ? Math.round((gaData.chatgptReferrals / finalTotalVisits) * 10000) / 100
          : 0,
      },
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
