import type { ReactNode } from 'react'

export const Notice = ({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad' | 'good'; children: ReactNode }) => (
  <div className={`notice ${tone}`} role={tone === 'bad' ? 'alert' : undefined}>{children}</div>
)

export function CenterMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="narrow center">
      <h1>{title}</h1>
      {children}
    </div>
  )
}
