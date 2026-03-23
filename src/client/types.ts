export interface DomSnapshot {
  /** outerHTML of the selected element (truncated to 5000 chars) */
  outerHTML: string
  /** Bounding rectangle relative to viewport */
  boundingRect: {
    top: number
    left: number
    width: number
    height: number
  }
  /** CSS selector path for the element */
  selectorPath: string
  /** Tag name (lowercase) */
  tagName: string
  /** Element id attribute, if present */
  id: string | null
  /** Element class list */
  classes: string[]
}

export interface ConsoleEntry {
  level: 'error' | 'warn'
  message: string
  timestamp: number
}

export interface NetworkFailure {
  url: string
  method: string
  status: number | null
  statusText: string
  timestamp: number
}

/** Successful API response summary (no body — just metadata for triage) */
export interface ApiActivity {
  url: string
  method: string
  status: number
  durationMs: number
  timestamp: number
}

export interface BrowserInfo {
  userAgent: string
  viewport: { width: number; height: number }
  url: string
  route: string
}

export type Severity = 'blocker' | 'major' | 'minor' | 'cosmetic'

export interface BugLensReport {
  /** User-written description of the issue */
  description: string
  /** What the user expected to happen */
  expectedBehavior: string
  severity: Severity
  /** Base64-encoded PNG screenshot, or null if capture failed */
  screenshot: string | null
  /** Info about the selected DOM element */
  element: DomSnapshot
  /** Browser/page context */
  browser: BrowserInfo
  /** React component ancestry from selected element (via data-component attrs) */
  componentPath: string[]
  /** Business-level page context — e.g. { grant: "CKL", month: "2026-02" } */
  pageContext: Record<string, string>
  /** Recent console errors/warnings (last 50) */
  consoleEntries: ConsoleEntry[]
  /** Recent failed network requests (last 20) */
  networkFailures: NetworkFailure[]
  /** Recent successful API calls (last 15) — metadata only, no response bodies */
  recentApiCalls: ApiActivity[]
  /** ISO timestamp when report was created */
  createdAt: string
  /** Email of the reporting user */
  reporterEmail: string
}

/** Severity → Linear priority mapping */
export const SEVERITY_TO_PRIORITY: Record<Severity, number> = {
  blocker: 1,  // Urgent
  major: 2,    // High
  minor: 3,    // Medium
  cosmetic: 4, // Low
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  blocker: "I can't do my work (P1)",
  major: 'Something is wrong (P2)',
  minor: 'Minor issue (P3)',
  cosmetic: 'Visual/cosmetic (P4)',
}

// ---------------------------------------------------------------------------
// Package configuration types
// ---------------------------------------------------------------------------

export interface BugLensConfig {
  /** API route path in the consuming app (default: '/api/buglens/report') */
  apiEndpoint?: string

  /** Async function that determines if the current user can see the bug button.
   *  Default: () => true (always visible — server is the auth gatekeeper). */
  canReport?: () => Promise<boolean>

  /** Function to determine which fetch URLs to track as API activity.
   *  Default: (url) => url.includes('/api/') */
  isTrackableUrl?: (url: string) => boolean

  /** Called when a report is successfully submitted.
   *  Default: uses sonner toast if installed, otherwise window.alert. */
  onSuccess?: (result: { issueUrl: string; issueIdentifier: string }) => void

  /** Called when a report submission fails.
   *  Default: uses sonner toast if installed, otherwise window.alert. */
  onError?: (error: Error) => void
}

export interface ScreenshotStorage {
  /** Upload a base64 PNG data URL and return a public URL. */
  upload(base64DataUrl: string): Promise<string | null>
}
