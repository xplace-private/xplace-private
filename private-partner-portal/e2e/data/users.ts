export interface TestUser {
  email: string
  password: string
}

/** The mock gateway accepts any valid email; the password satisfies the password policy. */
export const TEST_USER: TestUser = {
  email: 'partner@example.test',
  password: 'Partner1!',
}

/** The only authenticator code accepted by the mock auth gateway. */
export const MOCK_CODE = '123456'
