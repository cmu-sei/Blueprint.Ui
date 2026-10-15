// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
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
import { ClipboardModule } from 'ngx-clipboard';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Invitation, InvitationService, Msel, MselItemStatus, MselRole } from 'src/app/generated/blueprint.api';
import { InvitationStore } from 'src/app/data/invitation/invitation.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { TeamStore } from 'src/app/data/team/team.store';
import { InvitationListComponent } from './invitation-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';

const ME = 'user-me';
const INVITATION: Invitation = { id: 'inv-1', mselId: 'msel-1', teamId: 'team-1', emailDomain: 'example.com', maxUsersAllowed: 5, userCount: 2 };

function msel(overrides: Partial<Msel> = {}): Msel {
  return { id: 'msel-1', name: 'Exercise Alpha', createdBy: 'someone-else', status: MselItemStatus.Deployed, isTemplate: false, userMselRoles: [], ...overrides };
}

async function renderInvitations(overrides: { canEditMsel?: boolean; activeMsel?: Msel } = {}) {
  const { canEditMsel = true, activeMsel = msel() } = overrides;
  const invitationApi = {
    deleteInvitation: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<InvitationService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(InvitationListComponent, {
    imports: [
      ClipboardModule,
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatSortModule,
      MatTableModule,
    ],
    declarations: [InvitationListComponent],
    providers: [
      { provide: InvitationService, useValue: invitationApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
      // The MSEL page loads the MSEL, its teams and invitations; the stores are seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([activeMsel]);
          store.setActive(activeMsel.id);
          return store;
        },
      },
      {
        provide: TeamStore,
        useFactory: () => {
          const store = new TeamStore();
          store.set([{ id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' }]);
          return store;
        },
      },
      {
        provide: InvitationStore,
        useFactory: () => {
          const store = new InvitationStore();
          store.set([structuredClone(INVITATION)]);
          return store;
        },
      },
    ],
    inputs: { canEditMsel, loggedInUserId: ME },
  });
  return { ...rendered, invitationApi, confirm };
}

const table = () => screen.getByRole('table');
const ACTIONS = ['Add an invitation', 'Edit example.com invitation', 'Delete example.com invitation'];

describe('InvitationListComponent', () => {
  /**
   * Verifies: with canEditMsel the invitations can be added, edited and deleted, and a deployed MSEL's invitation link can be copied.
   * Interacts with: real MselQuery, TeamQuery and InvitationQuery (seeded), InvitationListComponent template.
   * Data: canEditMsel true; deployed MSEL; one invitation for BLUE at example.com, 3 uses left.
   */
  it('offers invitation actions with canEditMsel', async () => {
    await renderInvitations({ canEditMsel: true });

    for (const name of ACTIONS) {
      expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(table()).getByRole('button', { name: /^Copy Invitation Link: .*\/join\/\?msel=msel-1&team=team-1$/ })).toBeEnabled();
    expect(within(table()).getByText('3')).toBeInTheDocument();
  });

  /**
   * Verifies: the MSEL owner may manage invitations without canEditMsel.
   * Interacts with: MselPlus.hasRole (owner by role).
   * Data: canEditMsel false; the user holds the MSEL Owner role.
   */
  it('lets the MSEL owner manage invitations without canEditMsel', async () => {
    await renderInvitations({
      canEditMsel: false,
      activeMsel: msel({ userMselRoles: [{ id: 'umr-1', userId: ME, mselId: 'msel-1', role: MselRole.Owner }] }),
    });

    for (const name of ACTIONS) {
      expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  /**
   * Verifies: a non-owner without canEditMsel sees the invitations and the copy button but cannot add, edit or delete.
   * Interacts with: MselPlus.hasRole, InvitationListComponent template.
   * Data: canEditMsel false; the user is an MSEL Editor (near miss: not Owner).
   */
  it('hides invitation changes without canEditMsel for a non-owner', async () => {
    await renderInvitations({
      canEditMsel: false,
      activeMsel: msel({ userMselRoles: [{ id: 'umr-1', userId: ME, mselId: 'msel-1', role: MselRole.Editor }] }),
    });

    expect(within(table()).getByText('example.com')).toBeInTheDocument();
    expect(within(table()).getByRole('button', { name: /^Copy Invitation Link/ })).toBeInTheDocument();
    for (const name of ACTIONS) {
      expect(within(table()).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  /**
   * Verifies: before the MSEL is deployed there is no invitation link to copy.
   * Interacts with: getInvitationLink.
   * Data: a pending, non-template MSEL.
   */
  it('disables the invitation link until the MSEL is deployed', async () => {
    await renderInvitations({ activeMsel: msel({ status: MselItemStatus.Pending }) });

    expect(within(table()).getByRole('button', { name: /^Copy Invitation Link/ })).toBeDisabled();
  });

  /**
   * Verifies: confirming Delete removes the invitation through the API and from the list.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), InvitationService.deleteInvitation (stub), real InvitationStore.
   * Data: canEditMsel true.
   */
  it('deletes an invitation after confirmation', async () => {
    const { invitationApi, confirm } = await renderInvitations({ canEditMsel: true });
    const user = userEvent.setup();

    await user.click(within(table()).getByRole('button', { name: 'Delete example.com invitation' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Invitation' }));
    expect(invitationApi.deleteInvitation).toHaveBeenCalledWith('inv-1');
    expect(screen.getByText('No invitations found')).toBeInTheDocument();
  });
});
