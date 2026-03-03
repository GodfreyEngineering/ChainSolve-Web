/**
 * studentVerification.ts — University email validation and student
 * verification service (I7-1).
 *
 * Students verify ownership of a university email address to unlock
 * Pro-equivalent features at no cost.  The flow:
 *   1. Student enters university email in settings.
 *   2. Client validates the domain, then POSTs to /api/student/request.
 *   3. Server stores a hashed 6-digit code + sends email (Resend / SMTP).
 *   4. Student enters the code in the UI.
 *   5. Client POSTs to /api/student/confirm → server sets is_student=true.
 */

// ── University email domain patterns ────────────────────────────────
//
// We match the email suffix against known academic TLD patterns.
// This is deliberately strict: only well-known academic suffixes are
// accepted.  Institutions that use generic TLDs (e.g. mit.edu vs
// some-college.com) are handled by the TLD list itself (.edu is a
// controlled namespace in the US).

const UNIVERSITY_TLDS: readonly string[] = [
  // United States — .edu is restricted to accredited institutions
  '.edu',
  // United Kingdom
  '.ac.uk',
  // Australia
  '.edu.au',
  // Canada — many use .ca but academic institutions use these patterns
  '.edu.ca',
  '.ac.ca',
  // Japan
  '.ac.jp',
  // China
  '.edu.cn',
  // India
  '.ac.in',
  '.edu.in',
  // Brazil
  '.edu.br',
  // New Zealand
  '.ac.nz',
  // Singapore
  '.edu.sg',
  // Israel
  '.ac.il',
  // Mexico
  '.edu.mx',
  // Argentina
  '.edu.ar',
  // South Africa
  '.ac.za',
  // Colombia
  '.edu.co',
  // Hong Kong
  '.edu.hk',
  // South Korea
  '.ac.kr',
  // Germany
  '.ac.de',
  '.uni-',
  // France
  '.univ-',
  '.edu.fr',
  // Spain
  '.edu.es',
  // Italy
  '.edu.it',
  // Netherlands
  '.ac.nl',
  // Sweden
  '.ac.se',
  // Norway
  '.ac.no',
  // Denmark
  '.ac.dk',
  // Finland
  '.ac.fi',
  // Switzerland
  '.ac.ch',
  '.ethz.ch',
  '.epfl.ch',
  // Poland
  '.edu.pl',
  // Czech Republic
  '.ac.cz',
  // Hungary
  '.ac.hu',
  // Portugal
  '.edu.pt',
  // Turkey
  '.edu.tr',
  // Russia
  '.edu.ru',
  '.ac.ru',
  // Thailand
  '.ac.th',
  // Malaysia
  '.edu.my',
  // Indonesia
  '.ac.id',
  // Philippines
  '.edu.ph',
  // Taiwan
  '.edu.tw',
  // Pakistan
  '.edu.pk',
  // Egypt
  '.edu.eg',
  // Nigeria
  '.edu.ng',
  // Kenya
  '.ac.ke',
  // Chile
  '.edu.cl',
  // Peru
  '.edu.pe',
  // Iran
  '.ac.ir',
  // Saudi Arabia
  '.edu.sa',
  // UAE
  '.ac.ae',
  // Generic
  '.edu.',
  '.ac.',
]

/**
 * Returns true if the email belongs to a recognised university domain.
 * Checks against known academic TLD patterns.
 */
export function isUniversityEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return UNIVERSITY_TLDS.some((suffix) => {
    // For patterns like '.uni-' and '.univ-' check if the domain contains them
    if (suffix.startsWith('.') && suffix.endsWith('-')) {
      return domain.includes(suffix.slice(1))
    }
    return domain.endsWith(suffix)
  })
}

/**
 * Basic email format check (not exhaustive — server re-validates).
 */
export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ── Service calls ───────────────────────────────────────────────────

export interface StudentVerificationResponse {
  ok: boolean
  error?: string
}

/**
 * Request a verification code be sent to the university email.
 */
export async function requestStudentVerification(
  universityEmail: string,
): Promise<StudentVerificationResponse> {
  const res = await fetch('/api/student/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ universityEmail }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }))
    return { ok: false, error: body.error ?? `HTTP ${res.status}` }
  }
  return { ok: true }
}

/**
 * Confirm the verification code received at the university email.
 */
export async function confirmStudentVerification(
  code: string,
): Promise<StudentVerificationResponse> {
  const res = await fetch('/api/student/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ code }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Confirmation failed' }))
    return { ok: false, error: body.error ?? `HTTP ${res.status}` }
  }
  return { ok: true }
}

/** Exported for testing. */
export { UNIVERSITY_TLDS }
