self.addEventListener('push', (event) => {
  if (!event.data) return
  let data
  try { data = event.data.json() } catch { return }

  const options = {
    body: data.body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url ?? '/' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(data.title ?? 'New Lead', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const match = wins.find((w) => w.url.includes(url) && 'focus' in w)
      if (match) return match.focus()
      return clients.openWindow(url)
    })
  )
})
