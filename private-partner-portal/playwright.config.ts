import { defineConfig, devices } from '@playwright/test'

const port = 5173
const isCI = !!process.env.CI
const mobileTags = /@both|@mobile-only/

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? [['list'], ['junit', { outputFile: 'e2e-junit.xml' }], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: '**/*.setup.ts' },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@mobile-only/,
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      grep: mobileTags,
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 15'] },
      grep: mobileTags,
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: `pnpm dev --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
