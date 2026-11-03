// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  ProficiencyLevelService,
  ProficiencyScale,
  ProficiencyScaleService,
} from 'src/app/generated/blueprint.api';
import { AdminProficiencyScalesComponent } from './admin-proficiency-scales.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';

const SCALE: ProficiencyScale = {
  id: 'scale-1',
  name: 'Five Point',
  description: 'Novice to expert',
  proficiencyLevels: [
    { id: 'level-1', proficiencyScaleId: 'scale-1', name: 'Novice', value: 1, displayOrder: 1 },
  ],
};

async function renderScales(overrides: { canEdit?: boolean } = {}) {
  const { canEdit = true } = overrides;
  const scaleApi = {
    getProficiencyScales: vi.fn(() => of([structuredClone(SCALE)])),
    deleteProficiencyScale: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<ProficiencyScaleService>;
  const levelApi = {
    deleteProficiencyLevel: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<ProficiencyLevelService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(AdminProficiencyScalesComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatRippleModule,
      MatSortModule,
      MatTableModule,
    ],
    declarations: [AdminProficiencyScalesComponent],
    providers: [
      { provide: ProficiencyScaleService, useValue: scaleApi },
      { provide: ProficiencyLevelService, useValue: levelApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
    ],
    inputs: { canEdit, loggedInUserId: 'user-1' },
  });
  return { ...rendered, scaleApi, levelApi, confirm };
}

// The outer table of scales (the expanded row holds a second table of levels).
const scales = () => screen.getAllByRole('table')[0];
const HEADER_ACTIONS = [
  'Add proficiency scale',
  'Upload Proficiency Scales from JSON',
  'Download Proficiency Scales as JSON',
];

async function expandScale() {
  const user = userEvent.setup();
  await user.click(within(scales()).getByText('Five Point'));
  return within(screen.getByText('Levels for "Five Point"').parentElement as HTMLElement);
}

describe('AdminProficiencyScalesComponent', () => {
  /**
   * Verifies: with canEdit the header actions and the scale's Edit and Delete buttons are offered, and the expanded scale offers Add, Edit and Delete for its levels.
   * Interacts with: ProficiencyScaleService.getProficiencyScales (stub), row click to expand.
   * Data: canEdit true; scale Five Point with level Novice.
   */
  it('offers scale and level actions with canEdit', async () => {
    const { scaleApi } = await renderScales({ canEdit: true });

    expect(scaleApi.getProficiencyScales).toHaveBeenCalledTimes(1);
    for (const title of HEADER_ACTIONS) {
      expect(within(scales()).getByTitle(title)).toBeInTheDocument();
    }
    expect(within(scales()).getByTitle('Edit Five Point')).toBeInTheDocument();
    expect(within(scales()).getByTitle('Delete Five Point')).toBeInTheDocument();

    const levels = await expandScale();
    expect(levels.getByText('Novice')).toBeInTheDocument();
    expect(levels.getByTitle('Add level')).toBeInTheDocument();
    expect(levels.getByTitle('Edit Novice')).toBeInTheDocument();
    expect(levels.getByTitle('Delete Novice')).toBeInTheDocument();
  });

  /**
   * Verifies: without canEdit the scales and levels are listed read-only: no header, scale or level action is rendered.
   * Interacts with: ProficiencyScaleService.getProficiencyScales (stub), row click to expand.
   * Data: canEdit false; scale Five Point with level Novice.
   */
  it('hides scale and level actions without canEdit', async () => {
    await renderScales({ canEdit: false });

    for (const title of HEADER_ACTIONS) {
      expect(within(scales()).queryByTitle(title)).not.toBeInTheDocument();
    }
    expect(within(scales()).queryByTitle('Edit Five Point')).not.toBeInTheDocument();
    expect(within(scales()).queryByTitle('Delete Five Point')).not.toBeInTheDocument();

    const levels = await expandScale();
    expect(levels.getByText('Novice')).toBeInTheDocument();
    expect(levels.queryByTitle('Add level')).not.toBeInTheDocument();
    expect(levels.queryByTitle('Edit Novice')).not.toBeInTheDocument();
    expect(levels.queryByTitle('Delete Novice')).not.toBeInTheDocument();
  });

  /**
   * Verifies: confirming Delete removes the scale through the API and from the list.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), ProficiencyScaleService.deleteProficiencyScale (stub).
   * Data: canEdit true; scale Five Point.
   */
  it('deletes a scale after confirmation', async () => {
    const { scaleApi, confirm } = await renderScales({ canEdit: true });
    const user = userEvent.setup();

    await user.click(within(scales()).getByTitle('Delete Five Point'));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Proficiency Scale', message: 'Are you sure that you want to delete Five Point?', confirmText: 'Delete' }));
    expect(scaleApi.deleteProficiencyScale).toHaveBeenCalledWith('scale-1');
    expect(screen.getByText('No proficiency scales defined')).toBeInTheDocument();
  });
});
