// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  NgxMatDatepickerActions,
  NgxMatDatepickerApply,
  NgxMatDatepickerCancel,
  NgxMatDatepickerInput,
  NgxMatDatetimepicker,
} from '@ngxmc/datetime-picker';
import { DurationEditComponent } from './duration-edit.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const START = new Date('2026-01-01T12:00:00Z');

async function renderDurationEdit(overrides: { canEdit?: boolean; durationSeconds?: number } = {}) {
  const { canEdit = true, durationSeconds = 90061 } = overrides;
  const rendered = await renderComponent(DurationEditComponent, {
    imports: [
      MatButtonModule,
      MatDatepickerModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatNativeDateModule,
      NgxMatDatepickerActions,
      NgxMatDatepickerApply,
      NgxMatDatepickerCancel,
      NgxMatDatepickerInput,
      NgxMatDatetimepicker,
    ],
    declarations: [DurationEditComponent],
    inputs: { canEdit, durationSeconds, startTime: START, timeName: 'Inject Time', postScript: 'from start' },
  });
  const changes: number[] = [];
  rendered.fixture.componentInstance.change.subscribe((s) => changes.push(s));
  return { ...rendered, changes };
}

const days = () => screen.getByTitle('Days from Start') as HTMLInputElement;
const hours = () => screen.getByTitle('Hours from Start') as HTMLInputElement;
const minutes = () => screen.getByTitle('Minutes from Start') as HTMLInputElement;

describe('DurationEditComponent', () => {
  /**
   * Verifies: the duration is split into days, hours and minutes, and the end time is shown.
   * Interacts with: DurationEditComponent.ngOnChanges / setDeltaValues.
   * Data: 1 day, 1 hour, 1 minute, 1 second after 2026-01-01 12:00 UTC.
   */
  it('shows the duration as days, hours and minutes', async () => {
    await renderDurationEdit();

    expect(days().value).toBe('1');
    expect(hours().value).toBe('01');
    expect(minutes().value).toBe('01');
    expect(screen.getByText('Inject Time')).toBeInTheDocument();
    expect(screen.getByText('from start')).toBeInTheDocument();
  });

  /**
   * Verifies: with canEdit, changing the days input recalculates and emits the duration in seconds.
   * Interacts with: deltaUpdated, change output.
   * Data: canEdit true; days changed from 1 to 2.
   */
  it('emits the new duration when a part changes with canEdit', async () => {
    const { changes } = await renderDurationEdit({ canEdit: true });
    const user = userEvent.setup();

    await user.clear(days());
    await user.type(days(), '2');
    await user.tab();

    expect(changes.at(-1)).toBe(2 * 86400 + 3600 + 60 + 1);
  });

  /**
   * Verifies: without canEdit every duration input, the date toggle and the sign switch are disabled.
   * Interacts with: DurationEditComponent template, endTimeFormControl.disable.
   * Data: canEdit false.
   */
  it('disables the duration inputs without canEdit', async () => {
    const { fixture, changes } = await renderDurationEdit({ canEdit: false });
    const user = userEvent.setup();

    expect(days()).toBeDisabled();
    expect(hours()).toBeDisabled();
    expect(minutes()).toBeDisabled();
    expect(screen.getByTitle('Choose Date/Time').querySelector('button')).toBeDisabled();
    expect(fixture.componentInstance.endTimeFormControl.disabled).toBe(true);

    await user.click(screen.getByTitle('plus/minus'));
    expect(screen.getByTitle('plus/minus')).toHaveClass('disabled');
    expect(fixture.componentInstance.sign).toBe(1);
    expect(changes).toEqual([]);
  });

  /**
   * Verifies: with canEdit the sign switch negates the duration and leaves the sign at plus, and the next edit emits a positive duration (current behavior).
   * Interacts with: changeSign, the durationSeconds setter, deltaUpdated, change output.
   * Data: canEdit true; 90061 seconds; sign switched, then days changed to 2.
   */
  it('negates the duration but keeps the plus sign', async () => {
    const { fixture, changes } = await renderDurationEdit({ canEdit: true });
    const user = userEvent.setup();

    await user.click(screen.getByTitle('plus/minus'));

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(fixture.componentInstance.durationSeconds).toBe(-90061);
    expect(fixture.componentInstance.sign).toBe(1);
    expect(screen.getByTitle('plus/minus')).toHaveAttribute('fonticon', 'mdi-plus');

    await user.clear(days());
    await user.type(days(), '2');
    await user.tab();
    expect(changes.at(-1)).toBe(2 * 86400 + 3600 + 60 + 1);
  });
});
