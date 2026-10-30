// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  CompetencyFramework,
  CompetencyFrameworkService,
  FrameworkDeleteCheck,
  ProficiencyScale,
  ProficiencyScaleService,
} from 'src/app/generated/blueprint.api';
import { CompetencyFrameworkStore } from 'src/app/data/competency-framework/competency-framework.store';
import { AdminCompetencyFrameworksComponent } from './admin-competency-frameworks.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';

const FRAMEWORK: CompetencyFramework = {
  id: 'fw-1',
  name: 'NICE',
  version: '2.1.0',
  source: 'NIST',
  description: 'Workforce framework',
  defaultProficiencyScaleId: 'scale-1',
  competencies: [{ id: 'comp-1', competencyFrameworkId: 'fw-1', idNumber: 'K0001', shortName: 'Networking' }],
};

async function renderFrameworks(
  overrides: { canEdit?: boolean; deleteCheck?: FrameworkDeleteCheck } = {},
) {
  const { canEdit = true, deleteCheck = { canDelete: true, affectedMsels: [] } } = overrides;
  const frameworkApi = {
    checkCanDeleteCompetencyFramework: vi.fn(() => of(structuredClone(deleteCheck))),
    getCompetencyFramework: vi.fn(() => of(structuredClone(FRAMEWORK))),
    deleteCompetencyFramework: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<CompetencyFrameworkService>;
  const scaleApi = {
    getProficiencyScales: vi.fn(() => of<ProficiencyScale[]>([{ id: 'scale-1', name: 'Five Point' }])),
  } satisfies ApiStub<ProficiencyScaleService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(AdminCompetencyFrameworksComponent, {
    imports: [
      MatButtonModule,
      MatExpansionModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatRippleModule,
      MatSelectModule,
      MatSortModule,
      MatTableModule,
      MatToolbarModule,
      MatTooltipModule,
    ],
    declarations: [AdminCompetencyFrameworksComponent],
    providers: [
      { provide: CompetencyFrameworkService, useValue: frameworkApi },
      { provide: ProficiencyScaleService, useValue: scaleApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
      // The admin container loads the frameworks; the store is seeded instead.
      {
        provide: CompetencyFrameworkStore,
        useFactory: () => {
          const store = new CompetencyFrameworkStore();
          store.set([structuredClone(FRAMEWORK)]);
          return store;
        },
      },
    ],
    inputs: { canEdit, loggedInUserId: 'user-1' },
  });
  return { ...rendered, frameworkApi, confirm };
}

const frameworks = () => screen.getAllByRole('table')[0];
const deleteButton = () => within(frameworks()).getByRole('button', { description: /Delete framework|In use by/ });

// Inside the expanded framework, queries go by title: jsdom's CSS engine throws on
// the component's `border: 1px solid var(...)` rules when a role query computes styles there.
async function openCompetencies() {
  const user = userEvent.setup();
  await user.click(within(frameworks()).getByText('NICE'));
  await user.click(screen.getByText(/Competencies/, { selector: 'mat-panel-title' }));
  return within(screen.getByText('K0001').closest('mat-table') as HTMLElement);
}

describe('AdminCompetencyFrameworksComponent', () => {
  /**
   * Verifies: with canEdit the add, upload, edit, download and delete actions are offered for the frameworks.
   * Interacts with: real CompetencyFrameworkStore/Query (seeded), CompetencyFrameworkService.checkCanDeleteCompetencyFramework (stub).
   * Data: canEdit true; framework NICE, not in use.
   */
  it('offers framework actions with canEdit', async () => {
    const { frameworkApi } = await renderFrameworks({ canEdit: true });

    expect(frameworkApi.checkCanDeleteCompetencyFramework).toHaveBeenCalledWith('fw-1');
    expect(screen.queryByTitle('Import framework from JSON')).not.toBeInTheDocument();
    expect(within(frameworks()).getByTitle('Add new competency framework')).toBeInTheDocument();
    expect(within(frameworks()).getByTitle('Upload Competency Framework from JSON')).toBeInTheDocument();
    expect(within(frameworks()).getByTitle('Edit NICE')).toBeInTheDocument();
    expect(within(frameworks()).getByTitle('Download Competency Frameworks as JSON')).toBeInTheDocument();
    expect(within(frameworks()).queryByTitle('Download NICE as JSON')).not.toBeInTheDocument();
    expect(deleteButton()).toBeEnabled();
    expect(within(frameworks()).getByText('Five Point')).toBeInTheDocument();
  });

  /**
   * Verifies: without canEdit the frameworks are listed but no framework action is rendered.
   * Interacts with: AdminCompetencyFrameworksComponent template.
   * Data: canEdit false; framework NICE.
   */
  it('hides framework actions without canEdit', async () => {
    await renderFrameworks({ canEdit: false });

    expect(within(frameworks()).getByText('NICE')).toBeInTheDocument();
    expect(within(frameworks()).queryByTitle('Add new competency framework')).not.toBeInTheDocument();
    expect(within(frameworks()).queryByTitle('Upload Competency Framework from JSON')).not.toBeInTheDocument();
    expect(within(frameworks()).queryByTitle('Edit NICE')).not.toBeInTheDocument();
    expect(within(frameworks()).queryByTitle('Download Competency Frameworks as JSON')).not.toBeInTheDocument();
    expect(within(frameworks()).queryByRole('button', { description: 'Delete framework' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: a framework that MSELs use cannot be deleted, and the tooltip names them.
   * Interacts with: CompetencyFrameworkService.checkCanDeleteCompetencyFramework (stub), canDeleteFramework, getDeleteTooltip.
   * Data: canEdit true; NICE used by MSEL Exercise Alpha.
   */
  it('disables Delete for a framework that MSELs use', async () => {
    await renderFrameworks({
      canEdit: true,
      deleteCheck: { canDelete: false, affectedMsels: [{ id: 'msel-1', name: 'Exercise Alpha' }] },
    });

    expect(deleteButton()).toBeDisabled();
    expect(deleteButton()).toHaveAccessibleDescription('In use by 1 MSEL(s): Exercise Alpha');
  });

  /**
   * Verifies: with canEdit the expanded framework offers add, edit and delete for its competencies.
   * Interacts with: row click, CompetencyFrameworkService.getCompetencyFramework (stub), the Competencies panel.
   * Data: canEdit true; NICE with competency K0001.
   */
  it('offers competency actions with canEdit', async () => {
    const { frameworkApi } = await renderFrameworks({ canEdit: true });

    const competencies = await openCompetencies();

    expect(frameworkApi.getCompetencyFramework).toHaveBeenCalledWith('fw-1');
    expect(competencies.getByTitle('Add competency')).toBeInTheDocument();
    expect(competencies.getByTitle('Edit K0001')).toBeInTheDocument();
    expect(competencies.getByTitle('Delete K0001')).toBeInTheDocument();
  });

  /**
   * Verifies: without canEdit the expanded framework lists its competencies read-only.
   * Interacts with: row click, CompetencyFrameworkService.getCompetencyFramework (stub), the Competencies panel.
   * Data: canEdit false; NICE with competency K0001.
   */
  it('hides competency actions without canEdit', async () => {
    await renderFrameworks({ canEdit: false });

    const competencies = await openCompetencies();

    expect(competencies.getByText('Networking')).toBeInTheDocument();
    expect(competencies.queryByTitle('Add competency')).not.toBeInTheDocument();
    expect(competencies.queryByTitle('Edit K0001')).not.toBeInTheDocument();
    expect(competencies.queryByTitle('Delete K0001')).not.toBeInTheDocument();
  });

  /**
   * Verifies: confirming Delete deletes the framework through the API and removes it from the list.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), CompetencyFrameworkService.deleteCompetencyFramework (stub).
   * Data: canEdit true; NICE not in use.
   */
  it('deletes a framework after confirmation', async () => {
    const { frameworkApi, confirm } = await renderFrameworks({ canEdit: true });
    const user = userEvent.setup();

    await user.click(deleteButton());

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Competency Framework' }));
    expect(frameworkApi.deleteCompetencyFramework).toHaveBeenCalledWith('fw-1');
    expect(within(frameworks()).queryByText('NICE')).not.toBeInTheDocument();
  });
});
