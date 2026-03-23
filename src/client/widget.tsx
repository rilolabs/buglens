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
  const [fabHover, setFabHover] = useState(false)
  const [cancelHover, setCancelHover] = useState(false)
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
          onMouseEnter={() => setFabHover(true)}
          onMouseLeave={() => setFabHover(false)}
          title="Report an issue"
          data-buglens
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            backgroundColor: fabHover ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
            boxShadow: fabHover ? '0 10px 25px -3px rgba(0,0,0,0.15)' : '0 4px 12px -1px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            padding: 0,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgb(37, 99, 235)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
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
        <div
          data-buglens
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              borderRadius: 9999,
              backgroundColor: 'rgb(37, 99, 235)',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              color: 'white',
              boxShadow: '0 4px 12px -1px rgba(0,0,0,0.1)',
            }}
          >
            {isCapturing ? 'Capturing...' : 'Click an element to report'}
          </span>
          <button
            onClick={handleCancel}
            onMouseEnter={() => setCancelHover(true)}
            onMouseLeave={() => setCancelHover(false)}
            style={{
              height: 32,
              borderRadius: 9999,
              border: '1px solid rgb(209, 213, 219)',
              backgroundColor: cancelHover ? 'rgb(243, 244, 246)' : 'white',
              padding: '0 12px',
              fontSize: 12,
              fontWeight: 500,
              color: 'rgb(55, 65, 81)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              transition: 'background-color 150ms ease',
            }}
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
