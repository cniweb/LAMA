/// <reference types="node" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const workerDir = path.join(repoRoot, 'worker');

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:8787',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Serve the built frontend + worker API (inkl. WebSockets) via wrangler dev.
    // Voraussetzung: `npm run build` wurde zuvor ausgeführt (frontend/dist).
    command: 'npx wrangler dev --port 8787',
    cwd: workerDir,
    url: 'http://127.0.0.1:8787/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
