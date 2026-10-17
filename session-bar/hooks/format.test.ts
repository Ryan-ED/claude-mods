import { expect, test } from 'claude-code/testing'

import { contextSegments, format, placeName, prettyModel } from './format'

test('full line', () => {
  expect(
    format({
      place: 'my-project',
      branch: 'develop',
      isDirty: true,
      model: 'claude-opus-5-5',
      context: { tokens: 84_000, window: 200_000, percent: 42 },
      costUsd: 1.234,
      limits: [
        { kind: 'five_hour', percentUsed: 23.4 },
        { kind: 'seven_day', percentUsed: 41 },
      ],
    }),
  ).toBe('my-project ⎇ develop* │ Opus 5.5 │ ctx ▓▓▓▓░░░░░░ 42% 84k/200k │ $1.23 │ 5h 23% · 7d 41%')
})

test('outside git, no cost or limits', () => {
  expect(format({ place: 'tmp', model: 'claude-sonnet-5-5', context: { window: 200_000 }, limits: [] })).toBe(
    'tmp │ Sonnet 5.5 │ ctx —% of 200k',
  )
})

test('context bar colours at 70% and 85%', () => {
  const tones = (percent: number) =>
    contextSegments({ tokens: percent * 2000, window: 200_000, percent }).find(s => s.text.startsWith('▓'))?.tone
  expect(tones(42)).toBeUndefined()
  expect(tones(75)).toBe('warning')
  expect(tones(90)).toBe('error')
  expect(contextSegments({ tokens: 500_000, window: 1_000_000, percent: 50 }).map(s => s.text).join('')).toBe(
    'ctx ▓▓▓▓▓░░░░░ 50% 500k/1M',
  )
})

test('model names', () => {
  expect(prettyModel('claude-opus-5-5[1m]')).toBe('Opus 5.5 1M')
  expect(prettyModel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(prettyModel('Opus 5.5')).toBe('Opus 5.5')
})

test('place names', () => {
  expect(placeName('/home/r/p/repo', '/home/r/p/repo')).toBe('repo')
  expect(placeName('/home/r/p/repo/src', '/home/r/p/repo')).toBe('repo/src')
  expect(placeName('/home/r/p/repo/src/a/b', '/home/r/p/repo')).toBe('repo/…/b')
  expect(placeName('/tmp/x/')).toBe('x')
})
