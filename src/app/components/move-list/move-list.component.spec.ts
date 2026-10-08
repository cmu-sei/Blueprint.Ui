// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Move, MoveService, Msel, MselRole } from 'src/app/generated/blueprint.api';
import { MoveStore } from 'src/app/data/move/move.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { MoveListComponent } from './move-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';

@Component({ selector: 'app-duration-view', template: '', standalone: false })
class DurationViewStub {
  @Input() startTime: Date;
  @Input() durationSeconds: number;
  @Input() showRealTime: boolean;
}

const ME = 'user-me';
const MOVE: Move = { id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0, description: 'Initial access', situationTime: new Date('2026-01-01T12:00:00Z') };

function msel(roles: MselRole[] = []): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    userMselRoles: roles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
  };
}

async function renderMoves(overrides: { canEditMsel?: boolean; roles?: MselRole[] } = {}) {
  const { canEditMsel = true, roles = [] } = overrides;
  const moveApi = {
    deleteMove: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<MoveService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(MoveListComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatMenuModule,
      MatPaginatorModule,
      MatSortModule,
      MatTableModule,
    ],
    declarations: [MoveListComponent, DurationViewStub],
    providers: [
      { provide: MoveService, useValue: moveApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
      // The MSEL page loads the MSEL and its moves; the stores are seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(roles)]);
          store.setActive('msel-1');
          return store;
        },
      },
      {
        provide: MoveStore,
        useFactory: () => {
          const store = new MoveStore();
          store.set([structuredClone(MOVE)]);
          return store;
        },
      },
    ],
    inputs: { canEditMsel, loggedInUserId: ME },
  });
  return { ...rendered, moveApi, confirm };
}

const table = () => screen.getByRole('table');
const ACTIONS = ['Add new move', 'Edit Move 1', 'Delete Move 1'];

describe('MoveListComponent', () => {
  /**
   * Verifies: with canEditMsel, as the owner, or as a Move Editor, the moves can be added, edited and deleted.
   * Interacts with: real MselQuery and MoveQuery (seeded), MselPlus.hasRole.
   * Data: canEditMsel true with no role; or canEditMsel false with the Owner or MoveEditor role.
   */
  it.each([
    { label: 'with canEditMsel', canEditMsel: true, roles: [] },
    { label: 'as the MSEL owner', canEditMsel: false, roles: [MselRole.Owner] },
    { label: 'as a Move Editor', canEditMsel: false, roles: [MselRole.MoveEditor] },
  ])('offers move actions $label', async ({ canEditMsel, roles }) => {
    await renderMoves({ canEditMsel, roles });

    for (const name of ACTIONS) {
      expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  /**
   * Verifies: without canEditMsel, Owner or MoveEditor the moves are listed with no add, edit or delete, even for an MSEL Editor and Approver.
   * Interacts with: MselPlus.hasRole, MoveListComponent template.
   * Data: canEditMsel false; MSEL roles Editor and Approver (near miss).
   */
  it('hides move actions without canEditMsel or a move role', async () => {
    await renderMoves({ canEditMsel: false, roles: [MselRole.Editor, MselRole.Approver] });

    expect(within(table()).getByText('Initial access')).toBeInTheDocument();
    for (const name of ACTIONS) {
      expect(within(table()).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  /**
   * Verifies: confirming Delete removes the move through the API and from the list.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), MoveService.deleteMove (stub), real MoveStore.
   * Data: canEditMsel true.
   */
  it('deletes a move after confirmation', async () => {
    const { moveApi, confirm } = await renderMoves({ canEditMsel: true });
    const user = userEvent.setup();

    await user.click(within(table()).getByRole('button', { name: 'Delete Move 1' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Move' }));
    expect(moveApi.deleteMove).toHaveBeenCalledWith('move-1');
    expect(within(table()).queryByText('Initial access')).not.toBeInTheDocument();
  });
});
