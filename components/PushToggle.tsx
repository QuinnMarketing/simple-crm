'use client'
import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const output = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return buffer
}

type State = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export default function PushToggle() {
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? 'subscribed' : 'unsubscribed')
    }).catch(() => setState('unsupported'))
  }, [])

  async function subscribe() {
    try {
      const res = await fetch('/api/push/subscribe')
      const { publicKey } = await res.json()

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setState('subscribed')
    } catch {
      setState('unsubscribed')
    }
  }

  async function unsubscribe() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
      await sub.unsubscribe()
    }
    setState('unsubscribed')
  }

  if (state === 'unsupported' || state === 'loading') return null
  if (state === 'denied') return null

  return (
    <button
      onClick={state === 'subscribed' ? unsubscribe : subscribe}
      title={state === 'subscribed' ? 'Disable lead notifications' : 'Enable lead notifications'}
      className={`p-1.5 rounded-lg transition-colors ${
        state === 'subscribed'
          ? 'text-indigo-400 hover:text-indigo-300 hover:bg-slate-700'
          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
      }`}
    >
      {state === 'subscribed' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
    </button>
  )
}
