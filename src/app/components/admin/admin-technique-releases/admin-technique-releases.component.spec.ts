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
import { fireEvent, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { TechniqueRelease, TechniqueReleaseNotice, TechniqueReleaseService, TechniqueCountermeasureImport } from 'src/app/generated/blueprint.api';
import { SystemMessageService } from 'src/app/services/system-message/system-message.service';
import { AdminTechniqueReleasesComponent } from './admin-technique-releases.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';

// What the API's parsers stamp on a release: the notice, the publisher and the terms it carries.
const COPYRIGHT = '© 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation.';
const ATTACK_TERMS = 'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/';
const ENTERPRISE: TechniqueRelease = {
  id: 'rel-1', domain: 'enterprise-attack', name: 'Enterprise ATT&CK', version: '17.1',
  releaseDate: new Date('2025-04-22T00:00:00Z'), tacticCount: 14, techniqueCount: 211,
  source: 'MITRE ATT&CK', termsUrl: ATTACK_TERMS,
  notice: `${COPYRIGHT}\nMITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation.`,
};
const ATLAS: TechniqueRelease = {
  id: 'rel-2', domain: 'ATLAS', name: 'ATLAS', version: '2026.10',
  releaseDate: new Date('2026-10-28T00:00:00Z'), tacticCount: 16, techniqueCount: 221,
  source: 'MITRE ATLAS', termsUrl: ATTACK_TERMS,
  notice: `${COPYRIGHT}\nMITRE ATLAS™ is a trademark of The MITRE Corporation.`,
};
const D3FEND: TechniqueRelease = {
  id: 'rel-3', domain: 'd3fend', isDefensive: true, name: 'MITRE D3FEND', version: '1.6.0',
  releaseDate: new Date('2026-08-31T00:12:00Z'), tacticCount: 7, techniqueCount: 271,
  source: 'MITRE D3FEND', termsUrl: 'https://d3fend.mitre.org/tou/',
  notice: `${COPYRIGHT}\nMITRE D3FEND™ is a trademark of The MITRE Corporation.`,
};
const CAPEC: TechniqueRelease = {
  id: 'rel-4', domain: 'capec', name: 'MITRE CAPEC', version: '3.9',
  releaseDate: new Date('2023-01-24T00:00:00Z'), tacticCount: 61, techniqueCount: 497,
  source: 'MITRE CAPEC', termsUrl: 'https://capec.mitre.org/about/termsofuse.html',
  notice: `${COPYRIGHT}\nMITRE CAPEC™ is a trademark of The MITRE Corporation.`,
};
// A bundle from some other publisher: it carries no notice until an administrator gives it one.
const CUSTOM: TechniqueRelease = {
  id: 'rel-5', domain: 'acme-ttp', name: 'Acme Techniques', version: '1.0',
  releaseDate: new Date('2026-01-01T00:00:00Z'), tacticCount: 1, techniqueCount: 1,
};
const CAPEC_TRADEMARK = /MITRE CAPEC™ is a trademark of The MITRE Corporation\./;
const D3FEND_WITH_MAPPINGS: TechniqueRelease = { ...D3FEND, countermeasureCount: 4133 };
const MAPPINGS_URL = 'https://d3fend.mitre.org/ontologies/d3fend/1.6.0/d3fend-full-mappings.json';
const IMPORT_RESULT: TechniqueCountermeasureImport = { techniqueReleaseId: 'rel-3', rowsRead: 9, pairsStored: 5, pairsSkipped: 1, offensiveTechniqueCount: 4 };
const TRADEMARKS = /MITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation/;
const ATLAS_TRADEMARK = /MITRE ATLAS™ is a trademark of The MITRE Corporation\./;
const D3FEND_TRADEMARK = /MITRE D3FEND™ is a trademark of The MITRE Corporation\./;

// The component loads the releases itself in ngOnInit, so the stubbed endpoint is all the store needs.
async function renderReleases(releases: TechniqueRelease[], canEdit = true) {
  const releaseApi = {
    getTechniqueReleases: vi.fn(() => of(structuredClone(releases))),
    importTechniqueCountermeasures: vi.fn(() => of(structuredClone(IMPORT_RESULT))),
    // the API answers the release as saved: the four notice fields changed, nothing else
    updateTechniqueRelease: vi.fn((id: string, notice: TechniqueReleaseNotice) =>
      of({ ...structuredClone(releases.find(r => r.id === id)), ...notice })),
  } satisfies ApiStub<TechniqueReleaseService>;
  const messages = { displayMessage: vi.fn() };
  const rendered = await renderComponent(AdminTechniqueReleasesComponent, {
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
    declarations: [AdminTechniqueReleasesComponent],
    providers: [
      { provide: TechniqueReleaseService, useValue: releaseApi },
      { provide: SystemMessageService, useValue: messages },
      unstubbed(CrucibleDialogService),
    ],
    inputs: { canEdit, loggedInUserId: 'user-1' },
  });
  return { ...rendered, releaseApi, messages };
}

describe('AdminTechniqueReleasesComponent', () => {
  /**
   * Verifies: with nothing imported the empty state names the ATT&CK bundle, the ATLAS one and the D3FEND
   * ontology, the import button takes any of them, and no trademark line is shown, as no release carries one.
   * Interacts with: TechniqueReleaseService.getTechniqueReleases (stub), TechniqueNoticeComponent.
   * Data: no releases.
   */
  it('tells an administrator which files to import when there are none', async () => {
    const { releaseApi } = await renderReleases([]);

    expect(releaseApi.getTechniqueReleases).toHaveBeenCalled();
    expect(screen.getByText(/enterprise-attack\.json, mobile-attack\.json or ics-attack\.json from/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'attack-stix-data' })).toHaveAttribute('href', 'https://github.com/mitre-attack/attack-stix-data');
    expect(screen.getByRole('link', { name: 'atlas-data releases' })).toHaveAttribute('href', 'https://github.com/mitre-atlas/atlas-data/releases');
    expect(screen.getByRole('link', { name: 'mitre/cti' })).toHaveAttribute('href', 'https://github.com/mitre/cti/tree/master/capec/2.1');
    expect(screen.getByRole('link', { name: 'D3FEND resources page' })).toHaveAttribute('href', 'https://d3fend.mitre.org/resources/');
    expect(screen.getByTitle('Import a release file')).toBeInTheDocument();
    expect(screen.getByText(/d3fend-full-mappings\.json from https:\/\/d3fend\.mitre\.org\/ontologies\/d3fend\/<version>\/d3fend-full-mappings\.json \(the unversioned path is not served\)/)).toBeInTheDocument();
    expect(screen.queryByText(TRADEMARKS)).not.toBeInTheDocument();
    expect(screen.queryByText(/© 2026 The MITRE Corporation/)).not.toBeInTheDocument();
    expect(screen.queryByText(ATLAS_TRADEMARK)).not.toBeInTheDocument();
    expect(screen.queryByText(D3FEND_TRADEMARK)).not.toBeInTheDocument();
    expect(screen.queryByText(CAPEC_TRADEMARK)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Terms of Use/ })).not.toBeInTheDocument();
  });

  /** Opens a release's row, then its Copyright & terms link, and returns the dialog. */
  async function readNotice(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(screen.getByText(name, { selector: '.col-name' }));
    await user.click(await screen.findByRole('button', { name: 'Copyright & terms' }));
    return within(await screen.findByRole('dialog'));
  }

  /**
   * Verifies: nothing is shown until a row is opened; opening a row shows a Copyright & terms link under it, the link
   * opens that release's own notice and terms in a dialog, and opening the row again hides the link.
   * Interacts with: rowClicked, TechniqueNoticeComponent.
   * Data: Enterprise ATT&CK 17.1.
   */
  it('shows a release\'s copyright and terms link under its row when the row is opened', async () => {
    await renderReleases([ENTERPRISE]);
    const user = userEvent.setup();

    expect(screen.queryByRole('button', { name: 'Copyright & terms' })).not.toBeInTheDocument();
    expect(screen.queryByText(TRADEMARKS)).not.toBeInTheDocument();

    const dialog = await readNotice(user, 'Enterprise ATT&CK');
    expect(dialog.getByText(/© 2026 The MITRE Corporation/)).toBeInTheDocument();
    expect(dialog.getByText(TRADEMARKS)).toBeInTheDocument();
    expect(dialog.getByRole('link', { name: 'MITRE ATT&CK Terms of Use' })).toHaveAttribute('href', ATTACK_TERMS);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByText('Enterprise ATT&CK', { selector: '.col-name' }));
    expect(screen.queryByRole('button', { name: 'Copyright & terms' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: each release's dialog shows its own framework's mark and terms link, and no other framework's.
   * Interacts with: rowClicked, TechniqueNoticeComponent.
   * Data: Enterprise ATT&CK 17.1, ATLAS, MITRE D3FEND and MITRE CAPEC, opened one at a time.
   */
  it('shows each release\'s own trademark line and terms link, and no other framework\'s', async () => {
    await renderReleases([ENTERPRISE, ATLAS, D3FEND, CAPEC]);
    const user = userEvent.setup();

    let dialog = await readNotice(user, 'MITRE CAPEC');
    expect(dialog.getByText(CAPEC_TRADEMARK)).toBeInTheDocument();
    const capecTerms = dialog.getByRole('link', { name: 'MITRE CAPEC Terms of Use' });
    expect(capecTerms).toHaveAttribute('href', 'https://capec.mitre.org/about/termsofuse.html');
    expect(capecTerms).toHaveAttribute('target', '_blank');
    expect(capecTerms).toHaveAttribute('rel', 'noopener');
    expect(dialog.queryByText(TRADEMARKS)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    dialog = await readNotice(user, 'MITRE D3FEND');
    expect(dialog.getByText(D3FEND_TRADEMARK)).toBeInTheDocument();
    expect(dialog.getByRole('link', { name: 'MITRE D3FEND Terms of Use' })).toHaveAttribute('href', 'https://d3fend.mitre.org/tou/');
    expect(dialog.queryByText(CAPEC_TRADEMARK)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    dialog = await readNotice(user, 'ATLAS');
    expect(dialog.getByText(ATLAS_TRADEMARK)).toBeInTheDocument();
    expect(dialog.queryByText(D3FEND_TRADEMARK)).not.toBeInTheDocument();
  });

  /**
   * Verifies: a release with no notice says so when opened, and offers the edit button to an administrator.
   * Interacts with: rowClicked.
   * Data: a custom release with no notice.
   */
  it('says a custom release carries no notice when its row is opened', async () => {
    await renderReleases([CUSTOM]);
    const user = userEvent.setup();

    await user.click(screen.getByText('Acme Techniques', { selector: '.col-name' }));

    expect(screen.getByText(/This release carries no copyright or terms notice\. Use its edit button to add one\./)).toBeInTheDocument();
    expect(screen.queryByText(/The MITRE Corporation/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Terms of Use/ })).not.toBeInTheDocument();
  });

  /**
   * Verifies: a click on one of a row's own buttons does not open its notice.
   * Interacts with: rowClicked.
   * Data: Enterprise ATT&CK 17.1.
   */
  it('does not open the notice when a row button is clicked', async () => {
    await renderReleases([ENTERPRISE]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit notice of Enterprise ATT&CK 17.1' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByText(TRADEMARKS)).not.toBeInTheDocument();
  });

  /**
   * Verifies: a user who can edit gets an Edit notice action per row, a custom release's dialog starts with all four
   * fields empty, saving sends exactly those four fields, and the notice then shows on the page at once.
   * Interacts with: TechniqueReleaseService.updateTechniqueRelease (stub), AdminTechniqueReleaseNoticeDialogComponent,
   * TechniqueReleaseDataService.updateNotice.
   * Data: a custom release with no notice.
   */
  it('gives a custom release a notice from the edit dialog and shows it straight away', async () => {
    const { releaseApi } = await renderReleases([CUSTOM]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit notice of Acme Techniques 1.0' }));

    expect(await screen.findByRole('heading', { name: 'Edit Notice: Acme Techniques 1.0' })).toBeInTheDocument();
    for (const label of ['Source', 'Source URL', 'Notice', 'Terms URL']) {
      expect(screen.getByRole('textbox', { name: label })).toHaveValue('');
    }

    await user.type(screen.getByRole('textbox', { name: 'Source' }), 'Acme Corp');
    await user.type(screen.getByRole('textbox', { name: 'Notice' }), '© Acme Corp');
    await user.type(screen.getByRole('textbox', { name: 'Terms URL' }), 'https://acme.example/terms');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const sent: TechniqueReleaseNotice = { source: 'Acme Corp', sourceUrl: '', notice: '© Acme Corp', termsUrl: 'https://acme.example/terms' };
    expect(releaseApi.updateTechniqueRelease).toHaveBeenCalledWith('rel-5', sent);
    const dialog = await readNotice(user, 'Acme Techniques');
    expect(dialog.getByText('© Acme Corp')).toBeInTheDocument();
    expect(dialog.getByRole('link', { name: 'Acme Corp Terms of Use' })).toHaveAttribute('href', 'https://acme.example/terms');
  });

  /**
   * Verifies: the dialog starts from what the release carries, and will not save a link that is not an http or
   * https address.
   * Interacts with: AdminTechniqueReleaseNoticeDialogComponent.errorFree.
   * Data: Enterprise ATT&CK 17.1.
   */
  it('starts from the release\'s own notice and refuses a link that is not a web address', async () => {
    const { releaseApi } = await renderReleases([ENTERPRISE]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit notice of Enterprise ATT&CK 17.1' }));

    expect(await screen.findByRole('textbox', { name: 'Source' })).toHaveValue('MITRE ATT&CK');
    expect(screen.getByRole('textbox', { name: 'Terms URL' })).toHaveValue(ATTACK_TERMS);
    const terms = screen.getByRole('textbox', { name: 'Terms URL' });
    await user.clear(terms);
    await user.type(terms, 'javascript:alert(1)');

    expect(screen.getByText('Enter an http or https address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(releaseApi.updateTechniqueRelease).not.toHaveBeenCalled();
  });

  /**
   * Verifies: someone who cannot manage competency frameworks gets no Edit notice action.
   * Interacts with: the canEdit input.
   * Data: a custom release.
   */
  it('offers no edit action without edit permission', async () => {
    await renderReleases([CUSTOM], false);

    expect(screen.queryByRole('button', { name: /Edit notice of/ })).not.toBeInTheDocument();
  });

  /**
   * Verifies: only a D3FEND row offers Import ATT&CK mappings, a release with mappings says how many on its row, and
   * no hint is given for it.
   * Interacts with: TechniqueReleaseService.getTechniqueReleases (stub), isDefensive, defensiveReleasesWithoutMappings.
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
   * Interacts with: chooseMappingsFile, selectMappingsFile, TechniqueReleaseService.importTechniqueCountermeasures
   * (stub), SystemMessageService.displayMessage (stub), TechniqueReleaseDataService.importCountermeasures.
   * Data: MITRE D3FEND 1.6.0 with no mappings; an import that stores 5 pairs and skips 1.
   */
  it('imports the mappings file onto the release it was chosen for', async () => {
    const { releaseApi, messages, fixture } = await renderReleases([ENTERPRISE, D3FEND]);
    const file = new File(['{}'], 'd3fend-full-mappings.json', { type: 'application/json' });

    fireEvent.click(screen.getByTitle('Import ATT&CK mappings'));
    fireEvent.change(screen.getByTestId('mappings-file'), { target: { files: [file] } });
    fixture.detectChanges();

    expect(releaseApi.importTechniqueCountermeasures).toHaveBeenCalledWith('rel-3', file);
    expect(messages.displayMessage).toHaveBeenCalledWith(
      'Mappings Imported',
      '9 rows read. 5 countermeasure mappings for 4 techniques stored on MITRE D3FEND 1.6.0; 1 skipped because their D3FEND technique is not in this release.'
    );
    expect(screen.getByText('5 countermeasure mappings')).toBeInTheDocument();
    expect(screen.queryByText(/has no ATT&CK mappings yet/)).not.toBeInTheDocument();
  });
});
