/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { test, expect } from '@playwright/test';
const extraConfig = require('./settings.json');
const fs = require('fs');
// MSEL info for test MSEL
const testPushMsel = extraConfig.testPushMsel;
const testPushMselName = Date.now() + ' Test Push MSEL';
const testMselTemplate = extraConfig.testMselTemplate;
const testMselName =  Date.now() + ' Test MSEL';
const testMselDescription = testMselName + ' used for e2e and load testing';
let mselDownloadPath = extraConfig.dataPath + testMselName + '.xlsx';
const temporaryTestMsel = 'Temporary Test MSEL (delete me)';
console.log('Using ' + testMselTemplate + ' as the base MSEL for testing.');

// pull proxy from settings file
if (extraConfig.proxySettings.port) {
  test.use({proxy: {server: 'http:// ' + extraConfig.proxySettings.host + ':' + extraConfig.proxySettings.port}});
}

// ===================== Blueprint Access Check ======================
test('access check blueprint', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);

  await page.locator(':has-text("' + testMselTemplate + '")');

  await page.waitForTimeout(10 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Copy and Delete a MSEL ======================
test('copy MSEL', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("Standard MSEL")');
  await page.waitForTimeout(5 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy ' + testMselTemplate + '"]');

  // Select the new copy
  await page.click('text= Copy of ' + testMselTemplate);

  // Edit MSEL Name
  await page.fill('text=Name', testMselName);

  // Edit Description Field
  await page.fill('text=Description', testMselDescription);
  await page.click('button:has(mat-icon.mdi-check)');

  // Return to Dashboard
  await page.click('img[title="Home"]');

  // Delete created MSEL
  await page.click('// button[@title="Delete ' + testMselName + '"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testMselName, {timeout: 500});
  } catch (error) {
    console.log('Specified MSEL has been removed.');
  }

  console.log(test.info().title + ' complete');
});

// ===================== Download a xlsx file ======================
test('download MSEL xlsx file', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.waitForTimeout(5 * 1000);

  // Download MSEL
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    await page.getByRole('button', { name: 'Download ' + testMselTemplate, exact: true }).click(),
    await page.getByRole('menuitem', { name: 'Download xlsx file' }).click()
  ]);

  // branch for local vs environment
  if (extraConfig.dataPath) {
    await download.saveAs(mselDownloadPath);
    console.log('file downloaded as ' + mselDownloadPath);
  } else {
    mselDownloadPath = await download.path();
    console.log('file downloaded as ' + mselDownloadPath);
  }
  // check for download failure
  if (await download.failure()) {
    console.log(await download.failure());
  }
  console.log(await download.suggestedFilename());
  // Read file stats
  fs.stat(mselDownloadPath, (err, stats) => {
    if (err) {
      console.log('File does not exist.');
    } else {
      console.log('file size is ' + stats.size);
      fs.unlink(mselDownloadPath, () => {});
    }
  });
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Download a json file ======================
test('download MSEL json file', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.waitForTimeout(5 * 1000);

  // Download json file
  mselDownloadPath = extraConfig.dataPath + testMselName + '.json';
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    await page.getByRole('button', { name: 'Download ' + testMselTemplate, exact: true }).click(),
    await page.getByRole('menuitem', { name: 'Download json file' }).click()
  ]);

  // branch for local vs environment
  if (extraConfig.dataPath) {
    await download.saveAs(mselDownloadPath);
    console.log('file downloaded as ' + mselDownloadPath);
  } else {
    mselDownloadPath = await download.path();
    console.log('file downloaded as ' + mselDownloadPath);
  }
  // check for download failure
  if (await download.failure()) {
    console.log(await download.failure());
  }
  console.log(await download.suggestedFilename());
  // Read file stats
  fs.stat(mselDownloadPath, (err, stats) => {
    if (err) {
      console.log('File does not exist.');
    } else {
      console.log('file size is ' + stats.size);
      fs.unlink(mselDownloadPath, () => {});
    }
  });
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Upload a new MSEL from xlsx ======================
test('upload MSEL', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.waitForTimeout(1 * 1000);

  // Upload MSEL
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('button:has-text("Upload")').click(),
    await page.getByRole('menuitem', { name: 'Upload xlsx file' }).click()
  ]);

  // Be sure to change the file path to your own
  const filePath = extraConfig.dataPath + extraConfig.xlsxTestFile;
  await fileChooser.setFiles(filePath);
  await page.waitForTimeout(5 * 1000);

  // Verify File was Uploaded
  const path = require('path');
  const uploadMSELName = path.basename(filePath);
  await page.locator(uploadMSELName);
  await page.waitForTimeout(1 * 1000);

  // /Select the new copy
  await page.click('text=PlaywrightMSEL');

  // Edit MSEL Name
  await page.fill('text=Name', temporaryTestMsel);

  // Edit Description Field
  await page.fill('text=Description', temporaryTestMsel);
  await page.click('button:has(mat-icon.mdi-check)');

  // Return to Dashboard
  await page.click('img[title="Home"]');

});

// ===================== Replace and Delete MSEL ======================
test('replace and delete MSEL', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.waitForTimeout(1 * 1000);

  // Upload MSEL
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Upload .xlsx file to ' + temporaryTestMsel, exact: true }).click(),
  ]);

  // Be sure to change the file path to your own
  const filePath = extraConfig.dataPath + extraConfig.xlsxTestFile;
  await fileChooser.setFiles(filePath);
  await page.waitForTimeout(5 * 1000);

  // Delete created MSEL
  await page.click('// button[@title="Delete ' + temporaryTestMsel + '"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + temporaryTestMsel, {timeout: 500});
  } catch (error) {
    console.log('Specified MSEL has been removed.');
  }

  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Push Gallery CITE ======================
test('push gallery cite', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("' + testPushMsel + '")');
  await page.waitForTimeout(5 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy ' + testPushMsel + '"]');

  // Select the new copy
  await page.click('text= Copy of ' + testPushMsel);

  // Edit MSEL Name
  await page.fill('text=Name', testPushMselName);

  // Edit Description Field
  await page.fill('text=Description', testPushMselName);
  await page.click('button:has(mat-icon.mdi-check)');

  // Push to CITE & Gallery
  await page.getByRole('button', { name: 'Info' }).click();
  await expect(page.getByRole('button', { 'name': 'Push to Gallery'})).toBeEnabled();
  await page.click('button:has-text("Push to Gallery")');
  await page.click('text=Yes');
  await page.waitForTimeout(5 * 1000);
  await expect(page.getByRole('button', { 'name': 'Push to CITE'})).toBeEnabled();
  await page.click('button:has-text("Push to CITE")');
  await page.click('text=Yes');
  await page.waitForTimeout(5 * 1000);

  // Delete from CITE & Gallery
  await page.click('text=Remove from Gallery');
  await page.click('text=Yes');
  await page.click('text=Remove from CITE');
  await page.click('text=Yes');

  // Return to Dashboard
  await page.getByRole('button', { name: 'Return to MSEL list' }).click();
  await expect(page).toHaveTitle(/Blueprint/);

  // Delete created MSEL
  await page.click('// button[@title="Delete ' + testPushMselName + '"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(5 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testPushMselName, {timeout: 500});
  } catch (error) {
    console.log('Test Push MSEL has been removed.');
  }

  await page.waitForTimeout(5 * 1000);
});
