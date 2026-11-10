import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { E3_DIFFS, E3_MAP, E5_START_KW, DEVICES, LANDING_CODE, MODULES, PIECE_SPECS, ROLES, SECTOR_CODES, SECTOR_ORDER } from '../src/game/content/flugZumMars'
import { FRAME_H, FRAME_W } from '../src/game/geometry'
import { AUTO_ORDER } from '../src/game/reducer'
import type { RoleId } from '../src/game/types'
import { solveShield } from '../tests/solveShield'

const NET = '/?net=local'

async function advance(host: Page) {
  await host.getByRole('button', { name: /^Weiter:/ }).click()
  await host.getByRole('button', { name: /^Ja, weiter/ }).click()
}

async function setup(context: BrowserContext, n: number, films = false) {
  const host = await context.newPage()
  await host.goto(`${NET}#/`)
  await host.getByLabel('Wie viele Teams').fill(String(n))
  await host.getByRole('button', { name: 'Weiter zu den Übungen' }).click()
  await expect(host.getByText('4 h 05 min')).toBeVisible()
  await host.getByRole('button', { name: 'Spiel starten' }).click()
  const code = (await host.getByTestId('game-code').textContent())!
  expect(code).toMatch(/^ARES-/)
  const teams: Page[] = []
  for (let i = 0; i < n; i++) {
    const p = await context.newPage()
    await p.goto(`${NET}#/play/${code}`)
    await p.getByLabel('Name eurer Organisation').fill(`Organisation ${i + 1}`)
    await p.getByRole('button', { name: 'Beitreten' }).click()
    await expect(p.getByText('Willkommen an Bord')).toBeVisible()
    teams.push(p)
  }
  await host.getByRole('button', { name: 'Automatisch verteilen' }).click()
  if (!films) await host.getByLabel('Filme zwischen den Ereignissen').uncheck()
  await host.getByRole('button', { name: 'Übung starten' }).click()
  await expect(teams[0].getByTestId('phase-title')).toHaveText('Check-in')
  const as = async (role: RoleId) => {
    const p = teams[AUTO_ORDER.indexOf(role) % n]
    const tab = p.getByRole('tab', { name: ROLES[role].section })
    if (await tab.count()) await tab.click()
    return p
  }
  const next = async (title: RegExp) => {
    await advance(host)
    for (const p of teams) await expect(p.getByTestId('phase-title')).toHaveText(title)
  }
  return { host, teams, code, as, next }
}

function safePath() {
  const y0 = E3_MAP.findIndex((r) => r.includes('S'))
  const start: [number, number] = [E3_MAP[y0].indexOf('S'), y0]
  const seen = new Map<string, string[]>([[start.join(), []]])
  const queue = [start]
  const dirs: [number, number, string][] = [[1, 0, 'Nach rechts'], [-1, 0, 'Nach links'], [0, 1, 'Nach unten'], [0, -1, 'Nach oben']]
  while (queue.length) {
    const [x, y] = queue.shift()!
    const cur = seen.get(`${x},${y}`)!
    if (E3_MAP[y][x] === 'G') return cur
    for (const [dx, dy, label] of dirs) {
      const c = E3_MAP[y + dy]?.[x + dx]
      if (!c || c === '#' || c === '~' || seen.has(`${x + dx},${y + dy}`)) continue
      seen.set(`${x + dx},${y + dy}`, [...cur, label])
      queue.push([x + dx, y + dy])
    }
  }
  throw new Error('kein Weg')
}

async function clickSvg(page: Page, testId: string, fx: number, fy: number) {
  const box = (await page.getByTestId(testId).boundingBox())!
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
}

for (const n of [2, 6, 7]) {
  test(`komplette Mission mit ${n} Teams`, async ({ context }) => {
    const errors: string[] = []
    context.on('weberror', (e) => errors.push(e.error().message))
    const { host, teams, as, next } = await setup(context, n)

    // Räume im Raumschiff
    await expect(teams[0].locator('.room')).toHaveCount(n)
    await expect(host.locator('.room').first()).toContainText('Organisation 1')
    await expect(host.locator('.room').first()).toContainText('Brücke – LdS')

    // Ereignis 1
    await next(/Ereignis 1/)
    let p = await as('S1')
    for (let i = 1; i <= 5; i++) {
      await p.getByLabel(`Frage ${i}.`).fill(`Antwort ${i}`)
      await p.locator('form.question').nth(i - 1).getByRole('button', { name: 'Senden' }).click()
    }
    p = await as('LS')
    await expect(p.getByText('3,6 und 4,0 mm')).toBeVisible()
    await expect(p.getByText('Antwort 5', { exact: true })).toBeVisible()
    for (let i = 0; i < 5; i++) await p.getByRole('button', { name: 'Korrekt' }).nth(i).click()
    await p.getByRole('button', { name: 'GO für den Start' }).click()

    // Ereignis 2
    await next(/Ereignis 2/)
    p = await as('LS')
    const key = Number(await p.locator('.key').textContent())
    await p.getByRole('button', { name: 'Bauplan senden' }).click()
    p = await as('S6')
    await p.getByLabel(/Schlüssel/).fill(String(key))
    await expect(p.locator('.plan li').first()).toContainText('GROSSES DREIECK')
    for (const role of ['S2', 'S3', 'S4'] as RoleId[]) {
      p = await as(role)
      for (const m of MODULES.filter((x) => x.owner === role)) {
        const spec = PIECE_SPECS[m.kind]
        const form = p.locator('form.question', { hasText: `Modul ${m.id}` })
        await form.getByRole('combobox').selectOption(spec.shape)
        const inputs = form.getByRole('textbox')
        for (let i = 0; i < spec.dims.length; i++) await inputs.nth(i).fill(String(spec.dims[i]).replace('.', ','))
        await form.getByRole('button').click()
        await expect(form.getByText('Geliefert')).toBeVisible()
      }
    }
    p = await as('S1')
    const solution = solveShield()!
    let rot = 0
    let flip = false
    for (const m of MODULES) {
      const target = solution[m.id]
      await p.getByRole('button', { name: `Teil ${m.id} auswählen` }).click()
      while (rot !== target.rot) { await p.getByRole('button', { name: /Drehen/ }).click(); rot = (rot + 1) % 4 }
      if (flip !== target.flip) { await p.getByRole('button', { name: /Spiegeln/ }).click(); flip = target.flip }
      await clickSvg(p, 'shield-frame', (target.x + 0.5) / FRAME_W, (target.y + 0.5) / FRAME_H)
      await expect(p.getByRole('button', { name: `Teil ${m.id} auswählen` })).toHaveCount(0)
    }
    await expect(p.getByText('Hitzeschild repariert').first()).toBeVisible()

    // Ereignis 3
    await next(/Ereignis 3/)
    p = await as('S1')
    await p.getByLabel('Nachricht').fill('Kurs nach links')
    await p.getByRole('button', { name: 'Senden' }).click()
    await expect(p.getByRole('alert').filter({ hasText: 'nur Emojis' })).toBeVisible()
    await p.getByLabel('Nachricht').fill('🚀👍')
    await p.getByRole('button', { name: 'Senden' }).click()
    await expect(p.locator('.msg').last()).toContainText('🚀👍')

    // Spielstand übersteht das Neuladen von Spielleiter und Team
    host.on('dialog', (d) => void d.accept())
    await host.reload()
    await expect(host.getByTestId('phase-title')).toHaveText(/Ereignis 3/)
    await host.getByRole('button', { name: 'Fortsetzen' }).click()
    await teams[0].reload()
    await expect(teams[0].getByTestId('phase-title')).toHaveText(/Ereignis 3/)
    await expect(host.locator('.room .dot.on')).toHaveCount(n, { timeout: 15_000 })

    const path = safePath()
    for (let i = 0; i < path.length; i++) {
      if (i % 5 === 0) { p = await as('S4'); await p.getByRole('button', { name: '+5 Energie' }).click() }
      p = await as('S3')
      const left = path.length - i
      await expect(p.getByTestId('energy')).not.toHaveText('0')
      await p.getByRole('button', { name: path[i] }).click()
      await expect(p.getByTestId('energy')).toHaveText(String((5 - ((i + 1) % 5)) % 5), { timeout: 5000 })
      void left
    }
    await expect(p.getByText('durchquert')).toBeVisible()
    p = await as('S2')
    await p.getByLabel('Sektor B im Sturm').check()
    await p.getByLabel('Sektor D im Sturm').check()
    await p.getByRole('button', { name: 'Analyse melden' }).click()
    await expect(p.getByText('Analyse abgeschlossen')).toBeVisible()
    for (const [role, puzzle] of [['S1', 'mast'], ['S6', 'panel']] as const) {
      p = await as(role)
      for (const d of E3_DIFFS[puzzle]) await clickSvg(p, `spot-${puzzle}`, d.x / 300, d.y / 260)
      await expect(p.getByText('Fehlerprüfung abgeschlossen')).toBeVisible()
    }
    p = await as('S5')
    await p.getByLabel('Crew-Meldung').fill('🚀☄️👍')
    await p.getByRole('button', { name: 'Veröffentlichen' }).click()
    await expect(p.getByText('Crew-Meldung ist draußen')).toBeVisible()

    // Ereignis 4
    await next(/Ereignis 4/)
    await expect(teams[n - 1].getByTestId('chat-status')).toHaveText('Hauptkanal ausgefallen')
    p = await as('LS')
    await p.getByRole('button', { name: 'Notkanal aktivieren' }).click()
    for (const t of teams.slice(1)) {
      const b = t.getByRole('button', { name: 'Am Notkanal anmelden' })
      await b.click()
      await expect(t.getByText('Ihr seid am Notkanal angemeldet')).toBeVisible()
    }

    // Ereignis 5: Licht und Dämpfer aus, Vorwärmer bleiben an
    await next(/Ereignis 5/)
    p = await as('LS')
    const keep = ['cooling', 'preheat', 'hydro', 'water']
    for (const d of DEVICES.filter((x) => !keep.includes(x.id))) {
      const box = p.locator('.devices li', { hasText: d.name }).getByRole('checkbox')
      await box.click()
      await expect(box).not.toBeChecked()
    }
    const kw = E5_START_KW - DEVICES.filter((x) => !keep.includes(x.id)).reduce((a, x) => a + x.kw, 0)
    await expect(p.getByTestId('kw')).toHaveText(`${kw} kW`)
    await p.getByRole('button', { name: 'Lastverteilung bestätigen' }).click()
    p = await as('S4')
    await expect(p.getByText('Hier wächst das Essen')).toBeVisible()

    // Ereignis 6
    await next(/Ereignis 6/)
    await host.getByLabel('Dauer des Neustarts').fill('12')
    p = await as('LS')
    await p.getByRole('button', { name: 'Reaktor-Neustart einleiten' }).click()
    // Meldung mit fremdem Absender läuft über den Funk der Spielleitung
    await expect(host.getByRole('button', { name: /^Weiter:/ })).toBeVisible()
    await host.getByLabel('Absender').fill('Unbekannter Sender')
    await host.getByLabel('Nachricht').fill('Organisation 1 glänzt immer durch Abwesenheit.')
    await host.getByRole('button', { name: 'Einspielen' }).click()
    await expect(teams[n - 1].locator('.msg.inject')).toContainText('Abwesenheit')
    await expect(teams[n - 1].locator('.msg.inject')).toContainText('Unbekannter Sender')
    const talker = teams[n - 1]
    await talker.getByLabel('Nachricht').fill('Das ist eine Frechheit!')
    await talker.getByRole('button', { name: 'Senden' }).click()
    await expect(talker.getByText('Unterbrechungen bisher: 1 von 3')).toBeVisible()
    p = await as('S5')
    await p.getByLabel('Richtigstellung').fill('Das ist falsch.')
    await p.getByRole('button', { name: 'Veröffentlichen' }).click()
    await expect(p.locator('.msg.statement').last()).toContainText('Das ist falsch.')
    await expect(p.getByText('Reaktor-Neustart abgeschlossen.', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(p.getByText('Unterbrechungen bisher: 1 von 3')).toBeVisible()

    // Ereignis 7
    await next(/Ereignis 7/)
    p = await as('S6')
    await expect(p.locator('.fragments.blurred')).toBeVisible()
    p = await as('S1')
    await expect(p.getByText('Ein Teammitglied ist verletzt')).toBeVisible()
    for (const role of SECTOR_ORDER) {
      p = await as(role)
      await p.getByLabel('Sektoren-Code').fill(SECTOR_CODES[role]!)
      await p.getByRole('button', { name: 'An die Brücke senden' }).click()
      await expect(p.getByText(`Gesendet: ${SECTOR_CODES[role]}`)).toBeVisible()
    }
    p = await as('LS')
    await expect(p.locator('td.mono').first()).toHaveText(SECTOR_CODES.S1!)
    await p.getByLabel('Lande-Code').fill('000000000000')
    await p.getByRole('button', { name: 'Landen' }).click()
    await expect(p.getByText('0 von 6 Blöcken')).toBeVisible()
    await p.getByLabel('Lande-Code').fill(LANDING_CODE)
    await p.getByRole('button', { name: 'Landen' }).click()
    await expect(p.getByText('Touchdown!')).toBeVisible()

    // Lessons Learned
    await next(/Lessons Learned/)
    await expect(teams[0].getByText('Mission erfüllt')).toBeVisible()
    await teams[0].getByLabel('Notiz').fill('Funk klappte gut')
    await teams[0].getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(host.locator('.notes')).toContainText('Funk klappte gut')
    await expect(host.locator('.timeline li').first()).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('Filme laufen bei allen gleichzeitig und hängen vom Spielverlauf ab', async ({ context }) => {
  const { host, teams, as } = await setup(context, 2, true)
  const film = teams[1].getByTestId('cutscene')
  const release = async () => {
    await host.getByRole('button', { name: /Weiter für alle/ }).click()
    for (const p of [host, ...teams]) await expect(p.getByTestId('cutscene')).toHaveCount(0)
  }
  await expect(film).toContainText('Mission Red Planet')
  await expect(host.getByTestId('cutscene')).toBeVisible()
  await teams[1].getByRole('button', { name: 'Überspringen' }).click()
  // Überspringen führt nur zum Standbild und gilt nur für das eigene Team
  await expect(teams[1].getByTestId('cutscene-wait')).toContainText('Spielleitung gibt gleich')
  await expect(host.getByRole('button', { name: 'Überspringen' })).toBeVisible()
  await expect(teams[1].getByRole('button', { name: /Weiter für alle/ })).toHaveCount(0)
  await host.getByRole('button', { name: 'Überspringen' }).click()
  await release()

  await advance(host)
  await host.getByRole('button', { name: 'Überspringen' }).click()
  await host.getByRole('button', { name: /Weiter für alle/ }).click()
  await expect(film).toContainText('GO oder NO-GO?')
  await host.getByRole('button', { name: 'Überspringen' }).click()
  await release()
  const bridge = await as('LS')
  await bridge.getByRole('button', { name: /GO für den Start/ }).click()
  await advance(host)
  await expect(film).toContainText('Erfolgreich gestartet')
  await expect(teams[0].getByTestId('cutscene')).toContainText('auf dem Weg zum Mars')

  // Neuladen während des Films: läuft weiter und bleibt am Ende stehen, bis die Spielleitung freigibt
  await teams[1].getByRole('button', { name: 'Musik ausschalten' }).click()
  await expect(host.getByRole('button', { name: 'Musik ausschalten' })).toBeVisible() // Stumm gilt nur für das eigene Gerät
  await teams[1].reload()
  await expect(film).toBeVisible()
  await expect(teams[1].getByRole('button', { name: 'Musik einschalten' })).toBeVisible()
  await expect(teams[1].getByTestId('cutscene-wait')).toBeVisible({ timeout: 30_000 })
  await expect(film).toContainText('Erfolgreich gestartet')
  await expect(host.getByRole('button', { name: /Weiter für alle – .*Hüllenschaden/ })).toBeVisible()
  await teams[1].waitForTimeout(1500)
  await expect(film).toBeVisible()
  // Die Freigabe startet den zweiten Film, Ereignis 2 öffnet erst danach
  await host.getByRole('button', { name: /Weiter für alle/ }).click()
  await expect(film).toContainText('METEORITEN VORAUS')
  await expect(host.getByTestId('cutscene')).toBeVisible()
  await host.getByRole('button', { name: 'Überspringen' }).click()
  await expect(host.getByTestId('cutscene')).toContainText('WIR SIND GETROFFEN')
  // Im Wartebild laufen Dauerläufer wie die Sterne weiter
  await expect.poll(() => host.locator('.cut.held .c-stars').first().evaluate((el) => getComputedStyle(el).animationIterationCount)).toBe('infinite')
  await release()
  await expect(teams[1].getByTestId('phase-title')).toHaveText(/Ereignis 2/)
})

test('Ereignis 1: Teams überschreiben sich die Antworten nicht', async ({ context }) => {
  const { as, next } = await setup(context, 3)
  await next(/Ereignis 1/)
  const send = async (p: Page, text: string) => {
    await p.getByLabel('Frage 1.').fill(text)
    await p.locator('form.question').first().getByRole('button', { name: 'Senden' }).click()
    await expect(p.getByText(`Gesendet: ${text}`)).toBeVisible()
  }
  const first = await as('S6')
  await send(first, 'Antwort Team 2')
  const second = await as('S1')
  await send(second, 'Antwort Team 3')
  await expect(first.getByText('Gesendet: Antwort Team 2')).toBeVisible()
  await expect(first.getByText('Antwort Team 3')).toHaveCount(0)

  const bridge = await as('LS')
  await expect(bridge.getByText('Antwort Team 2', { exact: true })).toBeVisible()
  await expect(bridge.getByText('Antwort Team 3', { exact: true })).toBeVisible()

  // NO-GO gibt der Brücke und den Teams sichtbar Rückmeldung
  await bridge.getByRole('button', { name: /^NO-GO/ }).click()
  await expect(bridge.locator('.notice', { hasText: 'Startfenster verschoben' })).toBeVisible()
  await expect(bridge.getByRole('button', { name: 'GO für den Start' })).toBeVisible()
  const team = await as('S1')
  await expect(team.locator('.notice', { hasText: 'Startfenster verschoben' })).toBeVisible()
})

test('Musik lässt sich beim Beitritt abwählen und im Film wieder einschalten', async ({ context }) => {
  const page = await context.newPage()
  await page.goto(`${NET}#/uebungen?teams=2`)
  await page.getByRole('button', { name: 'Spiel starten' }).click()
  const code = (await page.getByTestId('game-code').textContent())!
  await page.getByLabel('Organisation vorab eintragen').fill('Vorab')
  await page.getByRole('button', { name: 'Eintragen' }).click()
  const team = await context.newPage()
  await team.goto(`${NET}#/play/${code}`)
  await team.getByLabel('Name eurer Organisation').fill('Org B')
  await expect(page.getByRole('button', { name: 'Musik testen' })).toBeVisible()
  await page.getByRole('button', { name: 'Musik testen' }).click()
  await expect(page.getByRole('button', { name: 'Test stoppen' })).toBeVisible()
  await page.getByRole('button', { name: 'Test stoppen' }).click()
  await expect(team.getByLabel('Musik und Klänge')).toBeChecked()
  await expect(team.getByRole('button', { name: 'Musik testen' })).toBeEnabled()
  await team.getByLabel('Musik und Klänge').uncheck()
  await expect(team.getByRole('button', { name: 'Musik testen' })).toBeDisabled()
  await team.getByRole('button', { name: 'Beitreten' }).click()
  await expect(team.getByText('Willkommen an Bord')).toBeVisible()
  await page.getByRole('button', { name: 'Automatisch verteilen' }).click()
  await page.getByRole('button', { name: 'Übung starten' }).click()
  await expect(team.getByRole('button', { name: 'Musik einschalten' })).toBeVisible()
  await team.getByRole('button', { name: 'Musik einschalten' }).click()
  await expect(team.getByRole('button', { name: 'Musik ausschalten' })).toBeVisible()
})

test('Übungsübersicht erklärt, was beübt wird', async ({ page }) => {
  await page.goto(`${NET}#/uebungen?teams=3`)
  const item = page.getByText('Desinformationskampagnen ausstehen')
  await expect(item).toBeHidden()
  await page.getByText('Was wird beübt?').click()
  await expect(item).toBeVisible()
  await expect(page.locator('.trains li')).toHaveCount(5)
})

test('Weiter muss bestätigt werden', async ({ context }) => {
  const { host, teams, next } = await setup(context, 2)
  await next(/Ereignis 1/)
  await next(/Ereignis 2/)
  const title = teams[0].getByTestId('phase-title')
  const weiter = host.getByRole('button', { name: /^Weiter:/ })
  const dialog = host.locator('dialog.confirm')

  // Der Klick allein schaltet nicht weiter, offene Punkte werden genannt
  await weiter.click()
  await expect(dialog).toContainText('Wirklich weiter zu „Ionensturm“?')
  await expect(dialog).toContainText('−15 Hülle und −25 Sauerstoff')
  await host.waitForTimeout(500)
  await expect(title).toHaveText(/Ereignis 2/)

  // Fokus liegt auf Abbrechen: ein versehentliches Enter löst nichts aus
  await expect(host.getByRole('button', { name: 'Abbrechen' })).toBeFocused()
  await host.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)
  await expect(title).toHaveText(/Ereignis 2/)

  // Escape bricht ebenfalls ab
  await weiter.click()
  await host.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(title).toHaveText(/Ereignis 2/)

  // Doppelklick auf Weiter schaltet nicht weiter
  await weiter.dblclick({ force: true }).catch(() => {})
  await host.waitForTimeout(300)
  await expect(title).toHaveText(/Ereignis 2/)
  await host.getByRole('button', { name: 'Abbrechen' }).click()

  // Erst die Bestätigung schaltet weiter
  await advance(host)
  await expect(title).toHaveText(/Ereignis 3/)
})

test('Spielleiter schließt den Browser mitten im Reaktor-Neustart', async ({ context }) => {
  const { host: first, teams, as, next } = await setup(context, 2)
  for (const title of [/Ereignis 1/, /Ereignis 2/, /Ereignis 3/, /Ereignis 4/]) await next(title)
  const bridge = await as('LS')
  await bridge.getByRole('button', { name: 'Notkanal aktivieren' }).click()
  await next(/Ereignis 5/)
  await as('LS')
  const keep = ['Hauptreaktor-Kühlung', 'Triebwerks-Vorwärmer', 'Hydrokulturen', 'Warmwasser']
  for (const li of await bridge.locator('.devices li').all()) {
    const text = (await li.textContent())!
    const box = li.getByRole('checkbox')
    if (!keep.some((k) => text.includes(k)) && (await box.isChecked())) { await box.click(); await expect(box).not.toBeChecked() }
  }
  await advance(first)
  await expect(teams[0].getByTestId('phase-title')).toHaveText(/Ereignis 6/)
  await first.getByLabel('Dauer des Neustarts').fill('8')
  await (await as('LS')).getByRole('button', { name: 'Reaktor-Neustart einleiten' }).click()
  await expect(first.getByText('Neustart: läuft')).toBeVisible()
  const hull = await first.getByTestId('gauge-hull').textContent()

  await first.close()
  await expect(teams[0].getByText('Spielleitung getrennt')).toBeVisible({ timeout: 20_000 })
  await expect(teams[0].locator('.timer')).toContainText('Pause')

  // Länger weg, als der Neustart dauert
  await teams[0].waitForTimeout(10_000)

  const host = await context.newPage()
  await host.goto(`${NET}#/`)
  await host.getByRole('link', { name: 'Fortsetzen' }).first().click()
  await expect(host.getByTestId('phase-title')).toHaveText(/Ereignis 6/)
  await expect(host.getByTestId('gauge-hull')).toHaveText(hull!)
  await expect(host.locator('.room .dot.on')).toHaveCount(2, { timeout: 15_000 })
  await expect(host.getByText('Neustart: läuft')).toBeVisible()
  await expect(teams[0].getByText('Spielleitung getrennt')).toHaveCount(0)
  await expect(teams[0].getByText('Die Übung ist pausiert').first()).toBeVisible()

  // Während der Pause ist nichts passiert, danach läuft die Restzeit
  await host.waitForTimeout(2000)
  await expect(host.getByText('Neustart: läuft')).toBeVisible()
  await host.getByRole('button', { name: 'Fortsetzen' }).click()
  await expect(teams[0].locator('.notice', { hasText: 'Die Übung ist pausiert' })).toHaveCount(0)
  await expect(host.getByText('Neustart: fertig')).toBeVisible({ timeout: 15_000 })

  // Zweiter Tab darf nicht zum zweiten Spielleiter werden
  const second = await context.newPage()
  await second.goto(host.url())
  await expect(second.getByText('Spiel ist schon geöffnet')).toBeVisible({ timeout: 10_000 })

  // Schließen fragt nach
  const dialog = host.waitForEvent('dialog')
  await host.close({ runBeforeUnload: true })
  const asked = await dialog
  expect(asked.type()).toBe('beforeunload')
  await asked.dismiss()
  await expect(host.getByTestId('phase-title')).toHaveText(/Ereignis 6/)
})

test('Hilfe, Mindestanzahl und Spielleiter als Brücke', async ({ context }) => {
  const page = await context.newPage()
  await page.goto(`${NET}#/`)
  await page.getByLabel('Wie viele Teams').fill('1')
  await page.getByRole('button', { name: 'Weiter zu den Übungen' }).click()
  await expect(page.getByText('mindestens 2 Teams')).toBeVisible()

  await page.getByRole('button', { name: 'Hilfe zu SKKM' }).click()
  await expect(page.getByText('Staatliches Krisen- und Katastrophenschutzmanagement')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Öffentlichkeitsarbeit').first()).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click()

  await page.getByLabel('Wie viele Teams').fill('2')
  await page.getByRole('button', { name: 'Weiter zu den Übungen' }).click()
  await page.getByRole('button', { name: 'Spiel starten' }).click()
  const code = (await page.getByTestId('game-code').textContent())!
  await page.getByLabel('Spielleiter spielt die Brücke').check()
  await page.getByLabel('Name der eigenen Organisation').fill('Leitstelle')
  await page.getByRole('button', { name: 'Speichern' }).click()
  const team = await context.newPage()
  await team.goto(`${NET}#/play/${code}`)
  await team.getByLabel('Name eurer Organisation').fill('Org B')
  await team.getByRole('button', { name: 'Beitreten' }).click()
  await expect(team.getByText('Willkommen an Bord')).toBeVisible()
  await page.getByRole('button', { name: 'Automatisch verteilen' }).click()
  await page.getByLabel('Filme zwischen den Ereignissen').uncheck()
  await page.getByRole('button', { name: 'Übung starten' }).click()
  await page.getByRole('tab', { name: 'Brücke' }).click()
  await expect(page.locator('.room', { hasText: 'Leitstelle' })).toContainText('Brücke – LdS')
  await expect(page.getByRole('tab', { name: 'Spielleitung' })).toBeVisible()
  await expect(team.locator('.room', { hasText: 'Org B' })).toContainText('Versorgung – S4')
})

test('Externe Kommunikation blendet den Chat aus', async ({ context }) => {
  const page = await context.newPage()
  await page.goto(`${NET}#/uebungen?teams=2`)
  await page.getByRole('button', { name: 'Spiel starten' }).click()
  const code = (await page.getByTestId('game-code').textContent())!
  await page.getByLabel(/Externe Tools/).check()
  await page.getByLabel('Organisation vorab eintragen').fill('Vorab')
  await page.getByRole('button', { name: 'Eintragen' }).click()
  const team = await context.newPage()
  await team.goto(`${NET}#/play/${code}`)
  await team.getByLabel('Name eurer Organisation').fill('Org B')
  await team.getByRole('button', { name: 'Beitreten' }).click()
  await expect(team.getByText('Willkommen an Bord')).toBeVisible()
  await page.getByRole('button', { name: 'Automatisch verteilen' }).click()
  await page.getByLabel('Filme zwischen den Ereignissen').uncheck()
  await page.getByRole('button', { name: 'Übung starten' }).click()
  await expect(team.getByText('externe Tools')).toBeVisible()
  await expect(team.getByLabel('Nachricht')).toHaveCount(0)
})
