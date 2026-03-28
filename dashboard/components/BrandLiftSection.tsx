/**
 * Brand Lift Measurement Dashboard Section
 *
 * Shows the lift multiplier, adjusted metrics, survey vs GA comparison,
 * and sanity check against branded search traffic.
 *
 * Part of the AI Traffic Attribution framework.
 * https://github.com/BenUsername/ai-traffic-attribution
 */

'use client'

import { Search, BarChart3, Megaphone } from 'lucide-react'

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

interface BrandLiftSectionProps {
  data: BrandLiftData
  directClicks: number
  directConversions: number
}

export function BrandLiftSection({ data, directClicks, directConversions }: BrandLiftSectionProps) {
  return (
    <div style={{ marginTop: '2rem' }}>
      <div className="glass-card" style={{ padding: '2.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Megaphone className="h-5 w-5" style={{ color: '#8b5cf6' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Brand Lift Measurement
          </h3>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2rem', maxWidth: '720px' }}>
          Direct referral clicks undercount AI's true influence. Many users discover your brand in ChatGPT
          or other LLMs, then Google you directly instead of clicking the citation link.
        </p>

        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <MetricCard
            label="Brand Lift Multiplier"
            value={`${data.liftMultiplier}x`}
            subtitle="survey / GA referral ratio"
            gradient="linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)"
            color="#7c3aed"
            valueColor="#5b21b6"
          />
          <MetricCard
            label="Adjusted Clicks"
            value={data.adjustedClicks.toLocaleString()}
            subtitle={`vs ${directClicks} direct referrals`}
            gradient="linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
            color="#16a34a"
            valueColor="#15803d"
          />
          <MetricCard
            label="Adjusted Conversions"
            value={data.adjustedConversions.toLocaleString()}
            subtitle={`vs ${directConversions} tracked conversions`}
            gradient="linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
            color="#d97706"
            valueColor="#b45309"
          />
          <MetricCard
            label="Branded Search Traffic"
            value={data.brandedSearchTraffic.toLocaleString()}
            subtitle="from GA (sanity check ceiling)"
            gradient="linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)"
            color="#2563eb"
            valueColor="#1d4ed8"
          />
        </div>

        {/* Survey vs GA Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <ComparisonCard
            icon={<Search className="h-4 w-4" style={{ color: '#64748b' }} />}
            title='Survey: "Where did you hear about us?"'
            value={data.surveyAttributionPct}
            valueLabel="said AI / ChatGPT"
            barColor="#8b5cf6"
            footnote={`${data.surveyResponses} responses via ${data.surveySource}`}
          />
          <ComparisonCard
            icon={<BarChart3 className="h-4 w-4" style={{ color: '#64748b' }} />}
            title="GA Referral Traffic from AI"
            value={data.gaReferralPct}
            valueLabel="of total site traffic"
            barColor="#2563eb"
            footnote="Direct click-throughs tracked in Google Analytics 4"
          />
        </div>

        {/* Sanity Check */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem 1.25rem',
          backgroundColor: '#fefce8',
          borderRadius: '0.5rem',
          border: '1px solid #fef08a',
        }}>
          <p style={{ fontSize: '0.8rem', color: '#854d0e', margin: 0, lineHeight: 1.5 }}>
            <strong>Sanity check:</strong> Adjusted AI-influenced traffic ({data.adjustedClicks})
            should not exceed your total branded/direct traffic ({data.brandedSearchTraffic}) in GA.
            {data.adjustedClicks <= data.brandedSearchTraffic
              ? <span style={{ color: '#16a34a' }}> &#10003; Within bounds.</span>
              : <span style={{ color: '#dc2626' }}> &#9888; Exceeds branded traffic — review multiplier.</span>
            }
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({
  label, value, subtitle, gradient, color, valueColor,
}: {
  label: string; value: string; subtitle: string;
  gradient: string; color: string; valueColor: string;
}) {
  return (
    <div style={{ background: gradient, borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '2.5rem', fontWeight: 800, color: valueColor, lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: '0.75rem', color, marginTop: '0.5rem' }}>{subtitle}</p>
    </div>
  )
}

function ComparisonCard({
  icon, title, value, valueLabel, barColor, footnote,
}: {
  icon: React.ReactNode; title: string; value: number;
  valueLabel: string; barColor: string; footnote: string;
}) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        {icon}
        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a', margin: 0 }}>{title}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.75rem', fontWeight: 700, color: barColor }}>{value}%</span>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{valueLabel}</span>
      </div>
      <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', backgroundColor: barColor, borderRadius: '4px', transition: 'width 1s ease' }} />
      </div>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>{footnote}</p>
    </div>
  )
}
