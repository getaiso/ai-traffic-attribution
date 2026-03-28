/**
 * Full Analytics Dashboard Page
 *
 * Complete funnel view: Impressions → Clicks → Conversions → Brand Lift
 *
 * This is a reference implementation using Next.js + React.
 * Adapt for your framework as needed.
 *
 * Part of the AI Traffic Attribution framework.
 * https://github.com/BenUsername/ai-traffic-attribution
 */

'use client'

import { useState, useEffect } from 'react'
import { Calendar, Bot, Target, Megaphone, Search, BarChart3 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandLiftData {
  surveyAttributionPct: number
  gaReferralPct: number
  liftMultiplier: number
  adjustedClicks: number
  adjustedConversions: number
  brandedSearchTraffic: number
  surveySource: string
  surveyResponses: number
}

interface FunnelData {
  impressions: number
  clicks: number
  conversions: number
  conversionRate: number
  clickThroughRate: number
  topConversionEvents: Array<{ event: string; count: number }>
}

interface TimeSeriesItem {
  label: string
  visits: number
  conversions: number
  convRate: number
}

interface DashboardData {
  totalVisits: number
  timeSeriesData: TimeSeriesItem[]
  isDaily: boolean
  funnel: FunnelData
  brandLift?: BrandLiftData
}

// ---------------------------------------------------------------------------
// InfoBox tooltip component
// ---------------------------------------------------------------------------

const InfoBox = ({ children }: { children: React.ReactNode }) => (
  <div className="group relative inline-block ml-2">
    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-[11px] text-slate-600 cursor-help font-semibold hover:bg-blue-100 hover:text-blue-600 transition-colors">
      ?
    </div>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-gray-900 text-white text-xs leading-relaxed rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
      {children}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900" />
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function AnalyticsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDays, setSelectedDays] = useState<number>(30)
  const [selectedBot, setSelectedBot] = useState<string>('all')

  useEffect(() => {
    fetchData()
  }, [selectedDays, selectedBot])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/analytics?days=${selectedDays}&bot=${selectedBot}`)
      if (!response.ok) throw new Error('Failed to fetch')
      setData(await response.json())
    } catch (err) {
      console.log('Using mock data:', err)
      setData(getMockData(selectedDays))
    } finally {
      setLoading(false)
    }
  }

  const impressions = data?.funnel?.impressions || 0
  const clicks = data?.funnel?.clicks || 0
  const conversions = data?.funnel?.conversions || 0
  const clickPct = impressions > 0 ? Math.round((clicks / impressions) * 100) : 0
  const convPct = clicks > 0 ? Math.round((conversions / clicks) * 100) : 0

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>

      {/* Header + Filters */}
      <header style={{ marginBottom: '3rem' }}>
        <p style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          AI Search Performance
        </p>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0' }}>
          Premium funnel analytics for the agentic web.
        </h1>
        <p style={{ color: '#64748b', maxWidth: '640px' }}>
          The complete journey from AI bot mentions to revenue. Track citations, referral intent, and confirmed conversions.
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar className="h-4 w-4 text-gray-400" />
            <select value={selectedDays} onChange={(e) => setSelectedDays(parseInt(e.target.value))}>
              <option value={1}>24 Hours</option>
              <option value={7}>7 Days</option>
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bot className="h-4 w-4 text-gray-400" />
            <select value={selectedBot} onChange={(e) => setSelectedBot(e.target.value)}>
              <option value="all">All AI Agents</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="perplexity">Perplexity</option>
              <option value="bing">Bing / Copilot</option>
            </select>
          </label>
        </div>
      </header>

      {/* Funnel Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <FunnelCard label="Bot Hits (Impressions)" value={impressions} source="Cloudflare/Bing"
          tooltip="The number of times an AI bot visited or cited your site content." />
        <FunnelCard label="Referral Clicks" value={clicks} source="GA4"
          tooltip="Direct traffic to your site coming from AI platforms." />
        <FunnelCard label="Conversions" value={conversions} source="GA4"
          tooltip="High-value events triggered by users who arrived via AI search." />
        <FunnelCard label="Conversion Rate" value={data?.funnel?.conversionRate || 0} source="Overall" suffix="%"
          tooltip="The percentage of referral clicks that resulted in a conversion." />
      </div>

      {/* Pipeline Efficiency */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
        <h3>Pipeline Efficiency</h3>
        <FunnelBar label="Discovery Visibility" value={impressions} pct={100} color="#2563eb" />
        <FunnelBar label="Intent Yield" value={clicks} pct={clickPct} color="#10b981" />
        <FunnelBar label="Success Rate" value={conversions} pct={convPct} color="#f59e0b" />
      </div>

      {/* Brand Lift Measurement */}
      {data?.brandLift && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '2.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Megaphone className="h-5 w-5" style={{ color: '#8b5cf6' }} />
            <h3 style={{ margin: 0 }}>
              Brand Lift Measurement
              <InfoBox>AI mentions drive branded searches, not just direct clicks. This measures the hidden influence by comparing survey data against GA referral data.</InfoBox>
            </h3>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2rem', maxWidth: '720px' }}>
            Direct referral clicks undercount AI's true influence. Many users discover your brand in ChatGPT or other LLMs, then Google you directly instead of clicking the citation link.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <LiftCard label="Brand Lift Multiplier" value={`${data.brandLift.liftMultiplier}x`} sub="survey / GA ratio" bg="#f5f3ff" color="#7c3aed" />
            <LiftCard label="Adjusted Clicks" value={data.brandLift.adjustedClicks.toString()} sub={`vs ${clicks} direct`} bg="#f0fdf4" color="#16a34a" />
            <LiftCard label="Adjusted Conversions" value={data.brandLift.adjustedConversions.toString()} sub={`vs ${conversions} tracked`} bg="#fffbeb" color="#d97706" />
            <LiftCard label="Branded Search" value={data.brandLift.brandedSearchTraffic.toString()} sub="GA ceiling check" bg="#eff6ff" color="#2563eb" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <SurveyCard
              icon={<Search className="h-4 w-4" />}
              title='Survey: "Where did you hear about us?"'
              pct={data.brandLift.surveyAttributionPct}
              label="said AI / ChatGPT"
              color="#8b5cf6"
              note={`${data.brandLift.surveyResponses} responses via ${data.brandLift.surveySource}`}
            />
            <SurveyCard
              icon={<BarChart3 className="h-4 w-4" />}
              title="GA Referral Traffic from AI"
              pct={data.brandLift.gaReferralPct}
              label="of total site traffic"
              color="#2563eb"
              note="Direct click-throughs tracked in Google Analytics 4"
            />
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#fefce8', borderRadius: '0.5rem', border: '1px solid #fef08a' }}>
            <p style={{ fontSize: '0.8rem', color: '#854d0e', margin: 0 }}>
              <strong>Sanity check:</strong> Adjusted traffic ({data.brandLift.adjustedClicks}) should not exceed branded traffic ({data.brandLift.brandedSearchTraffic}).
              {data.brandLift.adjustedClicks <= data.brandLift.brandedSearchTraffic
                ? ' ✓ Within bounds.'
                : ' ⚠ Exceeds — review multiplier.'}
            </p>
          </div>
        </div>
      )}

      {/* Top Conversion Signals */}
      {data?.funnel?.topConversionEvents?.length ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
          <h3>Top Conversion Signals</h3>
          {data.funnel.topConversionEvents.map((event, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>{event.event}</span>
              <span style={{ fontWeight: 600 }}>{event.count}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FunnelCard({ label, value, source, tooltip, suffix = '' }: {
  label: string; value: number; source: string; tooltip: string; suffix?: string
}) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>{label}</p>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#f8fafc', padding: '2px 8px', borderRadius: '4px' }}>{source}</span>
      </div>
      <p style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
        {value.toLocaleString()}{suffix}
      </p>
    </div>
  )
}

function FunnelBar({ label, value, pct, color }: {
  label: string; value: number; pct: number; color: string
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.875rem' }}>{label}</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ width: '100%', height: '24px', backgroundColor: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(pct, 8)}%`, height: '100%', backgroundColor: color, borderRadius: '6px', display: 'flex', alignItems: 'center', paddingLeft: '8px', color: 'white', fontSize: '0.75rem' }}>
          {pct}%
        </div>
      </div>
    </div>
  )
}

function LiftCard({ label, value, sub, bg, color }: {
  label: string; value: string; sub: string; bg: string; color: string
}) {
  return (
    <div style={{ background: bg, borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}>
      <p style={{ fontSize: '0.7rem', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{label}</p>
      <p style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: '0.7rem', color, marginTop: '0.5rem' }}>{sub}</p>
    </div>
  )
}

function SurveyCard({ icon, title, pct, label, color, note }: {
  icon: React.ReactNode; title: string; pct: number; label: string; color: string; note: string
}) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        {icon}
        <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{title}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{pct}%</span>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{label}</span>
      </div>
      <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '4px' }} />
      </div>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>{note}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mock data fallback
// ---------------------------------------------------------------------------

function getMockData(selectedDays: number): DashboardData {
  return {
    totalVisits: 1247,
    isDaily: selectedDays > 1,
    timeSeriesData: Array.from({ length: selectedDays > 1 ? selectedDays : 24 }, (_, i) => ({
      label: selectedDays > 1 ? `Day ${i + 1}` : i.toString().padStart(2, '0'),
      visits: Math.floor(Math.random() * 50) + 10,
      conversions: Math.floor(Math.random() * 5),
      convRate: Math.random() * 10,
    })),
    funnel: {
      impressions: 1247,
      clicks: 89,
      conversions: 12,
      conversionRate: 13.48,
      clickThroughRate: 7.14,
      topConversionEvents: [
        { event: 'demo_booking', count: 8 },
        { event: 'contact_form_submit', count: 3 },
        { event: 'sign_up', count: 1 },
      ],
    },
    brandLift: {
      surveyAttributionPct: 10,
      gaReferralPct: 1.4,
      liftMultiplier: 7.1,
      adjustedClicks: 632,
      adjustedConversions: 85,
      brandedSearchTraffic: 3420,
      surveySource: 'Tally Sign-Up Survey',
      surveyResponses: 312,
    },
  }
}
