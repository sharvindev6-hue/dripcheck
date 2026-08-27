'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

const ToastContext = createContext<{
  showToast: (message: string, type?: Toast['type']) => void
}>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Slide-down toast stack — non-blocking notifications. */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`toast-enter border-[3px] border-ink px-4 py-3 text-sm font-mono font-extrabold uppercase tracking-wider shadow-chunk ${
              toast.type === 'error'
                ? 'bg-pink text-ink'
                : toast.type === 'success'
                  ? 'bg-lime text-ink'
                  : 'bg-cyan text-ink'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
