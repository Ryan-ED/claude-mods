export type Snapshot = {
  place?: string
  branch?: string
  isDirty?: boolean
  model?: string
  context?: { tokens?: number; window: number; percent?: number }
  costUsd?: number
  limits?: readonly { kind: string; percentUsed: number }[]
}

declare module 'claude-code' {
  interface PluginState {
    'session-bar': { snapshot: Snapshot }
  }
}
