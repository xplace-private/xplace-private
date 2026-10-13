import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { isValidPassword } from '../../../shared/password-validation'
import { totpCode } from '../totp'
import type { AuthGateway, AuthSession } from './auth-gateway'
import { createMockAuthGateway } from './mock-auth-gateway'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-30T12:00:00Z')) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

const sessionKey = 'partner-portal.mock-auth-session.v2'

function createStorage() {
  const values = new Map<string, string>()
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    removeItem: vi.fn((key: string) => { values.delete(key) }),
  }
  return { values, storage }
}

async function finish<T>(result: Promise<T>): Promise<T> {
  let settled = false
  void result.then(() => { settled = true }, () => { settled = true })
  await vi.waitFor(() => expect(settled).toBe(true), { interval: 10 })
  return result
}

async function verifySetup(gateway: AuthGateway) {
  const setup = await gateway.getAuthenticatorSetup()
  const code = setup.ok ? await totpCode(setup.data.secret) : '123456'
  return gateway.verifyAuthenticatorCode({ code })
}

const credentials = { email: 'partner@example.test', password: 'temporary' }
const password = { password: 'a long passphrase' }
const steps = [
  { session: 'anonymous', run: (gateway: AuthGateway) => gateway.signIn(credentials) },
  { session: 'authenticator-required', run: (gateway: AuthGateway) => verifySetup(gateway) },
  { session: 'password-required', run: (gateway: AuthGateway) => gateway.setPassword(password) },
  { session: 'authenticated', run: (gateway: AuthGateway) => gateway.signOut() },
] satisfies { session: AuthSession; run: (gateway: AuthGateway) => ReturnType<AuthGateway['signOut']> }[]

test('rejects missing credentials and weak passwords without changing the session', async () => {
  const gateway = createMockAuthGateway()
  expect((await gateway.signIn({ email: ' ', password: 'temporary' })).ok).toBe(false)
  expect((await gateway.signIn({ email: 'partner@example.test', password: ' ' })).ok).toBe(false)
  expect(await gateway.getSession()).toBe('anonymous')

  await finish(gateway.signIn(credentials))
  await finish(verifySetup(gateway))
  expect((await gateway.setPassword({ password: 'weak' })).ok).toBe(false)
  expect(await gateway.getSession()).toBe('password-required')
})

test.each(steps)('rejects every out-of-order action from $session', async ({ session }) => {
  const gateway = createMockAuthGateway()
  for (const step of steps) {
    if (step.session === session) break
    await finish(step.run(gateway))
  }
  expect(await gateway.getSession()).toBe(session)

  for (const step of steps.filter((step) => step.session !== session)) {
    expect(await finish(step.run(gateway))).toMatchObject({ ok: false, code: 'session' })
    expect(await gateway.getSession()).toBe(session)
  }
})

test('accepts only one concurrent action per step and resets on logout', async () => {
  const gateway = createMockAuthGateway()
  const nextSessions = ['authenticator-required', 'password-required', 'authenticated', 'anonymous']
  for (const [index, step] of steps.entries()) {
    const pending = Promise.all([step.run(gateway), step.run(gateway)])
    expect(await gateway.getSession()).toBe(step.session)
    const results = await finish(pending)
    expect(results.filter((result) => result.ok)).toEqual([{ ok: true }])
    expect(results.filter((result) => !result.ok)).toEqual([expect.objectContaining({ ok: false, code: 'session' })])
    expect(await gateway.getSession()).toBe(nextSessions[index])
  }
  expect(await gateway.getSession()).toBe('anonymous')
})

test('does not let concurrent requests skip steps that were not available when submitted', async () => {
  const gateway = createMockAuthGateway()
  const results = await finish(Promise.all([
    gateway.signIn(credentials),
    verifySetup(gateway),
    gateway.setPassword(password),
    gateway.signOut(),
  ]))
  expect(results).toEqual([
    { ok: true },
    expect.objectContaining({ ok: false, code: 'session' }),
    expect.objectContaining({ ok: false, code: 'session' }),
    expect.objectContaining({ ok: false, code: 'session' }),
  ])
  expect(await gateway.getSession()).toBe('authenticator-required')
  expect(await createMockAuthGateway().getSession()).toBe('anonymous')
})

test.each([
  ['a long passphrase', true],
  ['abcdefghijkL', true],
  ['abc def ghij', true],
  ['Partner1!', true],
  ['123456789012', false],
  ['١٢٣٤٥٦٧٨٩٠١٢', false],
  ['abcdefgh', true],
  ['abcdefg', false],
  ['12345678', false],
  ['', false],
  ['🔑🔑🔑🔑🔑🔑🔑', false],
  ['🔑🔑🔑🔑🔑🔑🔑🔑', true],
])('checks the displayed password requirements for %s', (password, valid) => {
  expect(isValidPassword(password)).toBe(valid)
})

test('restores every step and remembers completed demo enrollment on logout', async () => {
  const { values, storage } = createStorage()
  values.set('language', 'en')
  const expectedSessions = ['authenticator-required', 'password-required', 'authenticated', 'anonymous']
  for (const [index, step] of steps.entries()) {
    const gateway = createMockAuthGateway(storage)
    expect(await gateway.getSession()).toBe(step.session)
    expect(await finish(step.run(gateway))).toEqual({ ok: true })
    expect(await createMockAuthGateway(storage).getSession()).toBe(expectedSessions[index])
    expect(values.get('language')).toBe('en')
    expect(JSON.parse(values.get(sessionKey) ?? 'null')).toMatchObject({
      session: expectedSessions[index],
      email: index === 3 ? null : credentials.email,
      accounts: [{ email: credentials.email, enrolled: index >= 2 }],
    })
  }
})

test.each(['', 'admin', '{"session":"authenticated"}'])('rejects damaged stored state %j and allows a fresh sign-in', async (value) => {
  const { values, storage } = createStorage()
  values.set(sessionKey, value)
  const gateway = createMockAuthGateway(storage)
  expect(await gateway.getSession()).toBe('anonymous')
  expect(await finish(gateway.signIn(credentials))).toEqual({ ok: true })
  expect(await createMockAuthGateway(storage).getSession()).toBe('authenticator-required')
})

test('uses browser sessionStorage by default without persisting passwords', async () => {
  const { values, storage } = createStorage()
  vi.stubGlobal('window', { sessionStorage: storage })
  await finish(createMockAuthGateway().signIn(credentials))
  expect(await createMockAuthGateway().getSession()).toBe('authenticator-required')
  expect(JSON.parse(values.get(sessionKey) ?? 'null')).toMatchObject({
    session: 'authenticator-required', email: credentials.email, accounts: [{ email: credentials.email, enrolled: false }],
  })
  expect(values.get(sessionKey)).not.toContain(credentials.password)
})

test('does not claim success when saving the session or logout fails, and can retry', async () => {
  const { values, storage } = createStorage()
  const gateway = createMockAuthGateway(storage)
  storage.setItem.mockImplementationOnce(() => { throw new Error('Quota detail') })
  expect(await finish(gateway.signIn(credentials))).toMatchObject({ ok: false, code: 'storage' })
  expect(await createMockAuthGateway(storage).getSession()).toBe('anonymous')
  expect(await finish(gateway.signIn(credentials))).toEqual({ ok: true })

  await finish(verifySetup(gateway))
  await finish(gateway.setPassword(password))
  storage.setItem.mockImplementationOnce(() => { throw new Error('Storage detail') })
  expect(await finish(gateway.signOut())).toMatchObject({ ok: false, code: 'storage' })
  expect(await createMockAuthGateway(storage).getSession()).toBe('authenticated')
  expect(await finish(gateway.signOut())).toEqual({ ok: true })
  expect(JSON.parse(values.get(sessionKey) ?? 'null')).toMatchObject({ session: 'anonymous', email: null, accounts: [{ enrolled: true }] })
  expect(await createMockAuthGateway(storage).getSession()).toBe('anonymous')
})

test('fails session restoration when browser storage access is blocked instead of silently losing the session', async () => {
  vi.stubGlobal('window', { get sessionStorage() { throw new Error('Storage blocked') } })
  const gateway = createMockAuthGateway()
  await expect(gateway.getSession()).rejects.toThrow()
  expect(await finish(gateway.signIn(credentials))).toMatchObject({ ok: false, code: 'storage' })
})

test('rechecks shared storage before committing concurrent actions from different gateway instances', async () => {
  const { storage } = createStorage()
  const first = createMockAuthGateway(storage)
  const second = createMockAuthGateway(storage)
  const results = await finish(Promise.all([first.signIn(credentials), second.signIn(credentials)]))
  expect(results).toEqual([{ ok: true }, expect.objectContaining({ ok: false, code: 'session' })])
  expect(await first.getSession()).toBe('authenticator-required')
  expect(await second.getSession()).toBe('authenticator-required')
})

test('does not recreate a cleared session when an old request finishes', async () => {
  const { values, storage } = createStorage()
  const gateway = createMockAuthGateway(storage)
  await finish(gateway.signIn(credentials))
  await finish(verifySetup(gateway))
  const pending = createMockAuthGateway(storage).setPassword(password)
  values.delete(sessionKey)
  expect(await finish(pending)).toMatchObject({ ok: false, code: 'session' })
  expect(await createMockAuthGateway(storage).getSession()).toBe('anonymous')
  expect(values.has(sessionKey)).toBe(false)
})

test('requires a valid code for setup and repeat sign-in without repeating password setup', async () => {
  const { storage } = createStorage()
  const gateway = createMockAuthGateway(storage)
  await finish(gateway.signIn(credentials))
  const setup = await gateway.getAuthenticatorSetup()
  if (!setup.ok) throw new Error('Expected setup key')
  for (const code of ['', '12345', 'abcdef']) {
    expect(await finish(gateway.verifyAuthenticatorCode({ code }))).toMatchObject({ ok: false, code: 'incorrectCode' })
    expect(await gateway.getSession()).toBe('authenticator-required')
  }
  expect(await finish(verifySetup(gateway))).toEqual({ ok: true })
  expect(await gateway.getSession()).toBe('password-required')
  await finish(gateway.setPassword(password))
  await finish(gateway.signOut())
  const returning = createMockAuthGateway(storage)
  await finish(returning.signIn(credentials))
  expect(await returning.getSession()).toBe('two-factor-required')
  expect(await finish(returning.verifyAuthenticatorCode({ code: '12345' }))).toMatchObject({ ok: false, code: 'incorrectCode' })
  expect(await returning.getSession()).toBe('two-factor-required')
  expect(await finish(returning.setPassword(password))).toMatchObject({ ok: false, code: 'session' })
  vi.advanceTimersByTime(30000)
  expect(await finish(returning.verifyAuthenticatorCode({ code: await totpCode(setup.data.secret) }))).toEqual({ ok: true })
  expect(await returning.getSession()).toBe('authenticated')
})

test('clearing stored demo enrollment starts setup again in the same gateway', async () => {
  const { values, storage } = createStorage()
  const gateway = createMockAuthGateway(storage)
  for (const step of steps) await finish(step.run(gateway))
  values.delete(sessionKey)

  await finish(gateway.signIn(credentials))
  expect(await gateway.getSession()).toBe('authenticator-required')
})

test('a different email starts its own enrollment after another account signs out', async () => {
  const { storage } = createStorage()
  const gateway = createMockAuthGateway(storage)
  for (const step of steps) await finish(step.run(gateway))

  await finish(gateway.signIn({ ...credentials, email: 'another@example.test' }))
  expect(await gateway.getSession()).toBe('authenticator-required')
})

async function setupFor(gateway: AuthGateway) {
  const setup = await gateway.getAuthenticatorSetup()
  if (!setup.ok) throw new Error('Expected authenticator setup')
  return setup.data
}

test('restores the same key and URI, and exposes setup only during enrollment', async () => {
  const { storage } = createStorage()
  const gateway = createMockAuthGateway(storage)
  expect(await gateway.getAuthenticatorSetup()).toMatchObject({ ok: false, code: 'session' })
  await finish(gateway.signIn({ ...credentials, email: ' Partner@Example.Test ' }))
  const setup = await setupFor(gateway)
  expect(await setupFor(createMockAuthGateway(storage))).toEqual(setup)
  const uri = new URL(setup.uri)
  expect(uri.protocol).toBe('otpauth:')
  expect(uri.hostname).toBe('totp')
  expect(decodeURIComponent(uri.pathname)).toBe('/XPlace Partners:partner@example.test')
  expect(uri.searchParams.get('secret')).toBe(setup.secret)
  expect(uri.searchParams.get('issuer')).toBe('XPlace Partners')
  expect(uri.searchParams.get('period')).toBe('30')
  expect(uri.searchParams.get('digits')).toBe('6')
  await finish(verifySetup(gateway))
  expect(await gateway.getAuthenticatorSetup()).toMatchObject({ ok: false, code: 'session' })
})

test('keeps separate keys and completion for different emails and recognizes a normalized returning email', async () => {
  const { storage } = createStorage()
  const first = createMockAuthGateway(storage)
  await finish(first.signIn(credentials))
  const setup = await setupFor(first)
  await finish(verifySetup(first))
  await finish(first.setPassword(password))
  await finish(first.signOut())

  const second = createMockAuthGateway(storage)
  await finish(second.signIn({ ...credentials, email: 'second@example.test' }))
  expect(await second.getSession()).toBe('authenticator-required')
  expect((await setupFor(second)).secret).not.toBe(setup.secret)
  await finish(verifySetup(second))
  expect(await second.getSession()).toBe('password-required')
  await finish(second.setPassword(password))
  await finish(second.signOut())

  const returning = createMockAuthGateway(storage)
  await finish(returning.signIn({ ...credentials, email: ' PARTNER@EXAMPLE.TEST ' }))
  expect(await returning.getSession()).toBe('two-factor-required')
  vi.advanceTimersByTime(30000)
  expect(await finish(returning.verifyAuthenticatorCode({ code: await totpCode(setup.secret) }))).toEqual({ ok: true })
  expect(await returning.getSession()).toBe('authenticated')
})

test('rejects expired and reused codes without advancing, then accepts the next code', async () => {
  const { storage, values } = createStorage()
  const gateway = createMockAuthGateway(storage)
  await finish(gateway.signIn(credentials))
  values.set(sessionKey, JSON.stringify({
    session: 'authenticator-required', email: credentials.email,
    accounts: [{ email: credentials.email, secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', enrolled: false, lastUsedStep: null }],
  }))
  const setup = await setupFor(gateway)
  const firstCode = await totpCode(setup.secret)
  expect(await finish(gateway.verifyAuthenticatorCode({ code: await totpCode(setup.secret, Date.now() - 120000) })))
    .toMatchObject({ ok: false, code: 'incorrectCode' })
  expect(await gateway.getSession()).toBe('authenticator-required')
  await finish(gateway.verifyAuthenticatorCode({ code: firstCode }))
  await finish(gateway.setPassword(password))
  await finish(gateway.signOut())
  await finish(gateway.signIn(credentials))
  expect(await finish(gateway.verifyAuthenticatorCode({ code: firstCode }))).toMatchObject({ ok: false, code: 'usedCode' })
  expect(await gateway.getSession()).toBe('two-factor-required')
  vi.advanceTimersByTime(30000)
  expect(await finish(gateway.verifyAuthenticatorCode({ code: await totpCode(setup.secret) }))).toEqual({ ok: true })
})

test('does not resurrect an enrollment cleared while code verification was pending', async () => {
  const { storage, values } = createStorage()
  const gateway = createMockAuthGateway(storage)
  await finish(gateway.signIn(credentials))
  const setup = await setupFor(gateway)
  const pending = gateway.verifyAuthenticatorCode({ code: await totpCode(setup.secret) })
  values.delete(sessionKey)
  expect(await finish(pending)).toMatchObject({ ok: false, code: 'session' })
  expect(await gateway.getSession()).toBe('anonymous')
  expect(values.has(sessionKey)).toBe(false)
})

test.each(['signed-out', 'authenticated'])('starts fresh rather than assigning legacy %s enrollment to a new email', async (legacy) => {
  const { storage, values } = createStorage()
  values.set('partner-portal.mock-auth-session.v1', legacy)
  const gateway = createMockAuthGateway(storage)
  expect(await gateway.getSession()).toBe('anonymous')
  await finish(gateway.signIn(credentials))
  expect(await gateway.getSession()).toBe('authenticator-required')
})

test.each(['secret', 'email', 'enrolled', 'lastUsedStep', 'passwordSet'])('rejects corrupted stored account field %s', async (field) => {
  const { storage, values } = createStorage()
  const gateway = createMockAuthGateway(storage)
  await finish(gateway.signIn(credentials))
  const setup = await setupFor(gateway)
  values.set(sessionKey, JSON.stringify({
    session: 'authenticator-required', email: credentials.email,
    accounts: [{ email: credentials.email, secret: setup.secret, enrolled: false, lastUsedStep: null, [field]: 'invalid' }],
  }))
  expect(await gateway.getSession()).toBe('anonymous')
  expect(await gateway.getAuthenticatorSetup()).toMatchObject({ ok: false, code: 'session' })
})

test('publishes only the active email, restores it on reload and clears it on logout', async () => {
  const { storage } = createStorage()
  const onUserChanged = vi.fn()
  const gateway = createMockAuthGateway(storage, onUserChanged)
  expect(await gateway.getSession()).toBe('anonymous')
  expect(onUserChanged).toHaveBeenLastCalledWith(null)
  expect((await gateway.signIn({ email: '', password: '' })).ok).toBe(false)
  expect(onUserChanged).toHaveBeenCalledOnce()
  await finish(gateway.signIn(credentials))
  expect(onUserChanged).toHaveBeenLastCalledWith({ email: credentials.email })
  const restored = createMockAuthGateway(storage, onUserChanged)
  expect(await restored.getSession()).toBe('authenticator-required')
  expect(onUserChanged).toHaveBeenLastCalledWith({ email: credentials.email })
  await finish(verifySetup(restored))
  await finish(restored.setPassword(password))
  await finish(restored.signOut())
  expect(onUserChanged).toHaveBeenLastCalledWith(null)
  expect(JSON.stringify(onUserChanged.mock.calls)).not.toContain('secret')
})
