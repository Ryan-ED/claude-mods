import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const CWD = '/home/r/projects/my-project'
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 200, scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const ran = (exitCode: number, stdout: string) => ({
  value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

function engine(on: On, cwd: string, isRepo: boolean) {
  mock.clock(on)
  on('ui.status', () => ({ value: undefined }))
  on('session.cwd', () => ({ value: cwd }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('process.run', ($, e) => {
    if (!isRepo) return ran(128, '')
    if (e.argv.includes('--show-toplevel')) return ran(0, `${CWD}\ndevelop\n`)
    if (e.argv.includes('status')) return ran(0, ' M CLAUDE.md\n')
    return ran(0, '')
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))
}

test('the band shows folder, branch, model and context after a measurement', async ($, on) => {
  engine(on, CWD, true)
  await $.session.measure({
    context: { tokens: 84_000, window: 200_000, percent: 42 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 23 }],
    cost: { usd: 0.5 },
    changed: ['context'],
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-bar', surface, ...BAND })
    for (const part of ['my-project', '⎇ develop', 'Opus 5.5', ' 42%', '84k/200k', '$0.50', '5h 23%']) {
      expect(await ui.find({ type: 'Text', text: part })).toBeDefined()
    }
    await ui.unmount()
  }
})

test('outside a git repo the folder name stands alone', async ($, on) => {
  engine(on, '/tmp/scratch', false)
  await $.session.measure({ context: { window: 200_000 }, rateLimits: [], changed: ['context'] })
  const ui = await $.ui.mount({ plugin: 'session-bar', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: 'scratch' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '⎇' })).toBeUndefined()
  await ui.unmount()
})
