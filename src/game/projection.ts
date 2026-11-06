import {
  DEVICES, E1_TARGETS, E3_MAP, E3_SENSORS, E5_GOALS, E7_FRAGMENTS, LANDING_CODE, planLines,
} from './content/flugZumMars'
import { shiftText } from './cipher'
import { SHIELD_TARGET } from './geometry'
import { rolesOf, totalKw } from './reducer'
import { ALL, GM, PHASES } from './types'
import type { Docs, GameState, RoleId, View } from './types'

/**
 * Baut die Sicht für ein Team oder die Spielleitung. Alles, was hier nicht
 * enthalten ist, wird gar nicht erst an den Browser dieses Teams gesendet.
 */
export function project(s: GameState, viewer: string): View {
  const gm = viewer === GM
  const roles = gm ? [] : rolesOf(s, viewer)
  const has = (r: RoleId) => gm || roles.includes(r)
  const at = (p: GameState['phase']) => s.phase === p
  const after = (p: GameState['phase']) => PHASES.indexOf(s.phase) > PHASES.indexOf(p)
  const docs: Docs = {}

  if (at('e1') && has('LS')) docs.e1Targets = E1_TARGETS

  if (at('e2')) {
    if (has('LS')) docs.e2CipherShift = s.e2.cipherShift
    if (has('LS')) docs.e2PlanText = planLines()
    if (has('S6') && s.e2.planSent) docs.e2Cipher = planLines().map((l) => shiftText(l, s.e2.cipherShift))
    if (has('LS') || (has('S1') && s.e2.planSent)) docs.e2Solution = SHIELD_TARGET
  }

  if (at('e3')) {
    if (has('LS')) docs.e3Map = E3_MAP.map((row) => (s.e3.stormKnown || gm ? row : row.replaceAll('~', '.')))
    if (has('S2')) docs.e3Sensors = E3_SENSORS
  }

  if (at('e5')) {
    const off = s.e5.off
    docs.e5Devices = DEVICES.filter((d) => has('LS') || roles.includes(d.owner)).map((d) => ({
      id: d.id,
      owner: d.owner,
      name: d.name,
      kw: d.kw,
      off: off.includes(d.id),
      info: gm || roles.includes(d.owner) ? d.info : undefined,
    }))
    docs.e5Goals = Object.fromEntries(Object.entries(E5_GOALS).filter(([r]) => gm || roles.includes(r as RoleId)))
  }

  if (at('e7')) {
    docs.e7Fragments = Object.fromEntries(Object.entries(E7_FRAGMENTS).filter(([r]) => gm || roles.includes(r as RoleId)))
    if (gm) docs.landingCode = LANDING_CODE
  }

  const decided = after('e5')
  const off = s.e5.off
  const { e1, e2, e5, teams, chat, e7, ...rest } = s
  const seesAllE1 = has('LS')
  return {
    ...rest,
    me: viewer,
    myRoles: roles,
    teams: teams.map(({ token: _token, ...t }) => t),
    chat: chat.filter((m) => gm || m.to === ALL || m.to === viewer || m.from === viewer),
    e1: {
      ...e1,
      answers: seesAllE1 ? e1.answers : Object.fromEntries(Object.entries(e1.answers).filter(([, a]) => a.by === viewer)),
      marks: seesAllE1 ? e1.marks : {},
    },
    e2: { planSent: e2.planSent, built: e2.built, placed: e2.placed, repaired: e2.repaired },
    e5: { confirmed: e5.confirmed, totalKw: has('LS') ? totalKw(off) : undefined },
    e7: { ...e7, sent: has('LS') ? e7.sent : Object.fromEntries(Object.entries(e7.sent).filter(([r]) => roles.includes(r as RoleId))) },
    flags: {
      blurS6: decided && off.includes('light'),
      oxygenRule: decided && off.includes('oxygen'),
      delayedS3: decided && off.includes('preheat'),
      injuredS1: decided && off.includes('damper'),
    },
    docs,
  }
}
