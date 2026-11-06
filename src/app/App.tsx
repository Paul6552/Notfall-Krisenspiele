import { ConnectionTest } from '../screens/ConnectionTest'
import { HostScreen } from '../screens/HostScreen'
import { Overview } from '../screens/Overview'
import { PlayScreen } from '../screens/PlayScreen'
import { Start } from '../screens/Start'
import { HelpButton } from './HelpDialog'
import { useHashPath } from './router'

function Page({ path }: { path: string }) {
  const [, section, arg] = path.split('?')[0].split('/')
  if (section === 'uebungen') return <Overview teamCount={Number(new URLSearchParams(path.split('?')[1]).get('teams'))} />
  if (section === 'host' && arg) return <HostScreen key={arg} code={arg} />
  if (section === 'play' && arg) return <PlayScreen key={arg} code={arg} />
  if (section === 'verbindungstest') return <ConnectionTest />
  return <Start />
}

export function App() {
  const path = useHashPath()
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <span aria-hidden>🛰️</span> Krisenübung
        </a>
        <HelpButton />
      </header>
      <main>
        <Page path={path} />
      </main>
    </div>
  )
}
