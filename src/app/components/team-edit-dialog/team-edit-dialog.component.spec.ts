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
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Team } from 'src/app/generated/blueprint.api';
import { TeamEditDialogComponent } from './team-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

function teamData(
  overrides: {
    team?: Team;
    useCite?: boolean;
    casterTeamVariables?: string[] | null;
    casterTeamVariableUsers?: { [variable: string]: string[] };
  } = {},
) {
  const {
    team = { id: 'team-1', name: 'Blue Team', shortName: 'BLUE', email: '', canTeamMemberInvite: false },
    useCite = false,
    casterTeamVariables = null,
    casterTeamVariableUsers = {},
  } = overrides;
  return {
    team,
    useCite,
    teamTypeList: [{ id: 'tt-1', name: 'Agency' }],
    userList: [],
    casterTeamVariables,
    casterTeamVariableUsers,
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
  // ngModel writes the checkbox state in a microtask; render it once more after it lands.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
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
   * Verifies: a team stored with canTeamMemberInvite false shows the box unticked, saving without ticking it keeps the setting false, and the trimmed names are saved.
   * Interacts with: mat-checkbox ngModel, crucible-dialog submit, handleEditComplete.
   * Data: Blue Team with canTeamMemberInvite false; name edited to " Cell ".
   */
  it('keeps canTeamMemberInvite false when the box stays unticked', async () => {
    const { results } = await renderTeamEdit(
      teamData({ team: { id: 'team-1', name: 'Blue Team', shortName: 'BLUE', email: '', canTeamMemberInvite: false } }),
    );
    const user = userEvent.setup();

    expect(inviteBox()).not.toBeChecked();
    await user.clear(screen.getByPlaceholderText('Name (required)'));
    await user.type(screen.getByPlaceholderText('Name (required)'), ' Cell ');
    await user.click(actions().getByRole('button', { name: 'Save' }));

    expect(results[0].team.canTeamMemberInvite).toBe(false);
    expect(results[0].team.name).toBe('Cell');
  });

  /**
   * Verifies: a team stored with canTeamMemberInvite true shows the box ticked, and unticking it saves the setting false.
   * Interacts with: mat-checkbox ngModel, crucible-dialog submit, editComplete output.
   * Data: Blue Team with canTeamMemberInvite true; the box is unticked, then saved.
   */
  it('saves canTeamMemberInvite false when a ticked box is unticked', async () => {
    const { results } = await renderTeamEdit(
      teamData({ team: { id: 'team-1', name: 'Blue Team', shortName: 'BLUE', email: '', canTeamMemberInvite: true } }),
    );
    const user = userEvent.setup();

    expect(inviteBox()).toBeChecked();
    await user.click(inviteBox());
    await user.click(actions().getByRole('button', { name: 'Save' }));

    expect(results).toHaveLength(1);
    expect(results[0].team.canTeamMemberInvite).toBe(false);
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

  describe('Topology Team', () => {
    const VARIABLES = ['admin', 'blue_cell', 'red_cell'];
    const topologySelect = (fixture: Parameters<typeof TestbedHarnessEnvironment.loader>[0]) =>
      TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);
    const optionTexts = async (select: MatSelectHarness) => {
      await select.open();
      return Promise.all((await select.getOptions()).map((option) => option.getText()));
    };

    /**
     * Verifies: without the Caster template's variables and with no mapping, the dialog has no Topology Team field.
     * Interacts with: the dialog template.
     * Data: Blue Team with no casterTeamVariable; casterTeamVariables null (the MSEL has no Caster directory).
     */
    it('has no Topology Team field without Caster team variables', async () => {
      await renderTeamEdit();

      expect(screen.queryByText('Topology Team')).not.toBeInTheDocument();
    });

    /**
     * Verifies: the field offers "By team name" and each template variable, naming the other teams that already write a variable, and starts at "By team name" for an unmapped team.
     * Interacts with: topologyTeamOptions, topologyTeamLabel, MatSelectHarness.
     * Data: variables admin, blue_cell and red_cell; blue_cell already written by Blue Cell and Cyan Team.
     */
    it('offers the topology teams and who already uses them', async () => {
      const { fixture } = await renderTeamEdit(
        teamData({ casterTeamVariables: VARIABLES, casterTeamVariableUsers: { blue_cell: ['Blue Cell', 'Cyan Team'] } }),
      );
      const select = await topologySelect(fixture);

      expect(screen.getByText("The Caster template variable this team's Player team ID is written to")).toBeInTheDocument();
      expect(await select.getValueText()).toBe('By team name');
      expect(await optionTexts(select)).toEqual(['By team name', 'admin', 'blue_cell (used by Blue Cell, Cyan Team)', 'red_cell']);
    });

    /**
     * Verifies: choosing a topology team saves it as the team's casterTeamVariable.
     * Interacts with: MatSelectHarness, saveTeam('casterTeamVariable'), crucible-dialog submit, editComplete output.
     * Data: Blue Team, unmapped; variables admin, blue_cell and red_cell; red_cell chosen.
     */
    it('saves the chosen topology team', async () => {
      const { fixture, results } = await renderTeamEdit(teamData({ casterTeamVariables: VARIABLES }));
      const user = userEvent.setup();

      await (await topologySelect(fixture)).clickOptions({ text: 'red_cell' });
      await user.click(actions().getByRole('button', { name: 'Save' }));

      expect(results).toHaveLength(1);
      expect(results[0].team.casterTeamVariable).toBe('red_cell');
    });

    /**
     * Verifies: a team mapped to a variable the template no longer declares, or with no template loaded, still shows the field with its mapping selected and kept as an option.
     * Interacts with: topologyTeamOptions, MatSelectHarness.
     * Data: Blue Team mapped to old_cell; variables admin, blue_cell and red_cell, or none (null).
     */
    it.each([
      { label: 'the template no longer declares', casterTeamVariables: VARIABLES, options: ['By team name', 'admin', 'blue_cell', 'red_cell', 'old_cell'] },
      { label: 'no template is loaded for', casterTeamVariables: null as string[], options: ['By team name', 'old_cell'] },
    ])('keeps a mapping $label', async ({ casterTeamVariables, options }) => {
      const { fixture } = await renderTeamEdit(
        teamData({ team: { id: 'team-1', name: 'Blue Team', shortName: 'BLUE', casterTeamVariable: 'old_cell' }, casterTeamVariables }),
      );
      const select = await topologySelect(fixture);

      expect(await select.getValueText()).toBe('old_cell');
      expect(await optionTexts(select)).toEqual(options);
    });

    /**
     * Verifies: choosing "By team name" for a mapped team saves the mapping as null.
     * Interacts with: MatSelectHarness, saveTeam('casterTeamVariable'), crucible-dialog submit, editComplete output.
     * Data: Blue Team mapped to blue_cell; variables admin, blue_cell and red_cell.
     */
    it('clears the mapping when By team name is chosen', async () => {
      const { fixture, results } = await renderTeamEdit(
        teamData({ team: { id: 'team-1', name: 'Blue Team', shortName: 'BLUE', casterTeamVariable: 'blue_cell' }, casterTeamVariables: VARIABLES }),
      );
      const user = userEvent.setup();

      await (await topologySelect(fixture)).clickOptions({ text: 'By team name' });
      await user.click(actions().getByRole('button', { name: 'Save' }));

      expect(results).toHaveLength(1);
      expect(results[0].team.casterTeamVariable).toBeNull();
    });
  });
});
