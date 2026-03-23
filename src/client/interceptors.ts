/**
 * Buffers console errors/warnings and fetch failures so errors that
 * happen BEFORE the user opens the report form are still captured.
 */

import type { ApiActivity, ConsoleEntry, NetworkFailure } from './types'

const MAX_CONSOLE_ENTRIES = 50
const MAX_NETWORK_FAILURES = 20
const MAX_API_ACTIVITY = 15

let consoleEntries: ConsoleEntry[] = []
let networkFailures: NetworkFailure[] = []
let apiActivity: ApiActivity[] = []

let originalConsoleError: typeof console.error | null = null
let originalConsoleWarn: typeof console.warn | null = null
let originalFetch: typeof window.fetch | null = null
let installed = false

let trackableUrlFilter: (url: string) => boolean = (url) => url.includes('/api/')

function pushCapped<T>(arr: T[], item: T, max: number): T[] {
  arr.push(item)
  return arr.length > max ? arr.slice(-max) : arr
}

function wrapConsoleMethod(level: 'error' | 'warn', original: typeof console.error) {
  return (...args: unknown[]) => {
    consoleEntries = pushCapped(consoleEntries, {
      level,
      message: args.map(String).join(' '),
      timestamp: Date.now(),
    }, MAX_CONSOLE_ENTRIES)
    original.apply(console, args)
  }
}

function interceptConsole() {
  originalConsoleError = console.error
  originalConsoleWarn = console.warn
  console.error = wrapConsoleMethod('error', originalConsoleError)
  console.warn = wrapConsoleMethod('warn', originalConsoleWarn)
}

/** Extract URL and method from fetch arguments without allocating a Request */
function extractFetchMeta(args: Parameters<typeof fetch>): { url: string; method: string } {
  const input = args[0]
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (args[1]?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
  return { url, method }
}

function interceptFetch() {
  originalFetch = window.fetch

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const { url, method } = extractFetchMeta(args)
    const start = performance.now()
    try {
      const response = await originalFetch!(...args)

      if (!response.ok) {
        networkFailures = pushCapped(networkFailures, {
          url, method,
          status: response.status,
          statusText: response.statusText,
          timestamp: Date.now(),
        }, MAX_NETWORK_FAILURES)
      }

      if (response.ok && trackableUrlFilter(url)) {
        apiActivity = pushCapped(apiActivity, {
          url, method,
          status: response.status,
          durationMs: Math.round(performance.now() - start),
          timestamp: Date.now(),
        }, MAX_API_ACTIVITY)
      }

      return response
    } catch (err) {
      networkFailures = pushCapped(networkFailures, {
        url, method,
        status: null,
        statusText: err instanceof Error ? err.message : 'Network error',
        timestamp: Date.now(),
      }, MAX_NETWORK_FAILURES)
      throw err
    }
  }
}

export function configure(opts: { isTrackableUrl?: (url: string) => boolean }) {
  if (opts.isTrackableUrl) {
    trackableUrlFilter = opts.isTrackableUrl
  }
}

export function install() {
  if (installed) return
  interceptConsole()
  interceptFetch()
  installed = true
}

export function uninstall() {
  if (!installed) return
  if (originalConsoleError) console.error = originalConsoleError
  if (originalConsoleWarn) console.warn = originalConsoleWarn
  if (originalFetch) window.fetch = originalFetch
  originalConsoleError = null
  originalConsoleWarn = null
  originalFetch = null
  installed = false
}

export function getConsoleEntries(): ConsoleEntry[] {
  return [...consoleEntries]
}

export function getNetworkFailures(): NetworkFailure[] {
  return [...networkFailures]
}

export function getApiActivity(): ApiActivity[] {
  return [...apiActivity]
}
