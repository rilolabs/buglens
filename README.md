# BugLens

Bug reporting widget for React apps. Click-to-select element inspector with automatic capture of screenshots, console errors, network failures, and DOM context. Creates Linear issues with full diagnostic data.

## Setup (4 steps)

### 1. Install

```bash
npm install git+ssh://git@github-consulting:rilolabs/buglens.git
```

> **Note:** This uses the `github-consulting` SSH host alias so npm clones with the correct SSH key for the `@rilolabs` identity. Do not use the `github:rilolabs/buglens` shorthand — it resolves to `git@github.com:...` which bypasses the multi-account SSH setup.

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
LINEAR_BUGLENS_PROJECT_ID=<optional-project-uuid>
```

> **Multi-project setup:** If you have one Linear team but multiple apps, set `LINEAR_BUGLENS_PROJECT_ID` per app so issues route to the correct Linear project. The API key and team ID can be shared across all apps.

#### Where to find these values in Linear

**`LINEAR_API_KEY`** — Your personal API key:
1. Click your avatar in the bottom-left corner of Linear
2. Go to **Settings > Account > Security & Access**
3. Scroll to **Personal API keys** and click **New API key**
4. Name it (e.g., "BugLens") and copy immediately — it won't be shown again

**`LINEAR_BUGLENS_TEAM_ID`** — The team UUID (not the short key like `ENG`):
1. Navigate to the team in the Linear sidebar
2. Press **Cmd+K** to open the command palette
3. Type **"Copy model UUID"** and select it
4. Choose your team name — the UUID is now on your clipboard

**`LINEAR_BUGLENS_PROJECT_ID`** — The project UUID (optional):
1. Navigate to the project in Linear (sidebar > Projects)
2. Press **Cmd+K** > type **"Copy model UUID"**
3. Select the project name — UUID copied

**`LINEAR_BUGLENS_LABEL_ID`** — A label UUID to auto-tag issues (optional):
1. Navigate to any issue with that label, or go to **Settings > Workspace > Labels**
2. Press **Cmd+K** > type **"Copy model UUID"**
3. Select the label — UUID copied

> **Tip:** The **Cmd+K > "Copy model UUID"** trick works for teams, projects, labels, cycles, and most Linear entities. The results are context-sensitive — navigate to the entity's page first.

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
| `apiEndpoint` | `string` | `'/api/buglens/report'` | API route path |
| `isTrackableUrl` | `(url: string) => boolean` | `url.includes('/api/')` | Filter for API activity tracking |
| `onSuccess` | `(result) => void` | sonner toast (falls back to alert) | Called on successful submission |
| `onError` | `(error: Error) => void` | sonner toast (falls back to alert) | Called on submission failure |

### createBugLensHandler options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `authorize` | `(req) => Promise<AuthResult>` | No auth check | Server-side auth; returned `email` is injected into the report |
| `storage` | `ScreenshotStorage` | Uploads to Linear | Custom screenshot storage adapter |
| `linear.apiKey` | `string` | `process.env.LINEAR_API_KEY` | Override env var |
| `linear.teamId` | `string` | `process.env.LINEAR_BUGLENS_TEAM_ID` | Override env var |
| `linear.labelId` | `string` | `process.env.LINEAR_BUGLENS_LABEL_ID` | Override env var |
| `linear.projectId` | `string` | `process.env.LINEAR_BUGLENS_PROJECT_ID` | Route issues to a specific Linear project |

### Screenshot storage adapter

By default, screenshots are uploaded to Linear's file storage (no config needed). To use custom storage instead:

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
