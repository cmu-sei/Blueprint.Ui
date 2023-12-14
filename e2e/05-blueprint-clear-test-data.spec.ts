/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { test, expect } from '@playwright/test';
const extraConfig = require('./settings.json');
const fs = require('fs');
// MSEL info for test MSEL
const testMselTemplate = extraConfig.testMselTemplate;
const testPushMsel = extraConfig.testPushMsel;
const testUserMsel = extraConfig.testUserMsel;

// pull proxy from settings file
if (extraConfig.proxySettings.port) {
  test.use({proxy: {server: 'http:// ' + extraConfig.proxySettings.host + ':' + extraConfig.proxySettings.port}});
}

// ===================== Clear Test Data ======================
test('clear blueprint test data', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.waitForTimeout(10 * 1000);
  // Delete base MSEL
  await page.click('// button[@title="Delete ' + testMselTemplate + '"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testMselTemplate, {timeout: 500});
  } catch (error) {
    console.log('Specified MSEL has been removed.');
  }

  // Delete integration MSEL
  await page.click('// button[@title="Delete ' + testPushMsel + '"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testPushMsel, {timeout: 500});
  } catch (error) {
    console.log('Specified MSEL has been removed.');
  }

  // Delete user MSEL
  await page.click('// button[@title="Delete ' + testUserMsel + '"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testUserMsel, {timeout: 500});
  } catch (error) {
    console.log('Specified MSEL has been removed.');
  }

  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');

});
