// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AngularEditorModule } from '@kolkov/angular-editor';
import {
  NgxMatDatepickerActions,
  NgxMatDatepickerApply,
  NgxMatDatepickerCancel,
  NgxMatDatepickerInput,
  NgxMatDatetimepicker,
} from '@ngxmc/datetime-picker';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Move } from 'src/app/generated/blueprint.api';
import { MoveEditDialogComponent } from './move-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

@Component({ selector: 'app-duration-edit', template: '', standalone: false })
class DurationEditStub {
  @Input() startTime: Date;
  @Input() canEdit: boolean;
  @Input() durationSeconds: number;
  @Output() durationSecondsChange = new EventEmitter<number>();
  @Input() timeName: string;
  @Input() postScript: string;
  @Output() change = new EventEmitter<number>();
}

const START = new Date('2026-01-01T12:00:00Z');
const MOVE: Move = {
  id: 'move-1',
  mselId: 'msel-1',
  moveNumber: 1,
  deltaSeconds: 3600,
  description: 'Initial access',
  situationTime: new Date('2026-01-01T13:00:00Z'),
  situationDescription: '<p>Phishing</p>',
};

async function renderMoveEdit() {
  const data = { move: structuredClone(MOVE), mselStartTime: START, title: 'Edit Move' };
  const rendered = await renderComponent(MoveEditDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      AngularEditorModule,
      MatDatepickerModule,
      MatFormFieldModule,
      MatInputModule,
      MatNativeDateModule,
      NgxMatDatepickerActions,
      NgxMatDatepickerApply,
      NgxMatDatepickerCancel,
      NgxMatDatepickerInput,
      NgxMatDatetimepicker,
    ],
    declarations: [MoveEditDialogComponent, DurationEditStub],
    // angular-editor injects HttpClient for its image upload.
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, provideHttpClient(), provideHttpClientTesting()],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

// angular-editor's toolbar makes whole-document role queries slow, so the
// fields go by placeholder and the buttons are looked up in the dialog actions.
const actions = () => within(document.querySelector('mat-dialog-actions') as HTMLElement);
const description = () => screen.getByPlaceholderText('Move Description');

describe('MoveEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows the move, its start offset editor and situation time.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog, DurationEditStub inputs.
   * Data: move 1, Initial access, one hour after the MSEL start.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderMoveEdit();

    expect(fixture.componentInstance).toBeInstanceOf(MoveEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Move' })).toBeInTheDocument();
    expect(description()).toHaveValue('Initial access');
    const duration = fixture.debugElement.query(By.directive(DurationEditStub)).componentInstance as DurationEditStub;
    expect(duration.durationSeconds).toBe(3600);
    expect(duration.startTime).toEqual(START);
  });

  /**
   * Verifies: Save emits the edited move and Cancel emits none.
   * Interacts with: ngModel, crucible-dialog submit and cancel, editComplete output.
   * Data: description changed to Lateral movement.
   */
  it('emits the move on Save and none on Cancel', async () => {
    const { data, results } = await renderMoveEdit();
    const user = userEvent.setup();

    await user.clear(description());
    await user.type(description(), 'Pivot');
    await user.click(actions().getByRole('button', { name: 'Save' }));
    await user.click(actions().getByRole('button', { name: 'Cancel' }));

    expect(data.move.description).toBe('Pivot');
    expect(results).toEqual([
      { saveChanges: true, move: data.move },
      { saveChanges: false, move: null },
    ]);
  });
});
