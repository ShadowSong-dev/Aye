import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Variant =
  | 'primary'
  | 'secondary'
  | 'violet'
  | 'yellow'
  | 'aye'
  | 'nay'
  | 'text'
  | 'ghost'

export function Button(props: {
  variant?: Variant
  size?: 'sm' | 'md'
  icon?: boolean
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
  children?: ReactNode
  className?: string
}) {
  const {
    variant = 'primary',
    size = 'md',
    icon,
    loading,
    disabled,
    type = 'button',
    onClick,
    children,
    className,
  } = props
  const cls = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    icon ? 'btn-icon' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      className={cls}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="spin"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'violet' | 'neutral'
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Card({
  children,
  hover,
  className,
  style,
}: {
  children: ReactNode
  hover?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`card ${hover ? 'card-hover' : ''} ${className ?? ''}`}
      style={style}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="card-header">{children}</div>
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ height: 36, width: 36 }}
          >
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

/* Toast (lightweight global event-bus version) */
type Toast = {
  id: number
  tone: 'success' | 'error' | 'info'
  title: string
  body?: string
}
let toastCounter = 0
const toastListeners: ((t: Toast) => void)[] = []

export function toast(
  tone: Toast['tone'],
  title: string,
  body?: string,
): void {
  const t: Toast = { id: ++toastCounter, tone, title, body }
  toastListeners.forEach((l) => l(t))
}

import { useState } from 'react'

export function ToastRegion() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    const listener = (t: Toast) => {
      setItems((prev) => [...prev, t])
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id))
      }, 5000)
    }
    toastListeners.push(listener)
    return () => {
      const i = toastListeners.indexOf(listener)
      if (i >= 0) toastListeners.splice(i, 1)
    }
  }, [])

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <div className="stack" style={{ gap: 2 }}>
            <strong>{t.title}</strong>
            {t.body && <span className="muted small">{t.body}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
