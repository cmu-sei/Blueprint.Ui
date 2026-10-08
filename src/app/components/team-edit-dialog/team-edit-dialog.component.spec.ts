// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Team } from 'src/app/generated/blueprint.api';
import { TeamEditDialogComponent } from './team-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

function teamData(overrides: { team?: Team; useCite?: boolean } = {}) {
  const { team = { id: 'team-1', name: 'Blue Team', shortName: 'BLUE', email: '', canTeamMemberInvite: false }, useCite = false } = overrides;
  return {
    team,
    useCite,
    teamTypeList: [{ id: 'tt-1', name: 'Agency' }],
    userList: [],
  };
}

async function renderTeamEdit(data = teamData()) {
  const rendered = await renderComponent(TeamEditDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      AngularEditorModule,
      MatCheckboxModule,
      MatFormFieldModule,
      MatInputModule,
      MatSelectModule,
    ],
    declarations: [TeamEditDialogComponent],
    // angular-editor injects HttpClient for its image upload.
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, provideHttpClient(), provideHttpClientTesting()],
  });
  await rendered.fixture.whenStable();
  const results: { saveChanges: boolean; team: Team | null }[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

// angular-editor's toolbar makes whole-document role queries slow, so the
// fields go by label or placeholder and the buttons are looked up in the dialog actions.
const actions = () => within(document.querySelector('mat-dialog-actions') as HTMLElement);
const inviteBox = () => screen.getByLabelText('ALL users can invite others to this team');

describe('TeamEditDialogComponent', () => {
  /**
   * Verifies: ticking "ALL users can invite" saves the team with canTeamMemberInvite set.
   * Interacts with: mat-checkbox ngModel, crucible-dialog submit, editComplete output.
   * Data: Blue Team with canTeamMemberInvite false; the box is ticked, then saved.
   */
  it('saves canTeamMemberInvite when the box is ticked', async () => {
    const { results } = await renderTeamEdit();
    const user = userEvent.setup();

    expect(inviteBox()).not.toBeChecked();
    await user.click(inviteBox());
    await user.click(actions().getByRole('button', { name: 'Save' }));

    expect(results).toHaveLength(1);
    expect(results[0].team.canTeamMemberInvite).toBe(true);
  });

  /**
   * Verifies: saving without ticking the box keeps canTeamMemberInvite false, and the trimmed names are saved.
   * Interacts with: crucible-dialog submit, handleEditComplete.
   * Data: Blue Team with canTeamMemberInvite false; name edited to " Cell ".
   */
  it('keeps canTeamMemberInvite false when the box stays unticked', async () => {
    const { results } = await renderTeamEdit();
    const user = userEvent.setup();

    await user.clear(screen.getByPlaceholderText('Name (required)'));
    await user.type(screen.getByPlaceholderText('Name (required)'), ' Cell ');
    await user.click(actions().getByRole('button', { name: 'Save' }));

    expect(results[0].team.canTeamMemberInvite).toBe(false);
    expect(results[0].team.name).toBe('Cell');
  });

  /**
   * Verifies: Save is disabled while the name is empty, and with CITE in use until a team type is chosen.
   * Interacts with: errorFree, crucible-dialog submitDisabled, the required validators.
   * Data: a new team with no name; then a named team with useCite and no team type.
   */
  it.each([
    { label: 'without a name', data: teamData({ team: { name: '', shortName: 'NEW' } }) },
    { label: 'without a CITE team type when CITE is used', data: teamData({ useCite: true }) },
  ])('disables Save $label', async ({ data }) => {
    await renderTeamEdit(data);

    expect(actions().getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: Cancel emits no team.
   * Interacts with: crucible-dialog cancel, editComplete output.
   * Data: Blue Team.
   */
  it('emits nothing to save on Cancel', async () => {
    const { results } = await renderTeamEdit();
    const user = userEvent.setup();

    await user.click(actions().getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([{ saveChanges: false, team: null }]);
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for a team with no name (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: a new team with no name.
   */
  it('saves an incomplete team when handleEditComplete is called', async () => {
    const { fixture, data, results } = await renderTeamEdit(teamData({ team: { name: '', shortName: 'NEW' } }));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, team: data.team }]);
  });

});
