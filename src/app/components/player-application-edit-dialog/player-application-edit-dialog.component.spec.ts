// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { PlayerApplication } from 'src/app/generated/blueprint.api';
import { PlayerApplicationEditDialogComponent } from './player-application-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const APPLICATION = { id: 'app-1', mselId: 'msel-1', name: 'Mail', url: 'https://mail.example.com/{playerViewId}', icon: '', embeddable: true, loadInBackground: false } as PlayerApplication;

function dialogData(overrides: Partial<typeof APPLICATION> = {}) {
  return { playerApplication: { ...structuredClone(APPLICATION), ...overrides }, title: 'Edit Player Application' };
}

async function renderPlayerApplicationEditDialog(data = dialogData()) {
  const rendered = await renderComponent(PlayerApplicationEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatCheckboxModule, MatFormFieldModule, MatInputModule],
    declarations: [PlayerApplicationEditDialogComponent],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  // ngModel writes the values into the inputs in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

describe('PlayerApplicationEditDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows its title.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog.
   * Data: application Mail whose URL uses the {playerViewId} variable.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderPlayerApplicationEditDialog();

    expect(fixture.componentInstance).toBeInstanceOf(PlayerApplicationEditDialogComponent);
    expect(screen.getByRole('heading', { name: 'Edit Player Application' })).toBeInTheDocument();
  });

  /**
   * Verifies: Save emits the application and Cancel emits none.
   * Interacts with: crucible-dialog submit and cancel, editComplete output.
   * Data: application Mail whose URL uses the {playerViewId} variable.
   */
  it('emits the application on Save and none on Cancel', async () => {
    const { data, results } = await renderPlayerApplicationEditDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, playerApplication: data.playerApplication },
      { saveChanges: false, playerApplication: null },
    ]);
  });

  /**
   * Verifies: Save refuses a URL with an unknown variable and shows why.
   * Interacts with: validateUrls, crucible-dialog submit, editComplete output.
   * Data: a URL using {missionId}, which is not an allowed variable.
   */
  it('refuses a URL with an unknown variable', async () => {
    const { results } = await renderPlayerApplicationEditDialog(dialogData({ url: 'https://mail.example.com/{missionId}' }));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(results).toEqual([]);
    expect(screen.getByText('Unknown variable(s): {missionId}')).toBeInTheDocument();
  });

  /**
   * Verifies: Save accepts an application URL or icon that uses the Caster and VM UI variables.
   * Interacts with: validateUrls, crucible-dialog submit, editComplete output.
   * Data: a URL or icon using {vmUrl} with {playerViewId}, {casterUrl} or {casterWorkspaceId}.
   */
  it.each([
    { label: 'a URL using {vmUrl}', overrides: { url: '{vmUrl}/views/{playerViewId}' } },
    { label: 'a URL using {casterUrl} and {casterWorkspaceId}', overrides: { url: '{casterUrl}/workspaces/{casterWorkspaceId}' } },
    { label: 'an icon using {vmUrl}', overrides: { icon: '{vmUrl}/assets/icon.png' } },
  ])('saves $label', async ({ overrides }) => {
    const { data, results } = await renderPlayerApplicationEditDialog(dialogData(overrides));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(results).toEqual([{ saveChanges: true, playerApplication: data.playerApplication }]);
    expect(screen.queryByText(/Unknown variable/)).not.toBeInTheDocument();
  });

  /**
   * Verifies: the help text lists the Caster and VM UI variables among those a URL may use.
   * Interacts with: the dialog template.
   * Data: application Mail.
   */
  it('lists the Caster and VM UI variables', async () => {
    await renderPlayerApplicationEditDialog();

    expect(screen.getByText('{citeUrl}, {galleryUrl}, {steamfitterUrl}, {playerUrl}, {blueprintUrl}, {casterUrl}, {vmUrl}', { exact: false })).toBeInTheDocument();
    expect(
      screen.getByText('{citeEvaluationId}, {galleryExhibitId}, {steamfitterScenarioId}, {playerViewId}, {casterWorkspaceId}, {blueprintMselId}', { exact: false }),
    ).toBeInTheDocument();
  });
});
