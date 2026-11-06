/** Texte und Abläufe der Filme zwischen den Ereignissen. Der Ausgang hängt vom Spielverlauf ab. */
import type { Cutscene, CutsceneScene, GameState, Phase } from '../types'

const SECONDS: Record<CutsceneScene, number> = {
  intro: 9, prep: 8, launch: 15, repair: 11, asteroids: 12, signal: 10, reactor: 11, restart: 11, landing: 14, failure: 9, credits: 18,
}

type Script = Pick<Cutscene, 'scene' | 'title' | 'subtitle' | 'tone' | 'kw'>

function script(from: Phase, s: GameState, kw: number): Script | null {
  if (s.failure && from !== 'lessons') return { scene: 'failure', title: 'Mission in Gefahr', subtitle: s.failure, tone: 'bad' }
  switch (from) {
    case 'lobby':
      return { scene: 'intro', title: 'Mission Red Planet', subtitle: 'Flug zum Mars', tone: 'good' }
    case 'checkin':
      return { scene: 'prep', title: 'Startvorbereitung läuft', subtitle: 'Die ARES 1 wird betankt. Alle Sektionen an ihre Plätze!', tone: 'good' }
    case 'e1':
      return s.e1.decision === 'go'
        ? { scene: 'launch', title: 'Erfolgreich gestartet', subtitle: 'Die ARES 1 ist auf dem Weg zum Mars.', tone: 'good' }
        : { scene: 'launch', title: 'Gestartet mit Verspätung', subtitle: 'Die ARES 1 ist unterwegs, aber das Startfenster war knapp.', tone: 'warn' }
    case 'e2':
      return s.e2.repaired
        ? { scene: 'repair', title: 'Hülle repariert', subtitle: 'Das Hitzeschild sitzt. Gute Teamarbeit!', tone: 'good' }
        : { scene: 'repair', title: 'Hülle notdürftig geflickt', subtitle: 'Das Hitzeschild hält vorerst, aber wir haben Sauerstoff verloren.', tone: 'warn' }
    case 'e3': {
      if (!s.e3.arrived) return { scene: 'asteroids', title: 'Durchgeschlagen', subtitle: 'Die ARES 1 hat schwere Treffer eingesteckt.', tone: 'warn' }
      const hits = s.e3.collisions
      return hits === 0
        ? { scene: 'asteroids', title: 'Asteroidenfeld durchquert', subtitle: 'Ohne einen einzigen Kratzer. Meisterhaft navigiert!', tone: 'good' }
        : { scene: 'asteroids', title: 'Asteroidenfeld durchquert', subtitle: `${hits} ${hits === 1 ? 'Kollision' : 'Kollisionen'}, aber wir sind durch.`, tone: 'good' }
    }
    case 'e4':
      return { scene: 'signal', title: 'Funkkontakt wiederhergestellt', subtitle: 'Der Notkanal steht. Die Crew spricht wieder miteinander.', tone: 'good' }
    case 'e5':
      return { scene: 'reactor', title: 'Reaktor stabilisiert', subtitle: `Dauerlast ${kw} kW. Die ARES 1 ist gerettet.`, tone: 'good', kw }
    case 'e6':
      return s.e6.done
        ? { scene: 'restart', title: 'Reaktor wieder online', subtitle: 'Der Mars kommt in Sicht!', tone: 'good' }
        : { scene: 'restart', title: 'Reaktor im Notbetrieb', subtitle: 'Es reicht gerade so. Der Mars kommt in Sicht.', tone: 'warn' }
    case 'e7':
      return { scene: 'landing', title: 'Touchdown!', subtitle: 'Die ARES 1 ist sicher auf dem Mars gelandet.', tone: 'good' }
    case 'lessons':
      return { scene: 'credits', title: 'Mission Red Planet', subtitle: 'Danke an alle Sektionen!', tone: 'good' }
    default:
      return null
  }
}

export function cutsceneFor(from: Phase, s: GameState, kw: number, at: number, id: number): Cutscene | null {
  const part = script(from, s, kw)
  return part && { ...part, id, at, seconds: SECONDS[part.scene], released: false }
}
