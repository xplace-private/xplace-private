import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const DEPLOYED_MODES = new Set(['dev', 'staging', 'production'])

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const uploadSourceMaps =
    command === 'build' && Boolean(process.env.SENTRY_AUTH_TOKEN)

  if (DEPLOYED_MODES.has(mode) && !env.VITE_API_BASE_URL?.trim()) {
    throw new Error(`VITE_API_BASE_URL is required for mode "${mode}"`)
  }

  return {
    build: { sourcemap: uploadSourceMaps ? 'hidden' : false },
    ...(mode === 'development'
      ? {
          server: {
            proxy: {
              '/partner/portal/v1': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                headers: { Origin: 'https://back.x.place' },
              },
              '/api/v2': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                headers: { Origin: 'https://back.x.place' },
                rewrite: (path: string) => path,
              },
              '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                headers: { Origin: 'https://back.x.place' },
                rewrite: (path: string) => path.replace(/^\/api/, '/api/v1'),
              },
            },
          },
        }
      : {}),
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: './src/app/routes',
        generatedRouteTree: './src/app/routeTree.gen.ts',
      }),
      react(),
      tailwindcss(),
      ...(command === 'build'
        ? [
            sentryVitePlugin({
              org: 'xplace',
              project: 'x-place-private-partner',
              telemetry: false,
              release: {
                create: uploadSourceMaps,
                finalize: uploadSourceMaps,
              },
              sourcemaps: {
                disable: !uploadSourceMaps,
                assets: './dist/**',
                filesToDeleteAfterUpload: './dist/**/*.map',
              },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
