/** Uses raw fetch instead of the Linear SDK to keep bundle size minimal. */

import type { BugLensReport } from '../client/types'
import { SEVERITY_LABELS, SEVERITY_TO_PRIORITY } from '../client/types'

const LINEAR_API_URL = 'https://api.linear.app/graphql'

export interface LinearIssueResult {
  issueId: string
  issueIdentifier: string
  issueUrl: string
}

export interface LinearConfig {
  apiKey?: string
  teamId?: string
  labelId?: string
}

async function linearQuery(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<{ data: Record<string, unknown> }> {
  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Linear API returned ${response.status}: ${text}`)
  }

  const result = await response.json()

  if (result.errors) {
    throw new Error(
      `Linear API error: ${result.errors.map((e: { message: string }) => e.message).join(', ')}`
    )
  }

  return result
}

export function formatIssueBody(
  report: BugLensReport,
  screenshotUrl: string | null
): string {
  const sections: string[] = []

  if (screenshotUrl) {
    sections.push(`![Screenshot](${screenshotUrl})`)
    sections.push('')
  }

  sections.push(`## What happened`)
  sections.push(report.description)
  if (report.expectedBehavior) {
    sections.push('')
    sections.push(`## What was expected`)
    sections.push(report.expectedBehavior)
  }
  sections.push('')
  sections.push(`**Severity:** ${SEVERITY_LABELS[report.severity]}`)
  sections.push(`**Reporter:** ${report.reporterEmail}`)

  if (Object.keys(report.pageContext).length > 0) {
    sections.push('')
    sections.push(`## Data Context`)
    for (const [key, value] of Object.entries(report.pageContext)) {
      sections.push(`- **${key}:** ${value}`)
    }
  }

  if (report.componentPath.length > 0) {
    sections.push('')
    sections.push(`## Component Path`)
    sections.push(`\`${report.componentPath.join(' → ')}\``)
  }

  sections.push('')
  sections.push(`## Page Context`)
  sections.push(`- **URL:** ${report.browser.url}`)
  sections.push(`- **Route:** ${report.browser.route}`)
  sections.push(
    `- **Viewport:** ${report.browser.viewport.width}x${report.browser.viewport.height}`
  )
  sections.push(`- **User Agent:** ${report.browser.userAgent}`)
  sections.push(`- **Reported at:** ${report.createdAt}`)

  if (report.consoleEntries.length > 0) {
    sections.push('')
    sections.push(`## Console Errors/Warnings (${report.consoleEntries.length})`)
    sections.push('```')
    for (const entry of report.consoleEntries.slice(-15)) {
      sections.push(`[${entry.level.toUpperCase()}] ${entry.message}`)
    }
    sections.push('```')
  }

  if (report.networkFailures.length > 0) {
    sections.push('')
    sections.push(`## Network Failures (${report.networkFailures.length})`)
    for (const failure of report.networkFailures.slice(-10)) {
      sections.push(
        `- \`${failure.method} ${failure.url}\` → ${failure.status ?? 'ERR'} ${failure.statusText}`
      )
    }
  }

  if (report.recentApiCalls.length > 0) {
    sections.push('')
    sections.push(`## Recent API Calls (${report.recentApiCalls.length})`)
    for (const call of report.recentApiCalls) {
      sections.push(
        `- \`${call.method} ${call.url}\` → ${call.status} (${call.durationMs}ms)`
      )
    }
  }

  sections.push('')
  sections.push(`## Selected Element`)
  sections.push(`- **Selector:** \`${report.element.selectorPath}\``)
  sections.push(`- **Tag:** \`${report.element.tagName}\``)
  if (report.element.id) {
    sections.push(`- **ID:** \`${report.element.id}\``)
  }
  if (report.element.classes.length > 0) {
    sections.push(`- **Classes:** \`${report.element.classes.join(' ')}\``)
  }
  if (report.element.outerHTML) {
    sections.push('')
    sections.push(`## Element HTML`)
    sections.push('<details><summary>Click to expand</summary>')
    sections.push('')
    sections.push('```html')
    sections.push(report.element.outerHTML)
    sections.push('```')
    sections.push('</details>')
  }

  return sections.join('\n')
}

/**
 * Two-step upload: request a presigned URL from Linear, then PUT the file.
 * Returns the hosted asset URL, or null if upload fails.
 */
export async function uploadScreenshot(
  base64DataUrl: string,
  apiKey: string
): Promise<string | null> {
  try {
    const base64Data = base64DataUrl.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const filename = `buglens-${Date.now()}.png`

    const result = await linearQuery(apiKey, `
      mutation FileUpload($size: Int!, $filename: String!, $contentType: String!) {
        fileUpload(size: $size, filename: $filename, contentType: $contentType) {
          success
          uploadFile {
            uploadUrl
            assetUrl
            headers { key value }
          }
        }
      }
    `, { size: buffer.length, filename, contentType: 'image/png' })

    const uploadFile = (result.data?.fileUpload as Record<string, unknown>)?.uploadFile as {
      uploadUrl: string
      assetUrl: string
      headers: { key: string; value: string }[]
    } | undefined

    if (!uploadFile?.uploadUrl || !uploadFile?.assetUrl) {
      console.warn('[BugLens] Linear fileUpload returned no upload URL')
      return null
    }

    const uploadHeaders: Record<string, string> = { 'Content-Type': 'image/png' }
    for (const h of uploadFile.headers) {
      uploadHeaders[h.key] = h.value
    }

    const putResponse = await fetch(uploadFile.uploadUrl, {
      method: 'PUT',
      headers: uploadHeaders,
      body: buffer,
    })

    if (!putResponse.ok) {
      console.warn('[BugLens] Screenshot PUT upload failed:', putResponse.status)
      return null
    }

    return uploadFile.assetUrl
  } catch (err) {
    console.warn('[BugLens] Screenshot upload failed:', err)
    return null
  }
}

export async function createLinearIssue(
  report: BugLensReport,
  screenshotUrl: string | null,
  config: LinearConfig = {}
): Promise<LinearIssueResult> {
  const apiKey = config.apiKey || process.env.LINEAR_API_KEY
  const teamId = config.teamId || process.env.LINEAR_BUGLENS_TEAM_ID
  const labelId = config.labelId || process.env.LINEAR_BUGLENS_LABEL_ID

  if (!apiKey || !teamId) {
    throw new Error(
      'LINEAR_API_KEY and LINEAR_BUGLENS_TEAM_ID environment variables are required'
    )
  }

  const title = `[BugLens] ${report.description.slice(0, 100)}${report.description.length > 100 ? '...' : ''}`
  const body = formatIssueBody(report, screenshotUrl)
  const priority = SEVERITY_TO_PRIORITY[report.severity]
  const labelIds = labelId ? [labelId] : undefined

  const result = await linearQuery(apiKey, `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url }
      }
    }
  `, { input: { teamId, title, description: body, priority, labelIds } })

  const issue = (result.data?.issueCreate as Record<string, unknown>)?.issue as {
    id: string; identifier: string; url: string
  } | undefined

  if (!issue) {
    throw new Error('Linear API did not return an issue')
  }

  return {
    issueId: issue.id,
    issueIdentifier: issue.identifier,
    issueUrl: issue.url,
  }
}
