// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { AttackRelease, AttackReleaseService } from 'src/app/generated/blueprint.api';
import { AdminAttackReleasesComponent } from './admin-attack-releases.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';

const ENTERPRISE: AttackRelease = {
  id: 'rel-1', domain: 'enterprise-attack', name: 'Enterprise ATT&CK', version: '17.1',
  releaseDate: new Date('2025-04-22T00:00:00Z'), tacticCount: 14, techniqueCount: 211,
};
const ATLAS: AttackRelease = {
  id: 'rel-2', domain: 'ATLAS', name: 'ATLAS', version: '2026.10',
  releaseDate: new Date('2026-10-28T00:00:00Z'), tacticCount: 16, techniqueCount: 221,
};
const D3FEND: AttackRelease = {
  id: 'rel-3', domain: 'd3fend', name: 'MITRE D3FEND', version: '1.6.0',
  releaseDate: new Date('2026-08-31T00:12:00Z'), tacticCount: 7, techniqueCount: 271,
};
const TRADEMARKS = /MITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation/;
const ATLAS_TRADEMARK = /MITRE ATLAS™ is a trademark of The MITRE Corporation\./;
const D3FEND_TRADEMARK = /MITRE D3FEND™ is a trademark of The MITRE Corporation\./;

// The component loads the releases itself in ngOnInit, so the stubbed endpoint is all the store needs.
async function renderReleases(releases: AttackRelease[]) {
  const releaseApi = {
    getAttackReleases: vi.fn(() => of(structuredClone(releases))),
  } satisfies ApiStub<AttackReleaseService>;
  const rendered = await renderComponent(AdminAttackReleasesComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatProgressSpinnerModule,
      MatSortModule,
      MatTableModule,
      MatTooltipModule,
    ],
    declarations: [AdminAttackReleasesComponent],
    providers: [
      { provide: AttackReleaseService, useValue: releaseApi },
      unstubbed(CrucibleDialogService),
    ],
    inputs: { canEdit: true, loggedInUserId: 'user-1' },
  });
  return { ...rendered, releaseApi };
}

describe('AdminAttackReleasesComponent', () => {
  /**
   * Verifies: with nothing imported the empty state names the ATT&CK bundle, the ATLAS one and the D3FEND
   * ontology, the import button takes any of them, and only the ATT&CK trademark line is shown.
   * Interacts with: AttackReleaseService.getAttackReleases (stub), hasAtlasRelease, hasD3fendRelease.
   * Data: no releases.
   */
  it('tells an administrator which files to import when there are none', async () => {
    const { releaseApi } = await renderReleases([]);

    expect(releaseApi.getAttackReleases).toHaveBeenCalled();
    expect(screen.getByText(/enterprise-attack\.json from MITRE's attack-stix-data repository/)).toBeInTheDocument();
    expect(screen.getByText(/stix-atlas\.json from the mitre-atlas\/atlas-data GitHub releases/)).toBeInTheDocument();
    expect(screen.getByText(/MITRE D3FEND™ ontology \(d3fend\.json from the D3FEND Ontology Resources page\)/)).toBeInTheDocument();
    expect(screen.getByTitle('Import a release file')).toBeInTheDocument();
    expect(screen.getByText(TRADEMARKS)).toBeInTheDocument();
    expect(screen.queryByText(/© 2026 The MITRE Corporation/)).not.toBeInTheDocument();
    expect(screen.queryByText(ATLAS_TRADEMARK)).not.toBeInTheDocument();
    expect(screen.queryByText(D3FEND_TRADEMARK)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'D3FEND Terms of Use' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: an imported ATT&CK release brings MITRE's copyright line but not the ATLAS mark.
   * Interacts with: AttackReleaseService.getAttackReleases (stub), hasAtlasRelease.
   * Data: Enterprise ATT&CK 17.1 only.
   */
  it('credits MITRE for an ATT&CK release without the ATLAS mark', async () => {
    await renderReleases([ENTERPRISE]);

    expect(screen.getByText('Enterprise ATT&CK')).toBeInTheDocument();
    expect(screen.getByText(/© 2026 The MITRE Corporation/)).toBeInTheDocument();
    expect(screen.getByText(TRADEMARKS)).toBeInTheDocument();
    expect(screen.queryByText(ATLAS_TRADEMARK)).not.toBeInTheDocument();
    expect(screen.queryByText(D3FEND_TRADEMARK)).not.toBeInTheDocument();
  });

  /**
   * Verifies: a release of the d3fend domain adds MITRE's D3FEND trademark sentence and a link to D3FEND's own
   * terms of use, beside the ATT&CK sentence and link, which stay.
   * Interacts with: AttackReleaseService.getAttackReleases (stub), hasD3fendRelease.
   * Data: Enterprise ATT&CK 17.1 and MITRE D3FEND 1.6.0.
   */
  it('also credits MITRE D3FEND and links its terms of use once a D3FEND release is listed', async () => {
    await renderReleases([ENTERPRISE, D3FEND]);

    expect(screen.getByText('MITRE D3FEND')).toBeInTheDocument();
    expect(screen.getByText('d3fend')).toBeInTheDocument();
    expect(screen.getByText(TRADEMARKS)).toBeInTheDocument();
    expect(screen.getByText(D3FEND_TRADEMARK)).toBeInTheDocument();
    expect(screen.queryByText(ATLAS_TRADEMARK)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', 'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/');
    const terms = screen.getByRole('link', { name: 'D3FEND Terms of Use' });
    expect(terms).toHaveAttribute('href', 'https://d3fend.mitre.org/tou/');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms).toHaveAttribute('rel', 'noopener');
  });

  /**
   * Verifies: a release of the ATLAS domain adds MITRE's ATLAS trademark sentence beside the ATT&CK one.
   * Interacts with: AttackReleaseService.getAttackReleases (stub), hasAtlasRelease.
   * Data: Enterprise ATT&CK 17.1 and ATLAS 2026.10.
   */
  it('also credits MITRE ATLAS once an ATLAS release is listed', async () => {
    await renderReleases([ENTERPRISE, ATLAS]);

    // the name and the domain cells both read ATLAS
    expect(screen.getAllByText('ATLAS', { selector: 'mat-cell' })).toHaveLength(2);
    expect(screen.getByText(TRADEMARKS)).toBeInTheDocument();
    expect(screen.getByText(ATLAS_TRADEMARK)).toBeInTheDocument();
  });
});
