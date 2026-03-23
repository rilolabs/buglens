# BugLens

Bug reporting widget for React apps. Click-to-select element inspector with automatic capture of screenshots, console errors, network failures, and DOM context. Creates Linear issues with full diagnostic data.

## Setup (4 steps)

### 1. Install

```bash
npm install github:rilolabs/buglens
```

### 2. Add the API route

Create `app/api/buglens/report/route.ts`:

```typescript
import { createBugLensHandler } from 'buglens/next'
import { createClient } from '@/lib/supabase/server'

export const POST = createBugLensHandler({
  authorize: async () => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { authorized: false, status: 401 }
    return { authorized: true, email: user.email || 'unknown' }
  },
})
```

### 3. Add BugLensProvider to your layout

```tsx
import { BugLensProvider } from 'buglens/client'

export default function Layout({ children }) {
  return (
    <BugLensProvider
      canReport={async () => {
        const res = await fetch('/api/auth/me')
        const user = await res.json()
        return user?.role === 'admin'
      }}
      reporterEmail="user@example.com"
      onSuccess={(result) => toast.success(`Reported: ${result.issueIdentifier}`)}
      onError={(err) => toast.error(err.message)}
    >
      {children}
    </BugLensProvider>
  )
}
```

### 4. Set environment variables

```env
LINEAR_API_KEY=lin_api_xxxxx
LINEAR_BUGLENS_TEAM_ID=<your-team-uuid>
LINEAR_BUGLENS_LABEL_ID=<optional-label-uuid>
```

### 5. Add Tailwind content path

BugLens uses Tailwind classes. Add the dist path so they get compiled:

**Tailwind v4** (CSS):
```css
@source "../node_modules/buglens/dist";
```

**Tailwind v3** (`tailwind.config.js`):
```js
content: [
  './src/**/*.{ts,tsx}',
  './node_modules/buglens/dist/**/*.{js,mjs}',
]
```

## What it captures

- Screenshot with element highlight (red border around selected element)
- DOM snapshot (selector path, tag, classes, truncated outerHTML)
- Browser info (viewport, URL, route, user agent)
- Console errors/warnings (last 50)
- Failed network requests (last 20)
- Recent API calls with timing (last 15)
- React component path (via `data-component` attributes)
- Page context (via `data-page-context` attributes)

## Configuration

### BugLensProvider props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `canReport` | `() => Promise<boolean>` | `() => true` | Controls widget visibility |
| `reporterEmail` | `string` | `'anonymous'` | Email attached to reports |
| `apiEndpoint` | `string` | `'/api/buglens/report'` | API route path |
| `isTrackableUrl` | `(url: string) => boolean` | `url.includes('/api/')` | Filter for API activity tracking |
| `onSuccess` | `(result) => void` | `window.alert` | Called on successful submission |
| `onError` | `(error: Error) => void` | `window.alert` | Called on submission failure |

### createBugLensHandler options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `authorize` | `(req) => Promise<AuthResult>` | No auth check | Server-side authorization |
| `storage` | `ScreenshotStorage` | Inline base64 | Screenshot upload adapter |
| `linearApiKey` | `string` | `process.env.LINEAR_API_KEY` | Override env var |
| `linearTeamId` | `string` | `process.env.LINEAR_BUGLENS_TEAM_ID` | Override env var |
| `linearLabelId` | `string` | `process.env.LINEAR_BUGLENS_LABEL_ID` | Override env var |

### Screenshot storage adapter

By default, screenshots are passed inline as base64 data URLs. To upload screenshots to external storage:

```typescript
export const POST = createBugLensHandler({
  storage: {
    async upload(base64DataUrl: string): Promise<string | null> {
      // Upload to your storage and return the public URL
      return publicUrl
    }
  }
})
```

## Data attributes

Add these to your components to enrich reports:

- `data-component="component-name"` — BugLens walks up the DOM to build a component path
- `data-page-context='{"grant":"CKL","month":"2026-02"}'` — Business-level context included in the report
