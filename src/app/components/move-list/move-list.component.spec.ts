// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { afterEach, describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, input } from '@angular/core';
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
import { MoveEditDialogComponent } from '../move-edit-dialog/move-edit-dialog.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { TimezoneAbbrPipe } from 'src/app/utilities/timezone-abbr';
import { renderComponent } from 'src/app/test-utils/render-component';

@Component({ selector: 'app-duration-view', template: '', standalone: false })
class DurationViewStub {
  readonly startTime = input<Date>(undefined);
  readonly durationSeconds = input<number>(undefined);
  readonly showRealTime = input<boolean>(undefined);
}

const ME = 'user-me';
const MOVE: Move = { id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0, description: 'Initial access', situationTime: new Date('2026-01-01T12:00:00Z') };
// A move of another MSEL. A user with EditMsels is sent every MSEL's move changes, so the store can hold one.
const OTHER_MSEL_MOVE: Move = { ...MOVE, id: 'move-other', mselId: 'msel-2', moveNumber: 5, deltaSeconds: 7200, description: 'Other exercise' };

function msel(roles: MselRole[] = []): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    userMselRoles: roles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
  };
}

async function renderMoves(overrides: { canEditMsel?: boolean; roles?: MselRole[]; moves?: Move[] } = {}) {
  const { canEditMsel = true, roles = [], moves = [MOVE] } = overrides;
  const moveApi = {
    deleteMove: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<MoveService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  // Add and Edit open MoveEditDialogComponent and subscribe to its editComplete; the
  // stand-in ref carries that emitter, which never fires here.
  const editRef = Object.assign(dialogRefStub<MoveEditDialogComponent>().dialogRef, {
    componentInstance: { editComplete: new EventEmitter<unknown>() },
  });
  const open = vi.fn().mockReturnValue(editRef);
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
    declarations: [MoveListComponent, DurationViewStub, TimezoneAbbrPipe],
    providers: [
      { provide: MoveService, useValue: moveApi },
      { provide: CrucibleDialogService, useValue: dialog },
      { provide: MatDialog, useValue: { open } satisfies Pick<MatDialog, 'open'> },
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
          store.set(structuredClone(moves));
          return store;
        },
      },
    ],
    inputs: { canEditMsel, loggedInUserId: ME },
  });
  return { ...rendered, moveApi, confirm, open };
}

const table = () => screen.getByRole('table');
const ACTIONS = ['Add new move', 'Edit Move 1', 'Delete Move 1'];

describe('MoveListComponent', () => {
  // A test that sets TZ runs in a zone with daylight saving time; this restores the host's.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  /**
   * Verifies: a new move defaults to the next number and the latest start offset of this MSEL's moves, not of another MSEL's moves in the store.
   * Interacts with: the Add new move button, MoveListComponent.addOrEditMove, MatDialog.open (stub), real MoveQuery (seeded).
   * Data: this MSEL's Move 1 at +0s; another MSEL's Move 5 at +7200s.
   */
  it("defaults a new move from this MSEL's moves only", async () => {
    const { open } = await renderMoves({ moves: [MOVE, OTHER_MSEL_MOVE] });
    const user = userEvent.setup();

    expect(within(table()).queryByText('Other exercise')).not.toBeInTheDocument();
    await user.click(within(table()).getByRole('button', { name: 'Add new move' }));

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toBe(MoveEditDialogComponent);
    expect(open.mock.calls[0][1].data.move).toEqual(
      expect.objectContaining({ moveNumber: 2, deltaSeconds: 0, mselId: 'msel-1' })
    );
  });

  /**
   * Verifies: the out-of-order warning shows when this MSEL's moves do not start in move order, and another MSEL's moves do not raise it.
   * Interacts with: MoveListComponent.badMoveTimeOrder in the template, real MoveQuery (seeded).
   * Data: this MSEL's Move 1 at +0s and Move 2 at +3600s or +0s; another MSEL's Move 1 at +9999s.
   */
  it.each([
    { label: 'stays hidden when only another MSEL is out of order', moveTwoSeconds: 3600, shown: false },
    { label: "shows when this MSEL's moves are out of order", moveTwoSeconds: 0, shown: true },
  ])('the start time order warning $label', async ({ moveTwoSeconds, shown }) => {
    const moves: Move[] = [
      MOVE,
      { ...MOVE, id: 'move-2', moveNumber: 2, deltaSeconds: moveTwoSeconds, description: 'Lateral movement' },
      { ...OTHER_MSEL_MOVE, moveNumber: 1, deltaSeconds: 9999 },
    ];

    await renderMoves({ moves });

    const warning = screen.queryByText(/The moves are not in ascending start time order!/);
    if (shown) {
      expect(warning).toBeInTheDocument();
    } else {
      expect(warning).not.toBeInTheDocument();
    }
  });

  /**
   * Verifies: each move's situation time is labelled with the zone in effect on that move's date.
   * Interacts with: real MoveQuery (seeded), DatePipe, TimezoneAbbrPipe in the situation time column.
   * Data: TZ America/New_York; Move 1 on 20 Oct 2026 16:00 UTC (EDT), Move 2 on 20 Nov 2026 17:00 UTC (EST, after DST ends).
   */
  it('labels each situation time with the zone in effect on that date', async () => {
    vi.stubEnv('TZ', 'America/New_York');
    const moves: Move[] = [
      { ...MOVE, situationTime: new Date('2026-10-20T16:00:00Z') },
      { ...MOVE, id: 'move-2', moveNumber: 2, deltaSeconds: 3600, description: 'Lateral movement', situationTime: new Date('2026-11-20T17:00:00Z') },
    ];

    await renderMoves({ moves });

    expect(within(table()).getByText('20 Oct 2026 12:00 EDT')).toBeInTheDocument();
    expect(within(table()).getByText('20 Nov 2026 12:00 EST')).toBeInTheDocument();
  });
});
