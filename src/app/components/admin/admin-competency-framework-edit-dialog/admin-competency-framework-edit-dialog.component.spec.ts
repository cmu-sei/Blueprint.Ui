// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { of } from 'rxjs';
import { CompetencyFramework, ProficiencyScale, ProficiencyScaleService } from 'src/app/generated/blueprint.api';
import { AdminCompetencyFrameworkEditDialogComponent } from './admin-competency-framework-edit-dialog.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';

const FRAMEWORK = { id: 'fw-1', name: 'NICE', version: '2.1.0', source: 'NIST', description: 'Workforce framework', defaultProficiencyScaleId: 'scale-1' } as CompetencyFramework;

function dialogData(overrides: Partial<typeof FRAMEWORK> = {}) {
  return { competencyFramework: { ...structuredClone(FRAMEWORK), ...overrides } };
}

async function renderAdminCompetencyFrameworkEditDialog(data = dialogData()) {
  const scaleApi = {
    getProficiencyScales: vi.fn(() => of<ProficiencyScale[]>([{ id: 'scale-1', name: 'Five Point' }])),
  } satisfies ApiStub<ProficiencyScaleService>;
  const rendered = await renderComponent(AdminCompetencyFrameworkEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule, MatSelectModule],
    declarations: [AdminCompetencyFrameworkEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: ProficiencyScaleService, useValue: scaleApi }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results, scaleApi };
}

describe('AdminCompetencyFrameworkEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: framework NICE with proficiency scale Five Point from the API.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderAdminCompetencyFrameworkEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(AdminCompetencyFrameworkEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Competency Framework' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Proficiency Scale' })).toHaveTextContent('Five Point');
  });

  /**
   * Verifies: Save emits the framework and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: framework NICE with proficiency scale Five Point from the API.
   */
  it('emits the framework on Save and none on Cancel', async () => {
    const { data, results } = await renderAdminCompetencyFrameworkEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, competencyFramework: data.competencyFramework },
      { saveChanges: false, competencyFramework: null },
    ]);
  });

  /**
   * Verifies: Save is disabled while the framework is incomplete.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: a framework with no name.
   */
  it('disables Save for an incomplete framework', async () => {
    await renderAdminCompetencyFrameworkEditDialog(dialogData({ name: '' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for an incomplete framework (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: a framework with no name.
   */
  it('saves an incomplete framework when handleEditComplete is called', async () => {
    const { fixture, data, results } = await renderAdminCompetencyFrameworkEditDialog(dialogData({ name: '' }));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, competencyFramework: data.competencyFramework }]);
  });
});
