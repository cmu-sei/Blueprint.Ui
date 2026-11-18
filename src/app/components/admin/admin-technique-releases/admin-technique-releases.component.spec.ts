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
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  TechniqueFramework,
  TechniqueFrameworkService,
  TechniqueRelease,
  TechniqueReleaseNotice,
  TechniqueReleaseService,
  TechniqueCountermeasureImport,
} from 'src/app/generated/blueprint.api';
import { SystemMessageService } from 'src/app/services/system-message/system-message.service';
import { AdminTechniqueReleasesComponent } from './admin-technique-releases.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';

// What the API's parsers stamp on a release: the notice, the publisher and the terms it carries.
const COPYRIGHT =
  '© 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation.';
const ATTACK_TERMS =
  'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/';
const ENTERPRISE: TechniqueRelease = {
  id: 'rel-1',
  domain: 'enterprise-attack',
  name: 'Enterprise ATT&CK',
  version: '17.1',
  releaseDate: new Date('2025-04-22T00:00:00Z'),
  tacticCount: 14,
  techniqueCount: 211,
  source: 'MITRE ATT&CK',
  termsUrl: ATTACK_TERMS,
  notice: `${COPYRIGHT}\nMITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation.`,
};
const ATLAS: TechniqueRelease = {
  id: 'rel-2',
  domain: 'ATLAS',
  name: 'ATLAS',
  version: '2026.10',
  releaseDate: new Date('2026-10-28T00:00:00Z'),
  tacticCount: 16,
  techniqueCount: 221,
  source: 'MITRE ATLAS',
  termsUrl: ATTACK_TERMS,
  notice: `${COPYRIGHT}\nMITRE ATLAS™ is a trademark of The MITRE Corporation.`,
};
// what the release's framework definition says about mappings is served on the release (test data)
const D3FEND: TechniqueRelease = {
  id: 'rel-3',
  domain: 'd3fend',
  isDefensive: true,
  name: 'MITRE D3FEND',
  version: '1.6.0',
  techniqueFrameworkId: 'fw-d3',
  techniqueFrameworkName: 'D3FEND definition',
  mappingRelation: 'countered by',
  mappingsDownloadUrl:
    'https://d3fend.mitre.org/ontologies/d3fend/1.6.0/d3fend-full-mappings.json',
  mappingsDownloadHint: "d3fend-full-mappings.json for the release's version",
  releaseDate: new Date('2026-08-31T00:12:00Z'),
  tacticCount: 7,
  techniqueCount: 271,
  source: 'MITRE D3FEND',
  termsUrl: 'https://d3fend.mitre.org/tou/',
  notice: `${COPYRIGHT}\nMITRE D3FEND™ is a trademark of The MITRE Corporation.`,
};
const CAPEC: TechniqueRelease = {
  id: 'rel-4',
  domain: 'capec',
  name: 'MITRE CAPEC',
  version: '3.9',
  releaseDate: new Date('2023-01-24T00:00:00Z'),
  tacticCount: 61,
  techniqueCount: 497,
  source: 'MITRE CAPEC',
  termsUrl: 'https://capec.mitre.org/about/termsofuse.html',
  notice: `${COPYRIGHT}\nMITRE CAPEC™ is a trademark of The MITRE Corporation.`,
};
// A bundle from some other publisher: it carries no notice until an administrator gives it one.
const CUSTOM: TechniqueRelease = {
  id: 'rel-5',
  domain: 'acme-ttp',
  name: 'Acme Techniques',
  version: '1.0',
  releaseDate: new Date('2026-01-01T00:00:00Z'),
  tacticCount: 1,
  techniqueCount: 1,
};
const CAPEC_TRADEMARK =
  /MITRE CAPEC™ is a trademark of The MITRE Corporation\./;
const D3FEND_WITH_MAPPINGS: TechniqueRelease = {
  ...D3FEND,
  countermeasureCount: 4133,
};
const MAPPINGS_URL =
  'https://d3fend.mitre.org/ontologies/d3fend/1.6.0/d3fend-full-mappings.json';
const IMPORT_RESULT: TechniqueCountermeasureImport = {
  techniqueReleaseId: 'rel-3',
  rowsRead: 9,
  pairsStored: 5,
  pairsSkipped: 1,
  offensiveTechniqueCount: 4,
};
const TRADEMARKS =
  /MITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation/;
const ATLAS_TRADEMARK =
  /MITRE ATLAS™ is a trademark of The MITRE Corporation\./;
const D3FEND_TRADEMARK =
  /MITRE D3FEND™ is a trademark of The MITRE Corporation\./;

// Framework definitions, as an administrator entered them (test data).
const D3FEND_FRAMEWORK: TechniqueFramework = {
  id: 'fw-d3',
  name: 'D3FEND definition',
  domain: 'd3fend',
  isDefensive: true,
  format: 'JsonLdOntology',
  settings: {
    match: { property: 'd3f:d3fend-id' },
    downloadHint: 'd3fend.json from the resources page',
    downloadUrl: 'https://d3fend.mitre.org/resources/',
  },
  releaseCount: 0,
};
const ATTACK_FRAMEWORK: TechniqueFramework = {
  id: 'fw-ent',
  name: 'Enterprise definition',
  domain: 'enterprise-attack',
  isDefensive: false,
  format: 'StixBundle',
  settings: {
    match: { stixDomain: 'enterprise-attack' },
    downloadHint: 'enterprise-attack.json',
    downloadUrl: 'https://github.com/mitre-attack/attack-stix-data',
  },
  releaseCount: 0,
};

// The component loads the releases and frameworks itself in ngOnInit, so the stubbed endpoints are all the stores need.
async function renderReleases(
  releases: TechniqueRelease[],
  canEdit = true,
  frameworks: TechniqueFramework[] = [],
) {
  const frameworkApi = {
    getTechniqueFrameworks: vi.fn(() => of(structuredClone(frameworks))),
  } satisfies ApiStub<TechniqueFrameworkService>;
  const releaseApi = {
    getTechniqueReleases: vi.fn(() => of(structuredClone(releases))),
    importTechniqueCountermeasures: vi.fn(() =>
      of(structuredClone(IMPORT_RESULT)),
    ),
    importTechniqueRelease: vi.fn(() => of(structuredClone(CUSTOM))),
    // the API answers the release as saved: the four notice fields changed, nothing else
    updateTechniqueRelease: vi.fn(
      (id: string, notice: TechniqueReleaseNotice) =>
        of({
          ...structuredClone(releases.find((r) => r.id === id)),
          ...notice,
        }),
    ),
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
      { provide: TechniqueFrameworkService, useValue: frameworkApi },
      { provide: SystemMessageService, useValue: messages },
      unstubbed(CrucibleDialogService),
    ],
    inputs: { canEdit, loggedInUserId: 'user-1' },
  });
  return { ...rendered, releaseApi, frameworkApi, messages };
}

describe('AdminTechniqueReleasesComponent', () => {
  /**
   * Verifies: with no framework defined the empty state says a framework definition comes first, naming no file
   * of any framework, since Blueprint ships none.
   * Interacts with: TechniqueFrameworkService.getTechniqueFrameworks (stub), frameworks.
   * Data: no frameworks and no releases.
   */
  it('asks for a framework definition first when none is defined', async () => {
    const { frameworkApi } = await renderReleases([]);

    expect(frameworkApi.getTechniqueFrameworks).toHaveBeenCalled();
    expect(
      screen.getByText(/Add or import a framework definition above first/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(
      screen.getByText(/No technique frameworks are defined/),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: with frameworks defined and nothing imported, the empty state lists each framework's own download
   * hint and link, the import button takes any file, and no trademark line is shown, as no release carries one.
   * Interacts with: TechniqueReleaseService.getTechniqueReleases (stub), frameworksWithDownloads, TechniqueNoticeComponent.
   * Data: two frameworks with download hints, no releases.
   */
  it("tells an administrator which files to import from the frameworks' download hints", async () => {
    const { releaseApi } = await renderReleases([], true, [
      D3FEND_FRAMEWORK,
      ATTACK_FRAMEWORK,
    ]);

    expect(releaseApi.getTechniqueReleases).toHaveBeenCalled();
    const items = screen
      .getAllByRole('listitem')
      .map((li) => li.textContent.replace(/\s+/g, ' ').trim());
    expect(items).toEqual([
      'D3FEND definition: d3fend.json from the resources page (https://d3fend.mitre.org/resources/)',
      'Enterprise definition: enterprise-attack.json (https://github.com/mitre-attack/attack-stix-data)',
    ]);
    expect(
      screen.getByRole('link', { name: 'https://d3fend.mitre.org/resources/' }),
    ).toHaveAttribute('href', 'https://d3fend.mitre.org/resources/');
    expect(screen.getByTitle('Import a release file')).toBeInTheDocument();
    expect(screen.queryByText(TRADEMARKS)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/© 2026 The MITRE Corporation/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(ATLAS_TRADEMARK)).not.toBeInTheDocument();
    expect(screen.queryByText(D3FEND_TRADEMARK)).not.toBeInTheDocument();
    expect(screen.queryByText(CAPEC_TRADEMARK)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Terms of Use/ }),
    ).not.toBeInTheDocument();
  });

  /** Opens a release's row, then its Copyright & terms link, and returns the dialog. */
  async function readNotice(
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) {
    await user.click(screen.getByText(name, { selector: '.col-name' }));
    await user.click(
      await screen.findByRole('button', { name: 'Copyright & terms' }),
    );
    return within(await screen.findByRole('dialog'));
  }

  /**
   * Verifies: nothing is shown until a row is opened; opening a row shows a Copyright & terms link under it, the link
   * opens that release's own notice and terms in a dialog, and opening the row again hides the link.
   * Interacts with: rowClicked, TechniqueNoticeComponent.
   * Data: Enterprise ATT&CK 17.1.
   */
  it("shows a release's copyright and terms link under its row when the row is opened", async () => {
    await renderReleases([ENTERPRISE]);
    const user = userEvent.setup();

    expect(
      screen.queryByRole('button', { name: 'Copyright & terms' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(TRADEMARKS)).not.toBeInTheDocument();

    const dialog = await readNotice(user, 'Enterprise ATT&CK');
    expect(
      dialog.getByText(/© 2026 The MITRE Corporation/),
    ).toBeInTheDocument();
    expect(dialog.getByText(TRADEMARKS)).toBeInTheDocument();
    expect(
      dialog.getByRole('link', { name: 'MITRE ATT&CK Terms of Use' }),
    ).toHaveAttribute('href', ATTACK_TERMS);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(
      screen.getByText('Enterprise ATT&CK', { selector: '.col-name' }),
    );
    expect(
      screen.queryByRole('button', { name: 'Copyright & terms' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: each release's dialog shows its own framework's mark and terms link, and no other framework's.
   * Interacts with: rowClicked, TechniqueNoticeComponent.
   * Data: Enterprise ATT&CK 17.1, ATLAS, MITRE D3FEND and MITRE CAPEC, opened one at a time.
   */
  it("shows each release's own trademark line and terms link, and no other framework's", async () => {
    await renderReleases([ENTERPRISE, ATLAS, D3FEND, CAPEC]);
    const user = userEvent.setup();

    let dialog = await readNotice(user, 'MITRE CAPEC');
    expect(dialog.getByText(CAPEC_TRADEMARK)).toBeInTheDocument();
    const capecTerms = dialog.getByRole('link', {
      name: 'MITRE CAPEC Terms of Use',
    });
    expect(capecTerms).toHaveAttribute(
      'href',
      'https://capec.mitre.org/about/termsofuse.html',
    );
    expect(capecTerms).toHaveAttribute('target', '_blank');
    expect(capecTerms).toHaveAttribute('rel', 'noopener');
    expect(dialog.queryByText(TRADEMARKS)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    dialog = await readNotice(user, 'MITRE D3FEND');
    expect(dialog.getByText(D3FEND_TRADEMARK)).toBeInTheDocument();
    expect(
      dialog.getByRole('link', { name: 'MITRE D3FEND Terms of Use' }),
    ).toHaveAttribute('href', 'https://d3fend.mitre.org/tou/');
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

    await user.click(
      screen.getByText('Acme Techniques', { selector: '.col-name' }),
    );

    expect(
      screen.getByText(
        /This release carries no copyright or terms notice\. Use its edit button to add one\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/The MITRE Corporation/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Terms of Use/ }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: a click on one of a row's own buttons does not open its notice.
   * Interacts with: rowClicked.
   * Data: Enterprise ATT&CK 17.1.
   */
  it('does not open the notice when a row button is clicked', async () => {
    await renderReleases([ENTERPRISE]);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit Enterprise ATT&CK 17.1' }),
    );
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

    await user.click(
      screen.getByRole('button', { name: 'Edit Acme Techniques 1.0' }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Edit Release: Acme Techniques 1.0',
      }),
    ).toBeInTheDocument();
    for (const label of ['Source', 'Source URL', 'Notice', 'Terms URL']) {
      expect(screen.getByRole('textbox', { name: label })).toHaveValue('');
    }

    await user.type(
      screen.getByRole('textbox', { name: 'Source' }),
      'Acme Corp',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Notice' }),
      '© Acme Corp',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Terms URL' }),
      'https://acme.example/terms',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const sent: TechniqueReleaseNotice = {
      techniqueFrameworkId: null,
      source: 'Acme Corp',
      sourceUrl: '',
      notice: '© Acme Corp',
      termsUrl: 'https://acme.example/terms',
    };
    expect(releaseApi.updateTechniqueRelease).toHaveBeenCalledWith(
      'rel-5',
      sent,
    );
    const dialog = await readNotice(user, 'Acme Techniques');
    expect(dialog.getByText('© Acme Corp')).toBeInTheDocument();
    expect(
      dialog.getByRole('link', { name: 'Acme Corp Terms of Use' }),
    ).toHaveAttribute('href', 'https://acme.example/terms');
  });

  /**
   * Verifies: the dialog starts from what the release carries, and will not save a link that is not an http or
   * https address.
   * Interacts with: AdminTechniqueReleaseNoticeDialogComponent.errorFree.
   * Data: Enterprise ATT&CK 17.1.
   */
  it("starts from the release's own notice and refuses a link that is not a web address", async () => {
    const { releaseApi } = await renderReleases([ENTERPRISE]);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit Enterprise ATT&CK 17.1' }),
    );

    expect(await screen.findByRole('textbox', { name: 'Source' })).toHaveValue(
      'MITRE ATT&CK',
    );
    expect(screen.getByRole('textbox', { name: 'Terms URL' })).toHaveValue(
      ATTACK_TERMS,
    );
    const terms = screen.getByRole('textbox', { name: 'Terms URL' });
    await user.clear(terms);
    await user.type(terms, 'javascript:alert(1)');

    expect(
      screen.getByText('Enter an http or https address'),
    ).toBeInTheDocument();
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

    expect(
      screen.queryByRole('button', { name: /^Edit / }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: only a release whose framework defines mappings offers Import mappings (a defensive release without
   * that definition does not), a release with mappings says how many on its row, and no hint is given for it.
   * Interacts with: TechniqueReleaseService.getTechniqueReleases (stub), takesMappings, releasesWithoutMappings.
   * Data: Enterprise ATT&CK 17.1, MITRE D3FEND 1.6.0 with 4133 mappings, and a defensive release with no framework.
   */
  it('offers the mappings import on a row whose framework defines mappings, and counts them', async () => {
    const unframed: TechniqueRelease = {
      ...D3FEND,
      id: 'rel-9',
      version: '0.9',
      techniqueFrameworkId: null,
      techniqueFrameworkName: null,
      mappingRelation: null,
    };
    await renderReleases([ENTERPRISE, D3FEND_WITH_MAPPINGS, unframed]);

    const buttons = screen.getAllByTitle('Import mappings');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute(
      'aria-label',
      'Import mappings for MITRE D3FEND 1.6.0',
    );
    expect(screen.getByText('4133 mappings')).toBeInTheDocument();
    expect(screen.queryByText(/has no mappings yet/)).not.toBeInTheDocument();
    expect(screen.getAllByText('No framework')).toHaveLength(2);
    expect(screen.getByText('D3FEND definition')).toBeInTheDocument();
  });

  /**
   * Verifies: a release that takes mappings but has none gets a hint with its framework's download hint and the
   * link its framework's template gives for the release's version.
   * Interacts with: releasesWithoutMappings, mappingsDownloadUrl, mappingsDownloadHint.
   * Data: MITRE D3FEND 1.6.0 with no mappings.
   */
  it("tells an administrator where a release's mappings file is", async () => {
    await renderReleases([D3FEND]);

    expect(
      screen.getByText(
        /MITRE D3FEND 1\.6\.0 has no mappings yet\. Download d3fend-full-mappings\.json for the release's version/,
      ),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: MAPPINGS_URL });
    expect(link).toHaveAttribute('href', MAPPINGS_URL);
    expect(screen.queryByText(/\d+ mappings$/)).not.toBeInTheDocument();
  });

  /**
   * Verifies: picking a file after the row's Import ATT&CK mappings posts it to that release, reports what was
   * stored and skipped, and the row shows the stored count.
   * Interacts with: chooseMappingsFile, selectMappingsFile, TechniqueReleaseService.importTechniqueCountermeasures
   * (stub), SystemMessageService.displayMessage (stub), TechniqueReleaseDataService.importCountermeasures.
   * Data: MITRE D3FEND 1.6.0 with no mappings; an import that stores 5 pairs and skips 1.
   */
  it('imports the mappings file onto the release it was chosen for', async () => {
    const { releaseApi, messages, fixture } = await renderReleases([
      ENTERPRISE,
      D3FEND,
    ]);
    const file = new File(['{}'], 'd3fend-full-mappings.json', {
      type: 'application/json',
    });

    fireEvent.click(screen.getByTitle('Import mappings'));
    fireEvent.change(screen.getByTestId('mappings-file'), {
      target: { files: [file] },
    });
    fixture.detectChanges();

    expect(releaseApi.importTechniqueCountermeasures).toHaveBeenCalledWith(
      'rel-3',
      file,
    );
    expect(messages.displayMessage).toHaveBeenCalledWith(
      'Mappings Imported',
      '9 rows read. 5 mappings for 4 techniques stored on MITRE D3FEND 1.6.0; 1 skipped because their technique is not in this release.',
    );
    expect(screen.getByText('5 mappings')).toBeInTheDocument();
    expect(screen.queryByText(/has no mappings yet/)).not.toBeInTheDocument();
  });

  /**
   * Verifies: the edit dialog offers only frameworks of the release's domain and family, and saving sends the one
   * chosen with the notice fields.
   * Interacts with: editNotice, AdminTechniqueReleaseNoticeDialogComponent.frameworks, updateTechniqueRelease (stub).
   * Data: MITRE D3FEND 1.6.0 with no framework, and a defensive and an attack framework definition.
   */
  it('gives a release a framework of its own domain and family from the edit dialog', async () => {
    const unframed: TechniqueRelease = {
      ...D3FEND,
      techniqueFrameworkId: null,
      techniqueFrameworkName: null,
    };
    const { releaseApi, fixture } = await renderReleases([unframed], true, [
      D3FEND_FRAMEWORK,
      ATTACK_FRAMEWORK,
    ]);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit MITRE D3FEND 1.6.0' }),
    );
    const select = await TestbedHarnessEnvironment.documentRootLoader(
      fixture,
    ).getHarness(
      MatSelectHarness.with({
        selector: '[title="The framework definition the release belongs to"]',
      }),
    );
    await select.open();
    expect(
      await Promise.all((await select.getOptions()).map((o) => o.getText())),
    ).toEqual(['No framework', 'D3FEND definition']);
    await select.clickOptions({ text: 'D3FEND definition' });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(releaseApi.updateTechniqueRelease).toHaveBeenCalledWith(
      'rel-3',
      expect.objectContaining({ techniqueFrameworkId: 'fw-d3' }),
    );
  });

  /**
   * Verifies: the Frameworks table's release count follows a release being linked to a framework and unlinked
   * again, without reloading the page.
   * Interacts with: editNotice, TechniqueReleaseDataService.updateNotice, the framework store's releaseCount.
   * Data: MITRE D3FEND 1.6.0 with no framework, and a defensive framework definition with no releases.
   */
  it('counts a release on its framework as soon as it is linked or unlinked', async () => {
    const unframed: TechniqueRelease = {
      ...D3FEND,
      techniqueFrameworkId: null,
      techniqueFrameworkName: null,
    };
    const { fixture } = await renderReleases([unframed], true, [
      D3FEND_FRAMEWORK,
    ]);
    const user = userEvent.setup();
    const releaseCount = () => {
      fixture.detectChanges();
      const row = within(
        screen.getByRole('table', { name: 'Technique frameworks' }),
      ).getAllByRole('row')[1];
      return row.querySelector('.col-count').textContent.trim();
    };
    const pickFramework = async (text: string) => {
      await user.click(
        screen.getByRole('button', { name: 'Edit MITRE D3FEND 1.6.0' }),
      );
      const select = await TestbedHarnessEnvironment.documentRootLoader(
        fixture,
      ).getHarness(
        MatSelectHarness.with({
          selector: '[title="The framework definition the release belongs to"]',
        }),
      );
      await select.clickOptions({ text });
      await user.click(screen.getByRole('button', { name: 'Save' }));
    };
    expect(releaseCount()).toBe('0');

    await pickFramework('D3FEND definition');
    expect(releaseCount()).toBe('1');

    await pickFramework('No framework');
    expect(releaseCount()).toBe('0');
  });

  /**
   * Verifies: a file is read as the framework chosen under Read As, for when more than one matches it; with
   * none chosen it is matched automatically.
   * Interacts with: frameworkControl, selectFile, TechniqueReleaseService.importTechniqueRelease (stub).
   * Data: two framework definitions and a file picked twice.
   */
  it('imports a file as the framework chosen, or matches it automatically', async () => {
    const { releaseApi, fixture } = await renderReleases([], true, [
      D3FEND_FRAMEWORK,
      ATTACK_FRAMEWORK,
    ]);
    const file = new File(['{}'], 'release.json', { type: 'application/json' });
    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('input[type=file]:not([data-testid])');

    fireEvent.change(input, { target: { files: [file] } });
    expect(releaseApi.importTechniqueRelease).toHaveBeenLastCalledWith(
      file,
      undefined,
      undefined,
    );

    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(
      MatSelectHarness.with({
        selector: '[title="The framework to read the next file as"]',
      }),
    );
    await select.clickOptions({ text: 'Enterprise definition' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(releaseApi.importTechniqueRelease).toHaveBeenLastCalledWith(
      file,
      undefined,
      'fw-ent',
    );
  });
});
