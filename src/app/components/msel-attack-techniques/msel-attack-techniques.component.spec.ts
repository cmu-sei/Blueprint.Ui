// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  AttackRelease,
  AttackReleaseService,
  AttackTactic,
  AttackTechnique,
  Msel,
  MselAttackTechnique,
  MselAttackTechniqueService,
  SystemPermissionsService,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselAttackTechniquesComponent } from './msel-attack-techniques.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionApiStubs } from 'src/app/test-utils/mock-permission-data.service';
import { unstubbed } from 'src/app/test-utils/unstubbed';

const ME = 'user-me';
const MSEL: Msel = { id: 'msel-1', name: 'Exercise Alpha', createdBy: 'someone-else', userMselRoles: [] };
const T1059: MselAttackTechnique = {
  id: 'mat-1',
  mselId: 'msel-1',
  attackTechniqueId: 'at-1',
  attackTechnique: { id: 'at-1', attackReleaseId: 'rel-1', externalId: 'T1059', name: 'Command and Scripting Interpreter', url: 'https://attack.mitre.org/techniques/T1059' },
};
const TERMS_OF_USE = 'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/';
const ATLAS_RELEASE: AttackRelease = { id: 'rel-1', domain: 'ATLAS', name: 'ATLAS', version: '2026.10' };
const AML_T0000: AttackTechnique = {
  id: 'at-1', attackReleaseId: 'rel-1', externalId: 'AML.T0000', name: 'Search Open Technical Databases',
  tactics: ['reconnaissance'], url: 'https://atlas.mitre.org/techniques/AML.T0000',
};
const ATLAS_IN_POOL: MselAttackTechnique = { id: 'mat-1', mselId: 'msel-1', attackTechniqueId: 'at-1', attackTechnique: AML_T0000 };

// With no release imported the Add Techniques browser stays empty and only the pool can put MITRE content on screen;
// an imported release is browsed as soon as the component loads it.
async function renderTechniques(pool: MselAttackTechnique[], releases: AttackRelease[] = [], techniques: AttackTechnique[] = []) {
  const poolApi = {
    getMselAttackTechniques: vi.fn(() => of(structuredClone(pool))),
  } satisfies ApiStub<MselAttackTechniqueService>;
  const releaseApi = {
    getAttackReleases: vi.fn(() => of(structuredClone(releases))),
    getAttackTactics: vi.fn(() => of<AttackTactic[]>([])),
    getAttackTechniques: vi.fn(() => of(structuredClone(techniques))),
  } satisfies ApiStub<AttackReleaseService>;
  // MselAttackTechniquesComponent loads the permissions itself in ngOnInit, so the
  // real service is provided over the stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs();
  const rendered = await renderComponent(MselAttackTechniquesComponent, {
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
      MatTableModule,
      MatTooltipModule,
    ],
    declarations: [MselAttackTechniquesComponent],
    providers: [
      { provide: SystemPermissionsService, useValue: permissionApis.systemPermissions },
      PermissionDataService,
      { provide: MselAttackTechniqueService, useValue: poolApi },
      { provide: AttackReleaseService, useValue: releaseApi },
      unstubbed(CrucibleDialogService),
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([MSEL]);
          store.setActive('msel-1');
          return store;
        },
      },
    ],
    inputs: { loggedInUserId: ME },
  });
  return { ...rendered, poolApi, releaseApi };
}

describe('MselAttackTechniquesComponent', () => {
  /**
   * Verifies: with a technique in the pool, MITRE's copyright and trademark notice follows the tables, with its Terms of Use link.
   * Interacts with: MselAttackTechniqueService.getMselAttackTechniques (stub), showsMitreContent.
   * Data: T1059 in the pool; no release imported.
   */
  it('attributes MITRE when the pool lists techniques', async () => {
    const { poolApi } = await renderTechniques([T1059]);

    expect(poolApi.getMselAttackTechniques).toHaveBeenCalledWith('msel-1');
    expect(screen.getByRole('link', { name: 'T1059' })).toBeInTheDocument();
    expect(screen.getByText(/© 2026 The MITRE Corporation/)).toBeInTheDocument();
    expect(screen.getByText(/MITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation/)).toBeInTheDocument();
    expect(screen.queryByText(/MITRE ATLAS/)).not.toBeInTheDocument();
    const terms = screen.getByRole('link', { name: 'Terms of Use' });
    expect(terms).toHaveAttribute('href', TERMS_OF_USE);
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms).toHaveAttribute('rel', 'noopener');
  });

  /**
   * Verifies: with nothing of MITRE's on screen there is no notice to give.
   * Interacts with: showsMitreContent.
   * Data: an empty pool; no release imported.
   */
  it('gives no attribution for an empty pool', async () => {
    await renderTechniques([]);

    expect(screen.getByText(/No techniques yet/)).toBeInTheDocument();
    expect(screen.queryByText(/The MITRE Corporation/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Terms of Use' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: techniques from an ATLAS release add MITRE's ATLAS trademark sentence to the ATT&CK notice.
   * Interacts with: AttackReleaseService.getAttackReleases/getAttackTechniques (stubs), showsAtlasContent.
   * Data: the ATLAS 2026.10 release imported, AML.T0000 in its pool and in the (collapsed) browser.
   */
  it('also credits MITRE ATLAS when the techniques are from an ATLAS release', async () => {
    const { releaseApi } = await renderTechniques([ATLAS_IN_POOL], [ATLAS_RELEASE], [AML_T0000]);

    expect(releaseApi.getAttackTechniques).toHaveBeenCalledWith('rel-1');
    expect(screen.getByRole('link', { name: 'AML.T0000' })).toHaveAttribute('href', 'https://atlas.mitre.org/techniques/AML.T0000');
    expect(screen.getByText(/MITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation/)).toBeInTheDocument();
    expect(screen.getByText(/MITRE ATLAS™ is a trademark of The MITRE Corporation\./)).toBeInTheDocument();
  });
});
