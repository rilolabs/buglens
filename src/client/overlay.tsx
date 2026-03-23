'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

interface BugLensOverlayProps {
  active: boolean
  onElementSelected: (element: Element) => void
  onCancel: () => void
}

/**
 * Uses capture-phase event listeners so clicks are intercepted before
 * React handlers. The highlight div uses pointer-events: none so
 * elementFromPoint sees through to real page elements.
 */
export function BugLensOverlay({
  active,
  onElementSelected,
  onCancel,
}: BugLensOverlayProps) {
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
  const [selectedRect, setSelectedRect] = useState<DOMRect | null>(null)
  const hoveredRef = useRef<Element | null>(null)

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!active) return
      const target = document.elementFromPoint(e.clientX, e.clientY)
      if (!target || target.closest('[data-buglens]')) {
        hoveredRef.current = null
        setHighlightRect(null)
        return
      }
      // Skip re-render if hovering the same element
      if (target === hoveredRef.current) return
      hoveredRef.current = target
      setHighlightRect(target.getBoundingClientRect())
    },
    [active]
  )

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!active) return

      const target = document.elementFromPoint(e.clientX, e.clientY)
      if (!target || target.closest('[data-buglens]')) return

      e.preventDefault()
      e.stopImmediatePropagation()

      setSelectedRect(target.getBoundingClientRect())
      setHighlightRect(null)
      hoveredRef.current = null
      onElementSelected(target)
    },
    [active, onElementSelected]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    },
    [onCancel]
  )

  useEffect(() => {
    if (!active) {
      setHighlightRect(null)
      setSelectedRect(null)
      hoveredRef.current = null
      return
    }

    document.addEventListener('mousemove', handleMouseMove, true)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [active, handleMouseMove, handleClick, handleKeyDown])

  const rect = selectedRect || highlightRect
  if (!rect) return null

  return createPortal(
    <div
      data-buglens
      style={{
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        border: selectedRect
          ? '2px solid rgb(239, 68, 68)'
          : '2px solid rgb(59, 130, 246)',
        backgroundColor: selectedRect
          ? 'rgba(239, 68, 68, 0.1)'
          : 'rgba(59, 130, 246, 0.1)',
        borderRadius: 4,
        pointerEvents: 'none',
        zIndex: 9999,
        transition: 'all 50ms ease-out',
      }}
    />,
    document.body
  )
}
