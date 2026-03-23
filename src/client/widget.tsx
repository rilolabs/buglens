'use client'

import { useState, useCallback, useRef } from 'react'
import { BugLensOverlay } from './overlay'
import { BugLensReportForm } from './report-form'
import {
  captureScreenshot,
  captureBrowserInfo,
  captureDomSnapshot,
  captureComponentPath,
  capturePageContext,
} from './capture'
import { getConsoleEntries, getNetworkFailures, getApiActivity } from './interceptors'
import { useBugLens } from './provider'
import type { BugLensReport, DomSnapshot, BrowserInfo } from './types'

type Mode = 'idle' | 'inspecting' | 'reporting'

interface CapturedData {
  element: DomSnapshot
  screenshot: string | null
  browser: BrowserInfo
  componentPath: string[]
  pageContext: Record<string, string>
}

const INITIAL_CAPTURE: CapturedData | null = null

export function BugLensWidget() {
  const { config } = useBugLens()
  const [mode, setMode] = useState<Mode>('idle')
  const [captured, setCaptured] = useState<CapturedData | null>(INITIAL_CAPTURE)
  const [isCapturing, setIsCapturing] = useState(false)
  const selectedElementRef = useRef<Element | null>(null)

  const handleElementSelected = useCallback(async (element: Element) => {
    selectedElementRef.current = element
    setIsCapturing(true)

    // Capture sync data first — reflects click-time DOM state
    const browser = captureBrowserInfo()
    const domSnapshot = captureDomSnapshot(element)
    const componentPath = captureComponentPath(element)
    const pageContext = capturePageContext(element)

    const screenshot = await captureScreenshot(element)

    setCaptured({ element: domSnapshot, screenshot, browser, componentPath, pageContext })
    setIsCapturing(false)
    setMode('reporting')
  }, [])

  const handleCancel = useCallback(() => {
    setMode('idle')
    setCaptured(INITIAL_CAPTURE)
    selectedElementRef.current = null
  }, [])

  const buildReport = useCallback(
    (description: string, expectedBehavior: string, severity: BugLensReport['severity']): BugLensReport => ({
      description,
      expectedBehavior,
      severity,
      screenshot: captured!.screenshot,
      element: captured!.element,
      browser: captured!.browser,
      componentPath: captured!.componentPath,
      pageContext: captured!.pageContext,
      consoleEntries: getConsoleEntries(),
      networkFailures: getNetworkFailures(),
      recentApiCalls: getApiActivity(),
      createdAt: new Date().toISOString(),
      reporterEmail: 'anonymous',
    }),
    [captured]
  )

  return (
    <>
      {mode === 'idle' && (
        <button
          onClick={() => setMode('inspecting')}
          title="Report an issue"
          data-buglens
          className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-blue-500/50 bg-blue-500/10 shadow-lg transition-all hover:bg-blue-500/20 hover:shadow-xl"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-blue-600 dark:text-blue-400"
          >
            <path d="m8 2 1.88 1.88" />
            <path d="M14.12 3.88 16 2" />
            <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
            <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
            <path d="M12 20v-9" />
            <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
            <path d="M6 13H2" />
            <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
            <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
            <path d="M22 13h-4" />
            <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
          </svg>
        </button>
      )}

      {mode === 'inspecting' && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2" data-buglens>
          <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
            {isCapturing ? 'Capturing...' : 'Click an element to report'}
          </span>
          <button
            onClick={handleCancel}
            className="h-8 rounded-full border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      <BugLensOverlay
        active={mode === 'inspecting'}
        onElementSelected={handleElementSelected}
        onCancel={handleCancel}
      />

      {mode === 'reporting' && captured && (
        <BugLensReportForm
          open
          onClose={handleCancel}
          screenshot={captured.screenshot}
          buildReport={buildReport}
        />
      )}
    </>
  )
}
