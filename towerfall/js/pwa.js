// PWA: Service Worker registrieren, Installationsangebot und Offline-Status.
export function setupPwa({ onStatus, onInstallable, onUpdate }) {
  let deferredPrompt = null
  const status = { sw: 'nicht unterstützt', online: navigator.onLine, installed: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true }
  const report = () => onStatus?.({ ...status })

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    status.sw = 'wird eingerichtet'
    // Gab es beim Laden schon einen Service Worker, ist ein neu aktivierter ein Update
    const hadController = !!navigator.serviceWorker.controller
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      if (reg.active) status.sw = 'bereit'
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'activated') {
            if (hadController) onUpdate?.()
            status.sw = 'bereit'
            report()
          }
        })
      })
      report()
      return navigator.serviceWorker.ready
    }).then(() => { status.sw = 'bereit'; report() }).catch((err) => {
      console.warn('Service Worker konnte nicht registriert werden:', err)
      status.sw = 'fehlgeschlagen'
      report()
    })
  } else if ('serviceWorker' in navigator) {
    status.sw = 'nur über https oder localhost'
  }

  addEventListener('online', () => { status.online = true; report() })
  addEventListener('offline', () => { status.online = false; report() })
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    onInstallable?.(true)
  })
  addEventListener('appinstalled', () => {
    deferredPrompt = null
    status.installed = true
    onInstallable?.(false)
    report()
  })
  report()

  return {
    canPrompt: () => !!deferredPrompt,
    async install() {
      if (!deferredPrompt) return false
      deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      deferredPrompt = null
      onInstallable?.(false)
      return choice.outcome === 'accepted'
    },
  }
}
