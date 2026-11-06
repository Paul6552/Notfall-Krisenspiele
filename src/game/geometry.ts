import type { PieceKind, Placement } from './types'

/** Rastereinheit: 1 Einheit = 3 cm. Der Rahmen misst 24 x 12 cm = 8 x 4 Einheiten. */
export const FRAME_W = 8
export const FRAME_H = 4
export const CM_PER_UNIT = 3

type Pt = [number, number]

const BASE: Record<PieceKind, Pt[]> = {
  L: [[0, 0], [4, 0], [2, 2]],
  M: [[0, 0], [2, 0], [0, 2]],
  S: [[0, 0], [2, 0], [1, 1]],
  Q: [[1, 0], [2, 1], [1, 2], [0, 1]],
  P: [[0, 0], [2, 0], [3, 1], [1, 1]],
}

/** Liefert die Ecken eines Teils. x/y ist die linke obere Ecke seines Begrenzungsrahmens. */
export function piecePolygon(kind: PieceKind, p: Placement): Pt[] {
  let pts = BASE[kind].map(([x, y]): Pt => (p.flip ? [x, -y] : [x, y]))
  for (let i = 0; i < ((p.rot % 4) + 4) % 4; i++) pts = pts.map(([x, y]): Pt => [-y, x])
  const minX = Math.min(...pts.map((q) => q[0]))
  const minY = Math.min(...pts.map((q) => q[1]))
  return pts.map(([x, y]): Pt => [x - minX + p.x, y - minY + p.y])
}

export const polygonArea = (pts: Pt[]) =>
  Math.abs(pts.reduce((a, [x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length]
    return a + x * ny - nx * y
  }, 0)) / 2

function inside([px, py]: Pt, pts: Pt[]) {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/**
 * Prüft, ob die Teile den Rahmen genau einmal abdecken. Die Prüfpunkte liegen so,
 * dass sie nie auf einer Kante des Rasters oder einer 45-Grad-Diagonale liegen.
 */
export function shieldCoverage(polygons: Pt[][]) {
  let covered = 0
  let overlaps = 0
  let total = 0
  let outside = 0
  for (let x = -1 + 0.125; x < FRAME_W + 1; x += 0.25) {
    for (let y = -1 + 0.0625; y < FRAME_H + 1; y += 0.25) {
      const hits = polygons.filter((poly) => inside([x, y], poly)).length
      const inFrame = x > 0 && x < FRAME_W && y > 0 && y < FRAME_H
      if (inFrame) total++
      if (!inFrame && hits) outside++
      if (inFrame && hits === 1) covered++
      if (hits > 1) overlaps++
    }
  }
  return { complete: covered === total && overlaps === 0 && outside === 0, ratio: covered / total, overlaps, outside }
}

/** Zielbild: zwei Tangrams nebeneinander. Die Brücke sendet es an Außeneinsatz. */
const TANGRAM: { kind: PieceKind; pts: Pt[] }[] = [
  { kind: 'L', pts: [[0, 0], [4, 0], [2, 2]] },
  { kind: 'L', pts: [[0, 0], [2, 2], [0, 4]] },
  { kind: 'M', pts: [[4, 2], [4, 4], [2, 4]] },
  { kind: 'S', pts: [[4, 0], [4, 2], [3, 1]] },
  { kind: 'S', pts: [[2, 2], [3, 3], [1, 3]] },
  { kind: 'Q', pts: [[2, 2], [3, 1], [4, 2], [3, 3]] },
  { kind: 'P', pts: [[0, 4], [1, 3], [3, 3], [2, 4]] },
]
export const SHIELD_TARGET: { kind: PieceKind; pts: Pt[] }[] = [
  ...TANGRAM,
  ...TANGRAM.map((t) => ({ kind: t.kind, pts: t.pts.map(([x, y]): Pt => [x + 4, y]) })),
]
