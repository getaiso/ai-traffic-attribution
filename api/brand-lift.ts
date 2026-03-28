/**
 * Brand Lift Calculation Module
 *
 * Estimates the true AI influence on your traffic by comparing
 * survey attribution data against GA referral measurements.
 *
 * The core insight: most users who discover your brand in AI responses
 * will Google your brand name rather than clicking the citation link.
 * This module quantifies that hidden influence.
 *
 * Part of the AI Traffic Attribution framework.
 * https://github.com/BenUsername/ai-traffic-attribution
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandLiftInput {
  /** % of survey respondents who said they found you via AI/ChatGPT */
  surveyAttributionPct: number

  /** % of total site traffic that came as direct AI referrals (from GA) */
  gaReferralPct: number

  /** Direct referral clicks from AI platforms (from GA) */
  directClicks: number

  /** Conversions attributed to direct AI referral traffic (from GA) */
  directConversions: number

  /** Total branded/direct search traffic (from GA) — used as sanity check ceiling */
  brandedSearchTraffic: number

  /** Source of survey data (e.g. "Tally Sign-Up Survey") */
  surveySource?: string

  /** Number of survey responses collected */
  surveyResponses?: number
}

export interface BrandLiftResult {
  /** The lift multiplier: surveyAttribution / gaReferral */
  liftMultiplier: number

  /** Adjusted clicks accounting for brand lift */
  adjustedClicks: number

  /** Adjusted conversions accounting for brand lift */
  adjustedConversions: number

  /** Whether adjusted clicks pass the sanity check (≤ branded search traffic) */
  withinBounds: boolean

  /** All input data preserved for display */
  input: BrandLiftInput
}

// ---------------------------------------------------------------------------
// Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate brand lift multiplier and adjusted metrics.
 *
 * @example
 * ```ts
 * const result = calculateBrandLift({
 *   surveyAttributionPct: 10,   // 10% of users said "ChatGPT"
 *   gaReferralPct: 1.4,         // 1.4% of traffic from AI referrals
 *   directClicks: 89,
 *   directConversions: 12,
 *   brandedSearchTraffic: 3420,
 *   surveySource: 'Tally Sign-Up Survey',
 *   surveyResponses: 312,
 * })
 *
 * // result.liftMultiplier = 7.14
 * // result.adjustedClicks = 635
 * // result.adjustedConversions = 86
 * // result.withinBounds = true  (635 ≤ 3420)
 * ```
 */
export function calculateBrandLift(input: BrandLiftInput): BrandLiftResult {
  const {
    surveyAttributionPct,
    gaReferralPct,
    directClicks,
    directConversions,
    brandedSearchTraffic,
  } = input

  // Guard against division by zero
  if (gaReferralPct <= 0) {
    return {
      liftMultiplier: 0,
      adjustedClicks: directClicks,
      adjustedConversions: directConversions,
      withinBounds: true,
      input,
    }
  }

  const liftMultiplier = Math.round((surveyAttributionPct / gaReferralPct) * 100) / 100
  const adjustedClicks = Math.round(directClicks * liftMultiplier)
  const adjustedConversions = Math.round(directConversions * liftMultiplier)
  const withinBounds = adjustedClicks <= brandedSearchTraffic

  return {
    liftMultiplier,
    adjustedClicks,
    adjustedConversions,
    withinBounds,
    input,
  }
}

// ---------------------------------------------------------------------------
// Recommended multiplier ranges (based on industry data)
// ---------------------------------------------------------------------------

export const MULTIPLIER_BENCHMARKS = {
  'B2B SaaS (niche)': { low: 5, high: 10, note: 'Users research extensively before buying' },
  'B2B SaaS (broad)': { low: 3, high: 7, note: 'More direct clicks from AI' },
  'E-commerce': { low: 2, high: 5, note: 'More impulse / direct behavior' },
  'Content / Media': { low: 1.5, high: 3, note: 'Users may bookmark directly' },
} as const

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Check if the survey sample size is large enough for reliable estimates.
 * Recommended minimum: 100 responses.
 */
export function isSampleSizeAdequate(responses: number): boolean {
  return responses >= 100
}

/**
 * Check if the multiplier falls within expected industry range.
 */
export function isMultiplierReasonable(multiplier: number): boolean {
  return multiplier >= 1 && multiplier <= 20
}
