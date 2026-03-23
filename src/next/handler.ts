import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createLinearIssue, uploadScreenshot } from '../server/linear'
import type { LinearConfig } from '../server/linear'
import type { BugLensReport, ScreenshotStorage } from '../client/types'

export interface BugLensHandlerConfig {
  /** Linear configuration. Overrides environment variables when provided. */
  linear?: LinearConfig

  /** Server-side auth check. Receives the NextRequest. */
  authorize?: (request: NextRequest) => Promise<
    | { authorized: true; email: string }
    | { authorized: false; status?: number; message?: string }
  >

  /** Custom screenshot storage adapter. Default: uploads to Linear's file storage. */
  storage?: ScreenshotStorage
}

export function createBugLensHandler(config: BugLensHandlerConfig = {}) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    try {
      let authorizedEmail: string | undefined
      if (config.authorize) {
        const authResult = await config.authorize(request)
        if (!authResult.authorized) {
          return NextResponse.json(
            { error: authResult.message || 'Unauthorized' },
            { status: authResult.status || 401 }
          )
        }
        authorizedEmail = authResult.email
      }

      const report: BugLensReport = await request.json()

      if (authorizedEmail) {
        report.reporterEmail = authorizedEmail
      }

      // Resolve API key once for both screenshot upload and issue creation
      const linearConfig = config.linear || {}
      const apiKey = linearConfig.apiKey || process.env.LINEAR_API_KEY

      let screenshotUrl: string | null = null
      if (report.screenshot) {
        if (config.storage) {
          try {
            screenshotUrl = await config.storage.upload(report.screenshot)
          } catch (err) {
            console.warn('[BugLens] Custom storage upload failed:', err)
          }
        }

        if (!screenshotUrl && apiKey) {
          screenshotUrl = await uploadScreenshot(report.screenshot, apiKey)
        }
      }

      const result = await createLinearIssue(report, screenshotUrl, linearConfig)

      return NextResponse.json({
        success: true,
        issueId: result.issueId,
        issueIdentifier: result.issueIdentifier,
        issueUrl: result.issueUrl,
      })
    } catch (error) {
      console.error('[BugLens] Handler error:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
