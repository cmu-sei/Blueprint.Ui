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
import { fireEvent, screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { AttackRelease, AttackReleaseService, AttackTechniqueCountermeasureImport } from 'src/app/generated/blueprint.api';
import { SystemMessageService } from 'src/app/services/system-message/system-message.service';
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
  id: 'rel-3', domain: 'd3fend', isDefensive: true, name: 'MITRE D3FEND', version: '1.6.0',
  releaseDate: new Date('2026-08-31T00:12:00Z'), tacticCount: 7, techniqueCount: 271,
};
const D3FEND_WITH_MAPPINGS: AttackRelease = { ...D3FEND, countermeasureCount: 4133 };
const MAPPINGS_URL = 'https://d3fend.mitre.org/ontologies/d3fend/1.6.0/d3fend-full-mappings.json';
const IMPORT_RESULT: AttackTechniqueCountermeasureImport = { attackReleaseId: 'rel-3', rowsRead: 9, pairsStored: 5, pairsSkipped: 1, offensiveTechniqueCount: 4 };
const TRADEMARKS = /MITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation/;
const ATLAS_TRADEMARK = /MITRE ATLAS™ is a trademark of The MITRE Corporation\./;
const D3FEND_TRADEMARK = /MITRE D3FEND™ is a trademark of The MITRE Corporation\./;

// The component loads the releases itself in ngOnInit, so the stubbed endpoint is all the store needs.
async function renderReleases(releases: AttackRelease[]) {
  const releaseApi = {
    getAttackReleases: vi.fn(() => of(structuredClone(releases))),
    importAttackTechniqueCountermeasures: vi.fn(() => of(structuredClone(IMPORT_RESULT))),
  } satisfies ApiStub<AttackReleaseService>;
  const messages = { displayMessage: vi.fn() };
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
      { provide: SystemMessageService, useValue: messages },
      unstubbed(CrucibleDialogService),
    ],
    inputs: { canEdit: true, loggedInUserId: 'user-1' },
  });
  return { ...rendered, releaseApi, messages };
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
    expect(screen.getByText(/d3fend-full-mappings\.json from https:\/\/d3fend\.mitre\.org\/ontologies\/d3fend\/<version>\/d3fend-full-mappings\.json; the unversioned path is not served/)).toBeInTheDocument();
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
  /**
   * Verifies: only a D3FEND row offers Import ATT&CK mappings, a release with mappings says how many on its row, and
   * no hint is given for it.
   * Interacts with: AttackReleaseService.getAttackReleases (stub), isDefensive, defensiveReleasesWithoutMappings.
   * Data: Enterprise ATT&CK 17.1 and MITRE D3FEND 1.6.0 with 4133 mappings.
   */
  it('offers the mappings import on a D3FEND row and counts its mappings', async () => {
    await renderReleases([ENTERPRISE, D3FEND_WITH_MAPPINGS]);

    const buttons = screen.getAllByTitle('Import ATT&CK mappings');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute('aria-label', 'Import ATT&CK mappings for MITRE D3FEND 1.6.0');
    expect(screen.getByText('4133 countermeasure mappings')).toBeInTheDocument();
    expect(screen.queryByText(/has no ATT&CK mappings yet/)).not.toBeInTheDocument();
  });

  /**
   * Verifies: a D3FEND release without mappings gets a hint naming the file, linking the versioned URL and warning
   * that the unversioned path is not served.
   * Interacts with: defensiveReleasesWithoutMappings, mappingsUrl.
   * Data: MITRE D3FEND 1.6.0 with no mappings.
   */
  it('tells an administrator where a release\'s mappings file is', async () => {
    await renderReleases([D3FEND]);

    expect(screen.getByText(/MITRE D3FEND 1\.6\.0 has no ATT&CK mappings yet\. Download d3fend-full-mappings\.json from/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: MAPPINGS_URL });
    expect(link).toHaveAttribute('href', MAPPINGS_URL);
    expect(screen.getByText(/the unversioned path is not served/)).toBeInTheDocument();
    expect(screen.queryByText(/countermeasure mappings/)).not.toBeInTheDocument();
  });

  /**
   * Verifies: picking a file after the row's Import ATT&CK mappings posts it to that release, reports what was
   * stored and skipped, and the row shows the stored count.
   * Interacts with: chooseMappingsFile, selectMappingsFile, AttackReleaseService.importAttackTechniqueCountermeasures
   * (stub), SystemMessageService.displayMessage (stub), AttackReleaseDataService.importCountermeasures.
   * Data: MITRE D3FEND 1.6.0 with no mappings; an import that stores 5 pairs and skips 1.
   */
  it('imports the mappings file onto the release it was chosen for', async () => {
    const { releaseApi, messages, fixture } = await renderReleases([ENTERPRISE, D3FEND]);
    const file = new File(['{}'], 'd3fend-full-mappings.json', { type: 'application/json' });

    fireEvent.click(screen.getByTitle('Import ATT&CK mappings'));
    fireEvent.change(screen.getByTestId('mappings-file'), { target: { files: [file] } });
    fixture.detectChanges();

    expect(releaseApi.importAttackTechniqueCountermeasures).toHaveBeenCalledWith('rel-3', file);
    expect(messages.displayMessage).toHaveBeenCalledWith(
      'Mappings Imported',
      '9 rows read. 5 countermeasure mappings for 4 techniques stored on MITRE D3FEND 1.6.0; 1 skipped because their D3FEND technique is not in this release.'
    );
    expect(screen.getByText('5 countermeasure mappings')).toBeInTheDocument();
    expect(screen.queryByText(/has no ATT&CK mappings yet/)).not.toBeInTheDocument();
  });
});
