// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { screen, within } from '@testing-library/angular';
import { SystemMessageService } from './system-message.service';

describe('SystemMessageService', () => {
  /**
   * Verifies: displayMessage opens one bottom sheet that shows the title as its heading and the message as its body.
   * Interacts with: the real MatBottomSheet and SystemMessageComponent (noop animations).
   * Data: title 'Invalid MSEL', message 'The MSEL could not be saved.'.
   */
  it('opens the system message bottom sheet with the title and message', async () => {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, MatBottomSheetModule],
      providers: [SystemMessageService],
    });
    const service = TestBed.inject(SystemMessageService);

    service.displayMessage('Invalid MSEL', 'The MSEL could not be saved.');

    const sheet = await screen.findByRole('alert');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(
      within(sheet).getByRole('heading', { level: 2, name: 'Invalid MSEL' }),
    ).toBeInTheDocument();
    expect(within(sheet).getByText('The MSEL could not be saved.')).toHaveClass(
      'messagebody',
    );
  });
});
