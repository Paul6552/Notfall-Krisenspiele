import type { Action, RoleId, View } from '../game/types'

export interface PanelProps {
  view: View
  role: RoleId
  act: (a: Action) => void
}
