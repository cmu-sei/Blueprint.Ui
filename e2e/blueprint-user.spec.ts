import { test, expect } from '@playwright/test';
const extraConfig = require('./settings.json');
const fs = require('fs');
// MSEL info for test MSEL
const testPushMsel = extraConfig.testPushMsel;
const testPushMselName = Date.now() + ' Test Push MSEL';
const testMselTemplate = extraConfig.testMselTemplate;
const testMselName =  Date.now() + ' Test MSEL';
const testMselDescription = testMselName + ' used for e2e and load testing';
let mselDownloadPath = extraConfig.downloadPath + testMselName + '.xlsx';
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

// ===================== Access All MSEL Tabs ======================
test('access all MSEL tabs', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);

  await page.waitForTimeout(5 * 1000);

  // Click on available MSEL
  await page.click('text=' + testMselTemplate);
  await page.waitForTimeout(5 * 1000);

  // Click on Blueprint Tab
  // Teams Tab
  await page.getByRole('button', { name: 'Teams', exact: true }).click();
  await page.waitForTimeout(2 * 1000);

  // Data Fields Tab
  await page.getByRole('button', { name: 'Data Fields' }).click();
  await page.waitForTimeout(2 * 1000);

  // Organizations Tab
  await page.getByRole('button', { name: 'Organizations' }).click();
  await page.waitForTimeout(2 * 1000);

  // Moves Tab
  await page.getByRole('button', { name: 'Moves' }).click();
  await page.waitForTimeout(2 * 1000);

  // Injects Tab
  await page.getByRole('button', { name: 'Events' }).click();
  await page.waitForTimeout(2 * 1000);

  // Exercise View Tab
  await page.getByRole('button', { name: 'Exercise View' }).click();
  await page.waitForTimeout(2 * 1000);

  // Info Tab
  await page.getByRole('button', { name: 'Info' }).click();
  await page.waitForTimeout(2 * 1000);

  // Return to Dashboard
  await page.getByRole('button', { name: 'Return to MSEL list' }).click();
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("' + testMselTemplate + '")');
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Add Page ======================
test('add page', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("' + testMselTemplate + '")');
  await page.waitForTimeout(5 * 1000);

  // Copy a MSEL
  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy ' + testMselTemplate + '"]');
  await page.waitForTimeout(1 * 1000);

  // Select MSEL
  await page.click('text=Copy of ' + testMselTemplate);

  // Edit MSEL Name
  await page.fill('text=Name', testMselName);

  // Edit Description Field
  await page.fill('text=Description', testMselDescription);
  await page.click('button:has(mat-icon.mdi-check)');

  // Add Page
  await page.click('text=Add Page');
  await page.fill('text=Page Name', 'test');
  await page.locator('#quill p').fill('test');
  await page.click('button:has(mat-icon.mdi-check)');

  // Return to dashboard
  await page.click('img[title="Home"]');

  // Delete MSEL
  // Delete created MSEL
  await page.click('// button[@title="Delete ' + testMselName + '"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testMselDescription, {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Add/Remove Team ======================
test('add delete teams', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("' + testMselTemplate + '")');
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

  // Edit Teams Add a Team to the MSEL
  await page.getByRole('button', { name: 'Teams', exact: true }).click();
  await page.click('text=Add a Team');
  await page.waitForTimeout(1 * 1000);
  await page.locator('text=FRB - Federal Reserve Board >> button').click();
  await page.waitForTimeout(1 * 1000);

  // Remove Team from MSEL
  const panelElement = await page.locator('mat-expansion-panel:has(:text("FRB - Federal Reserve Board"))');
  await panelElement.locator('button[title="Remove team from MSEL"]').click();

  // return to dashboard
  await page.click('img[title="Home"]');

  // Delete MSEL
  // Delete created MSEL
  await page.click('// button[@title="Delete ' + testMselName + '"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testMselDescription, {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Add/Remove Data Field ======================
test('add delete data fields', async ({ page }) => {
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

  // Add Data Fields
  await page.getByRole('button', { name: 'Data Fields', exact: true }).click();
  await page.getByRole('button', { name: 'Add new data field', exact: true }).click();
  await page.getByLabel('Display Order').press('Tab');
  await page.getByLabel('Name').fill('Group');
  await page.getByLabel('Name').press('Tab');
  await page.getByLabel('Data Type').getByText('Data Type').click();
  await page.getByRole('option', { name: 'Integer' }).locator('span').click();
  await page.getByLabel('Column Metadata (Width)').click();
  await page.click('text=Save');
  await page.waitForTimeout(2 * 1000);

  // // Remove Data Field
  // await page.getByRole('button', { name: 'Delete Group', exact: true }).click();
  // await page.click('text=Yes');

  // return to dashboard
  await page.click('img[title="Home"]');

  // Delete MSEL
  // Delete created MSEL
  await page.click('// button[@title="Delete ' + testMselName + '"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testMselDescription, {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Add/Remove Organization from Template ======================
test('add delete template organization', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy ' + testMselTemplate + '"]');

  // Select the new copy
  await page.click('text= Copy of ' + testMselTemplate);

  // Edit MSEL Name
  await page.fill('text=Name', testMselName);

  // Edit Description Field
  await page.fill('text=Description', testMselDescription);
  await page.click('button:has(mat-icon.mdi-check)');

  // Change to organization's tab
  await page.getByRole('button', { name: 'Organizations' }).click();

  // Click on the Show Templates checkbox
  await page.locator('.mat-checkbox-inner-container').click();

  // Select organization template
  await page.locator('button:has(mat-icon.mdi-bank-plus)').nth(1).click();

  // Edit organization template fields
  await page.locator('text=Name (required)').nth(0).fill(extraConfig.orgName);
  await page.locator('text=Short Name (required)').fill(extraConfig.orgShortName);
  await page.locator('text=Summary (required)').fill(extraConfig.orgSummary);
  await page.locator('text=Email').fill(extraConfig.orgEmail);
  await page.locator('#quill p').fill(extraConfig.orgDescription);
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(5 * 1000);

  // Verify card creation
  await page.locator('text=' + extraConfig.orgName);

  // Delete new organization template
  const orgDeleteButton = await page
    .locator('text=' + extraConfig.orgName + extraConfig.orgShortName + ' ' + extraConfig.orgSummary + ' >> button')
    .nth(2);
  if (orgDeleteButton) {
    await orgDeleteButton.click({force: true});
    await page.click('button:has-text("Yes")');
  } else {
    console.log('Page does not have specified organization template.');
  }

  // Verify gone
  try {
    await page.waitForSelector('text=' + extraConfig.orgName, { timeout: 500});
  } catch (error) {
    console.log('Organization template specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);

  // return to dashboard
  await page.click('img[title="Home"]');

  // Delete MSEL
  // Delete created MSEL
  await page.click('// button[@title="Delete ' + testMselName + '"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testMselDescription, {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Add/Remove Organization ======================
test('add delete organizations', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);

  await page.locator(':has-text("Standard MSEL"');
  await page.waitForTimeout(1 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy ' + testMselTemplate + '"]');

  // Select the new copy
  await page.click('text= Copy of ' + testMselTemplate);

  // Edit MSEL Name
  await page.fill('text=Name', testMselName);

  // Edit Description Field
  await page.fill('text=Description', testMselDescription);
  await page.click('button:has(mat-icon.mdi-check)');

  // Go to Organizations tab
  await page.getByRole('button', { name: 'Organizations' }).click();

  // Click on Add Organization Button
  await page.click('button:has(mat-icon.mdi-bank-plus)');

  // Fill Organization fields
  await page.fill('text=Name', extraConfig.orgName);
  await page.fill('text=Short Name (required)', extraConfig.orgShortName);
  await page.fill('text=Summary (required)', extraConfig.orgSummary);
  await page.fill('#quill p', extraConfig.orgDescription);
  await page.click('button:has-text("Save")');

  // timeout
  await page.waitForTimeout(5 * 1000);

  // check creation status
  await page.locator('text=' + extraConfig.orgName);

  // cleanup process
  const orgDeleteButton = await page
    .locator('text=' + extraConfig.orgName + extraConfig.orgShortName + ' ' + extraConfig.orgSummary + ' >> button')
    .nth(2);
  if (orgDeleteButton){
    await orgDeleteButton.click();
    await page.click('button:has-text("Yes")');
  } else {
    console.log('Page does not have specified organization.');
  }

  await page.waitForTimeout(5 * 1000);

  // verify gone
  try {
    await page.waitForSelector('text=' + extraConfig.orgName, { timeout: 500 });
  } catch (error) {
    console.log('Organization specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);

  // return to dashboard
  await page.click('img[title="Home"]');

  // Delete MSEL
  // Delete created MSEL
  await page.click('// button[@title="Delete ' + testMselName + '"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testMselDescription, {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Add/Remove Move ======================
test('add delete move', async ({ page }) => {
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

  // Moves section
  await page.getByRole('button', { name: 'Moves' }).click();
  await page.click('button:has(mat-icon.mdi-plus-circle-outline)');
  await page.locator('text=Title').nth(1).fill('Playwright Move');
  await page.fill('text=Move Description', 'Move created with test');
  await page.click('button:has-text("Save")');

  // Delete Move
  const moveDeleteButton = 'mat-expansion-panel-header:has-text("Playwright Move") button[title="Delete this move"]';
  if (moveDeleteButton){
    await page.click(moveDeleteButton, {force: true});
    await page.click('button:has-text("Yes")');
  } else {
    console.log('Page does not have specified move.');
  }
  await page.waitForTimeout(5 * 1000);

  // return to dashboard
  await page.click('img[title="Home"]');

  // Delete MSEL
  // Delete created MSEL
  await page.click('// button[@title="Delete ' + testMselName + '"]');
  await page.click('button:has-text("Yes")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testMselDescription, {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Add/Remove Gallery Cards ======================
test('add delete gallery card', async ({ page }) => {
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

  // Add Gallery Card
  await page.getByRole('button', { name: 'Gallery Cards' }).click();
  await page.click('button:has(mat-icon.mdi-plus-circle-outline)');
  await page.locator('text=Name').nth(1).fill('Playwright Card');
  await page.fill('text=Card Description', 'Playwright Test');
  await page.locator('mat-select[role="combobox"] >> text=Move').click();
  await page.locator('text=0 - setup').click();
  await page.click('text=Save');

  // Delete Gallery Card
  const cardDeleteButton = 'mat-expansion-panel-header:has-text("Playwright Card") button[title="Delete this card"]';
  if (cardDeleteButton){
    await page.click(cardDeleteButton, {force: true});
    await page.click('button:has-text("Yes")');
  } else {
    console.log('Page does not have specified Gallery Card.');
  }
  await page.waitForTimeout(5 * 1000);

  // return to dashboard
  await page.click('img[title="Home"]');

  // Delete MSEL
  // Delete created MSEL
  await page.click('// button[@title="Delete ' + testMselName + '"]');
  await page.click('button:has-text("Yes")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testMselDescription, {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Add/Remove CITE Actions======================
test('add delete cite action', async ({ page }) => {
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

  // Add Cite Action
  await page.getByRole('button', { name: 'Cite Actions' }).click();
  await page.click('button:has(mat-icon.mdi-plus-circle-outline)');
  await page.locator('mat-select[role="combobox"] >> text=Move').click();
  await page.locator('text=0 - setup').click();
  await page.locator('mat-select[role="combobox"] >> text=Team').nth(1).click();
  await page.locator('text=Test Users').click();
  await page.locator('text=Display Order').nth(1).fill('1');
  await page.locator('text=Description').nth(1).fill('Playwright CITE Action');
  await page.click('text=Save');

  // Delete CITE Action
  const actionDeleteButton = 'mat-expansion-panel-header:has-text("Playwright CITE Action") button[title="Delete this citeAction"]';
  if (actionDeleteButton){
    await page.click(actionDeleteButton, {force: true});
    await page.click('button:has-text("Yes")');
  } else {
    console.log('Page does not have specified CITE Action.');
  }
  await page.waitForTimeout(5 * 1000);

  // return to dashboard
  await page.click('img[title="Home"]');

  // Delete MSEL
  // Delete created MSEL
  await page.click('// button[@title="Delete ' + testMselName + '"]');
  await page.click('button:has-text("Yes")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testMselDescription, {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Add/Remove CITE Roles======================
test('add delete cite role', async ({ page }) => {
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

  // Add CITE Role
  await page.getByRole('button', { name: 'Cite Roles' }).click();
  await page.click('button:has(mat-icon.mdi-plus-circle-outline)');
  await page.locator('text=Name').nth(1).fill('Playwright CITE Role');
  await page.locator('mat-select[role="combobox"] >> text=Team').nth(1).click();
  await page.locator('text=Test Users').click();
  await page.click('text=Save');

  // Delete CITE Role
  const roleDeleteButton = 'mat-expansion-panel-header:has-text("Playwright CITE Role") button[title="Delete this citeRole"]';
  if (roleDeleteButton){
    await page.click(roleDeleteButton, {force: true});
    await page.click('button:has-text("Yes")');
  } else {
    console.log('Page does not have specified CITE Role.');
  }
  await page.waitForTimeout(5 * 1000);

  // return to dashboard
  await page.click('img[title="Home"]');

  // Delete MSEL
  // Delete created MSEL
  await page.click('// button[@title="Delete ' + testMselName + '"]');
  await page.click('button:has-text("Yes")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testMselDescription, {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Add/Remove Injects ======================
test('add delete injects', async ({ page }) => {
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

  // Add Inject
  await page.getByRole('button', { name: 'Events' }).click();
  await page.waitForTimeout(1 * 1000);
  await page.click('button:has(mat-icon.mdi-plus-circle-outline)');
  await page.getByRole('tab', { name: 'Additional' }).click();
  await page.fill('text=Order', '1');
  await page.getByRole('tab', { name: 'Default' }).click();
  await page.fill('text=Message', 'I hope you enjoy the event!');
  await page.locator('mat-select[role="combobox"] >> text=Status').click();
  await page.locator('text=Approved').click();
  await page.fill('text="Inject Mode"', 'ala mode');
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(1 * 1000);

  // Delete inject
  await page.locator('button[title="Delete this inject"]').first().click();
  await page.click('text=Yes');

  // Return to Dashboard
  await page.click('img[title="Home"]');
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator('text=' + testMselTemplate);
  await page.waitForTimeout(1 * 1000);

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

  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Copy/Delete MSEL ======================
test('copy delete MSEL', async ({ page }) => {
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

  await page.waitForTimeout(5 * 1000);
  console.log(test.info().title + ' complete');
});

// ===================== Download a MSEL ======================
test('download MSEL', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.waitForTimeout(5 * 1000);

  // Download MSEL
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    await page.getByRole('button', { name: 'Download .xlsx file from ' + testMselTemplate }).click()
  ]);

  // branch for local vs environment
  if (extraConfig.downloadPath) {
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

// ===================== Upload a MSEL ======================
test('upload MSEL', async ({ page }) => {
  console.log(test.info().title + ' started');
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.waitForTimeout(1 * 1000);

  // Upload MSEL
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('button:has-text("Upload")').click()
  ]);

  // Be sure to change the file path to your own
  const filePath = extraConfig.pathToTestFile;
  await fileChooser.setFiles(filePath);
  await page.waitForTimeout(1 * 1000);

  // Verify File was Uploaded
  const path = require('path');
  const uploadMSELName = path.basename(filePath);
  await page.locator(uploadMSELName);
  await page.waitForTimeout(1 * 1000);

  // /Select the new copy
  await page.click('text=PlaywrightMSEL');

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
  await page.click('button:has-text("Push to Gallery")');
  await page.click('text=Yes');
  await page.waitForTimeout(5 * 1000);
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
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + testPushMselName, {timeout: 500});
  } catch (error) {
    console.log('Test Push MSEL has been removed.');
  }

  await page.waitForTimeout(5 * 1000);
});