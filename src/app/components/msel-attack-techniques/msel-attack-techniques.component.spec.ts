// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { screen, within } from '@testing-library/angular';
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
  attackTechnique: { id: 'at-1', attackReleaseId: 'rel-1', domain: 'enterprise-attack', externalId: 'T1059', name: 'Command and Scripting Interpreter', url: 'https://attack.mitre.org/techniques/T1059' },
};
const TERMS_OF_USE = 'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/';
const D3FEND_TERMS_OF_USE = 'https://d3fend.mitre.org/tou/';
const ENTERPRISE_RELEASE: AttackRelease = { id: 'rel-1', domain: 'enterprise-attack', name: 'Enterprise ATT&CK', version: '17.1' };
const ATLAS_RELEASE: AttackRelease = { id: 'rel-1', domain: 'ATLAS', name: 'ATLAS', version: '2026.10' };
const D3FEND_RELEASE: AttackRelease = { id: 'rel-d3', domain: 'd3fend', name: 'MITRE D3FEND', version: '1.6.0' };
const AML_T0000: AttackTechnique = {
  id: 'at-1', attackReleaseId: 'rel-1', domain: 'ATLAS', externalId: 'AML.T0000', name: 'Search Open Technical Databases',
  tactics: ['reconnaissance'], url: 'https://atlas.mitre.org/techniques/AML.T0000',
};
const ATLAS_IN_POOL: MselAttackTechnique = { id: 'mat-1', mselId: 'msel-1', attackTechniqueId: 'at-1', attackTechnique: AML_T0000 };
const D3_CH: AttackTechnique = {
  id: 'at-d3', attackReleaseId: 'rel-d3', domain: 'd3fend', externalId: 'D3-CH', name: 'Credential Hardening',
  tactics: ['harden'], url: 'https://d3fend.mitre.org/technique/d3f:CredentialHardening/',
};
const D3_CH_IN_POOL: MselAttackTechnique = { id: 'mat-d3', mselId: 'msel-1', attackTechniqueId: 'at-d3', attackTechnique: D3_CH };

const attackSection = () => screen.getByText('Attack Techniques').closest('app-technique-pool') as HTMLElement;
const defensiveSection = () => screen.getByText('Defensive Techniques').closest('app-technique-pool') as HTMLElement;

// With no release imported the Add Techniques browsers stay empty and only the pool can put MITRE content on screen;
// an imported release is browsed by its family's section as soon as the component loads it.
async function renderTechniques(pool: MselAttackTechnique[], releases: AttackRelease[] = [], techniques: Record<string, AttackTechnique[]> = {}) {
  const poolApi = {
    getMselAttackTechniques: vi.fn(() => of(structuredClone(pool))),
  } satisfies ApiStub<MselAttackTechniqueService>;
  const releaseApi = {
    getAttackReleases: vi.fn(() => of(structuredClone(releases))),
    getAttackTactics: vi.fn(() => of<AttackTactic[]>([])),
    getAttackTechniques: vi.fn((id: string) => of(structuredClone(techniques[id] ?? []))),
  } satisfies ApiStub<AttackReleaseService>;
  // The sections load the permissions themselves in ngOnInit, so the real service is provided over the
  // stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs();
  const rendered = await renderComponent(MselAttackTechniquesComponent, {
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
   * Verifies: the tab has an Attack Techniques section and a Defensive Techniques section, each with a release
   * picker, and the pool is loaded once for both.
   * Interacts with: MselAttackTechniqueService.getMselAttackTechniques (stub), TechniquePoolComponent.title.
   * Data: an empty pool; no release imported.
   */
  it('shows an attack section and a defensive section', async () => {
    const { poolApi } = await renderTechniques([]);

    expect(poolApi.getMselAttackTechniques).toHaveBeenCalledTimes(1);
    expect(poolApi.getMselAttackTechniques).toHaveBeenCalledWith('msel-1');
    expect(screen.getByText('Attack Techniques')).toBeInTheDocument();
    expect(screen.getByText('Defensive Techniques')).toBeInTheDocument();
    expect(screen.getByLabelText('Attack Techniques release')).toBeInTheDocument();
    expect(screen.getByLabelText('Defensive Techniques release')).toBeInTheDocument();
    expect(screen.getAllByText(/No releases have been imported/)).toHaveLength(2);
  });

  /**
   * Verifies: with a technique in the pool, MITRE's copyright and trademark notice follows the tables once, with
   * its Terms of Use link and without the ATLAS or D3FEND marks.
   * Interacts with: MselAttackTechniqueService.getMselAttackTechniques (stub), showsMitreContent, linkHost.
   * Data: T1059 in the pool; no release imported.
   */
  it('attributes MITRE when the pool lists techniques', async () => {
    await renderTechniques([T1059]);

    expect(screen.getByRole('link', { name: 'T1059' })).toHaveAttribute('title', 'Open T1059 on attack.mitre.org');
    expect(screen.getAllByText(/© 2026 The MITRE Corporation/)).toHaveLength(1);
    expect(screen.getByText(/MITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation/)).toBeInTheDocument();
    expect(screen.queryByText(/MITRE ATLAS/)).not.toBeInTheDocument();
    expect(screen.queryByText(/MITRE D3FEND/)).not.toBeInTheDocument();
    const terms = screen.getByRole('link', { name: 'Terms of Use' });
    expect(terms).toHaveAttribute('href', TERMS_OF_USE);
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms).toHaveAttribute('rel', 'noopener');
    expect(screen.queryByRole('link', { name: 'D3FEND Terms of Use' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: with nothing of MITRE's on screen there is no notice to give.
   * Interacts with: showsMitreContent.
   * Data: an empty pool; no release imported.
   */
  it('gives no attribution for an empty pool', async () => {
    await renderTechniques([]);

    expect(screen.getAllByText(/No techniques yet/)).toHaveLength(2);
    expect(screen.queryByText(/The MITRE Corporation/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Terms of Use' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: techniques from an ATLAS release add MITRE's ATLAS trademark sentence to the ATT&CK notice, and
   * their links say they open on atlas.mitre.org.
   * Interacts with: AttackReleaseService.getAttackReleases/getAttackTechniques (stubs), showsAtlasContent, linkHost.
   * Data: the ATLAS 2026.10 release imported, AML.T0000 in its pool and in the (collapsed) browser.
   */
  it('also credits MITRE ATLAS when the techniques are from an ATLAS release', async () => {
    const { releaseApi } = await renderTechniques([ATLAS_IN_POOL], [ATLAS_RELEASE], { 'rel-1': [AML_T0000] });

    expect(releaseApi.getAttackTechniques).toHaveBeenCalledWith('rel-1');
    expect(screen.getByRole('link', { name: 'AML.T0000' })).toHaveAttribute('href', 'https://atlas.mitre.org/techniques/AML.T0000');
    expect(screen.getByRole('link', { name: 'AML.T0000' })).toHaveAttribute('title', 'Open AML.T0000 on atlas.mitre.org');
    expect(screen.getByText(/MITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation/)).toBeInTheDocument();
    expect(screen.getByText(/MITRE ATLAS™ is a trademark of The MITRE Corporation\./)).toBeInTheDocument();
    expect(screen.queryByText(/MITRE D3FEND/)).not.toBeInTheDocument();
  });

  /**
   * Verifies: a D3FEND technique is listed by the defensive section, not the attack one, its link opens on
   * d3fend.mitre.org, and the notice adds the D3FEND trademark sentence and the D3FEND Terms of Use link.
   * Interacts with: TechniquePoolComponent.family, showsD3fendContent, linkHost.
   * Data: T1059 and D3-CH in the pool; no release imported.
   */
  it('credits MITRE D3FEND and its terms of use when the defensive pool lists techniques', async () => {
    await renderTechniques([T1059, D3_CH_IN_POOL]);

    expect(within(attackSection()).getByRole('link', { name: 'T1059' })).toBeInTheDocument();
    expect(within(attackSection()).queryByRole('link', { name: 'D3-CH' })).not.toBeInTheDocument();
    expect(within(attackSection()).getByText('MSEL Techniques (1)')).toBeInTheDocument();
    const d3ch = within(defensiveSection()).getByRole('link', { name: 'D3-CH' });
    expect(d3ch).toHaveAttribute('href', 'https://d3fend.mitre.org/technique/d3f:CredentialHardening/');
    expect(d3ch).toHaveAttribute('title', 'Open D3-CH on d3fend.mitre.org');
    expect(within(defensiveSection()).getByText('MSEL Techniques (1)')).toBeInTheDocument();
    expect(screen.getAllByText(/© 2026 The MITRE Corporation/)).toHaveLength(1);
    expect(screen.getByText(/MITRE D3FEND™ is a trademark of The MITRE Corporation\./)).toBeInTheDocument();
    expect(screen.queryByText(/MITRE ATLAS/)).not.toBeInTheDocument();
    const terms = screen.getByRole('link', { name: 'D3FEND Terms of Use' });
    expect(terms).toHaveAttribute('href', D3FEND_TERMS_OF_USE);
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms).toHaveAttribute('rel', 'noopener');
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', TERMS_OF_USE);
  });

  /**
   * Verifies: each section's release picker offers only its family's releases, each browses its own, and the
   * defensive browser has no Platforms column.
   * Interacts with: AttackReleaseService.getAttackReleases/getAttackTechniques (stubs), TechniquePoolComponent.releases.
   * Data: Enterprise ATT&CK 17.1 and MITRE D3FEND 1.6.0 imported; an empty pool.
   */
  it('offers each section only its own releases', async () => {
    const { fixture, releaseApi } = await renderTechniques([], [ENTERPRISE_RELEASE, D3FEND_RELEASE], { 'rel-1': [T1059.attackTechnique], 'rel-d3': [D3_CH] });
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const attackSelect = await loader.getHarness(MatSelectHarness.with({ selector: '[aria-label="Attack Techniques release"]' }));
    const defensiveSelect = await loader.getHarness(MatSelectHarness.with({ selector: '[aria-label="Defensive Techniques release"]' }));

    expect(releaseApi.getAttackTechniques).toHaveBeenCalledWith('rel-1');
    expect(releaseApi.getAttackTechniques).toHaveBeenCalledWith('rel-d3');
    expect(await attackSelect.getValueText()).toBe('Enterprise ATT&CK 17.1');
    expect(await defensiveSelect.getValueText()).toBe('MITRE D3FEND 1.6.0');
    await attackSelect.open();
    expect(await Promise.all((await attackSelect.getOptions()).map(o => o.getText()))).toEqual(['Enterprise ATT&CK 17.1']);
    await attackSelect.close();
    await defensiveSelect.open();
    expect(await Promise.all((await defensiveSelect.getOptions()).map(o => o.getText()))).toEqual(['MITRE D3FEND 1.6.0']);
    await defensiveSelect.close();
    expect(within(attackSection()).getByText('Platforms')).toBeInTheDocument();
    expect(within(defensiveSection()).queryByText('Platforms')).not.toBeInTheDocument();
    expect(within(defensiveSection()).getByRole('link', { name: 'D3-CH' })).toBeInTheDocument();
    expect(screen.getByText(/MITRE D3FEND™ is a trademark of The MITRE Corporation\./)).toBeInTheDocument();
  });
});
