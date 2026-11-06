import { useSyncExternalStore } from 'react'

const subscribe = (fn: () => void) => {
  addEventListener('hashchange', fn)
  return () => removeEventListener('hashchange', fn)
}

export const useHashPath = () => useSyncExternalStore(subscribe, () => location.hash.replace(/^#/, '') || '/')

export const go = (path: string) => {
  location.hash = path
}

export const inviteLink = (code: string) => `${location.origin}${location.pathname}${location.search}#/play/${code}`
