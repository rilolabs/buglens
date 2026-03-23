'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { install, uninstall, configure as configureInterceptors } from './interceptors'
import { BugLensWidget } from './widget'
import type { BugLensConfig } from './types'

interface BugLensContextValue {
  config: Required<BugLensConfig>
}

const BugLensContext = createContext<BugLensContextValue | null>(null)

async function showNotification(type: 'success' | 'error', message: string, description?: string) {
  try {
    const { toast } = await import('sonner')
    if (type === 'success') {
      toast.success(message, description ? { description } : undefined)
    } else {
      toast.error(message)
    }
  } catch {
    if (typeof window !== 'undefined') {
      window.alert(message)
    }
  }
}

const DEFAULTS: Required<BugLensConfig> = {
  apiEndpoint: '/api/buglens/report',
  canReport: async () => true,
  isTrackableUrl: (url: string) => url.includes('/api/'),
  onSuccess: (result) => showNotification('success', 'Issue reported — thank you!', `Created ${result.issueIdentifier}`),
  onError: (error) => showNotification('error', error.message),
}

export function BugLensProvider({
  children,
  ...config
}: BugLensConfig & { children: ReactNode }) {
  const mergedConfig = useMemo(
    () => ({ ...DEFAULTS, ...config }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.apiEndpoint, config.canReport, config.isTrackableUrl, config.onSuccess, config.onError]
  )
  const [canReportResult, setCanReportResult] = useState(false)

  useEffect(() => {
    configureInterceptors({ isTrackableUrl: mergedConfig.isTrackableUrl })
    install()
    mergedConfig
      .canReport()
      .then(setCanReportResult)
      .catch(() => setCanReportResult(false))
    return () => uninstall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ctxValue = useMemo(() => ({ config: mergedConfig }), [mergedConfig])

  return (
    <BugLensContext.Provider value={ctxValue}>
      {children}
      {canReportResult && <BugLensWidget />}
    </BugLensContext.Provider>
  )
}

export function useBugLens() {
  const ctx = useContext(BugLensContext)
  if (!ctx) throw new Error('useBugLens must be used within <BugLensProvider>')
  return ctx
}
