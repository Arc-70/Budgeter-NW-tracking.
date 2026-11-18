import { useEffect, useRef, useState, type ReactNode } from 'react'

const WIDTH = 288
const canHover = () => matchMedia('(hover: hover)').matches

// A small "i" that shows a short explanation: on hover with a mouse, on tap or
// long-press on a phone. Tapping anywhere else closes it.
export function Info({ children }: { children: ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)

  function show() {
    const r = button.current!.getBoundingClientRect()
    const width = Math.min(WIDTH, window.innerWidth - 16)
    const left = Math.min(Math.max(8, r.left - 8), window.innerWidth - width - 8)
    setPos({ top: r.bottom + 6, left, width })
  }
  const hide = () => setPos(null)

  useEffect(() => {
    if (!pos) return
    const outside = (e: Event) => {
      if (!button.current?.contains(e.target as Node)) hide()
    }
    // Close once the page has really scrolled away (ignores the tiny scrolls a tap can cause).
    const scrolled = () => {
      const r = button.current?.getBoundingClientRect()
      if (!r || Math.abs(r.bottom + 6 - pos.top) > 12) hide()
    }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('scroll', scrolled, true)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('scroll', scrolled, true)
      window.removeEventListener('resize', hide)
    }
  }, [pos])

  return (
    <span className="info" onMouseEnter={() => canHover() && show()} onMouseLeave={() => canHover() && hide()}>
      <button
        ref={button}
        type="button"
        className="info-btn"
        aria-label="More info"
        aria-expanded={pos !== null}
        onClick={() => (pos ? hide() : show())}
        onContextMenu={(e) => {
          e.preventDefault() // long-press on Android
          show()
        }}
      >
        i
      </button>
      {pos && (
        <span className="info-pop" role="tooltip" style={{ top: pos.top, left: pos.left, width: pos.width }}>
          {children}
        </span>
      )}
    </span>
  )
}
