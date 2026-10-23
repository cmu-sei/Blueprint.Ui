// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import {
  CardTeam,
  CardTeamService,
  Msel,
  MselRole,
  SystemPermission,
  SystemPermissionsService,
  Team,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { CardTeamDataService } from 'src/app/data/team/card-team-data.service';
import { CardTeamsComponent } from './card-teams.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';

const ME = 'user-me';
const BLUE: Team = { id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' };
const RED: Team = { id: 'team-2', mselId: 'msel-1', name: 'Red Team', shortName: 'RED' };
const BLUE_ON_CARD: CardTeam = { id: 'ct-1', cardId: 'card-1', teamId: 'team-1', isShownOnWall: true, canPostArticles: false };
const ALL_BUT_EDIT_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.EditMsels);

function msel(roles: MselRole[] = []): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    teams: [BLUE, RED],
    userMselRoles: roles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
  };
}

async function renderCardTeams(overrides: { permissions?: SystemPermission[]; roles?: MselRole[] } = {}) {
  const { permissions = [], roles = [] } = overrides;
  const cardTeamApi = {
    getMselCardTeams: vi.fn(() => of(structuredClone([BLUE_ON_CARD]))),
    createCardTeam: vi.fn((ct: CardTeam) => of<CardTeam>({ ...ct, id: 'ct-2' })),
    updateCardTeam: vi.fn((id: string, ct: CardTeam) => of(structuredClone(ct))),
    deleteCardTeam: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<CardTeamService>;
  // CardTeamsComponent loads the permissions itself in ngOnInit, so the real
  // service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(CardTeamsComponent, {
    imports: [
      MatButtonModule,
      MatCardModule,
      MatCheckboxModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatProgressSpinnerModule,
      MatSortModule,
      MatTableModule,
    ],
    declarations: [CardTeamsComponent],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: CardTeamService, useValue: cardTeamApi },
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(roles)]);
          store.setActive('msel-1');
          return store;
        },
      },
    ],
    inputs: { cardId: 'card-1', loggedInUserId: ME },
  });
  // The card list's MSEL page loads the card teams.
  TestBed.inject(CardTeamDataService).getCardTeamsFromApi('msel-1');
  rendered.fixture.detectChanges();
  return { ...rendered, cardTeamApi };
}

const region = (selector: string) => document.querySelector(selector) as HTMLElement;
const mselTeams = () => within(region('.team-list-container'));
const cardTeams = () => within(region('.card-list-container'));
const blueRow = () => within(cardTeams().getByText('BLUE').closest('mat-row') as HTMLElement);

describe('CardTeamsComponent', () => {
  /**
   * Verifies: with EditMsels, or as an MSEL Editor, teams can be added to the card, shown on the wall, allowed to post, and removed.
   * Interacts with: real PermissionDataService over SystemPermissionsService (stub), MselPlus.hasRole, real CardTeamDataService.
   * Data: EditMsels with no role; or the Editor role. BLUE is on the card (shown, cannot post); RED is not.
   */
  it.each([
    { label: 'with EditMsels', permissions: [SystemPermission.EditMsels], roles: [] },
    { label: 'as an MSEL Editor', permissions: [], roles: [MselRole.Editor] },
  ])('manages card teams $label', async ({ permissions, roles }) => {
    const { cardTeamApi } = await renderCardTeams({ permissions, roles });
    const user = userEvent.setup();

    const [shownOnWall, canPost] = blueRow().getAllByRole('checkbox');
    expect(shownOnWall).toBeChecked();
    expect(canPost).not.toBeChecked();
    await user.click(canPost);
    expect(cardTeamApi.updateCardTeam).toHaveBeenCalledWith('ct-1', expect.objectContaining({ canPostArticles: true }));

    await user.click(mselTeams().getByRole('button', { name: 'Add Red Team' }));
    expect(cardTeamApi.createCardTeam).toHaveBeenCalledWith(expect.objectContaining({ cardId: 'card-1', teamId: 'team-2' }));

    // Same case as 'labels the Remove button without the team name'.
    await user.click(blueRow().getByRole('button', { name: 'Remove' }));
    expect(cardTeamApi.deleteCardTeam).toHaveBeenCalledWith('ct-1');
  });

  /**
   * Verifies: without EditMsels and the Editor role every card team control is disabled.
   * Interacts with: real PermissionDataService (stubbed grants), CardTeamsComponent.canEditMsel.
   * Data: every permission but EditMsels (near miss: ManageMsels); MSEL roles Viewer and MoveEditor.
   */
  it('disables card team changes without EditMsels or the Editor role', async () => {
    await renderCardTeams({ permissions: ALL_BUT_EDIT_MSELS, roles: [MselRole.Viewer, MselRole.MoveEditor] });

    expect(mselTeams().getByRole('button', { name: 'Add Red Team' })).toBeDisabled();
    for (const checkbox of blueRow().getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled();
    }
    expect(blueRow().getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  /**
   * Verifies: the Remove button's accessible name is "Remove", without the team (current behavior).
   * Interacts with: CardTeamsComponent template.
   * Data: EditMsels; BLUE on the card.
   */
  it('labels the Remove button without the team name', async () => {
    await renderCardTeams({ permissions: [SystemPermission.EditMsels] });

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(blueRow().getByRole('button', { name: /^Remove/ })).toHaveAccessibleName('Remove');
  });
});
