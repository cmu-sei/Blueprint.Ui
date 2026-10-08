// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  CompetencyFramework,
  CompetencyFrameworkService,
  Msel,
  MselCompetency,
  MselCompetencyService,
  MselRole,
  SystemPermission,
  SystemPermissionsService,
  Team,
  TeamCompetency,
  TeamCompetencyService,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselCompetenciesComponent } from './msel-competencies.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { unstubbed } from 'src/app/test-utils/unstubbed';

const ME = 'user-me';
const BLUE: Team = { id: 'team-1', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' };
const POOL: MselCompetency = {
  id: 'mc-1',
  mselId: 'msel-1',
  competencyId: 'c-1',
  competency: { id: 'c-1', competencyFrameworkId: 'fw-1', idNumber: 'K0001', shortName: 'Networking' },
};
const ALL_BUT_MANAGE_MSELS = Object.values(SystemPermission).filter((p) => p !== SystemPermission.ManageMsels);

function msel(myRoles: MselRole[] = []): Msel {
  return {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'someone-else',
    teams: [BLUE],
    userMselRoles: myRoles.map((role, i) => ({ id: `umr-${i}`, userId: ME, mselId: 'msel-1', role })),
  };
}

async function renderCompetencies(overrides: { permissions?: SystemPermission[]; myRoles?: MselRole[] } = {}) {
  const { permissions = [], myRoles = [] } = overrides;
  const poolApi = {
    getMselCompetencies: vi.fn(() => of(structuredClone([POOL]))),
    deleteMselCompetency: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<MselCompetencyService>;
  const teamCompetencyApi = {
    getMselTeamCompetencies: vi.fn(() => of<TeamCompetency[]>([])),
    createTeamCompetency: vi.fn((tc: TeamCompetency) => of<TeamCompetency>({ ...tc, id: 'tc-1' })),
  } satisfies ApiStub<TeamCompetencyService>;
  const frameworkApi = {
    getCompetencyFrameworks: vi.fn(() => of<CompetencyFramework[]>([{ id: 'fw-1', name: 'NICE', version: '2.1.0' }])),
  } satisfies ApiStub<CompetencyFrameworkService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  // MselCompetenciesComponent loads the permissions itself in ngOnInit, so the
  // real service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs({ system: permissions });
  const rendered = await renderComponent(MselCompetenciesComponent, {
    imports: [
      MatButtonModule,
      MatCheckboxModule,
      MatExpansionModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatProgressSpinnerModule,
      MatSelectModule,
      MatSortModule,
      MatTableModule,
      MatToolbarModule,
      MatTooltipModule,
    ],
    declarations: [MselCompetenciesComponent],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: MselCompetencyService, useValue: poolApi },
      { provide: TeamCompetencyService, useValue: teamCompetencyApi },
      { provide: CompetencyFrameworkService, useValue: frameworkApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([msel(myRoles)]);
          store.setActive('msel-1');
          return store;
        },
      },
    ],
    inputs: { loggedInUserId: ME },
  });
  return { ...rendered, poolApi, teamCompetencyApi, confirm };
}

const poolTable = () => within(document.querySelector('.pool-table-scroll') as HTMLElement);
// Inside the expanded pool row, queries go by title: jsdom's CSS engine throws on
// the component's `border: 1px solid var(...)` rules when a role query computes styles there.
async function expandK0001() {
  const user = userEvent.setup();
  await user.click(poolTable().getByText('Networking'));
  return user;
}

describe('MselCompetenciesComponent', () => {
  /**
   * Verifies: the MSEL's competency pool and team assignments are loaded and listed.
   * Interacts with: MselCompetencyService.getMselCompetencies, TeamCompetencyService.getMselTeamCompetencies, CompetencyFrameworkService.getCompetencyFrameworks (stubs).
   * Data: K0001 Networking in the pool.
   */
  it('lists the competency pool', async () => {
    const { poolApi, teamCompetencyApi } = await renderCompetencies({ permissions: [SystemPermission.ManageMsels] });

    expect(poolApi.getMselCompetencies).toHaveBeenCalledWith('msel-1');
    expect(teamCompetencyApi.getMselTeamCompetencies).toHaveBeenCalledWith('msel-1');
    expect(poolTable().getByText('K0001')).toBeInTheDocument();
    expect(poolTable().getByText('Knowledge')).toBeInTheDocument();
  });

  // The users who may edit the pool: ManageMsels, or the Owner role.
  const EDITORS = [
    { label: 'with ManageMsels', permissions: [SystemPermission.ManageMsels], myRoles: [] },
    { label: 'as the MSEL owner', permissions: [], myRoles: [MselRole.Owner] },
  ];

  /**
   * Verifies: with ManageMsels, or as the owner, a framework can be chosen and competencies removed.
   * Interacts with: real PermissionDataService over SystemPermissionsService (stub), MselPlus.hasRole.
   * Data: ManageMsels with no role; or the Owner role. K0001 in the pool.
   */
  it.each(EDITORS)('edits the competency pool $label', async ({ permissions, myRoles }) => {
    await renderCompetencies({ permissions, myRoles });

    expect(screen.getByLabelText('Competency Framework')).toHaveAttribute('aria-disabled', 'false');
    expect(poolTable().getByTitle('Remove from MSEL')).toBeInTheDocument();
  });

  /**
   * Verifies: with ManageMsels, or as the owner, a team can be assigned to a pooled competency.
   * Interacts with: the expanded pool row, TeamCompetencyService.createTeamCompetency (stub).
   * Data: ManageMsels with no role; or the Owner role. BLUE not yet assigned to K0001.
   */
  it.each(EDITORS)('assigns a team to a competency $label', async ({ permissions, myRoles }) => {
    const { teamCompetencyApi } = await renderCompetencies({ permissions, myRoles });

    const user = await expandK0001();
    await user.click(poolTable().getByTitle('Add BLUE'));

    expect(teamCompetencyApi.createTeamCompetency).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'team-1', competencyId: 'c-1' }));
  });

  /**
   * Verifies: without ManageMsels and not the owner the pool is read-only: no framework choice, no Remove, and team assignment is disabled.
   * Interacts with: real PermissionDataService (stubbed grants), MselCompetenciesComponent.canEditMsel.
   * Data: every permission but ManageMsels (near miss: EditMsels); MSEL roles Editor and Approver.
   */
  it('lists the competency pool read-only without ManageMsels or ownership', async () => {
    await renderCompetencies({ permissions: ALL_BUT_MANAGE_MSELS, myRoles: [MselRole.Editor, MselRole.Approver] });

    expect(screen.getByLabelText('Competency Framework')).toHaveAttribute('aria-disabled', 'true');
    expect(poolTable().queryByTitle('Remove from MSEL')).not.toBeInTheDocument();
    await expandK0001();
    expect(poolTable().getByTitle('Add BLUE')).toBeDisabled();
  });

  /**
   * Verifies: confirming Remove deletes the competency from the MSEL and removes it from the pool table.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), MselCompetencyService.deleteMselCompetency (stub), real MselCompetencyDataService and store.
   * Data: ManageMsels; K0001.
   */
  it('removes a competency after confirmation', async () => {
    const { fixture, poolApi, confirm } = await renderCompetencies({ permissions: [SystemPermission.ManageMsels] });
    const user = userEvent.setup();

    expect(poolTable().getByText('K0001')).toBeInTheDocument();
    await user.click(poolTable().getByTitle('Remove from MSEL'));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Remove Competency' }));
    expect(poolApi.deleteMselCompetency).toHaveBeenCalledWith('mc-1');
    fixture.detectChanges();
    expect(poolTable().queryByText('K0001')).not.toBeInTheDocument();
  });
});
