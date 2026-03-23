'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Select from '@radix-ui/react-select'
import { useBugLens } from './provider'
import type { BugLensReport, Severity } from './types'
import { SEVERITY_LABELS } from './types'

const textareaClasses = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500'

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
        <Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/40" data-buglens />
        <Dialog.Content
          data-buglens
          className="fixed right-0 top-0 z-[10000] flex h-full w-[400px] flex-col bg-white shadow-xl dark:bg-gray-900"
        >
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Report an Issue
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Tell us what went wrong. A screenshot and technical details are captured automatically.
            </Dialog.Description>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-4">
              {screenshot && (
                <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                  <img
                    src={screenshot}
                    alt="Page screenshot"
                    className="h-auto max-h-40 w-full object-cover object-top"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="buglens-description" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  What happened?
                </label>
                <textarea
                  id="buglens-description"
                  placeholder="e.g. The total doesn't match what I expected..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  autoFocus
                  className={textareaClasses}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="buglens-expected" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  What did you expect to see?
                </label>
                <textarea
                  id="buglens-expected"
                  placeholder="e.g. The total should be $12,500 based on last month's report..."
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  rows={2}
                  className={textareaClasses}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  How urgent is this?
                </label>
                <Select.Root value={severity} onValueChange={(val) => setSeverity(val as Severity)}>
                  <Select.Trigger className="flex h-9 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                    <Select.Value />
                    <Select.Icon>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-500">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content
                      className="z-[10001] overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                      position="popper"
                      sideOffset={4}
                      data-buglens
                    >
                      <Select.Viewport className="p-1">
                        {(Object.entries(SEVERITY_LABELS) as [Severity, string][]).map(
                          ([value, label]) => (
                            <Select.Item
                              key={value}
                              value={value}
                              className="cursor-pointer rounded px-3 py-2 text-sm text-gray-900 outline-none data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-900 dark:text-gray-100 dark:data-[highlighted]:bg-blue-900/30 dark:data-[highlighted]:text-blue-200"
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

          <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <button
              onClick={handleSubmit}
              disabled={!description.trim() || isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {isSubmitting ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
