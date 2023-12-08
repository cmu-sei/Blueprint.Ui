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

// ===================== Load Test Data ======================
test('load blueprint test data', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.waitForTimeout(10 * 1000);
  // load base MSEL
  let [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    await page.getByRole('button', { name: 'Upload', exact: true }).click(),
    await page.getByRole('menuitem', { name: 'Upload json file' }).click()
  ]);
  await fileChooser.setFiles(extraConfig.downloadPath + testMselTemplate + '.json');
  await page.waitForTimeout(1 * 1000);
  // load integration MSEL
  [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    await page.getByRole('button', { name: 'Upload', exact: true }).click(),
    await page.getByRole('menuitem', { name: 'Upload json file' }).click()
  ]);
  await fileChooser.setFiles(extraConfig.downloadPath + testPushMsel + '.json');
  await page.waitForTimeout(1 * 1000);
  // load user MSEL
  [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    await page.getByRole('button', { name: 'Upload', exact: true }).click(),
    await page.getByRole('menuitem', { name: 'Upload json file' }).click()
  ]);
  await fileChooser.setFiles(extraConfig.downloadPath + testUserMsel + '.json');
  await page.waitForTimeout(1 * 1000);
  console.log(test.info().title + ' complete');
});
