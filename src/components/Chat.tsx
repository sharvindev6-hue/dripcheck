'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Mannequin from './Mannequin'
import { SendIcon } from './icons'
import { toDrawable } from '@/lib/garment'
import type { Item } from '@/types'

export interface ChatSeed {
  id: number
  text: string
}

interface ChatProps {
  open: boolean
  onClose: () => void
  items: Item[]
  itemIds: string[]
  temp: number | null
  condition: string
  lookName: string
  seed: ChatSeed | null
  onSeedConsumed: () => void
  onLookChange: (ids: string[], explanation: string, match: number, occasion?: string) => void
}

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
}

const PROMPTS = ['Warmer', 'Dressier', 'More casual', 'Swap shoes']

export default function Chat({
  open,
  onClose,
  items,
  itemIds,
  temp,
  condition,
  lookName,
  seed,
  onSeedConsumed,
  onLookChange,
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(0)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const byId = new Map(items.map(item => [item.id, item]))
  const current = itemIds.map(id => byId.get(id)).filter((item): item is Item => Boolean(item))
  const drawable = current.map(toDrawable)

  const push = useCallback((role: Message['role'], text: string) => {
    idRef.current += 1
    setMessages(prev => [...prev, { id: idRef.current, role, text }])
  }, [])

  useEffect(() => {
    if (!open) return
    if (messages.length === 0) {
      const weather = typeof temp === 'number' ? `It is ${temp}°` : 'Weather is offline'
      push(
        'assistant',
        `Morning. ${weather}${condition ? ` and ${condition}` : ''}. This is your ${lookName.toLowerCase()}. Ask for a change, or just chat about the look.`
      )
    }
    // Only seed the greeting once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => inputRef.current?.focus(), 350)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    const node = messagesRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, sending])

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim()
      if (!text || sending) return
      setInput('')
      setError(null)
      push('user', text)
      setSending(true)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            item_ids: itemIds,
            temp,
          }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || !data) {
          const message =
            response.status === 429
              ? 'Give me a minute — too many requests right now.'
              : 'I could not restyle that just now. Try again in a moment.'
          push('assistant', message)
          setError(message)
          return
        }

        if (Array.isArray(data.item_ids) && data.item_ids.length >= 3) {
          onLookChange(data.item_ids, data.explanation, data.match, data.occasion)
        }
        push('assistant', String(data.reply || 'Done.'))
      } catch {
        const message = 'I cannot reach Milli right now. Your current look is still here.'
        push('assistant', message)
        setError(message)
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
    },
    [itemIds, onLookChange, push, sending, temp]
  )

  useEffect(() => {
    if (!open || !seed) return
    void send(seed.text)
    onSeedConsumed()
    // The seed is consumed exactly once by id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed])

  return (
    <div className={open ? 'chat on' : 'chat'} role="dialog" aria-modal="true" aria-label="Milli">
      <div className="chh">
        <h2>Milli</h2>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </div>

      <div className="cur">
        <div className="fg">
          <Mannequin items={drawable} />
        </div>
        <div className="nw">
          <small>Now wearing</small>
          <b>{lookName}</b>
          <span>{current.map(item => item.name).join(', ') || 'Add pieces to build a look'}</span>
        </div>
      </div>

      <div className="msgs" ref={messagesRef} aria-live="polite">
        {messages.map(message => (
          <div key={message.id} className={`bub ${message.role === 'user' ? 'u' : 'a'}`}>
            {message.text}
          </div>
        ))}
        {sending ? (
          <div className="bub a ty" aria-label="Milli is thinking">
            <i />
            <i />
            <i />
          </div>
        ) : null}
      </div>

      <div className="cft">
        <div className="prm">
          {PROMPTS.map(prompt => (
            <button key={prompt} type="button" onClick={() => void send(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
        <form
          className="askf"
          onSubmit={event => {
            event.preventDefault()
            void send(input)
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="Ask anything, or name the occasion"
            autoComplete="off"
            enterKeyHint="send"
            aria-label="Message Milli"
          />
          <button className="snd" type="submit" aria-label="Send" disabled={sending || !input.trim()}>
            <SendIcon size={20} />
          </button>
        </form>
        {error ? <p className="chat-error">{error}</p> : null}
      </div>
    </div>
  )
}
