// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NEVER, of } from 'rxjs';
import { ComnAuthService, CrucibleDialogService } from '@cmusei/crucible-common';
import { Msel, MselItemStatus, MselRole, MselService, SystemPermission, SystemPermissionsService } from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { ManageComponent } from './manage.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { mselLoadApiProviders, mselLoadApiStubs } from 'src/app/test-utils/msel-load-api-stubs';
import { unstubbed } from 'src/app/test-utils/unstubbed';

@Component({ selector: 'app-topbar', template: '', standalone: false })
class TopbarStub {
  @Input() title: string;
  @Input() topbarView: unknown;
  @Input() imageFilePath: string;
  @Output() urlNavigate = new EventEmitter<string>();
}
@Component({ selector: 'app-invitation-list', template: '', standalone: false })
class InvitationListStub {
  @Input() loggedInUserId: string;
  @Input() canEditMsel: boolean;
  @Input() hideSearch: boolean;
}

const ME = 'user-me';
const ALL_BUT_EDIT_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.EditMsels);

function msel(overrides: Partial<Msel> = {}): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    description: 'A deployed exercise',
    status: MselItemStatus.Deployed,
    createdBy: 'someone-else',
    startTime: '2026-01-01T12:00:00Z' as unknown as Date,
    durationSeconds: 3600,
    userMselRoles: [],
    ...overrides,
  };
}

async function renderManage(overrides: { permissions?: SystemPermission[]; activeMsel?: Msel } = {}) {
  const { permissions = [], activeMsel = msel() } = overrides;
  const apis = mselLoadApiStubs({ msel: activeMsel });
  // Archiving answers with the archived MSEL, which sends the window to the
  // logout page; jsdom cannot navigate, so the request stays pending.
  const mselApi = { ...apis.msel, archive: vi.fn(() => NEVER) } satisfies ApiStub<MselService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  // ManageComponent loads the permissions itself in ngOnInit, so the real
  // service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const { route } = activatedRouteStub({ msel: 'msel-1' });
  const rendered = await renderComponent(ManageComponent, {
    imports: [MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
    declarations: [ManageComponent, TopbarStub, InvitationListStub],
    providers: [
      ...mselLoadApiProviders(apis),
      { provide: MselService, useValue: mselApi },
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: ActivatedRoute, useValue: route },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
      {
        provide: ComnAuthService,
        useValue: { user$: of({ profile: { sub: ME, name: 'Me' } }) } as Pick<ComnAuthService, 'user$'>,
      },
    ],
  });
  rendered.fixture.detectChanges();
  return { ...rendered, apis, mselArchive: mselApi.archive, confirm };
}

function invitations(fixture: ComponentFixture<unknown>): InvitationListStub | undefined {
  return fixture.debugElement.query(By.directive(InvitationListStub))?.componentInstance;
}

describe('ManageComponent', () => {
  /**
   * Verifies: with EditMsels, or as the owner, the deployed MSEL can be managed: its name, the end time, End Event and the invitations are shown.
   * Interacts with: real PermissionDataService over SystemPermissionsService (stub), MselService.getMsel (stub), real MselQuery, MselPlus.hasRole.
   * Data: msel=msel-1, deployed; EditMsels with no role, or no permission as the Owner.
   */
  it.each([
    { label: 'with EditMsels', permissions: [SystemPermission.EditMsels], activeMsel: msel() },
    { label: 'as the owner', permissions: [], activeMsel: msel({ userMselRoles: [{ id: 'umr-1', userId: ME, mselId: 'msel-1', role: MselRole.Owner }] }) },
  ])('manages the deployed MSEL $label', async ({ permissions, activeMsel }) => {
    const { fixture, apis } = await renderManage({ permissions, activeMsel });

    expect(apis.msel.getMsel).toHaveBeenCalledWith('msel-1');
    expect(apis.invitation.getInvitations).toHaveBeenCalledWith('msel-1');
    expect(screen.getByText('Exercise Alpha')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('End Date / Time')).toBeInTheDocument();
    expect(screen.getByTitle('End Event')).toBeInTheDocument();
    expect(invitations(fixture)?.hideSearch).toBe(true);
  });

  /**
   * Verifies: without EditMsels and not the owner the page shows only that there is nothing to manage.
   * Interacts with: real PermissionDataService (stubbed grants), MselPlus.hasRole.
   * Data: every permission but EditMsels (near miss: ManageMsels); MSEL roles Editor and Approver.
   */
  it('shows nothing to manage without EditMsels or ownership', async () => {
    const { fixture } = await renderManage({
      permissions: ALL_BUT_EDIT_MSELS,
      activeMsel: msel({ userMselRoles: [{ id: 'umr-1', userId: ME, mselId: 'msel-1', role: MselRole.Editor }, { id: 'umr-2', userId: ME, mselId: 'msel-1', role: MselRole.Approver }] }),
    });

    expect(screen.getByRole('heading', { name: 'You have nothing to manage.' })).toBeInTheDocument();
    expect(screen.queryByTitle('End Event')).not.toBeInTheDocument();
    expect(invitations(fixture)).toBeUndefined();
  });

  /**
   * Verifies: the invitation list on this page gets no canEditMsel for an EditMsels user (current behavior).
   * Interacts with: InvitationListStub input.
   * Data: EditMsels; no MSEL role.
   */
  it('leaves the invitation list without canEditMsel', async () => {
    const { fixture } = await renderManage({ permissions: [SystemPermission.EditMsels] });

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(invitations(fixture)?.canEditMsel).toBeUndefined();
  });

  /**
   * Verifies: an EditMsels user who is not the owner is offered End Event, and confirming it sends the archive request (current behavior).
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), MselService.archive (stub, pending).
   * Data: EditMsels; no MSEL role; deployed MSEL.
   */
  it('offers End Event to an EditMsels user who is not the owner', async () => {
    const { confirm, mselArchive } = await renderManage({ permissions: [SystemPermission.EditMsels] });
    const user = userEvent.setup();

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(screen.getByRole('button', { name: 'End Event' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'End Event' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'End the Event' }));
    expect(mselArchive).toHaveBeenCalledWith('msel-1');
  });
});
