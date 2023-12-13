/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

// login.setup.ts
import { test as setup, expect } from '@playwright/test';
import { USER_STORAGE_STATE } from '../playwright.config';
const extraConfig = require('./settings.json');

setup('do login', async ({ page }) => {
  await page.goto('http://localhost:5000');
  await expect(page).toHaveTitle(/Identity | OpenID Connect/);
  await page.locator('text=Login').click();
  await page.locator('text=Continue').click();
  await page.fill('input[name="Username"]', extraConfig.testMselOwnerEmail);
  await page.fill('input[name="Password"]', extraConfig.testMselOwnerPassword);
  await page.click('text=Continue');
  await page.context().storageState({ path: USER_STORAGE_STATE });
});
