import { expect, test } from 'vitest'

import { createSessionGeneration } from './session-generation'

test('advances monotonically and rejects an earlier captured generation', () => {
  const generation = createSessionGeneration()
  const captured = generation.read()

  expect(generation.isCurrent(captured)).toBe(true)
  expect(generation.advance()).toBe(captured + 1)
  expect(generation.isCurrent(captured)).toBe(false)
})
