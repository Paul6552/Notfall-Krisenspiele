import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { GameState, View } from '../game/types'
import { isLocalNet } from '../net/transport'

export interface ClientRecord {
  key: string
  code: string
  name: string
  token?: string
  teamId?: string
  lastView?: View
  updatedAt: number
}

interface Schema extends DBSchema {
  games: { key: string; value: GameState }
  clients: { key: string; value: ClientRecord }
}

let db: Promise<IDBPDatabase<Schema>> | undefined

const open = () =>
  (db ??= openDB<Schema>('krisenuebung', 1, {
    upgrade(d) {
      d.createObjectStore('games', { keyPath: 'code' })
      d.createObjectStore('clients', { keyPath: 'key' })
    },
  }))

/** Im Testbetrieb teilen sich alle Tabs die IndexedDB. Der Tab-Zusatz hält ihre Team-Daten getrennt. */
function tabSuffix() {
  if (!isLocalNet()) return ''
  let id = sessionStorage.getItem('bcm-tab')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('bcm-tab', id)
  }
  return `:${id}`
}

export const clientKey = (code: string) => `${code}${tabSuffix()}`

/**
 * Sichert, dass nur ein Tab dieses Browsers Spielleiter ist. Zwei Tabs würden sich gegenseitig überschreiben.
 * Mehrere Versuche, weil ein gerade geschlossener Tab seine Sperre kurz noch hält.
 */
export async function acquireHostLock(code: string): Promise<(() => void) | null> {
  if (!navigator.locks) return () => {}
  for (let attempt = 0; attempt < 5; attempt++) {
    const release = await new Promise<(() => void) | null>((resolve) => {
      void navigator.locks.request(`host-${code}`, { ifAvailable: true }, (lock) => {
        if (!lock) return resolve(null)
        return new Promise<void>((done) => resolve(done))
      })
    })
    if (release) return release
    await new Promise((r) => setTimeout(r, 300))
  }
  return null
}

export const saveGame = async (state: GameState) => void (await (await open()).put('games', state))
export const loadGame = async (code: string) => (await open()).get('games', code)
export const listGames = async () => (await open()).getAll('games')
export const deleteGame = async (code: string) => (await open()).delete('games', code)

export const saveClient = async (rec: ClientRecord) => void (await (await open()).put('clients', rec))
export const loadClient = async (code: string) => (await open()).get('clients', clientKey(code))
export const listClients = async () => {
  const suffix = tabSuffix()
  return (await (await open()).getAll('clients')).filter((c) => c.key === `${c.code}${suffix}`)
}
export const deleteClient = async (code: string) => (await open()).delete('clients', clientKey(code))
