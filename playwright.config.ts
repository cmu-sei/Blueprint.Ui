/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { defineConfig } from '@playwright/test';
import path from 'path';

export const ADMIN_STORAGE_STATE = path.join(__dirname, 'e2e/.auth/admin.json');
export const USER_STORAGE_STATE = path.join(__dirname, 'e2e/.auth/user.json');
export const CONTENT_DEV_STORAGE_STATE = path.join(__dirname, 'e2e/.auth/contentdev.json');

export default defineConfig({
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: 'http://localhost:4725/',
    // run traces on the first retry of a failed test
    trace: 'on-first-retry',
  },
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html', {outputFolder: 'test-reporter'}]],
  /* Set timeout for a test in millisecands */
  timeout: 90000,
  /* Configure projects based on user permissions */
  projects: [
    {
      name: 'adminsetup',
      testMatch: 'admin.login.setup.ts',
    },
    {
      name: 'contentdevsetup',
      testMatch: 'contentdev.login.setup.ts',
    },
    {
      name: 'usersetup',
      testMatch: 'login.setup.ts',
    },
    {
      name: 'load test data',
      testMatch: 'blueprint-load-test-data.spec.ts',
      dependencies: ['adminsetup'],
      use: {
        storageState: ADMIN_STORAGE_STATE,
      },
    },
    {
      name: 'clear test data',
      testMatch: 'blueprint-clear-test-data.spec.ts',
      dependencies: ['adminsetup'],
      use: {
        storageState: ADMIN_STORAGE_STATE,
      },
    },
    {
      name: 'user tests',
      testMatch: 'blueprint-user.spec.ts',
      dependencies: ['usersetup'],
      use: {
        storageState: USER_STORAGE_STATE,
      },
    },
    {
      name: 'content dev tests',
      testMatch: 'blueprint-contentdev.spec.ts',
      dependencies: ['contentdevsetup'],
      use: {
        storageState: CONTENT_DEV_STORAGE_STATE,
      },
    },
    {
      name: 'admin tests',
      testMatch: /blueprint-admin.spec\.ts/,
      dependencies: ['adminsetup'],
      use: {
        storageState: ADMIN_STORAGE_STATE,
      },
    },
  ]
});
