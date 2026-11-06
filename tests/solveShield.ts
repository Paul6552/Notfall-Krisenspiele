import { MODULES } from '../src/game/content/flugZumMars'
import { FRAME_H, FRAME_W, SHIELD_TARGET, piecePolygon } from '../src/game/geometry'
import type { Placement } from '../src/game/types'

const key = (pts: number[][]) => pts.map((p) => p.join()).sort().join('|')

/** Ordnet jedem Modul eine Platzierung zu, die genau das Zielbild ergibt. */
export function solveShield(): Record<string, Placement> | null {
  const free = [...SHIELD_TARGET]
  const result: Record<string, Placement> = {}
  for (const m of MODULES) {
    let found = false
    for (const flip of [false, true]) for (let rot = 0; rot < 4 && !found; rot++) for (let x = 0; x < FRAME_W && !found; x++) for (let y = 0; y < FRAME_H && !found; y++) {
      const p = { x, y, rot, flip }
      const idx = free.findIndex((t) => t.kind === m.kind && key(t.pts) === key(piecePolygon(m.kind, p)))
      if (idx >= 0) {
        free.splice(idx, 1)
        result[m.id] = p
        found = true
      }
    }
    if (!found) return null
  }
  return result
}
