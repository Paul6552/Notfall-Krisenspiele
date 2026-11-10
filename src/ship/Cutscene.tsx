import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { E5_LIMIT_KW, E5_START_KW, ROLES } from '../game/content/flugZumMars'
import { SHIELD_TARGET } from '../game/geometry'
import { ROLE_IDS } from '../game/types'
import type { Cutscene, CutsceneScene, RoleId } from '../game/types'
import { COUNTDOWN, COUNTDOWN_STEP, DISH_HIT, IMPACT_HITS, STORM_INSIDE, STORM_SURGE, STORM_ZOOM, TOUCHDOWN, countdownAt, isMuted, playAmbient, playFilm, setMuted, subscribeSound } from './filmSound'
import './cutscene.css'

/** `float` lässt das Schiff im All sanft treiben, auch im Wartebild. */
function Rocket({ flame = false, float = false }: { flame?: boolean; float?: boolean }) {
  return (
    <div className={float ? 'c-float c-amb' : 'c-float'}>
      <svg className="c-rocket" viewBox="0 0 80 240" aria-hidden>
        <defs>
          <linearGradient id="c-hull" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#f4f8fb" /><stop offset=".55" stopColor="#dfe6ec" /><stop offset="1" stopColor="#9aa8b5" />
          </linearGradient>
          <linearGradient id="c-nose" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#c3ced8" /><stop offset="1" stopColor="#74828f" />
          </linearGradient>
        </defs>
        {flame && (
          <g className="c-flame c-amb">
            <path d="M26 196 Q40 300 54 196Z" fill="#ff8a2b" />
            <path d="M32 196 Q40 262 48 196Z" fill="#ffe08a" />
          </g>
        )}
        <path d="M8 196 L22 150 V196Z M72 196 L58 150 V196Z" fill="#7d8c9a" />
        <path d="M40 2 C58 26 62 56 62 84 V192 H18 V84 C18 56 22 26 40 2Z" fill="url(#c-hull)" />
        <path d="M40 2 C50 15 56 30 59 46 H21 C24 30 30 15 40 2Z" fill="url(#c-nose)" />
        <rect x="18" y="176" width="44" height="16" fill="url(#c-nose)" />
        <rect x="26" y="192" width="28" height="8" fill="#3a4753" />
        <circle cx="40" cy="74" r="9" fill="#0e2233" stroke="#f2b544" strokeWidth="3" />
        <path d="M34 70 A8 8 0 0 1 42 66" fill="none" stroke="#7fb6e0" strokeWidth="2" strokeLinecap="round" />
        <text x="40" y="120" textAnchor="middle" fontSize="9" fontWeight="800" fill="#33424f" letterSpacing="1">ARES 1</text>
      </svg>
    </div>
  )
}

const Pad = () => (
  <div className="c-ground">
    <div className="c-tower" />
    <div className="c-pad" />
  </div>
)

const Stars = () => <><div className="c-nebula" /><div className="c-stars far c-amb" /><div className="c-stars c-amb" /></>

const RISE_FROM_KW = 120

// Meteoritenfeld in der Ferne: Lage in Prozent, Größe in Pixeln
const FAR_ROCKS = [[8, 18, 16], [32, 6, 10], [58, 22, 20], [84, 10, 12], [18, 44, 12], [46, 40, 24], [74, 48, 14], [6, 70, 20], [36, 66, 12], [62, 74, 18], [88, 66, 22], [24, 90, 14], [52, 94, 10], [78, 90, 16]]

const ASTEROIDS = [
  [12, 0, 9, 70], [32, 2.2, 7, 110], [58, 1, 8, 54], [76, 3.1, 6.5, 90], [22, 4.4, 7.5, 60], [66, 5, 8.5, 80], [46, 6, 6, 120], [86, 0.6, 9, 50],
]

// Oben und unten am Schiff vorbei: Oberkante, Start, Dauer, Dicke
const METEORS = Array.from({ length: 28 }, (_, i) => [
  i % 2 ? 68 + ((i * 7) % 22) : 10 + ((i * 11) % 24),
  8.2 + i * 0.2,
  1 + (i % 4) * 0.18,
  20 + ((i * 17) % 34),
])
const HITS = IMPACT_HITS

/** Kreissegment für das Strahlenzeichen. */
function sector(cx: number, cy: number, inner: number, outer: number, from: number, to: number) {
  const at = (r: number, deg: number) => `${(cx + r * Math.cos((deg * Math.PI) / 180)).toFixed(2)} ${(cy + r * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`
  return `M${at(inner, from)} L${at(outer, from)} A${outer} ${outer} 0 0 1 ${at(outer, to)} L${at(inner, to)} A${inner} ${inner} 0 0 0 ${at(inner, from)}Z`
}

/** Last steigt im Film von 5 bis 13,5 Sekunden, passend zum Balken. */
function RisingKw({ held }: { held: boolean }) {
  const [value, setValue] = useState(RISE_FROM_KW)
  useEffect(() => {
    const start = performance.now() + 5000
    let frame = 0
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / 8500))
      setValue(Math.round(RISE_FROM_KW + (E5_START_KW - RISE_FROM_KW) * p ** 1.6))
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [])
  return <div className="c-kwrise">{held ? E5_START_KW : value} kW</div>
}

/** Crewmitglied von hinten, mit Blick zum Fenster. */
/** `arms`: Hände am Kopf vor Schreck. `cheer`: Arme zum Jubel hochgerissen. */
function CrewMember({ x, shirt, className, arms = false, cheer = false, headset = false }: { x: number; shirt: string; className: string; arms?: boolean; cheer?: boolean; headset?: boolean }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <g className={`${className} c-amb`}>
        <path d="M-34 360 V286 Q-34 256 0 256 Q34 256 34 286 V360 Z" fill={shirt} />
        {cheer
          ? <path d="M-30 276 L-50 224 L-60 178 M30 276 L50 224 L60 178" fill="none" stroke={shirt} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          : arms
          ? <path className="c-arms" d="M-30 276 L-44 228 L-20 212 M30 276 L44 228 L20 212" fill="none" stroke={shirt} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M-30 276 L-40 330 M30 276 L40 330" fill="none" stroke={shirt} strokeWidth="13" strokeLinecap="round" />}
        <g className="c-head">
          <circle cy="230" r="24" fill="#e0b08c" />
          <path d="M-24 228 A24 24 0 0 1 24 228 Q0 216 -24 228Z" fill="#3a2a22" />
          {headset && <path d="M-25 232 A25 25 0 0 1 25 232 M-25 226 V240 M25 226 V240" fill="none" stroke="#141a20" strokeWidth="4" />}
        </g>
      </g>
    </g>
  )
}

function ReactorCounter({ kw, held }: { kw: number; held: boolean }) {
  const [value, setValue] = useState(E5_START_KW)
  useEffect(() => {
    const start = performance.now() + 1500
    let frame = 0
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / 4000))
      setValue(Math.round(E5_START_KW + (kw - E5_START_KW) * (1 - (1 - p) ** 3)))
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [kw])
  return <div className="c-kw">{held ? kw : value} kW</div>
}

/** Erst rückt die ARES zur Seite, dann rollt der Abspann. */
const CREDITS_START = 2.2

function Credits({ teams, roleOwner, title, subtitle, seconds }: Props & { title: string; subtitle: string; seconds: number }) {
  return (
    <div className="c-credits" style={{ animationDuration: `${seconds - CREDITS_START}s`, animationDelay: `${CREDITS_START}s` }}>
      <h2>{title}</h2>
      <p>Die Crew der ARES 1</p>
      {teams.map((t) => (
        <div key={t.id} className="c-credit">
          <strong>{t.name}</strong>
          <span>{ROLE_IDS.filter((r) => roleOwner[r] === t.id).map((r) => ROLES[r].section).join(' · ')}</span>
        </div>
      ))}
      <h2>{subtitle}</h2>
      <div className="c-credit">
        <span>Entwickler</span>
        <strong>Christoph Paul Pedretscher</strong>
      </div>
    </div>
  )
}

function Stage({ c, teams, roleOwner, held, jump }: { c: Cutscene; held: boolean; jump: boolean } & Props) {
  /** Verzögerung für Dauerläufer: Wer den Film überspringt oder später kommt, sieht sie sofort. */
  const d = (start: number, stagger = 0) => `${jump ? stagger : start + stagger}s`
  const scenes: Record<CutsceneScene, React.ReactNode> = {
    intro: <><Pad /><div className="c-ship c-on-pad"><Rocket /></div></>,
    prep: (
      <>
        <Pad />
        <i className="c-beam left c-amb" /><i className="c-beam right c-amb" />
        <div className="c-ship c-on-pad"><Rocket /><i className="c-vapor c-amb" /></div>
        <div className="c-clock">T − 30:00</div>
      </>
    ),
    control: (
      <div className="c-deck">
        <div className="c-bubble left"><span aria-hidden>📡</span> Flugkontrolle an ARES 1: Die letzte Überprüfung vor dem Start muss durchgeführt werden.</div>
        <div className="c-bubble right"><span aria-hidden>📡</span> Leiter der Brücke, meldet uns das Ergebnis. Wir brauchen ein GO oder NO-GO.</div>
        <svg viewBox="0 0 640 360" aria-hidden>
          <rect x="110" y="10" width="420" height="160" rx="6" fill="#071a1f" stroke="#6d7b89" strokeWidth="6" />
          <path d="M130 150 H510 M130 110 H510 M130 70 H510 M210 30 V150 M320 30 V150 M430 30 V150" stroke="#14463f" strokeWidth="1.5" />
          <path d="M214 148 V82 Q214 64 222 54 Q230 64 230 82 V148 Z" fill="#dfe6ec" />
          <rect x="240" y="60" width="6" height="88" fill="#6d7b89" />
          <text x="400" y="62" textAnchor="middle" fontSize="20" fontWeight="800" fill="#5be08a">ARES 1</text>
          <text x="400" y="92" textAnchor="middle" fontSize="18" fontWeight="800" fill="#ffd36b" fontFamily="ui-monospace, monospace">T − 30:00</text>
          <text x="400" y="122" textAnchor="middle" fontSize="13" fontWeight="800" fill="#ff8a6b" className="c-deckalert c-amb">LETZTE ÜBERPRÜFUNG</text>
          <path d="M-500 214 H1140 V900 H-500 Z" fill="#2c3844" />
          <path d="M-500 214 H1140 V232 H-500 Z" fill="#46545f" />
          {[[52, 'TREIBSTOFF'], [255, 'WETTER'], [458, 'BRÜCKE']].map(([x, label]) => (
            <g key={x as number}>
              <rect x={x as number} y="176" width="130" height="50" rx="5" fill="#0b1622" stroke="#6d7b89" strokeWidth="3" />
              <text x={(x as number) + 65} y="195" textAnchor="middle" fontSize="11" fontWeight="700" fill="#cfd8e2">{label}</text>
              <text x={(x as number) + 65} y="215" textAnchor="middle" fontSize="13" fontWeight="800" fill="#ffd36b">WARTET</text>
            </g>
          ))}
          <CrewMember x={44} shirt="#4a5a78" className="c-look" headset />
          <CrewMember x={218} shirt="#3f6fb5" className="c-talk" headset />
          <CrewMember x={422} shirt="#3f8f6a" className="c-look" headset />
        </svg>
      </div>
    ),
    launch: (
      <>
        <Stars />
        <div className="c-day" />
        <div className="c-limb" />
        <Pad />
        {COUNTDOWN.map((n, i) => <div key={n} className="c-count" style={{ animationDelay: `${countdownAt(i)}s`, animationDuration: `${COUNTDOWN_STEP}s` }}>{n}</div>)}
        <div className="c-ship c-launching"><Rocket flame /></div>
        {[-15, -5, 5, 15].map((x) => <i key={x} className="c-smoke" style={{ left: `calc(50% + ${x}vh)`, animationDelay: `${11.7 + Math.abs(x) / 50}s` }} />)}
      </>
    ),
    impact: (
      <>
        <div className="c-shakebox">
          <Stars />
          {METEORS.map(([top, delay, dur, size], i) => <i key={i} className="c-meteor" style={{ top: `${top}%`, width: size * 3.4, height: size, animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />)}
          {HITS.map((t, i) => <i key={i} className="c-micro" style={{ top: `${49 + (i % 3) * 2}%`, animationDelay: `${t - 0.4}s` }} />)}
          <div className="c-ship c-hitship">
            <Rocket flame float />
            {HITS.map((t, i) => <i key={i} className="c-hit" style={{ top: `${22 + i * 13}%`, left: `${i % 2 ? 66 : 34}%`, animationDelay: `${t}s` }} />)}
            {[0, 1, 2].map((i) => <i key={i} className="c-leak c-amb" style={{ animationDelay: d(15.2, i * 0.7) }} />)}
          </div>
        </div>
        <div className="c-reds">
          <i className="c-redglow c-amb" />
          {['tl', 'tr', 'bl', 'br'].map((p) => <i key={p} className={`c-beacon c-amb ${p}`} />)}
        </div>
        <div className="c-msg c-alarmword">ALARM</div>
        <div className="c-msg c-ahead">METEORITEN VORAUS</div>
        <div className="c-msg c-hold"><strong>Ausweichen unmöglich.</strong><span>Wir können nichts tun. DURCHHALTEN!</span></div>
      </>
    ),
    repair: (
      <>
        <Stars />
        <div className="c-sun" />
        <svg className="c-shield" viewBox="-0.2 -0.2 8.4 4.4" aria-hidden>
          <rect x="0" y="0" width="8" height="4" fill="#14222f" stroke="#f2b544" strokeWidth="0.05" />
          {SHIELD_TARGET.map((p, i) => (
            <polygon key={i} points={p.pts.map((q) => q.join(',')).join(' ')} className="c-piece" style={{ animationDelay: `${0.5 + i * 0.32}s`, '--dx': `${(i % 2 ? 1 : -1) * (3 + (i % 3))}px`, '--dy': `${(i % 3) * 2 - 2}px` } as CSSProperties} />
          ))}
        </svg>
        <i className="c-spark" />
      </>
    ),
    storm: (
      <>
        {/* Von außen: Der Sturm trifft die ARES 1, dann zoomt das Bild auf das Schiff. */}
        <div className="c-stormout" style={{ animationDelay: `${STORM_ZOOM}s` }}>
        <Stars />
        <div className="c-stormsun" />
        {[3, 3.7, 4.4, 5.1, 5.8, 6.5, 7.2].map((t) => <i key={t} className="c-wave" style={{ animationDelay: `${t}s` }} />)}
        {Array.from({ length: 26 }, (_, i) => <i key={i} className="c-ion" style={{ top: `${12 + ((i * 29) % 76)}%`, animationDelay: `${3.2 + i * 0.24}s` }} />)}
        <div className="c-field">
          {FAR_ROCKS.map(([x, y, size], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }} />)}
        </div>
        <div className="c-ship c-stormship">
          <Rocket flame float />
          <svg className="c-arcs" viewBox="0 0 80 240" aria-hidden>
            <polyline points="22,50 34,70 18,92 36,118 20,140" />
            <polyline points="60,70 46,92 62,120 44,146 60,170" />
          </svg>
        </div>
        <i className="c-shipring" style={{ animationDelay: `${STORM_ZOOM}s` }} />
        </div>
        <div className="c-shiplabel" style={{ animationDelay: `${STORM_ZOOM + 0.2}s` }}>
          <strong>ARES 1</strong>
          <span>An Bord: Kommunikationsserver</span>
        </div>
        <i className="c-stormflash" />
        {/* Schnitt ins Schiff: Der Sturm legt die Kommunikationsserver lahm. */}
        <div className="c-deck c-serverroom" style={{ animationDelay: `${STORM_INSIDE}s` }}>
          <p className="c-roomsign">ARES 1 · Serverraum Kommunikation</p>
          <svg viewBox="0 0 640 360" aria-hidden>
            <path d="M-500 340 H1140 V900 H-500 Z" fill="#141a20" />
            {[30, 150, 270, 390, 510].map((x, rack) => (
              <g key={x}>
                <rect x={x} y="20" width="100" height="320" rx="4" fill="#232d36" stroke="#46545f" strokeWidth="3" />
                {Array.from({ length: 8 }, (_, row) => (
                  <g key={row}>
                    <rect x={x + 10} y={32 + row * 37} width="80" height="28" rx="2" fill="#10161c" />
                    {[0, 1, 2].map((led) => <circle key={led} cx={x + 22 + led * 12} cy={46 + row * 37} r="3.4" className="c-led" style={{ animationDelay: `${STORM_SURGE + 0.3 + rack * 0.45 + row * 0.05}s` }} />)}
                    {(rack * 3 + row) % 5 === 0 && <circle cx={x + 22} cy={46 + row * 37} r="3.4" className="c-ledflicker c-amb" style={{ animationDelay: d(STORM_SURGE + 3, row * 0.13) }} />}
                    <rect x={x + 62} y={42 + row * 37} width="20" height="8" fill="#2c3844" />
                  </g>
                ))}
              </g>
            ))}
            <g className="c-serversparks" style={{ animationDelay: `${STORM_SURGE}s` }}>{[[176, 110], [320, 210], [438, 70], [556, 250]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="6" className="c-dishspark c-amb" style={{ animationDelay: d(STORM_SURGE) }} />)}</g>
            {[[176, 110], [438, 70]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="14" className="c-serversmoke c-amb" style={{ animationDelay: d(STORM_SURGE + 0.8) }} />)}
          </svg>
          <i className="c-stormflash" style={{ animationDelay: `${STORM_SURGE - 0.2}s` }} />
          <div className="c-reds" style={{ animationDelay: `${STORM_SURGE}s` }}><i className="c-redglow c-amb" /></div>
        </div>
      </>
    ),
    asteroids: (
      <>
        <Stars />
        {ASTEROIDS.map(([top, delay, dur, size], i) => <i key={i} className="c-rock c-amb" style={{ top: `${top}%`, width: size, height: size, animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />)}
        <div className="c-ship c-weaving"><Rocket flame float /></div>
        <div className="c-glitch" />
      </>
    ),
    dish: (
      <>
        <div className="c-dishshake">
          <Stars />
          <div className="c-ship c-dishfly"><Rocket flame /></div>
          <div className="c-closeup">
            <svg viewBox="0 0 400 300" aria-hidden>
              <path d="M-900 330 Q200 170 1300 330 V1400 H-900 Z" fill="#aab6c2" />
              <path d="M-900 345 Q200 185 1300 345" fill="none" stroke="#7d8c9a" strokeWidth="3" />
              {[-160, -40, 80, 320, 440, 560].map((x) => <line key={x} x1={x} y1="225" x2={x} y2="300" stroke="#8b99a7" strokeWidth="2" />)}
              <rect x="176" y="238" width="48" height="14" rx="3" fill="#5a6876" />
              <g className="c-dishwhole">
                <rect x="193" y="130" width="14" height="112" fill="#6d7b89" />
                <g transform="rotate(25 200 120)">
                  <path d="M136 84 Q200 196 264 84 Z" fill="#dfe6ec" stroke="#8a98a6" strokeWidth="3" />
                  <line x1="200" y1="138" x2="200" y2="66" stroke="#6d7b89" strokeWidth="4" />
                  <circle cx="200" cy="62" r="7" fill="#f2b544" />
                </g>
              </g>
              <g className="c-dishwhole">{[0, 1, 2].map((i) => <circle key={i} cx="232" cy="66" r="24" className="c-dishwave" style={{ animationDelay: `${4.3 + i * 0.45}s` }} />)}</g>
              <g className="c-dishbroken">
                <path d="M193 242 V186 L199 176 L203 188 L207 180 V242 Z" fill="#6d7b89" />
                <path d="M186 186 Q176 214 214 214 L206 190 Z" fill="#c3ccd5" stroke="#8a98a6" strokeWidth="3" />
                <circle cx="201" cy="180" r="5" className="c-dishspark c-amb" style={{ animationDelay: d(DISH_HIT + 0.2) }} />
              </g>
              {[[-90, -80], [80, -110], [130, 20], [-120, 30], [20, -140]].map(([dx, dy], i) => (
                <polygon key={i} points="192,112 214,106 208,132" className="c-dishfrag" style={{ '--dx': `${dx}px`, '--dy': `${dy}px` } as CSSProperties} />
              ))}
              <g className="c-dishrock">
                <path d="M200 120 L262 88 L250 124 Z" fill="#ff8a3d" opacity=".7" />
                <circle cx="200" cy="120" r="14" fill="#7a6a5c" />
              </g>
              <circle cx="200" cy="120" r="30" className="c-dishflash" />
            </svg>
          </div>
        </div>
        <div className="c-reds" style={{ animationDelay: `${DISH_HIT + 0.3}s` }}><i className="c-redglow c-amb" /></div>
      </>
    ),
    signal: (
      <>
        <Stars />
        <div className="c-ship c-cruise"><Rocket flame float /></div>
        {[0, 1, 2].map((i) => <i key={i} className="c-ring c-amb" style={{ animationDelay: `${i * 0.9}s` }} />)}
        <div className="c-bars">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ height: `${20 + i * 18}%`, animationDelay: `${1.2 + i * 0.8}s` }} />)}</div>
      </>
    ),
    overload: (
      <>
        <Stars />
        <div className="c-ship c-rearfly"><Rocket flame /></div>
        <div className="c-engine">
          <div className="c-load">
            <span>Reaktorlast</span>
            <div className="c-loadbar"><i /><b style={{ left: `${(E5_LIMIT_KW / E5_START_KW) * 100}%` }}>Grenzwert {E5_LIMIT_KW} kW</b></div>
          </div>
          <div className="c-reactorroom">
            <svg viewBox="0 0 400 240" aria-hidden>
              <path d="M-900 60 H60 M340 60 H1300 M-900 190 H60 M340 190 H1300" stroke="#3a4753" strokeWidth="14" />
              <rect x="60" y="14" width="280" height="212" rx="46" fill="#39454f" stroke="#6d7b89" strokeWidth="6" />
              <rect x="96" y="50" width="208" height="142" rx="24" fill="#0b1622" />
              <g className="c-heatpulse"><circle cx="200" cy="121" r="56" className="c-heat" /></g>
              {[122, 158, 232, 268].map((x) => <rect key={x} x={x} y="50" width="10" height="86" fill="#6d7b89" />)}
              <circle cx="200" cy="32" r="14" fill="#f2b544" />
              {[-90, 30, 150].map((a) => <path key={a} d={sector(200, 32, 3.5, 12.5, a - 30, a + 30)} fill="#141a20" />)}
              <text x="200" y="214" textAnchor="middle" fontSize="15" fontWeight="800" letterSpacing="3" fill="#dfe6ec">ATOMREAKTOR</text>
            </svg>
            <RisingKw held={held} />
          </div>
        </div>
        <div className="c-reds" style={{ animationDelay: '13.5s' }}>
          <i className="c-redglow c-amb" />
          {['tl', 'tr', 'bl', 'br'].map((p) => <i key={p} className={`c-beacon c-amb ${p}`} />)}
        </div>
        <div className="c-msg c-alarmword c-alarmstay">ALARM</div>
      </>
    ),
    reactor: <><div className="c-corepulse"><div className="c-core" /></div><ReactorCounter kw={c.kw ?? 150} held={held} /></>,
    restart: (
      <>
        <Stars />
        <div className="c-mars" />
        <div className="c-ship c-approach"><Rocket flame float /></div>
      </>
    ),
    bridge: (
      <>
        <Stars />
        <div className="c-ship c-portfly"><Rocket flame /></div>
        <div className="c-deck">
          <div className="c-bubble left">Wo bleibt der Algorithmus?</div>
          <div className="c-bubble right">Der Mars kommt immer näher!</div>
          <svg viewBox="0 0 640 360" aria-hidden>
            <defs>
              <clipPath id="c-deckwindow"><path d="M120 16 H520 L566 176 H74 Z" /></clipPath>
              <radialGradient id="c-deckmars" cx=".35" cy=".3"><stop offset="0" stopColor="#f0a06c" /><stop offset=".55" stopColor="#b4532f" /><stop offset="1" stopColor="#4a1d13" /></radialGradient>
            </defs>
            <path d="M120 16 H520 L566 176 H74 Z" fill="#050811" stroke="#6d7b89" strokeWidth="7" />
            <g clipPath="url(#c-deckwindow)">
              {[[170, 50], [250, 90], [300, 36], [420, 60], [480, 120], [150, 130], [360, 28]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.6" fill="#fff" />)}
              <circle cx="320" cy="170" r="52" fill="url(#c-deckmars)" className="c-deckplanet" />
            </g>
            <path d="M-500 214 H1140 V900 H-500 Z" fill="#2c3844" />
            <path d="M-500 214 H1140 V232 H-500 Z" fill="#46545f" />
            {[[52, 'LANDECODE', '– – – – – –'], [255, 'ALGORITHMUS', 'FEHLT'], [458, 'MARS', 'KOLLISIONSKURS']].map(([x, top, text]) => (
              <g key={x as number}>
                <rect x={x as number} y="176" width="130" height="50" rx="5" fill="#0b1622" stroke="#6d7b89" strokeWidth="3" />
                <text x={(x as number) + 65} y="195" textAnchor="middle" fontSize="11" fontWeight="700" fill="#cfd8e2">{top}</text>
                <text x={(x as number) + 65} y="215" textAnchor="middle" fontSize="13" fontWeight="800" fill="#ff5a4d" className="c-deckalert c-amb">{text}</text>
              </g>
            ))}
            <CrewMember x={218} shirt="#3f6fb5" className="c-look" />
            <CrewMember x={422} shirt="#b5563f" className="c-panic" arms />
            <CrewMember x={624} shirt="#3f8f6a" className="c-pace" />
          </svg>
        </div>
        <div className="c-reds" style={{ animationDelay: '12s' }}><i className="c-redglow c-amb" /></div>
      </>
    ),
    landing: (
      <>
        <Stars />
        <div className="c-mars-sky" />
        {[[18, 22, '#ffd36b', 0], [78, 18, '#5be08a', 0.7], [36, 12, '#8fa8e8', 1.3], [64, 30, '#ff8a6b', 1.9], [88, 40, '#ffd36b', 2.4], [8, 42, '#5be08a', 2.9]].map(([x, y, color, delay]) => (
          <i key={x} className="c-firework c-amb" style={{ left: `${x}%`, top: `${y}%`, color: color as string, animationDelay: d(TOUCHDOWN + 2.4, delay as number) }} />
        ))}
        <div className="c-mars-ground" />
        <div className="c-ship c-descent"><Rocket flame /></div>
        <svg className="c-flag" viewBox="0 0 40 80" aria-hidden>
          <rect x="4" y="0" width="3" height="80" fill="#dfe6ec" />
          <path className="c-flagcloth c-amb" d="M7 3 H36 L30 13 L36 23 H7 Z" fill="#f2b544" />
        </svg>
        {[-18, -8, 8, 18].map((x) => <i key={x} className="c-dust" style={{ left: `calc(50% + ${x}vh)`, animationDelay: `${TOUCHDOWN - 0.2 + Math.abs(x) / 60}s` }} />)}
        {Array.from({ length: 36 }, (_, i) => <i key={i} className="c-confetti c-amb" style={{ left: `${(i * 37) % 100}%`, animationDelay: d(TOUCHDOWN + 1, (i % 9) * 0.45), animationDuration: `${3.4 + (i % 4) * 0.5}s`, background: ['#f2b544', '#5be08a', '#8fa8e8', '#ff8a6b'][i % 4] }} />)}
        <div className="c-crowd" style={{ animationDelay: `${TOUCHDOWN + 2.6}s` }}>
          <div className="c-bubble left" style={{ animationDelay: `${TOUCHDOWN + 3.6}s` }}>Geschafft!</div>
          <div className="c-bubble right" style={{ animationDelay: `${TOUCHDOWN + 5.6}s` }}>Wir sind auf dem Mars!</div>
          <svg viewBox="0 160 640 200" preserveAspectRatio="xMidYMax meet" aria-hidden>
            {[[70, '#4a5a78'], [195, '#3f6fb5'], [320, '#b5563f'], [445, '#3f8f6a'], [570, '#8a5fb5']].map(([x, shirt], i) => (
              <g key={x} className="c-cheer c-amb" style={{ animationDelay: `${i * 0.11}s` }}>
                <CrewMember x={x as number} shirt={shirt as string} className="c-still" cheer />
              </g>
            ))}
          </svg>
        </div>
      </>
    ),
    failure: <><Stars /><div className="c-alarm c-amb" /><div className="c-ship c-drift"><Rocket float /></div></>,
    credits: (
      <>
        <Stars />
        <div className="c-mars-sky" />
        <div className="c-mars-ground still" />
        <svg className="c-flag still" viewBox="0 0 40 80" aria-hidden>
          <rect x="4" y="0" width="3" height="80" fill="#dfe6ec" />
          <path className="c-flagcloth c-amb" d="M7 3 H36 L30 13 L36 23 H7 Z" fill="#f2b544" />
        </svg>
        <div className="c-ship c-landed"><Rocket /></div>
        <Credits teams={teams} roleOwner={roleOwner} title={c.title} subtitle={c.subtitle} seconds={c.seconds} />
      </>
    ),
  }
  return <>{scenes[c.scene]}</>
}

const CAPTION_AT: Record<CutsceneScene, number> = {
  intro: 2.5, prep: 3, control: 11, launch: 19.1, impact: 16, repair: 6, storm: 21, asteroids: 7.5, dish: 10, signal: 5.5, overload: 17.4, reactor: 6, restart: 6, bridge: 12.5, landing: 9.5, failure: 2.5, credits: 0,
}

interface Props {
  teams: { id: string; name: string }[]
  roleOwner: Record<RoleId, string | null>
}

interface OverlayProps extends Props {
  cutscene: Cutscene | null
  offset?: number
  /** Nur die Spielleitung bekommt den Knopf zur Freigabe. */
  onRelease?: () => void
  nextTitle?: string
  hostLost?: boolean
}

/**
 * Zeigt den Film bei allen gleichzeitig. Danach läuft das Schlussbild mit leiser Grundmusik weiter,
 * bis die Spielleitung freigibt.
 */
export function CutsceneOverlay({ cutscene, teams, roleOwner, offset = 0, onRelease, nextTitle, hostLost = false }: OverlayProps) {
  const [finished, setFinished] = useState(0)
  /** Film, der bis zum Ende lief. Nur dann stehen alle Dauerläufer schon an ihrem Platz. */
  const [watched, setWatched] = useState(0)
  const skip = useRef<HTMLButtonElement>(null)
  const muted = useSyncExternalStore(subscribeSound, isMuted)
  const id = cutscene?.id ?? 0
  const expired = cutscene ? Date.now() + offset - cutscene.at >= cutscene.seconds * 1000 : true
  const active = Boolean(cutscene) && !cutscene?.released
  const playing = active && !expired && finished !== id

  // Nach der letzten Freigabe blendet der Film ins Spiel aus. Zwischen zwei Filmen bleibt es dunkel.
  const [wasActive, setWasActive] = useState(active)
  const [leaving, setLeaving] = useState(false)
  if (wasActive !== active) {
    setWasActive(active)
    setLeaving(!active)
  }
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => setLeaving(false), 450)
    return () => clearTimeout(timer)
  }, [leaving])

  useEffect(() => {
    if (!playing || !cutscene) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const left = cutscene.at + cutscene.seconds * 1000 - (Date.now() + offset)
    const timer = setTimeout(() => {
      setFinished(id)
      if (!reduced) setWatched(id)
    }, reduced ? Math.min(left, 5000) : left)
    return () => clearTimeout(timer)
  }, [playing, id, cutscene, offset])

  // Nur am Filmanfang: Der Spielstand wird laufend neu verteilt, das darf den Ton nicht neu starten.
  useEffect(() => {
    if (!playing || !cutscene) return
    skip.current?.focus()
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    return playFilm(cutscene, () => (Date.now() + offset - cutscene.at) / 1000, CAPTION_AT[cutscene.scene], reduced)
  }, [playing, id])

  // Wartebild: Grundmusik, bis die Spielleitung freigibt.
  const waiting = active && !playing
  useEffect(() => {
    if (!waiting || !cutscene) return
    return playAmbient(cutscene)
  }, [waiting, id])

  if (!active || !cutscene) return leaving ? <div className="cut-wrap leaving" aria-hidden /> : null
  const credits = cutscene.scene === 'credits'
  const jump = !playing && watched !== id
  return (
    <div className="cut-wrap" role="dialog" aria-label={`Film: ${cutscene.title}`} data-testid="cutscene">
      <div key={cutscene.id} className={`cut cut-${cutscene.scene}${playing ? '' : ' held'}${jump ? ' jump' : ''}`}>
        <Stage c={cutscene} teams={teams} roleOwner={roleOwner} held={!playing} jump={jump} />
        {!credits && (
          <div className={`c-caption ${cutscene.tone}`} style={{ animationDelay: `${CAPTION_AT[cutscene.scene]}s` }}>
            <h1>{cutscene.title}</h1>
            <p>{cutscene.subtitle}</p>
          </div>
        )}
      </div>
      <div className="c-sound">
        <button className="c-skip" aria-pressed={muted} onClick={() => setMuted(!muted)}>
          <span aria-hidden>{muted ? '🔇' : '🔊'}</span> Musik {muted ? 'einschalten' : 'ausschalten'}
        </button>
      </div>
      {playing && <button ref={skip} className="c-skip c-skipfilm" onClick={() => setFinished(id)}>Überspringen</button>}
      {!playing && (
        <div className="c-wait" data-testid="cutscene-wait">
          {onRelease
            ? <button className="btn primary" onClick={onRelease}>Weiter für alle – {nextTitle}</button>
            : <p role="status">{hostLost ? 'Die Verbindung zur Spielleitung ist unterbrochen. Es geht weiter, sobald sie zurück ist.' : 'Die Spielleitung gibt gleich den nächsten Abschnitt frei.'}</p>}
        </div>
      )}
    </div>
  )
}
