// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import {
  PlayerApplication,
  PlayerApplicationTeam,
  PlayerApplicationTeamService,
  Team,
} from 'src/app/generated/blueprint.api';
import { PlayerApplicationStore } from 'src/app/data/player-application/player-application.store';
import { PlayerApplicationTeamDataService } from 'src/app/data/team/player-application-team-data.service';
import { TeamStore } from 'src/app/data/team/team.store';
import { PlayerTeamAppOrderComponent } from './player-team-app-order.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';

const BLUE: Team = { id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' };
const APPS: PlayerApplication[] = [
  { id: 'app-1', mselId: 'msel-1', name: 'Mail' },
  { id: 'app-2', mselId: 'msel-1', name: 'Chat' },
];
const APP_TEAMS: PlayerApplicationTeam[] = [
  { id: 'pat-1', playerApplicationId: 'app-1', teamId: 'team-1', displayOrder: 1 },
  { id: 'pat-2', playerApplicationId: 'app-2', teamId: 'team-1', displayOrder: 2 },
];

async function renderAppOrder(overrides: { canEdit?: boolean } = {}) {
  const { canEdit = true } = overrides;
  const appTeamApi = {
    getMselPlayerApplicationTeams: vi.fn(() => of(structuredClone(APP_TEAMS))),
    updatePlayerApplicationTeam: vi.fn((id: string, pat: PlayerApplicationTeam) => of(structuredClone(pat))),
  } satisfies ApiStub<PlayerApplicationTeamService>;
  const rendered = await renderComponent(PlayerTeamAppOrderComponent, {
    imports: [MatButtonModule, MatIconModule, MatTableModule],
    declarations: [PlayerTeamAppOrderComponent],
    providers: [
      { provide: PlayerApplicationTeamService, useValue: appTeamApi },
      // The MSEL page loads the teams and applications; the stores are seeded instead.
      {
        provide: TeamStore,
        useFactory: () => {
          const store = new TeamStore();
          store.set([structuredClone(BLUE)]);
          return store;
        },
      },
      {
        provide: PlayerApplicationStore,
        useFactory: () => {
          const store = new PlayerApplicationStore();
          store.set(structuredClone(APPS));
          return store;
        },
      },
    ],
    inputs: { canEdit, loggedInUserId: 'user-1', mselTeamList: [BLUE] },
  });
  TestBed.inject(PlayerApplicationTeamDataService).getPlayerApplicationTeamsFromApi('msel-1');
  rendered.fixture.detectChanges();
  const user = userEvent.setup();
  await user.click(within(screen.getByRole('table')).getByText('BLUE - Blue Team'));
  return { ...rendered, appTeamApi, user };
}

function appRow(name: string) {
  return within(screen.getByText(name).closest('.data-row') as HTMLElement);
}

describe('PlayerTeamAppOrderComponent', () => {
  /**
   * Verifies: with canEdit the expanded team's applications can be moved, except past either end.
   * Interacts with: row click to expand, real PlayerApplicationTeamDataService and PlayerApplicationQuery.
   * Data: canEdit true; BLUE sees Mail (1) then Chat (2).
   */
  it('enables reordering with canEdit', async () => {
    await renderAppOrder({ canEdit: true });

    expect(appRow('Mail').getByRole('button', { name: 'Move player application up' })).toBeDisabled();
    expect(appRow('Mail').getByRole('button', { name: 'Move player application down' })).toBeEnabled();
    expect(appRow('Chat').getByRole('button', { name: 'Move player application up' })).toBeEnabled();
    expect(appRow('Chat').getByRole('button', { name: 'Move player application down' })).toBeDisabled();
  });

  /**
   * Verifies: without canEdit every reorder button is disabled.
   * Interacts with: PlayerTeamAppOrderComponent template.
   * Data: canEdit false; BLUE sees Mail then Chat.
   */
  it('disables reordering without canEdit', async () => {
    await renderAppOrder({ canEdit: false });

    for (const name of ['Mail', 'Chat']) {
      expect(appRow(name).getByRole('button', { name: 'Move player application up' })).toBeDisabled();
      expect(appRow(name).getByRole('button', { name: 'Move player application down' })).toBeDisabled();
    }
  });

  /**
   * Verifies: moving the first application down saves it at display order 2.
   * Interacts with: PlayerApplicationTeamService.updatePlayerApplicationTeam (stub).
   * Data: canEdit true; Mail moved down.
   */
  it('saves the new display order', async () => {
    const { appTeamApi, user } = await renderAppOrder({ canEdit: true });

    await user.click(appRow('Mail').getByRole('button', { name: 'Move player application down' }));

    expect(appTeamApi.updatePlayerApplicationTeam).toHaveBeenCalledWith('pat-1', expect.objectContaining({ displayOrder: 2 }));
  });
});
