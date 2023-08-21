// login.setup.ts
import { test as setup, expect } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from '../playwright.config';

setup('do login', async ({ page }) => {
  await page.goto('http://localhost:5000');
  await expect(page).toHaveTitle(/Identity | OpenID Connect/);
  await page.locator('text=Login').click();
  await page.locator('text=Continue').click();
  await page.fill('input[name="Username"]', 'admin@this.ws');
  await page.fill('input[name="Password"]', '321ChangeMe!');
  await page.click('text=Continue');
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
