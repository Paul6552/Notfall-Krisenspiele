import { expect, test } from '@playwright/test'

// Prüft echtes WebRTC über öffentliche Relays. Braucht Internet: REAL_NET=1 npm run test:e2e -- realNetwork
test.skip(!process.env.REAL_NET, 'Nur mit REAL_NET=1')

test('Spielleiter und Team verbinden sich aus getrennten Browsern', async ({ browser }) => {
  const a = await browser.newContext()
  const b = await browser.newContext()
  const host = await a.newPage()
  await host.goto('./#/uebungen?teams=2')
  await host.getByRole('button', { name: 'Spiel starten' }).click()
  const code = (await host.getByTestId('game-code').textContent())!

  const team = await b.newPage()
  await team.goto(`./#/play/${code}`)
  await team.getByLabel('Name eurer Organisation').fill('Fernes Team')
  await team.getByRole('button', { name: 'Beitreten' }).click()
  await expect(team.getByText('Willkommen an Bord')).toBeVisible({ timeout: 60_000 })
  await expect(host.locator('.team-list')).toContainText('Fernes Team')

  // Spielleiter schließt den Tab und kommt zurück: Das Team verbindet sich über das Netz neu.
  await host.close()
  const back = await a.newPage()
  await back.goto('./#/')
  await back.getByRole('link', { name: 'Fortsetzen' }).first().click()
  await expect(back.locator('.team-list')).toContainText('Fernes Team')
  await expect(back.locator('.team-list .dot.on')).toHaveCount(1, { timeout: 60_000 })
})
