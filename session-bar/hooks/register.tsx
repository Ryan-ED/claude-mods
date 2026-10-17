import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Snapshot } from '../types'
import { placeName, segments } from './format'

const GIT_ENV = { GIT_OPTIONAL_LOCKS: '0' }
const GIT_TIMEOUT_MS = 3000
const POLL_MS = 10_000
// session.measure can fire several times a turn; git is re-read at most this often.
const GIT_MIN_INTERVAL_MS = 3000

const snapshot = atom({ plugin: 'session-bar', key: 'snapshot' } as const, {} as Snapshot)

let gitInFlight: Promise<void> | undefined
let gitReadAt = -Infinity

function git($: EngineInterface, cwd: string, args: string[]) {
  return $.process.run(['git', ...args], { cwd, env: GIT_ENV, timeoutMs: GIT_TIMEOUT_MS })
}

async function readGit($: EngineInterface) {
  const cwd = await $.session.cwd()
  const head = await git($, cwd, ['rev-parse', '--show-toplevel', '--abbrev-ref', 'HEAD']).catch(() => undefined)
  if (!head || head.exitCode !== 0) {
    await update($, snapshot, s => ({ ...s, place: placeName(cwd), branch: undefined, isDirty: undefined }))
    return
  }
  const [top, ref] = head.stdout.trim().split('\n')
  const [branch, status] = await Promise.all([
    ref === 'HEAD'
      ? git($, cwd, ['rev-parse', '--short', 'HEAD']).then(r => `@${r.stdout.trim()}`, () => 'HEAD')
      : ref,
    git($, cwd, ['status', '--porcelain', '--ignore-submodules']).catch(() => undefined),
  ])
  await update($, snapshot, s => ({
    ...s,
    place: placeName(cwd, top),
    branch,
    isDirty: status ? status.stdout.trim() !== '' : undefined,
  }))
}

// One git read at a time, and none within GIT_MIN_INTERVAL_MS of the last.
async function refreshGit($: EngineInterface) {
  if (gitInFlight) return gitInFlight
  const now = await $.clock.now()
  if (now - gitReadAt < GIT_MIN_INTERVAL_MS) return
  gitReadAt = now
  gitInFlight = readGit($).finally(() => {
    gitInFlight = undefined
  })
  return gitInFlight
}

async function refreshModel($: EngineInterface) {
  const model = await $.session.model().catch(() => undefined)
  if (model !== undefined) await update($, snapshot, s => (s.model === model ? s : { ...s, model }))
}

async function refresh($: EngineInterface) {
  await Promise.all([refreshGit($), refreshModel($)])
}

const TONE_COLOR = { warning: 'warning', error: 'error' } as const

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    $.ui.status(undefined) // clear the status line left by v0.1
    const usage = await $.session.usage().catch(() => undefined)
    if (usage) {
      await update($, snapshot, s => ({
        ...s,
        context: usage.context,
        costUsd: usage.cost?.usd,
        limits: usage.rateLimits,
      }))
    }
    await refresh($)
    $.clock.every(POLL_MS, () => {
      void refresh($)
    })
    return started
  })

  on('session.measure', async ($, e, next) => {
    const measured = await next(e)
    await update($, snapshot, s => ({ ...s, context: e.context, costUsd: e.cost?.usd, limits: e.rateLimits }))
    await refresh($)
    return measured
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const segs = segments(await read($, snapshot))
    if (segs.length === 0) return next(e)

    const { Text } = $.ui.resolve(e)
    return (
      <Text wrap="truncate-end">
        {segs.map(seg =>
          seg.tone === 'dim' ? (
            <Text dimColor>{seg.text}</Text>
          ) : seg.tone ? (
            <Text color={TONE_COLOR[seg.tone]}>{seg.text}</Text>
          ) : (
            <Text>{seg.text}</Text>
          ),
        )}
      </Text>
    )
  })
}
