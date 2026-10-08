// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SystemMessageComponent } from './system-message.component';
import { bottomSheetRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderSystemMessage() {
  const sheet = bottomSheetRefStub<SystemMessageComponent>();
  const rendered = await renderComponent(SystemMessageComponent, {
    imports: [MatButtonModule, MatIconModule],
    declarations: [SystemMessageComponent],
    providers: [
      { provide: MAT_BOTTOM_SHEET_DATA, useValue: { title: 'Save failed', message: 'The API returned 500.' } },
      { provide: MatBottomSheetRef, useValue: sheet.sheetRef },
    ],
  });
  return { ...rendered, dismiss: sheet.dismiss };
}

describe('SystemMessageComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and announces the error title and message.
   * Interacts with: getDefaultProviders (placeholders and stubs only), MAT_BOTTOM_SHEET_DATA.
   * Data: title "Save failed", message "The API returned 500.".
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderSystemMessage();

    expect(fixture.componentInstance).toBeInstanceOf(SystemMessageComponent);
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
    expect(screen.getByRole('alert')).toHaveTextContent('The API returned 500.');
  });

  /**
   * Verifies: Close dismisses the bottom sheet.
   * Interacts with: MatBottomSheetRef.dismiss (stub).
   * Data: the message above.
   */
  it('dismisses the sheet from Close', async () => {
    const { dismiss } = await renderSystemMessage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
