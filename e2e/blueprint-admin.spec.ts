/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { test, expect } from '@playwright/test';
const extraConfig = require('./settings.json');
const fs = require('fs');

// pull proxy from settings file
if (extraConfig.proxySettings.port) {
  test.use({proxy: {server: 'http:// ' + extraConfig.proxySettings.host + ':' + extraConfig.proxySettings.port}});
}

// ===================== ADMIN Add User ======================
test('add users', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("Standard MSEL")');
  await page.waitForTimeout(5 * 1000);

  // Access admin settings
  await page.click('button:has(mat-icon.mdi-cog-outline)');
  await page.click('text=Users');

  // add users
  await page.click('button:has(mat-icon.mdi-plus-circle)');
  await page.locator('#mat-input-2').type(extraConfig.adminNewUserID);
  await page.locator('#mat-input-3').type(extraConfig.adminNewUser);
  await page.waitForTimeout(5 * 1000);
  await page.locator('button:has(mat-icon.mdi-account-plus)').dblclick({force: true});
  await page.waitForTimeout(5 * 1000);

  // delete user
  const deleteButton = await page.locator(`text = ${extraConfig.adminNewUser} >> button >> nth=1`);
  if (deleteButton){
    await deleteButton.click({force: true});
    await page.click('button:has-text("Yes")');
    await page.waitForTimeout(5 * 1000);
  } else {
    console.log('Page does not have specified user.');
  }

});

// ===================== ADMIN Add Team ======================
test('add teams', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("Standard MSEL")');
  await page.waitForTimeout(5 * 1000);

  // Access admin settings
  await page.click('button:has(mat-icon.mdi-cog-outline)');
  await page.click('text=Teams');

  // add team
  await page.click('button:has(mat-icon.mdi-plus-circle)');
  await page.fill('text=Name (required)', extraConfig.blueprintTeam);
  await page.fill('text=Short Name (required)', extraConfig.blueprintShortName);
  await page.click('button:has-text("Save")');

  // search team
  await page.fill('text=Search', 'plw');
  await page.keyboard.press('Enter');

  // add users to the team
  await page.click(`mat-expansion-panel-header:has-text('${extraConfig.blueprintShortName}')`);
  await page.getByRole('row', { name: 'Bob Add User' }).getByRole('button').click();

  // delete team
  const deleteButton = await page.locator(`text = ${extraConfig.blueprintShortName} >> button >> nth=1`);
  if (deleteButton){
    await deleteButton.click({force: true});
    await page.click('button:has-text("Yes")');
    await page.waitForTimeout(5 * 1000);
  } else {
    console.log('Page does not have specified team.');
  }
});
