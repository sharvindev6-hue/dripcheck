'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastState {
  id: number
  message: string
  type: ToastType
}

const ToastContext = createContext<{
  showToast: (message: string, type?: ToastType) => void
}>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const idRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++idRef.current
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ id, message, type })
    timerRef.current = setTimeout(() => setToast(null), 3400)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={toast ? 'toast on' : 'toast'}
        role="status"
        aria-live="polite"
        data-type={toast?.type}
      >
        {toast?.message}
      </div>
    </ToastContext.Provider>
  )
}
