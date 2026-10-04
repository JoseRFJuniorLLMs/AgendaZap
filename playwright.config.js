import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './ui-test',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8793/AgendaZap/',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node ui-test/server.js',
    url: 'http://127.0.0.1:8793/AgendaZap/',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
