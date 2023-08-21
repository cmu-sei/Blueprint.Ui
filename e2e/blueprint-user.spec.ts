import { test, expect } from '@playwright/test';
const extraConfig = require('./settings.json');
const fs = require('fs');

// pull proxy from settings file
if (extraConfig.proxySettings.port) {
  test.use({proxy: {server: 'http:// ' + extraConfig.proxySettings.host + ':' + extraConfig.proxySettings.port}});
}

// ===================== Blueprint Access Check ======================
test('access check blueprint', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);

  await page.locator(':has-text("HSEEP")');

  await page.waitForTimeout(10 * 1000);
});

// ===================== Access All MSEL Tabs ======================
test('access all MSEL tabs', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);

  await page.waitForTimeout(5 * 1000);

  // Click on available MSEL
  await page.click('text=HSEEP');
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
  await page.locator(':has-text("HSEEP")');
  await page.waitForTimeout(5 * 1000);

});

// ===================== Add Page ======================
test('add page', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("HSEEP")');
  await page.waitForTimeout(5 * 1000);

  // Copy a MSEL
  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');
  await page.waitForTimeout(1 * 1000);

  // Select MSEL
  await page.click('text=Copy of HSEEP');

  // Edit MSEL Name
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
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
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=Playwright Test MSEL', {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
});

// ===================== Add/Remove Team ======================
test('add delete teams', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("HSEEP")');
  await page.waitForTimeout(5 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');

  // Select the new copy
  await page.click('text= Copy of HSEEP');

  // Edit MSEL Name
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
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
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=Playwright Test MSEL', {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
});

// ===================== Add/Remove Data Field ======================
test('add delete data fields', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("Standard MSEL")');
  await page.waitForTimeout(5 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');

  // Select the new copy
  await page.click('text= Copy of HSEEP');

  // Edit MSEL Name
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
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

  // Remove Data Field
  await page.getByRole('button', { name: 'Delete Group', exact: true }).click();
  await page.click('text=Yes');

  // return to dashboard
  await page.click('img[title="Home"]');

  // Delete MSEL
  // Delete created MSEL
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=Playwright Test MSEL', {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
});

// ===================== Add/Remove Organization from Template ======================
test('add delete template organization', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');

  // Select the new copy
  await page.click('text= Copy of HSEEP');

  // Edit MSEL Name
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
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
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=Playwright Test MSEL', {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);
});

// ===================== Add/Remove Organization ======================

test('add delete organizations', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);

  await page.locator(':has-text("Standard MSEL"');
  await page.waitForTimeout(1 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');

  // Select the new copy
  await page.click('text= Copy of HSEEP');

  // Edit MSEL Name
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
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
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=Playwright Test MSEL', {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);

});

// ===================== Add/Remove Move ======================
test('add delete move', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("Standard MSEL")');
  await page.waitForTimeout(5 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');

  // Select the new copy
  await page.click('text= Copy of HSEEP');

  // Edit MSEL Name
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
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
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("Yes")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=Playwright Test MSEL', {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);


});

// ===================== Add/Remove Gallery Cards ======================
test('add delete gallery card', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("Standard MSEL")');
  await page.waitForTimeout(5 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');

  // Select the new copy
  await page.click('text= Copy of HSEEP');

  // Edit MSEL Name
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
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
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("Yes")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=Playwright Test MSEL', {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);

});

// ===================== Add/Remove CITE Actions======================
test('add delete cite action', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("Standard MSEL")');
  await page.waitForTimeout(5 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');

  // Select the new copy
  await page.click('text= Copy of HSEEP');

  // Edit MSEL Name
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
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
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("Yes")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=Playwright Test MSEL', {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);

});

// ===================== Add/Remove CITE Roles======================
test('add delete cite role', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("Standard MSEL")');
  await page.waitForTimeout(5 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');

  // Select the new copy
  await page.click('text= Copy of HSEEP');

  // Edit MSEL Name
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
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
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("Yes")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=Playwright Test MSEL', {timeout: 500});
  } catch (error) {
    console.log('MSEL specified has been removed.');
  }
  await page.waitForTimeout(5 * 1000);

});

// ===================== Add/Remove Injects ======================
test('add delete injects', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("Standard MSEL")');
  await page.waitForTimeout(5 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');


  // Select the new copy
  await page.click('text= Copy of HSEEP');

  // Edit MSEL Name
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
  await page.click('button:has(mat-icon.mdi-check)');

  // Add Inject
  await page.getByRole('button', { name: 'Events' }).click();
  await page.waitForTimeout(1 * 1000);
  await page.click('button:has(mat-icon.mdi-plus-circle-outline)');
  await page.fill('text=Order', '1');
  await page.locator('text=Control Number').nth(1).fill('ADMIN-1');
  await page.locator('mat-select[role="combobox"] >> text=Status').click();
  await page.locator('text=Approved').click();
  await page.locator('quill-editor div').nth(2).fill('Test inject');
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(1 * 1000);

  // Delete inject
  await page.locator('button[title="Delete this inject"]').first().click();
  await page.click('text=Yes');

  // Return to Dashboard
  await page.click('img[title="Home"]');
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator('text= HSEEP');
  await page.waitForTimeout(1 * 1000);

  // Delete created MSEL
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + extraConfig.MSELName, {timeout: 500});
  } catch (error) {
    console.log('Specified MSEL has been removed.');
  }

  await page.waitForTimeout(5 * 1000);
});

// ===================== Copy/Delete MSEL ======================
test('copy delete MSEL', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("Standard MSEL")');
  await page.waitForTimeout(5 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');

  // Select the new copy
  await page.click('text= Copy of HSEEP');

  // Edit MSEL Name
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
  await page.click('button:has(mat-icon.mdi-check)');

  // Return to Dashboard
  await page.click('img[title="Home"]');

  // Delete created MSEL
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + extraConfig.MSELName, {timeout: 500});
  } catch (error) {
    console.log('Specified MSEL has been removed.');
  }

  await page.waitForTimeout(5 * 1000);
});

// ===================== Download a MSEL ======================
test('download MSEL', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.waitForTimeout(5 * 1000);

  // Download MSEL
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button[title="Download .xlsx file"]').first().click()
  ]);

  const path = await download.path();
  console.log('file downloaded as ' + path);
  if (await download.failure()) {
    console.log(await download.failure());
  }
  console.log(await download.suggestedFilename());
  // Read file stats
  fs.stat(path, (err, stats) => {
    if (err) {
      console.log('File does not exist.');
    } else {
      console.log('file size is ' + stats.size);
    }
  });
  await page.waitForTimeout(5 * 1000);

});

// ===================== Upload a MSEL ======================
test('upload MSEL', async ({ page }) => {
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
  await page.fill('text=Name', extraConfig.MSELName);

  // Edit Description Field
  await page.fill('text=Description', 'Playwright Test MSEL');
  await page.click('button:has(mat-icon.mdi-check)');

  // Return to Dashboard
  await page.click('img[title="Home"]');

  // Delete created MSEL
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + extraConfig.MSELName, {timeout: 500});
  } catch (error) {
    console.log('Specified MSEL has been removed.');
  }

  await page.waitForTimeout(5 * 1000);

});

// ===================== Push Gallery CITE ======================
test('push gallery cite', async ({ page }) => {
  await page.goto(extraConfig.blueprintURL);
  await expect(page).toHaveTitle(/Blueprint/);
  await page.locator(':has-text("Standard MSEL")');
  await page.waitForTimeout(5 * 1000);

  // Find the "Copy" button using XPath
  await page.click('// button[@title="Copy HSEEP"]');


  // Select the new copy
  await page.click('text= Copy of HSEEP');

  // Edit MSEL Info
  await page.fill('text=Name', extraConfig.MSELName);
  await page.fill('text=Description', 'Playwright Test MSEL');
  await page.click('button:has(mat-icon.mdi-check)');

  // Add Organization
  await page.getByRole('button', { name: 'Organizations' }).click();
  await page.click('button:has(mat-icon.mdi-bank-plus)');
  await page.fill('text=Name', extraConfig.orgName);
  await page.fill('text=Short Name (required)', extraConfig.orgShortName);
  await page.fill('text=Summary (required)', extraConfig.orgSummary);
  await page.fill('#quill p', extraConfig.orgDescription);
  await page.click('button:has-text("Save")');

  // Add Move
  await page.getByRole('button', { name: 'Moves' }).click();
  await page.click('button:has(mat-icon.mdi-plus-circle-outline)');
  await page.locator('text=Title').nth(1).fill('Playwright Move');
  await page.fill('text=Move Description', 'Move created with test');
  await page.click('button:has-text("Save")');

  // Add Gallery Card
  await page.getByRole('button', { name: 'Gallery Cards' }).click();
  await page.click('button:has(mat-icon.mdi-plus-circle-outline)');
  await page.locator('text=Name').nth(1).fill('Playwright Card');
  await page.fill('text=Card Description', 'Playwright Test');
  await page.locator('mat-select[role="combobox"] >> text=Move').click();
  await page.locator('text=0 - setup').click();
  await page.click('text=Save');

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

  // Add CITE Role
  await page.getByRole('button', { name: 'Cite Roles' }).click();
  await page.click('button:has(mat-icon.mdi-plus-circle-outline)');
  await page.locator('text=Name').nth(1).fill('Playwright CITE Role');
  await page.locator('mat-select[role="combobox"] >> text=Team').nth(1).click();
  await page.locator('text=Test Users').click();
  await page.click('text=Save');

  // Add Inject
  await page.getByRole('button', { name: 'Events' }).click();
  await page.waitForTimeout(1 * 1000);
  await page.click('button:has(mat-icon.mdi-plus-circle-outline)');
  await page.click('text=Default');
  await page.locator('mat-dialog-container[role="dialog"] >> text=Gallery').click();
  await page.locator('text=Description').nth(1).fill('Playwright Inject Description');
  await page.locator('[aria-label="Open calendar"]').click();
  await page.locator('button:has-text("done")').click();
  await page.locator('mat-select[role="combobox"] >> text=Move').click();
  await page.click('text=0 - setup');
  await page.locator('text=Title').nth(1).fill('Playwright Inject Title');
  await page.locator('mat-select[role="combobox"] >> text=From Org').click();
  await page.click('text=AMB');
  await page.mouse.click(5, 5);
  await page.locator('mat-select[role="combobox"] >> text=To Org').click();
  await page.click('text=ATB');
  await page.mouse.click(5, 5);
  await page.locator('quill-editor div').nth(2).fill('Test inject');
  await page.locator('mat-select[role="combobox"] >> text=Card').click();
  await page.locator('text=Playwright Card').click();
  await page.mouse.click(5, 5);
  await page.locator('text=Gallery Status').nth(1).fill('Open');
  await page.locator('mat-select[role="combobox"] >> text=Source Type').click();
  await page.locator('text=Social').click();
  await page.mouse.click(5, 5);
  await page.locator('text=Source Name').nth(1).fill('Twitter');
  await page.fill('input[data-placeholder="Inject"]', '1');
  await page.locator('mat-select[role="combobox"] >> text=Delivery Method').click();
  await page.locator('div[role="listbox"] >> text=Gallery').click();
  await page.mouse.click(5, 5);
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(1 * 1000);

  // Push to CITE & Gallery
  await page.locator('mat-tab-header button').first().click();
  await page.getByRole('button', { name: 'Info' }).click();
  await page.locator('text=Link Player ViewAdd View Teams >> mat-select[role="combobox"] div').nth(2).click();
  await page.click('text=Test Environment');
  await page.click('button:has-text("Push to Gallery")');
  await page.click('text=Yes');
  await page.waitForTimeout(5 * 1000);
  await page.locator('text=Integrate CITESelect Scoring ModelPush to CITE >> mat-select[role="combobox"] div').nth(3).click();
  await page.click('text=Test ITSM');
  await page.click('button:has(mat-icon.mdi-check)');
  await page.click('button:has-text("Push to CITE")');
  await page.click('text=Yes');
  await page.waitForTimeout(5 * 1000);

  // Delete from CITE & Gallery
  await page.click('text=Remove from Gallery');
  await page.click('text=Yes');
  await page.click('text=Remove from CITE');
  await page.click('text=Yes');

  // Return to Dashboard
  await page.click('img[title="Home"]');

  // Delete created MSEL
  await page.click('// button[@title="Delete Test MSEL"]');
  await page.click('button:has-text("YES")');
  await page.waitForTimeout(1 * 1000);

  // Verify gone
  try {
    await page.waitForSelector('text=' + extraConfig.MSELName, {timeout: 500});
  } catch (error) {
    console.log('Specified MSEL has been removed.');
  }

  await page.waitForTimeout(5 * 1000);
});
