/**
 * Each capture function has its own try/catch — partial reports are
 * always better than no reports.
 */

import type { BrowserInfo, DomSnapshot } from './types'

/**
 * Sums scrollTop/scrollLeft from all scrollable ancestors between the element
 * and the document root. html-to-image resets these to 0 in its DOM clone,
 * so we need to add them back to find the element's true position in the image.
 */
function getAncestorScrollOffset(el: Element): { x: number; y: number } {
  let x = 0
  let y = 0
  let current = el.parentElement
  while (current && current !== document.documentElement) {
    x += current.scrollLeft
    y += current.scrollTop
    current = current.parentElement
  }
  return { x, y }
}

/**
 * Captures a viewport-sized screenshot with a red highlight around the selected element.
 *
 * Strategy: html-to-image always renders from the top of the document (ignoring scroll),
 * so we can't rely on scrollIntoView. Instead we:
 *   1. Capture the full page body with the highlight at document coordinates
 *   2. Crop the resulting image to a viewport-sized region centered on the element
 *
 * Two important corrections applied here:
 *   - DPR scaling: html-to-image renders at devicePixelRatio (2x on Retina).
 *     The crop must scale coordinates to match the actual image pixel dimensions.
 *   - Scroll offset: html-to-image resets inner scroll containers to 0 in its
 *     DOM clone. We add ancestor scrollTop values so the crop targets the element's
 *     true position in the rendered image.
 *
 * Returns a base64 PNG string, or null if capture fails.
 */
export async function captureScreenshot(selectedElement: Element | null): Promise<string | null> {
  let highlight: HTMLDivElement | null = null

  try {
    // Calculate where to crop (document coordinates, accounting for scroll containers)
    let cropY = 0
    if (selectedElement) {
      const rect = selectedElement.getBoundingClientRect()
      const scrollOffset = getAncestorScrollOffset(selectedElement)

      // Element's position in the html-to-image rendered image.
      // getBoundingClientRect gives viewport-relative coords; we add window scroll
      // AND any inner container scroll (since those reset to 0 in the clone).
      const elementDocTop = rect.top + window.scrollY + scrollOffset.y
      const elementDocLeft = rect.left + window.scrollX + scrollOffset.x

      const elementCenter = elementDocTop + rect.height / 2
      // Center the crop region on the element, clamped to page bounds
      cropY = Math.max(0, elementCenter - window.innerHeight / 2)

      // Inject highlight at document coordinates (absolute, not fixed)
      highlight = document.createElement('div')
      highlight.setAttribute('data-buglens-highlight', '')
      Object.assign(highlight.style, {
        position: 'absolute',
        top: `${elementDocTop - 3}px`,
        left: `${elementDocLeft - 3}px`,
        width: `${rect.width + 6}px`,
        height: `${rect.height + 6}px`,
        border: '3px solid rgb(239, 68, 68)',
        borderRadius: '6px',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        zIndex: '9998',
        pointerEvents: 'none',
      })
      document.body.appendChild(highlight)
    }

    const { toPng } = await import('html-to-image')
    const fullPageDataUrl = await toPng(document.body, {
      cacheBust: true,
      // Render a transparent pixel for cross-origin images that can't be fetched
      imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      fetchRequestInit: { mode: 'cors' as RequestMode },
      filter: (el: HTMLElement) => !el.hasAttribute?.('data-buglens'),
    })

    // If no element selected, return the full page image
    if (!selectedElement) return fullPageDataUrl

    // Crop to a viewport-sized region centered on the selected element.
    // Pass page width so cropToRegion can detect the DPR scale factor.
    return await cropToRegion(
      fullPageDataUrl,
      cropY,
      window.innerWidth,
      window.innerHeight,
      document.body.scrollWidth
    )
  } catch (err) {
    // html-to-image fires an Event object on resource load failures (CORS, missing assets)
    const msg = err instanceof Event ? `Resource load failed: ${(err as Event).type}` : err
    console.warn('[BugLens] Screenshot capture failed:', msg)
    return null
  } finally {
    if (highlight) highlight.remove()
  }
}

/**
 * Crops a data URL image to a specific region, accounting for DPR scaling.
 *
 * html-to-image renders at window.devicePixelRatio by default (e.g. 2x on Retina).
 * The y/width/height params are in CSS pixels, so we detect the actual scale from
 * the image dimensions and convert before cropping.
 *
 * @param pageWidth - document.body.scrollWidth, used to detect the scale factor
 */
function cropToRegion(
  dataUrl: string,
  y: number,
  width: number,
  height: number,
  pageWidth: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // Detect the pixel ratio html-to-image used (e.g. 2 on Retina Mac).
      // The image is pageWidth * scale pixels wide.
      const scale = pageWidth > 0 ? img.naturalWidth / pageWidth : 1

      // Convert CSS-pixel crop coordinates to image-pixel coordinates
      const srcY = Math.min(
        y * scale,
        Math.max(0, img.naturalHeight - height * scale)
      )
      const srcW = width * scale
      const srcH = height * scale

      // Output at CSS pixel dimensions (viewport size) — the browser
      // downscales from the high-res source, keeping the image crisp.
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, srcY, srcW, srcH, 0, 0, width, height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

export function captureBrowserInfo(): BrowserInfo {
  try {
    return {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      url: window.location.href,
      route: window.location.pathname,
    }
  } catch (err) {
    console.warn('[BugLens] Browser info capture failed:', err)
    return { userAgent: '', viewport: { width: 0, height: 0 }, url: '', route: '' }
  }
}

function buildSelectorPath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase()
    if (current.id) {
      selector += `#${current.id}`
      parts.push(selector)
      break
    }
    const classes = Array.from(current.classList)
      .filter((c) => !c.startsWith('_')) // skip CSS module hashes
      .slice(0, 3)
    if (classes.length > 0) {
      selector += `.${classes.join('.')}`
    }
    parts.push(selector)
    current = current.parentElement
  }

  return parts.reverse().join(' > ')
}

/**
 * Walks up the DOM from the selected element, collecting `data-component`
 * attribute values. Returns an array like ["spending-breakdown", "grant-detail-client"].
 * Components should add data-component="component-name" to their outermost element.
 */
export function captureComponentPath(el: Element): string[] {
  try {
    const path: string[] = []
    let current: Element | null = el

    while (current && current !== document.body) {
      const name = current.getAttribute('data-component')
      if (name) path.push(name)
      current = current.parentElement
    }

    return path
  } catch (err) {
    console.warn('[BugLens] Component path capture failed:', err)
    return []
  }
}

/**
 * Finds the nearest ancestor with a `data-page-context` attribute and
 * parses it as JSON. Pages set this attribute with business-level context
 * like { grant: "CKL", month: "2026-02" } so the agent knows what data
 * the user was looking at.
 */
export function capturePageContext(el: Element): Record<string, string> {
  try {
    let current: Element | null = el

    while (current && current !== document.documentElement) {
      const raw = current.getAttribute('data-page-context')
      if (raw) {
        return JSON.parse(raw)
      }
      current = current.parentElement
    }

    return {}
  } catch (err) {
    console.warn('[BugLens] Page context capture failed:', err)
    return {}
  }
}

export function captureDomSnapshot(el: Element): DomSnapshot {
  try {
    const rect = el.getBoundingClientRect()
    const outerHTML = el.outerHTML.slice(0, 5000)

    return {
      outerHTML,
      boundingRect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
      selectorPath: buildSelectorPath(el),
      tagName: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: Array.from(el.classList),
    }
  } catch (err) {
    console.warn('[BugLens] DOM snapshot capture failed:', err)
    return {
      outerHTML: '',
      boundingRect: { top: 0, left: 0, width: 0, height: 0 },
      selectorPath: '',
      tagName: '',
      id: null,
      classes: [],
    }
  }
}
