'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Select from '@radix-ui/react-select'
import { useBugLens } from './provider'
import type { BugLensReport, Severity } from './types'
import { SEVERITY_LABELS } from './types'

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 6,
  border: '1px solid rgb(209, 213, 219)',
  padding: '8px 12px',
  fontSize: 14,
  color: 'rgb(17, 24, 39)',
  backgroundColor: 'white',
  outline: 'none',
  fontFamily: 'inherit',
  resize: 'vertical' as const,
}

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'rgb(17, 24, 39)',
  display: 'block',
  marginBottom: 6,
}

interface BugLensReportFormProps {
  open: boolean
  onClose: () => void
  screenshot: string | null
  buildReport: (description: string, expectedBehavior: string, severity: Severity) => BugLensReport
}

export function BugLensReportForm({
  open,
  onClose,
  screenshot,
  buildReport,
}: BugLensReportFormProps) {
  const { config } = useBugLens()
  const [description, setDescription] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [severity, setSeverity] = useState<Severity>('minor')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitHover, setSubmitHover] = useState(false)

  const handleSubmit = async () => {
    if (!description.trim()) return

    setIsSubmitting(true)
    try {
      const report = buildReport(description, expectedBehavior, severity)
      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to submit report')
      }

      const result = await response.json()
      config.onSuccess({
        issueUrl: result.issueUrl,
        issueIdentifier: result.issueIdentifier,
      })
      onClose()
    } catch (err) {
      config.onError(err instanceof Error ? err : new Error('Failed to submit report'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-buglens
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
          }}
        />
        <Dialog.Content
          data-buglens
          style={{
            position: 'fixed',
            right: 0,
            top: 0,
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: 400,
            backgroundColor: 'white',
            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.12)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ borderBottom: '1px solid rgb(229, 231, 235)', padding: '16px 24px' }}>
            <Dialog.Title style={{ fontSize: 18, fontWeight: 600, color: 'rgb(17, 24, 39)', margin: 0 }}>
              Report an Issue
            </Dialog.Title>
            <Dialog.Description style={{ marginTop: 4, fontSize: 14, color: 'rgb(107, 114, 128)' }}>
              Tell us what went wrong. A screenshot and technical details are captured automatically.
            </Dialog.Description>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {screenshot && (
                <div style={{ borderRadius: 6, border: '1px solid rgb(229, 231, 235)', overflow: 'hidden' }}>
                  <img
                    src={screenshot}
                    alt="Page screenshot"
                    style={{ width: '100%', height: 'auto', maxHeight: 160, objectFit: 'cover', objectPosition: 'top', display: 'block' }}
                  />
                </div>
              )}

              <div>
                <label htmlFor="buglens-description" style={labelStyle}>
                  What happened?
                </label>
                <textarea
                  id="buglens-description"
                  placeholder="e.g. The total doesn't match what I expected..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  autoFocus
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="buglens-expected" style={labelStyle}>
                  What did you expect to see?
                </label>
                <textarea
                  id="buglens-expected"
                  placeholder="e.g. The total should be $12,500 based on last month's report..."
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  rows={2}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  How urgent is this?
                </label>
                <Select.Root value={severity} onValueChange={(val) => setSeverity(val as Severity)}>
                  <Select.Trigger
                    style={{
                      display: 'flex',
                      height: 36,
                      width: '100%',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: 6,
                      border: '1px solid rgb(209, 213, 219)',
                      backgroundColor: 'white',
                      padding: '0 12px',
                      fontSize: 14,
                      color: 'rgb(17, 24, 39)',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <Select.Value />
                    <Select.Icon>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="rgb(107, 114, 128)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content
                      data-buglens
                      position="popper"
                      sideOffset={4}
                      style={{
                        zIndex: 10001,
                        overflow: 'hidden',
                        borderRadius: 6,
                        border: '1px solid rgb(229, 231, 235)',
                        backgroundColor: 'white',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <Select.Viewport style={{ padding: 4 }}>
                        {(Object.entries(SEVERITY_LABELS) as [Severity, string][]).map(
                          ([value, label]) => (
                            <Select.Item
                              key={value}
                              value={value}
                              style={{
                                cursor: 'pointer',
                                borderRadius: 4,
                                padding: '8px 12px',
                                fontSize: 14,
                                color: 'rgb(17, 24, 39)',
                                outline: 'none',
                              }}
                            >
                              <Select.ItemText>{label}</Select.ItemText>
                            </Select.Item>
                          )
                        )}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid rgb(229, 231, 235)', padding: '16px 24px' }}>
            <button
              onClick={handleSubmit}
              onMouseEnter={() => setSubmitHover(true)}
              onMouseLeave={() => setSubmitHover(false)}
              disabled={!description.trim() || isSubmitting}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 6,
                backgroundColor: (!description.trim() || isSubmitting)
                  ? 'rgb(147, 167, 228)'
                  : submitHover ? 'rgb(29, 78, 216)' : 'rgb(37, 99, 235)',
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                color: 'white',
                border: 'none',
                cursor: (!description.trim() || isSubmitting) ? 'not-allowed' : 'pointer',
                transition: 'background-color 150ms ease',
              }}
            >
              {isSubmitting ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              )}
              Submit Issue
            </button>
          </div>

          {/* Keyframe for spinner */}
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
