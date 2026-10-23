// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Card } from 'src/app/generated/blueprint.api';
import { CardEditDialogComponent } from './card-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const CARD = { id: 'card-1', mselId: 'msel-1', name: 'Situation Card', description: 'Move 1 situation', move: 1, isTemplate: false } as Card;

function dialogData(overrides: Partial<typeof CARD> = {}) {
  return { card: { ...structuredClone(CARD), ...overrides }, moveList: [{ id: 'move-1', mselId: 'msel-1', moveNumber: 1, description: 'Initial access' }] };
}

async function renderCardEditDialog(data = dialogData()) {
  const rendered = await renderComponent(CardEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule, MatSelectModule],
    declarations: [CardEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

describe('CardEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: card Situation Card in move 1.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderCardEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(CardEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Card' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the card and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: card Situation Card in move 1.
   */
  it('emits the card on Save and none on Cancel', async () => {
    const { data, results } = await renderCardEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, card: data.card },
      { saveChanges: false, card: null },
    ]);
  });
});
