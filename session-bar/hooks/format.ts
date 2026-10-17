import type { Snapshot } from '../types'

/** A run of text in the band; `tone` colours it, left out it is plain. */
export type Segment = { text: string; tone?: 'dim' | 'warning' | 'error' }

const SEP: Segment = { text: ' │ ', tone: 'dim' }
const BAR_CELLS = 10
const LIMIT_LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }

const kilo = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`)

export const prettyModel = (model: string) => {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?$/.exec(model)
  if (!m) return model
  const [, family = '', major, minor, oneM] = m
  const name = family.charAt(0).toUpperCase() + family.slice(1)
  return `${name} ${major}${minor ? `.${minor}` : ''}${oneM ? ' 1M' : ''}`
}

export const contextSegments = (context: NonNullable<Snapshot['context']>): Segment[] => {
  if (context.percent === undefined) return [{ text: 'ctx ', tone: 'dim' }, { text: `—% of ${kilo(context.window)}` }]
  const pct = Math.max(0, Math.min(100, context.percent))
  const filled = Math.round((pct / 100) * BAR_CELLS)
  const tone = pct >= 85 ? 'error' : pct >= 70 ? 'warning' : undefined
  const tokens = context.tokens === undefined ? '' : ` ${kilo(context.tokens)}/${kilo(context.window)}`
  return [
    { text: 'ctx ', tone: 'dim' },
    { text: '▓'.repeat(filled), tone },
    { text: '░'.repeat(BAR_CELLS - filled), tone: 'dim' },
    { text: ` ${pct}%`, tone },
    { text: tokens, tone: 'dim' },
  ]
}

export const limitsText = (limits: NonNullable<Snapshot['limits']>) =>
  limits.map(l => `${LIMIT_LABELS[l.kind] ?? l.kind} ${Math.round(l.percentUsed)}%`).join(' · ')

export const segments = (s: Snapshot): Segment[] => {
  const groups: Segment[][] = []
  const where: Segment[] = []
  if (s.place) where.push({ text: s.place })
  if (s.branch) where.push({ text: `${where.length ? ' ' : ''}⎇ ${s.branch}` }, ...(s.isDirty ? [{ text: '*', tone: 'warning' } as const] : []))
  if (where.length) groups.push(where)
  if (s.model) groups.push([{ text: prettyModel(s.model) }])
  if (s.context) groups.push(contextSegments(s.context))
  if (s.costUsd !== undefined) groups.push([{ text: `$${s.costUsd.toFixed(2)}` }])
  if (s.limits?.length) groups.push([{ text: limitsText(s.limits) }])
  return groups.flatMap((g, i) => (i === 0 ? g : [SEP, ...g])).filter(seg => seg.text !== '')
}

/** The band as plain text. */
export const format = (s: Snapshot) => segments(s).map(seg => seg.text).join('')

/** `repo`, `repo/sub` or `repo/…/leaf` for where cwd sits under the repo's top level. */
export const placeName = (cwd: string, top?: string) => {
  const base = (p: string) => p.replace(/\/+$/, '').split('/').pop() || p
  if (!top) return base(cwd)
  const rest = cwd.startsWith(top + '/') ? cwd.slice(top.length + 1).split('/').filter(Boolean) : []
  if (rest.length === 0) return base(top)
  if (rest.length === 1) return `${base(top)}/${rest[0]}`
  return `${base(top)}/…/${rest[rest.length - 1]}`
}
