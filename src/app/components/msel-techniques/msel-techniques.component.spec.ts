// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { fireEvent, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, Subject, of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  TechniqueRelease,
  TechniqueReleaseService,
  TechniqueTactic,
  Technique,
  Msel,
  MselTechnique,
  MselTechniqueService,
  MselCountermeasures,
  SystemPermission,
  SystemPermissionsService,
  DataFieldType,
} from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { DataFieldStore } from 'src/app/data/data-field/data-field.store';
import { DataValueStore } from 'src/app/data/data-value/data-value.store';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselTechniquesComponent } from './msel-techniques.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  permissionApiStubs,
  PermissionGrants,
} from 'src/app/test-utils/mock-permission-data.service';
import { unstubbed } from 'src/app/test-utils/unstubbed';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';

const ME = 'user-me';
const MSEL: Msel = {
  id: 'msel-1',
  name: 'Exercise Alpha',
  createdBy: 'someone-else',
  userMselRoles: [],
};
const T1059: MselTechnique = {
  id: 'mat-1',
  mselId: 'msel-1',
  techniqueId: 'at-1',
  technique: {
    id: 'at-1',
    techniqueReleaseId: 'rel-1',
    domain: 'enterprise-attack',
    externalId: 'T1059',
    name: 'Command and Scripting Interpreter',
    url: 'https://attack.mitre.org/techniques/T1059',
  },
};
const T1003: MselTechnique = {
  id: 'mat-2',
  mselId: 'msel-1',
  techniqueId: 'at-2',
  technique: {
    id: 'at-2',
    techniqueReleaseId: 'rel-1',
    domain: 'enterprise-attack',
    externalId: 'T1003',
    name: 'OS Credential Dumping',
    url: 'https://attack.mitre.org/techniques/T1003',
  },
};
const TERMS_OF_USE =
  'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/';
const D3FEND_TERMS_OF_USE = 'https://d3fend.mitre.org/tou/';
// What the API's parsers stamp on a release: the notice, the publisher and the terms it carries.
const COPYRIGHT =
  '© 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation.';
const ENTERPRISE_RELEASE: TechniqueRelease = {
  id: 'rel-1',
  domain: 'enterprise-attack',
  name: 'Enterprise ATT&CK',
  version: '17.1',
  source: 'MITRE ATT&CK',
  termsUrl: TERMS_OF_USE,
  groupLabel: 'Tactics',
  notice: `${COPYRIGHT}\nMITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation.`,
};
const ATLAS_RELEASE: TechniqueRelease = {
  id: 'rel-1',
  domain: 'ATLAS',
  name: 'ATLAS',
  version: '2026.10',
  source: 'MITRE ATLAS',
  termsUrl: TERMS_OF_USE,
  groupLabel: 'Tactics',
  notice: `${COPYRIGHT}\nMITRE ATLAS™ is a trademark of The MITRE Corporation.`,
};
const D3FEND_RELEASE: TechniqueRelease = {
  id: 'rel-d3',
  domain: 'd3fend',
  isDefensive: true,
  name: 'MITRE D3FEND',
  version: '1.6.0',
  source: 'MITRE D3FEND',
  termsUrl: D3FEND_TERMS_OF_USE,
  groupLabel: 'Tactics',
  // from its framework definition (test data)
  mappingRelation: 'countered by',
  tacticOrder: [
    'Model',
    'Harden',
    'Detect',
    'Isolate',
    'Deceive',
    'Evict',
    'Restore',
  ],
  notice: `${COPYRIGHT}\nMITRE D3FEND™ is a trademark of The MITRE Corporation.`,
};
const CAPEC_RELEASE: TechniqueRelease = {
  id: 'rel-c',
  domain: 'capec',
  name: 'MITRE CAPEC',
  version: '3.9',
  source: 'MITRE CAPEC',
  termsUrl: 'https://capec.mitre.org/about/termsofuse.html',
  groupLabel: 'Categories',
  // from its framework definition (test data)
  weaknessUrlTemplate: 'https://cwe.mitre.org/data/definitions/{id}.html',
  notice: `${COPYRIGHT}\nMITRE CAPEC™ is a trademark of The MITRE Corporation.`,
};
const NEXT_ENTERPRISE_RELEASE: TechniqueRelease = {
  ...ENTERPRISE_RELEASE,
  id: 'rel-2',
  version: '18.0',
};
const CUSTOM_RELEASE: TechniqueRelease = {
  id: 'rel-x',
  domain: 'acme-ttp',
  name: 'Acme Techniques',
  version: '1.0',
  groupLabel: 'Tactics',
};
const CUSTOM_TECHNIQUE: MselTechnique = {
  id: 'mat-x',
  mselId: 'msel-1',
  techniqueId: 'at-x',
  technique: {
    id: 'at-x',
    techniqueReleaseId: 'rel-x',
    domain: 'acme-ttp',
    externalId: 'AT-100',
    name: 'Front Door',
    url: 'https://acme.example/AT-100',
  },
};
const CAPEC_66: Technique = {
  id: 'at-c66',
  techniqueReleaseId: 'rel-c',
  domain: 'capec',
  externalId: 'CAPEC-66',
  name: 'SQL Injection',
  tactics: ['capec-248'],
  platforms: ['Software'],
  weaknesses: ['CWE-89', 'CWE-1286'],
  url: 'https://capec.mitre.org/data/definitions/66.html',
  referenceLinks: [
    {
      source: 'WASC',
      label: 'WASC-19 SQL Injection',
      url: 'http://projects.webappsec.org/SQL-Injection',
    },
    {
      source: 'OWASP',
      label: 'SQL Injection',
      url: 'https://owasp.org/www-community/attacks/SQL_Injection',
    },
  ],
};
const CAPEC_8: Technique = {
  id: 'at-c8',
  techniqueReleaseId: 'rel-c',
  domain: 'capec',
  externalId: 'CAPEC-8',
  name: 'Buffer Overflow in an API Call',
  tactics: ['capec-123'],
  platforms: ['Software'],
  weaknesses: ['CWE-120'],
  url: 'https://capec.mitre.org/data/definitions/8.html',
};
const CAPEC_TERMS_OF_USE = 'https://capec.mitre.org/about/termsofuse.html';
const CAPEC_66_IN_POOL: MselTechnique = {
  id: 'mat-c66',
  mselId: 'msel-1',
  techniqueId: 'at-c66',
  technique: CAPEC_66,
};
const AML_T0000: Technique = {
  id: 'at-1',
  techniqueReleaseId: 'rel-1',
  domain: 'ATLAS',
  externalId: 'AML.T0000',
  name: 'Search Open Technical Databases',
  tactics: ['reconnaissance'],
  url: 'https://atlas.mitre.org/techniques/AML.T0000',
};
const ATLAS_IN_POOL: MselTechnique = {
  id: 'mat-1',
  mselId: 'msel-1',
  techniqueId: 'at-1',
  technique: AML_T0000,
};
const D3_CH: Technique = {
  id: 'at-d3',
  techniqueReleaseId: 'rel-d3',
  domain: 'd3fend',
  isDefensive: true,
  externalId: 'D3-CH',
  name: 'Credential Hardening',
  tactics: ['harden'],
  url: 'https://d3fend.mitre.org/technique/d3f:CredentialHardening/',
};
const D3_CH_IN_POOL: MselTechnique = {
  id: 'mat-d3',
  mselId: 'msel-1',
  techniqueId: 'at-d3',
  technique: D3_CH,
};
const NO_MAPPINGS: MselCountermeasures = {
  mselId: 'msel-1',
  techniqueReleaseId: null,
  hasMappings: false,
  techniques: [],
};
// D3FEND 1.6.0 counters T1059 with D3-CH, inherited from nothing; D3-CH is in the defensive pool already.
const T1059_COUNTERED: MselCountermeasures = {
  mselId: 'msel-1',
  techniqueReleaseId: 'rel-d3',
  hasMappings: true,
  techniques: [
    {
      techniqueId: 'at-1',
      offensiveExternalId: 'T1059',
      inheritedFrom: null,
      countermeasures: [
        {
          id: 'cm-1',
          techniqueReleaseId: 'rel-d3',
          offensiveExternalId: 'T1059',
          defensiveTechniqueId: 'at-d3',
          defensiveTechnique: D3_CH,
          defensiveTactic: 'Harden',
          rationale: 'hardens Credential; T1059 executes Script',
          weight: 2,
        },
      ],
    },
  ],
};

// The notice is behind each release's Copyright & terms link: open the nth one and read the dialog, then close it.
async function readNotice(index = 0): Promise<HTMLElement> {
  await userEvent
    .setup()
    .click(screen.getAllByRole('button', { name: 'Copyright & terms' })[index]);
  return await screen.findByRole('dialog');
}
async function closeNotice() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
}

const attackSection = () =>
  screen
    .getByLabelText('Attack Techniques release')
    .closest<HTMLElement>('app-technique-pool');
const defensiveSection = () =>
  screen
    .getByLabelText('Defensive Techniques release')
    .closest<HTMLElement>('app-technique-pool');

// With no release imported the Add Techniques browsers stay empty and only the pool can put MITRE content on screen;
// an imported release is browsed by its family's section as soon as the component loads it.
async function renderTechniques(
  pool: MselTechnique[],
  releases: TechniqueRelease[] = [],
  techniques: Record<string, Technique[]> = {},
  countermeasures: MselCountermeasures = NO_MAPPINGS,
  grants: PermissionGrants = {},
  tactics: Record<string, TechniqueTactic[]> = {},
  dialog?: Pick<CrucibleDialogService, 'confirm'>,
  tacticsFor?: (releaseId: string) => Observable<TechniqueTactic[]>,
) {
  const poolApi = {
    getMselTechniques: vi.fn(() => of(structuredClone(pool))),
    deleteMselTechnique: vi.fn(() => of({})),
    getMselCountermeasures: vi.fn(() => of(structuredClone(countermeasures))),
  } satisfies ApiStub<MselTechniqueService>;
  const releaseApi = {
    getTechniqueReleases: vi.fn(() => of(structuredClone(releases))),
    getTechniqueTactics: vi.fn(
      (id: string) =>
        tacticsFor?.(id) ??
        of<TechniqueTactic[]>(structuredClone(tactics[id] ?? [])),
    ),
    getTechniques: vi.fn((id: string) =>
      of(structuredClone(techniques[id] ?? [])),
    ),
  } satisfies ApiStub<TechniqueReleaseService>;
  // The sections load the permissions themselves in ngOnInit, so the real service is provided over the
  // stubbed endpoint, without priming it.
  const permissionApis = permissionApiStubs(grants);
  const rendered = await renderComponent(MselTechniquesComponent, {
    providers: [
      {
        provide: SystemPermissionsService,
        useValue: permissionApis.systemPermissions,
      },
      PermissionDataService,
      { provide: MselTechniqueService, useValue: poolApi },
      { provide: TechniqueReleaseService, useValue: releaseApi },
      dialog
        ? { provide: CrucibleDialogService, useValue: dialog }
        : unstubbed(CrucibleDialogService),
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

// Ticks both techniques of the pool and clicks Remove 2, with the confirmation answered as given.
async function removeBothTicked(answer: boolean) {
  const confirm = vi.fn(
    () => dialogRefStub<unknown, boolean>(answer).dialogRef,
  );
  const rendered = await renderTechniques(
    [T1059, T1003],
    [ENTERPRISE_RELEASE],
    {},
    NO_MAPPINGS,
    { system: [SystemPermission.ManageMsels] },
    {},
    { confirm },
  );
  const user = userEvent.setup();
  for (const id of ['T1059', 'T1003']) {
    await user.click(
      await within(attackSection()).findByRole('checkbox', {
        name: `Select ${id}`,
      }),
    );
  }
  await user.click(
    within(attackSection()).getByRole('button', { name: /Remove 2/ }),
  );
  expect(confirm).toHaveBeenCalledTimes(1);
  return rendered;
}

describe('MselTechniquesComponent', () => {
  /**
   * Verifies: the tab has an Attack Techniques section and a Defensive Techniques section, each with a release
   * picker, and the pool is loaded once for both.
   * Interacts with: MselTechniqueService.getMselTechniques (stub), TechniquePoolComponent.title.
   * Data: an empty pool; no release imported.
   */
  it('shows an attack section and a defensive section', async () => {
    const { poolApi } = await renderTechniques([]);

    expect(poolApi.getMselTechniques).toHaveBeenCalledTimes(1);
    expect(poolApi.getMselTechniques).toHaveBeenCalledWith('msel-1');
    expect(
      screen.queryByRole('heading', { name: /Techniques/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Attack Techniques release'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Defensive Techniques release'),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/No releases have been imported/)).toHaveLength(
      2,
    );
  });

  /**
   * Verifies: with a technique in the pool, the release's copyright and trademark notice shows under its pinned row, with
   * its Terms of Use link.
   * Interacts with: MselTechniqueService.getMselTechniques (stub), TechniqueNoticeComponent.
   * Data: T1059 in the pool; Enterprise ATT&CK 17.1 imported, carrying MITRE's notice.
   */
  it('attributes MITRE when the pool lists techniques', async () => {
    await renderTechniques([T1059], [ENTERPRISE_RELEASE]);

    expect(screen.getByText('T1059')).toBeInTheDocument();
    // the link sits with the pinned release it covers, not at the foot of the tab, and nothing is shown until it is opened
    expect(
      screen.getAllByRole('button', { name: 'Copyright & terms' }),
    ).toHaveLength(1);
    expect(
      within(attackSection()).getByLabelText('Pinned releases'),
    ).toContainElement(
      screen.getByRole('button', { name: 'Copyright & terms' }),
    );
    expect(screen.queryByText(/The MITRE Corporation/)).not.toBeInTheDocument();
    const dialog = within(await readNotice());
    expect(
      dialog.getByText(/© 2026 The MITRE Corporation/),
    ).toBeInTheDocument();
    expect(
      dialog.getByText(
        /MITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation/,
      ),
    ).toBeInTheDocument();
    expect(
      dialog.getByRole('link', { name: 'MITRE ATT&CK Terms of Use' }),
    ).toHaveAttribute('href', TERMS_OF_USE);
  });

  /**
   * Verifies: with nothing of MITRE's on screen there is no notice to give.
   * Interacts with: TechniqueNoticeComponent.
   * Data: an empty pool; Enterprise ATT&CK 17.1 imported but its techniques not browsed (none to show).
   */
  it('gives no attribution for an empty pool', async () => {
    await renderTechniques([], [ENTERPRISE_RELEASE]);

    expect(screen.getAllByText(/No techniques yet/)).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Copyright & terms' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: techniques from an ATLAS release carry MITRE's ATLAS trademark sentence and not ATT&CK's, because the
   * notice is what the release carries, and their IDs show in the pool.
   * Interacts with: TechniqueReleaseService.getTechniqueReleases/getTechniques (stubs), TechniqueNoticeComponent.
   * Data: the ATLAS 2026.10 release imported, AML.T0000 in its pool and in the (collapsed) browser.
   */
  it('also credits MITRE ATLAS when the techniques are from an ATLAS release', async () => {
    const { releaseApi } = await renderTechniques(
      [ATLAS_IN_POOL],
      [ATLAS_RELEASE],
      { 'rel-1': [AML_T0000] },
    );

    expect(releaseApi.getTechniques).toHaveBeenCalledWith('rel-1');
    expect(screen.getAllByText('AML.T0000').length).toBeGreaterThan(0);
    const dialog = within(await readNotice());
    expect(
      dialog.queryByText(/ATT&CK and ATT&CK are registered trademarks/),
    ).not.toBeInTheDocument();
    expect(
      dialog.getByText(
        /MITRE ATLAS™ is a trademark of The MITRE Corporation\./,
      ),
    ).toBeInTheDocument();
    expect(dialog.queryByText(/MITRE D3FEND/)).not.toBeInTheDocument();
  });

  /**
   * Verifies: a CAPEC release is browsed with its patterns' own labels (Categories, Domains), its weaknesses link to
   * cwe.mitre.org and its OWASP and WASC links open where they point, a search for a CWE id finds the patterns that
   * cite it, and the notice adds the CAPEC trademark sentence and the CAPEC Terms of Use link.
   * Interacts with: TechniquePoolComponent.browserColumns/weaknessUrl/matchesBrowserFilter, showsCapecContent.
   * Data: MITRE CAPEC 3.9 imported with CAPEC-66 (CWE-89, CWE-1286, WASC and OWASP links) and CAPEC-8 (CWE-120).
   */
  it('browses a CAPEC release by its weaknesses and credits MITRE CAPEC', async () => {
    await renderTechniques([], [CAPEC_RELEASE], {
      'rel-c': [CAPEC_66, CAPEC_8],
    });
    const attack = within(attackSection());

    expect(attack.getByText('Categories')).toBeInTheDocument();
    expect(attack.getByText('Domains')).toBeInTheDocument();
    expect(attack.getByText('Weaknesses')).toBeInTheDocument();
    expect(attack.getByText('See also')).toBeInTheDocument();
    expect(attack.queryByText('Platforms')).not.toBeInTheDocument();
    expect(attack.getByText('CAPEC-66')).toBeInTheDocument();
    expect(attack.getByRole('link', { name: 'CWE-89' })).toHaveAttribute(
      'href',
      'https://cwe.mitre.org/data/definitions/89.html',
    );
    expect(attack.getByRole('link', { name: 'CWE-1286' })).toHaveAttribute(
      'href',
      'https://cwe.mitre.org/data/definitions/1286.html',
    );
    expect(attack.getByRole('link', { name: 'WASC' })).toHaveAttribute(
      'href',
      'http://projects.webappsec.org/SQL-Injection',
    );
    expect(attack.getByRole('link', { name: 'OWASP' })).toHaveAttribute(
      'href',
      'https://owasp.org/www-community/attacks/SQL_Injection',
    );
    const dialog = within(await readNotice());
    expect(
      dialog.getByText(
        /MITRE CAPEC™ is a trademark of The MITRE Corporation\./,
      ),
    ).toBeInTheDocument();
    expect(dialog.queryByText(/MITRE ATLAS/)).not.toBeInTheDocument();
    expect(
      dialog.getByRole('link', { name: 'MITRE CAPEC Terms of Use' }),
    ).toHaveAttribute('href', CAPEC_TERMS_OF_USE);
    expect(
      dialog.queryByText(/ATT&CK and ATT&CK are registered trademarks/),
    ).not.toBeInTheDocument();
    await closeNotice();

    fireEvent.input(attack.getByPlaceholderText('Search techniques'), {
      target: { value: 'cwe-120' },
    });

    expect(await attack.findByText('CAPEC-8')).toBeInTheDocument();
    expect(attack.queryByText('CAPEC-66')).not.toBeInTheDocument();
  });

  /**
   * Verifies: the pool names each technique's groups from its own release, so a pattern from a release that is not
   * the one being browsed shows its category name, not its short name.
   * Interacts with: TechniquePoolComponent.getTacticNames/loadTacticNames, TechniqueReleaseService.getTechniqueTactics (stub).
   * Data: a pool holding T1059 (Enterprise ATT&CK, Execution) and CAPEC-66 (MITRE CAPEC, Command Injection).
   */
  it("names each pool technique's groups from its own release", async () => {
    const t1059: MselTechnique = {
      ...T1059,
      technique: { ...T1059.technique, tactics: ['execution'] },
    };
    await renderTechniques(
      [t1059, CAPEC_66_IN_POOL],
      [ENTERPRISE_RELEASE, CAPEC_RELEASE],
      {},
      NO_MAPPINGS,
      {},
      {
        'rel-1': [
          {
            id: 'tac-1',
            techniqueReleaseId: 'rel-1',
            shortName: 'execution',
            name: 'Execution',
          },
        ],
        'rel-c': [
          {
            id: 'tac-c',
            techniqueReleaseId: 'rel-c',
            shortName: 'capec-248',
            name: 'Command Injection',
          },
        ],
      },
    );
    const attack = within(attackSection());

    expect(await attack.findByText('Command Injection')).toBeInTheDocument();
    expect(attack.getAllByText('Execution').length).toBeGreaterThan(0);
    expect(attack.queryByText('capec-248')).not.toBeInTheDocument();
  });

  /**
   * Verifies: a pattern that cites many weaknesses shows the first four and a "+n more" toggle that opens the rest
   * and closes them again; a pattern with four or fewer has no toggle.
   * Interacts with: TechniquePoolComponent.shownWeaknesses/toggleWeaknesses.
   * Data: MITRE CAPEC 3.9 with CAPEC-1 citing six CWEs, and CAPEC-8 citing one.
   */
  it('shows the first four weaknesses of a pattern and the rest on request', async () => {
    const capec1: Technique = {
      ...CAPEC_8,
      id: 'at-c1',
      externalId: 'CAPEC-1',
      name: 'Accessing Functionality Not Properly Constrained by ACLs',
      weaknesses: [
        'CWE-276',
        'CWE-285',
        'CWE-434',
        'CWE-693',
        'CWE-732',
        'CWE-1191',
      ],
    };
    await renderTechniques([], [CAPEC_RELEASE], { 'rel-c': [capec1, CAPEC_8] });
    const attack = within(attackSection());
    const user = userEvent.setup();

    expect(attack.getByRole('link', { name: 'CWE-693' })).toBeInTheDocument();
    expect(
      attack.queryByRole('link', { name: 'CWE-732' }),
    ).not.toBeInTheDocument();
    expect(attack.getAllByRole('button', { name: /more$/ })).toHaveLength(1);

    await user.click(attack.getByRole('button', { name: '+2 more' }));
    expect(attack.getByRole('link', { name: 'CWE-1191' })).toBeInTheDocument();

    await user.click(attack.getByRole('button', { name: 'show fewer' }));
    expect(
      attack.queryByRole('link', { name: 'CWE-732' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: the CAPEC columns and sentences are only for a CAPEC release; an ATT&CK release keeps its Tactics and
   * Platforms and has no weaknesses column, and no CAPEC notice appears.
   * Interacts with: TechniquePoolComponent.browsesWeaknesses, the release's groupLabel.
   * Data: Enterprise ATT&CK 17.1 imported with T1059.
   */
  it('keeps the ATT&CK labels, and gives no CAPEC notice, for an ATT&CK release', async () => {
    await renderTechniques([], [ENTERPRISE_RELEASE], {
      'rel-1': [T1059.technique],
    });
    const attack = within(attackSection());

    expect(attack.getByText('Tactics')).toBeInTheDocument();
    expect(attack.getByText('Platforms')).toBeInTheDocument();
    expect(attack.queryByText('Weaknesses')).not.toBeInTheDocument();
    const dialog = within(await readNotice());
    expect(dialog.queryByText(/MITRE CAPEC/)).not.toBeInTheDocument();
    expect(
      dialog.queryByRole('link', { name: 'MITRE CAPEC Terms of Use' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: a D3FEND technique is listed by the defensive section, not the attack one, and
   *  the notice adds the D3FEND trademark sentence and the D3FEND Terms of Use link.
   * Interacts with: TechniquePoolComponent.family, TechniqueNoticeComponent.
   * Data: T1059 and D3-CH in the pool; Enterprise ATT&CK 17.1 and MITRE D3FEND 1.6.0 imported.
   */
  it('credits MITRE D3FEND and its terms of use when the defensive pool lists techniques', async () => {
    await renderTechniques(
      [T1059, D3_CH_IN_POOL],
      [ENTERPRISE_RELEASE, D3FEND_RELEASE],
    );

    expect(within(attackSection()).getByText('T1059')).toBeInTheDocument();
    expect(
      within(attackSection()).queryByText('D3-CH'),
    ).not.toBeInTheDocument();
    expect(
      within(attackSection()).getByText('MSEL Techniques (1)'),
    ).toBeInTheDocument();
    expect(within(defensiveSection()).getByText('D3-CH')).toBeInTheDocument();
    expect(
      within(defensiveSection()).getByText('MSEL Techniques (1)'),
    ).toBeInTheDocument();
    // each pinned release has its own link under its row: ATT&CK's, then D3FEND's
    expect(
      screen.getAllByRole('button', { name: 'Copyright & terms' }),
    ).toHaveLength(2);
    const d3fend = within(await readNotice(1));
    expect(
      d3fend.getByText(
        /MITRE D3FEND™ is a trademark of The MITRE Corporation\./,
      ),
    ).toBeInTheDocument();
    expect(
      d3fend.getByRole('link', { name: 'MITRE D3FEND Terms of Use' }),
    ).toHaveAttribute('href', D3FEND_TERMS_OF_USE);
    expect(
      d3fend.queryByRole('link', { name: 'MITRE ATT&CK Terms of Use' }),
    ).not.toBeInTheDocument();
    await closeNotice();
    expect(
      within(await readNotice(0)).getByRole('link', {
        name: 'MITRE ATT&CK Terms of Use',
      }),
    ).toHaveAttribute('href', TERMS_OF_USE);
  });

  /**
   * Verifies: each section's release picker offers only its family's releases, each browses its own, and the
   * defensive browser has no Platforms column.
   * Interacts with: TechniqueReleaseService.getTechniqueReleases/getTechniques (stubs), TechniquePoolComponent.releases.
   * Data: Enterprise ATT&CK 17.1 and MITRE D3FEND 1.6.0 imported; an empty pool.
   */
  it('offers each section only its own releases', async () => {
    const { fixture, releaseApi } = await renderTechniques(
      [],
      [ENTERPRISE_RELEASE, D3FEND_RELEASE],
      { 'rel-1': [T1059.technique], 'rel-d3': [D3_CH] },
    );
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const attackSelect = await loader.getHarness(
      MatSelectHarness.with({
        selector: '[aria-label="Attack Techniques release"]',
      }),
    );
    const defensiveSelect = await loader.getHarness(
      MatSelectHarness.with({
        selector: '[aria-label="Defensive Techniques release"]',
      }),
    );

    expect(releaseApi.getTechniques).toHaveBeenCalledWith('rel-1');
    expect(releaseApi.getTechniques).toHaveBeenCalledWith('rel-d3');
    expect(await attackSelect.getValueText()).toBe('Enterprise ATT&CK 17.1');
    expect(await defensiveSelect.getValueText()).toBe('MITRE D3FEND 1.6.0');
    await attackSelect.open();
    expect(
      await Promise.all(
        (await attackSelect.getOptions()).map((o) => o.getText()),
      ),
    ).toEqual(['Enterprise ATT&CK 17.1']);
    await attackSelect.close();
    await defensiveSelect.open();
    expect(
      await Promise.all(
        (await defensiveSelect.getOptions()).map((o) => o.getText()),
      ),
    ).toEqual(['MITRE D3FEND 1.6.0']);
    await defensiveSelect.close();
    expect(within(attackSection()).getByText('Platforms')).toBeInTheDocument();
    expect(
      within(defensiveSection()).queryByText('Platforms'),
    ).not.toBeInTheDocument();
    expect(within(defensiveSection()).getByText('D3-CH')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Copyright & terms' }),
    ).toHaveLength(2);
  });
  /**
   * Verifies: each pooled attack technique gets a Countered by row loaded for the MSEL once, the defensive pool
   * gets none, and opening the row lists the D3FEND technique grouped under its tactic, marked as already pooled;
   * a user who cannot edit the MSEL gets the mark, not a checkbox.
   * Interacts with: MselTechniqueService.getMselCountermeasures (stub), MselCountermeasureDataService,
   * TechniquePoolComponent.countermeasuresFor, TechniqueCountermeasuresComponent.
   * Data: T1059 and D3-CH in the pool; D3FEND 1.6.0 imported with D3-CH countering T1059.
   */
  it('lists what counters each pooled attack technique', async () => {
    const { poolApi } = await renderTechniques(
      [T1059, D3_CH_IN_POOL],
      [ENTERPRISE_RELEASE, D3FEND_RELEASE],
      {},
      T1059_COUNTERED,
    );

    expect(poolApi.getMselCountermeasures).toHaveBeenCalledTimes(1);
    expect(poolApi.getMselCountermeasures).toHaveBeenCalledWith('msel-1');
    const toggle = within(attackSection()).getByRole('button', {
      name: 'Countered by, T1059',
    });
    expect(toggle).toHaveTextContent('Countered by (1)');
    expect(
      within(defensiveSection()).queryByRole('button', {
        name: /Countered by/,
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(within(attackSection()).getByText('Harden')).toBeInTheDocument();
    expect(
      within(attackSection()).getByText('Credential Hardening'),
    ).toBeInTheDocument();
    expect(
      within(attackSection()).getByTitle("In this MSEL's defensive techniques"),
    ).toBeInTheDocument();
    expect(
      within(attackSection()).queryByRole('checkbox', { name: 'Add D3-CH' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: with no defensive release imported the mappings row says so rather than listing nothing.
   * Interacts with: TechniqueCountermeasuresComponent.emptyMessage, TechniquePoolComponent.hasDefensiveRelease.
   * Data: T1059 in the pool; Enterprise ATT&CK 17.1 the only release.
   */
  it('says when no defensive release is there to map to', async () => {
    await renderTechniques([T1059], [ENTERPRISE_RELEASE], {
      'rel-1': [T1059.technique],
    });

    fireEvent.click(
      within(attackSection()).getByRole('button', { name: 'Mapped to, T1059' }),
    );

    expect(
      screen.getByText(
        'No defensive release has been imported. An administrator imports one on the Technique Frameworks page.',
      ),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: ATT&CK enterprise, CAPEC and D3FEND techniques sit side by side in one MSEL: the attack section lists
   * one pinned release per domain and names each technique's domain, while the defensive section, holding one
   * domain, names none; the notice carries each release's own lines, the shared copyright once.
   * Interacts with: TechniquePoolComponent.pinnedDomains/showsDomainLabels, TechniqueNoticeComponent.
   * Data: T1059 (enterprise 17.1), CAPEC-66 (capec 3.9) and D3-CH (d3fend 1.6.0) in the pool.
   */
  it('holds a technique of every domain in one pool and pins each domain to its own release', async () => {
    await renderTechniques(
      [T1059, CAPEC_66_IN_POOL, D3_CH_IN_POOL],
      [ENTERPRISE_RELEASE, CAPEC_RELEASE, D3FEND_RELEASE],
    );
    const attack = within(attackSection());

    expect(attack.getByText('MSEL Techniques (2)')).toBeInTheDocument();
    const pinned = within(
      attackSection().querySelector<HTMLElement>('.pinned-releases'),
    );
    expect(pinned.getByText('Enterprise ATT&CK 17.1')).toBeInTheDocument();
    expect(pinned.getByText('MITRE CAPEC 3.9')).toBeInTheDocument();
    expect(
      attack.getByText('enterprise-attack', { selector: '.domain-tag' }),
    ).toBeInTheDocument();
    expect(
      attack.getByText('capec', { selector: '.domain-tag' }),
    ).toBeInTheDocument();
    expect(
      within(defensiveSection()).queryByText('d3fend', {
        selector: '.domain-tag',
      }),
    ).not.toBeInTheDocument();
    // each of the three pinned releases has its own link, and opens its own notice
    expect(
      screen.getAllByRole('button', { name: 'Copyright & terms' }),
    ).toHaveLength(3);
    // the attack section lists its pinned domains alphabetically (capec, then enterprise-attack), the defensive one follows
    const capec = within(await readNotice(0));
    expect(capec.getByText(/MITRE CAPEC™ is a trademark/)).toBeInTheDocument();
    expect(capec.queryByText(/MITRE D3FEND/)).not.toBeInTheDocument();
    await closeNotice();
    expect(
      within(await readNotice(2)).getByText(/MITRE D3FEND™ is a trademark/),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: a pool of one domain shows no domain label on its techniques.
   * Interacts with: TechniquePoolComponent.showsDomainLabels.
   * Data: T1059 in the pool; Enterprise ATT&CK 17.1 imported.
   */
  it('shows no domain label while the pool holds one domain', async () => {
    await renderTechniques([T1059], [ENTERPRISE_RELEASE]);

    expect(attackSection().querySelector('.domain-tag')).toBeNull();
  });

  /**
   * Verifies: the MSEL's creator can edit its techniques without the ManageMsels permission, and unticking a pooled
   * technique then cancelling the removal leaves it ticked, as it is still in the pool.
   * Interacts with: TechniquePoolComponent.canEditMsel (loggedInUserId), togglePoolItem, appModelCheckbox,
   * CrucibleDialogService.confirm (cancelled).
   * Data: T1059 in the pool; Enterprise ATT&CK 17.1 browsed; the MSEL created by the signed-in user; no grants.
   */
  it("lets the MSEL's creator edit, and keeps a technique ticked when its removal is cancelled", async () => {
    const confirm = vi.fn(
      () =>
        ({ afterClosed: () => of(false) }) as ReturnType<
          CrucibleDialogService['confirm']
        >,
    );
    const { fixture, poolApi } = await renderTechniques(
      [T1059],
      [ENTERPRISE_RELEASE],
      { 'rel-1': [T1059.technique] },
      NO_MAPPINGS,
      {},
      {},
      { confirm },
    );
    TestBed.inject(MselStore).update('msel-1', { createdBy: ME });
    fixture.detectChanges();
    fireEvent.click(
      within(attackSection()).getByRole('button', { name: /Add Techniques/ }),
    );
    fixture.detectChanges();

    const box = await within(attackSection()).findByRole('checkbox', {
      name: 'Add T1059',
    });
    expect(box).toBeChecked();

    fireEvent.click(box);
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Remove Technique' }),
    );
    expect(box).toBeChecked();
    expect(poolApi.deleteMselTechnique).not.toHaveBeenCalled();
  });

  /**
   * Verifies: browsing another release of one domain offers to upgrade that domain alone, on its own row, names the
   * domain in the notice, and leaves the other domain's row without an upgrade.
   * Interacts with: TechniquePoolComponent.pinnedDomains/needsUpgrade, TechniqueReleaseService (stub).
   * Data: T1059 (enterprise 17.1) and CAPEC-66 (capec 3.9) in the pool; Enterprise 18.0 imported.
   */
  it('offers to upgrade one domain on its own row and leaves the others alone', async () => {
    const { fixture } = await renderTechniques(
      [T1059, CAPEC_66_IN_POOL],
      [ENTERPRISE_RELEASE, NEXT_ENTERPRISE_RELEASE, CAPEC_RELEASE],
      { 'rel-1': [T1059.technique], 'rel-2': [T1059.technique] },
      NO_MAPPINGS,
      { system: [SystemPermission.ManageMsels] },
    );
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const select = await loader.getHarness(
      MatSelectHarness.with({
        selector: '[aria-label="Attack Techniques release"]',
      }),
    );

    await select.open();
    await select.clickOptions({ text: /18\.0/ });

    const attack = within(attackSection());
    expect(
      await attack.findByRole('button', {
        name: /Upgrade enterprise-attack to 18\.0/,
      }),
    ).toBeInTheDocument();
    expect(
      attack.queryByRole('button', { name: /Upgrade capec/ }),
    ).not.toBeInTheDocument();
    expect(
      attack.getByText(
        /This MSEL's enterprise-attack techniques are from Enterprise ATT&CK 17\.1/,
      ),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: a release that carries no notice (a custom one) puts no notice and no terms link on the page, MITRE's
   * or any other.
   * Interacts with: TechniqueNoticeComponent.
   * Data: AT-100 in the pool; a custom release with no notice imported.
   */
  it('shows no notice for a custom release that carries none', async () => {
    await renderTechniques([CUSTOM_TECHNIQUE], [CUSTOM_RELEASE]);

    expect(within(attackSection()).getByText('AT-100')).toBeInTheDocument();
    expect(
      attackSection().closest('.content-area')?.querySelector('.attribution'),
    ).toBeNull();
    expect(screen.queryByText(/The MITRE Corporation/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Terms of Use/ }),
    ).not.toBeInTheDocument();
  });
  /**
   * Verifies: the technique's name opens a dialog with its description and a link to the framework's page, and its ID in
   * the pool is plain text, not a link.
   * Interacts with: TechniquePoolComponent.showDetail, TechniqueDetailDialogComponent.
   * Data: T1059 in the pool; Enterprise ATT&CK 17.1 imported.
   */
  it('opens a technique description dialog from its name', async () => {
    await renderTechniques([T1059], [ENTERPRISE_RELEASE]);
    const user = userEvent.setup();

    expect(
      within(attackSection()).queryByRole('link', { name: 'T1059' }),
    ).not.toBeInTheDocument();
    await user.click(
      within(attackSection()).getByRole('button', {
        name: 'Command and Scripting Interpreter',
      }),
    );

    expect(
      await screen.findByRole('link', {
        name: 'Open T1059 on attack.mitre.org',
      }),
    ).toHaveAttribute('href', 'https://attack.mitre.org/techniques/T1059');
  });
  /**
   * Verifies: the pool has its own search that narrows its rows by id, name or group, and clearing it brings them back,
   * as on the Competencies tab.
   * Interacts with: TechniquePoolComponent.applyPoolFilter, poolSearchControl.
   * Data: T1059 and T1003 in the pool; Enterprise ATT&CK 17.1 imported.
   */
  it('searches the pool by id or name', async () => {
    await renderTechniques([T1059, T1003], [ENTERPRISE_RELEASE]);
    const user = userEvent.setup();
    const search =
      within(attackSection()).getAllByPlaceholderText('Search techniques')[1];

    await user.type(search, 'dumping');

    expect(
      within(attackSection()).queryByRole('cell', { name: 'T1059' }),
    ).not.toBeInTheDocument();
    expect(
      within(attackSection()).getByRole('cell', { name: 'T1003' }),
    ).toBeInTheDocument();

    await user.clear(search);

    expect(
      within(attackSection()).getByRole('cell', { name: 'T1059' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: the pool's ID, Name and Events headers sort its rows, ids in number order, Events by count, and a second
   * click reverses.
   * Interacts with: TechniquePoolComponent.sortValue, MatSort.
   * Data: T1059 and T1003 in the pool; the default order is by id.
   */
  it('sorts the pool by a column header', async () => {
    const { fixture } = await renderTechniques(
      [T1059, T1003],
      [ENTERPRISE_RELEASE],
    );
    const user = userEvent.setup();
    const ids = () =>
      within(attackSection())
        .getAllByRole('cell', { name: /^T\d{4}$/ })
        .map((c) => c.textContent?.trim());

    expect(ids()).toEqual(['T1003', 'T1059']);

    await user.click(
      within(attackSection()).getAllByRole('columnheader', { name: 'Name' })[0],
    );
    fixture.detectChanges();

    // Command and Scripting Interpreter comes before OS Credential Dumping
    expect(ids()).toEqual(['T1059', 'T1003']);

    await user.click(
      within(attackSection()).getAllByRole('columnheader', { name: 'Name' })[0],
    );

    expect(ids()).toEqual(['T1003', 'T1059']);
  });

  /**
   * Verifies: the pool is paged, with a paginator that counts its rows and not the browser's.
   * Interacts with: TechniquePoolComponent.poolPaginator.
   * Data: T1059 and T1003 in the pool; no release techniques to browse.
   */
  it('pages the pool', async () => {
    await renderTechniques([T1059, T1003], [ENTERPRISE_RELEASE]);

    expect(
      await within(attackSection()).findByText('1 – 2 of 2'),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: with ManageMsels, ticking pool rows offers Remove n, which asks first and then deletes each ticked
   * technique; without it there are no checkboxes.
   * Interacts with: TechniquePoolComponent.removeSelected, MselTechniqueService.deleteMselTechnique (stub),
   * CrucibleDialogService.confirm (stub).
   * Data: T1059 and T1003 in the pool; ManageMsels granted.
   */
  it('removes the ticked techniques from the pool', async () => {
    const confirm = vi.fn(
      () => dialogRefStub<unknown, boolean>(true).dialogRef,
    );
    const { poolApi } = await renderTechniques(
      [T1059, T1003],
      [ENTERPRISE_RELEASE],
      {},
      NO_MAPPINGS,
      { system: [SystemPermission.ManageMsels] },
      {},
      { confirm },
    );
    const user = userEvent.setup();

    await user.click(
      await within(attackSection()).findByRole('checkbox', {
        name: 'Select T1059',
      }),
    );
    await user.click(
      within(attackSection()).getByRole('button', { name: /Remove 1/ }),
    );

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(poolApi.deleteMselTechnique).toHaveBeenCalledTimes(1);
    expect(poolApi.deleteMselTechnique).toHaveBeenCalledWith('mat-1');
  });

  /**
   * Verifies: a user who cannot edit the MSEL gets no tick boxes in the pool.
   * Interacts with: TechniquePoolComponent.canEditMsel.
   * Data: T1059 in the pool; no grants.
   */
  it('offers no tick boxes without edit rights', async () => {
    await renderTechniques([T1059], [ENTERPRISE_RELEASE]);

    expect(
      within(attackSection()).queryByRole('checkbox', {
        name: 'Select T1059',
      }),
    ).not.toBeInTheDocument();
  });
  /**
   * Verifies: the pool's Domain filter lists the domains the pool holds and narrows the rows to the chosen one.
   * Interacts with: TechniquePoolComponent.onPoolDomainChange, applyPoolFilter.
   * Data: T1059 (enterprise-attack) and CAPEC-66 (capec) in the pool; both releases imported.
   */
  it('filters the pool by domain', async () => {
    await renderTechniques(
      [T1059, CAPEC_66_IN_POOL],
      [ENTERPRISE_RELEASE, CAPEC_RELEASE],
    );
    const user = userEvent.setup();

    await user.click(
      await within(attackSection()).findByRole('combobox', { name: 'Domain' }),
    );
    await user.click(await screen.findByRole('option', { name: 'capec' }));

    expect(
      within(attackSection()).getByRole('cell', { name: /CAPEC-66/ }),
    ).toBeInTheDocument();
    expect(
      within(attackSection()).queryByRole('cell', { name: 'T1059' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: the pool's group filter lists the groups by the names their release gives and narrows the rows to one.
   * Interacts with: TechniquePoolComponent.onPoolGroupChange, groupKey.
   * Data: T1059 in Execution and T1003 in Credential Access; the release's group names.
   */
  it('filters the pool by group', async () => {
    const execution = {
      ...T1059,
      technique: { ...T1059.technique, tactics: ['execution'] },
    };
    const credentials = {
      ...T1003,
      technique: { ...T1003.technique, tactics: ['credential-access'] },
    };
    await renderTechniques(
      [execution, credentials],
      [ENTERPRISE_RELEASE],
      {},
      NO_MAPPINGS,
      {},
      {
        'rel-1': [
          { id: 'ta-1', shortName: 'execution', name: 'Execution' },
          {
            id: 'ta-2',
            shortName: 'credential-access',
            name: 'Credential Access',
          },
        ],
      },
    );
    const user = userEvent.setup();

    await user.click(
      await within(attackSection()).findByRole('combobox', { name: 'Tactic' }),
    );
    await user.click(await screen.findByRole('option', { name: 'Execution' }));

    expect(
      within(attackSection()).getByRole('cell', { name: 'T1059' }),
    ).toBeInTheDocument();
    expect(
      within(attackSection()).queryByRole('cell', { name: 'T1003' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: a Domain filter whose domain leaves the pool is dropped, so the table does not stay empty behind a filter
   * control that is no longer shown.
   * Interacts with: TechniquePoolComponent.refreshPoolFacets, MselTechniqueService.deleteMselTechnique (stub).
   * Data: T1059 and CAPEC-66 in the pool; filtered to capec, then CAPEC-66 removed; ManageMsels granted.
   */
  it('drops a domain filter when its last technique is removed', async () => {
    await renderTechniques(
      [T1059, CAPEC_66_IN_POOL],
      [ENTERPRISE_RELEASE, CAPEC_RELEASE],
      {},
      NO_MAPPINGS,
      { system: [SystemPermission.ManageMsels] },
      {},
      { confirm: () => dialogRefStub<unknown, boolean>(true).dialogRef },
    );
    const user = userEvent.setup();
    await user.click(
      await within(attackSection()).findByRole('combobox', { name: 'Domain' }),
    );
    await user.click(await screen.findByRole('option', { name: 'capec' }));

    await user.click(
      within(attackSection()).getByRole('button', { name: 'Remove CAPEC-66' }),
    );

    expect(
      await within(attackSection()).findByRole('cell', { name: 'T1059' }),
    ).toBeInTheDocument();
    // the Domain control is gone with one domain left, and the row it would have hidden is listed
    expect(
      within(attackSection()).queryByRole('combobox', { name: 'Domain' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: removing a technique does not send the pool back to its first page, only a new search or filter does.
   * Interacts with: TechniquePoolComponent.applyPoolFilter, MatPaginator.
   * Data: 24 techniques in the pool, so the second page holds four; the last one is removed; ManageMsels granted.
   */
  it('stays on its page when a technique is removed', async () => {
    const many: MselTechnique[] = Array.from({ length: 24 }, (_, i) => ({
      id: `mat-${i}`,
      mselId: 'msel-1',
      techniqueId: `at-${i}`,
      technique: {
        id: `at-${i}`,
        techniqueReleaseId: 'rel-1',
        domain: 'enterprise-attack',
        externalId: `T${2000 + i}`,
        name: `Technique ${i}`,
      },
    }));
    await renderTechniques(
      many,
      [ENTERPRISE_RELEASE],
      {},
      NO_MAPPINGS,
      { system: [SystemPermission.ManageMsels] },
      {},
      { confirm: () => dialogRefStub<unknown, boolean>(true).dialogRef },
    );
    const user = userEvent.setup();
    const attack = within(attackSection());
    const range = await attack.findByText('1 – 20 of 24');

    await user.click(
      within(range.closest<HTMLElement>('mat-paginator')).getByRole('button', {
        name: 'Next page',
      }),
    );
    expect(await attack.findByText('21 – 24 of 24')).toBeInTheDocument();
    await user.click(attack.getByRole('button', { name: 'Remove T2023' }));

    expect(await attack.findByText('21 – 23 of 23')).toBeInTheDocument();
  });

  /**
   * Verifies: the Events column sorts by how many events name each technique, and sorts again when those counts change.
   * Interacts with: TechniquePoolComponent.refreshEventCounts, DataFieldStore, DataValueStore.
   * Data: one Attack Technique column; T1059 named by one event, T1003 by none; then T1003 by two and T1059 by none.
   */
  it('sorts the pool by events, and again when the counts change', async () => {
    const { fixture } = await renderTechniques(
      [T1059, T1003],
      [ENTERPRISE_RELEASE],
    );
    const user = userEvent.setup();
    TestBed.inject(DataFieldStore).set([
      {
        id: 'df-1',
        mselId: 'msel-1',
        name: 'Techniques',
        dataType: DataFieldType.AttackTechnique,
      },
    ] as never);
    const valuesOf = (rows: [string, string][]) =>
      rows.map(([scenarioEventId, value], i) => ({
        id: `dv-${i}`,
        dataFieldId: 'df-1',
        scenarioEventId,
        value,
      }));
    TestBed.inject(DataValueStore).set(valuesOf([['e1', 'T1059']]));
    fixture.detectChanges();
    const ids = () =>
      within(attackSection())
        .getAllByRole('cell', { name: /^T\d{4}$/ })
        .map((c) => c.textContent?.trim());

    await user.click(
      within(attackSection()).getAllByRole('columnheader', {
        name: 'Events',
      })[0],
    );
    fixture.detectChanges();
    expect(ids()).toEqual(['T1003', 'T1059']);

    TestBed.inject(DataValueStore).set(
      valuesOf([
        ['e1', 'T1003'],
        ['e2', 'T1003'],
      ]),
    );
    fixture.detectChanges();

    expect(ids()).toEqual(['T1059', 'T1003']);
  });

  /**
   * Verifies: the Add techniques browser's ID and Name headers sort its rows, and a second click reverses.
   * Interacts with: TechniquePoolComponent.sortValue, MatSort on the browser table.
   * Data: an empty pool, so the browser is open; two techniques of the release.
   */
  it('sorts the browser by a column header', async () => {
    const brute = {
      id: 'at-b',
      techniqueReleaseId: 'rel-1',
      domain: 'enterprise-attack',
      externalId: 'T1110',
      name: 'Brute Force',
    };
    const command = {
      id: 'at-a',
      techniqueReleaseId: 'rel-1',
      domain: 'enterprise-attack',
      externalId: 'T1059',
      name: 'Command and Scripting Interpreter',
    };
    const { fixture } = await renderTechniques([], [ENTERPRISE_RELEASE], {
      'rel-1': [brute, command],
    });
    const user = userEvent.setup();
    const ids = () =>
      within(attackSection())
        .getAllByRole('cell', { name: /^T\d{4}$/ })
        .map((c) => c.textContent?.trim());
    await within(attackSection()).findByRole('cell', { name: 'T1110' });

    await user.click(
      within(attackSection()).getAllByRole('columnheader', { name: 'ID' })[0],
    );
    fixture.detectChanges();
    expect(ids()).toEqual(['T1059', 'T1110']);

    await user.click(
      within(attackSection()).getAllByRole('columnheader', { name: 'ID' })[0],
    );
    fixture.detectChanges();
    expect(ids()).toEqual(['T1110', 'T1059']);
  });

  /**
   * Verifies: with several rows ticked Remove n deletes each of them after the confirmation is answered Yes.
   * Interacts with: TechniquePoolComponent.removeSelected, CrucibleDialogService.confirm (stub).
   * Data: T1059 and T1003 in the pool; ManageMsels granted.
   */
  it('removes several ticked techniques', async () => {
    const { poolApi } = await removeBothTicked(true);

    expect(poolApi.deleteMselTechnique).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: answering the confirmation of Remove n with No deletes nothing.
   * Interacts with: TechniquePoolComponent.removeSelected, CrucibleDialogService.confirm (stub).
   * Data: T1059 and T1003 in the pool; ManageMsels granted.
   */
  it('removes nothing when the confirmation is declined', async () => {
    const { poolApi } = await removeBothTicked(false);

    expect(poolApi.deleteMselTechnique).not.toHaveBeenCalled();
  });

  /**
   * Verifies: two domains that use one group short name for different groups show as two options, each narrowing the pool to
   * its own domain's techniques.
   * Interacts with: TechniquePoolComponent.groupKey, refreshPoolFacets.
   * Data: T1059 (enterprise, group "impact" named Impact) and CAPEC-66 (capec, group "impact" named Business Impact); the filter
   * is labelled Group because the pool mixes tactics and categories.
   */
  it('keeps two groups that share a short name apart', async () => {
    const enterprise = {
      ...T1059,
      technique: { ...T1059.technique, tactics: ['impact'] },
    };
    const capec = {
      ...CAPEC_66_IN_POOL,
      technique: { ...CAPEC_66, tactics: ['impact'] },
    };
    await renderTechniques(
      [enterprise, capec],
      [ENTERPRISE_RELEASE, CAPEC_RELEASE],
      {},
      NO_MAPPINGS,
      {},
      {
        'rel-1': [{ id: 'ta-1', shortName: 'impact', name: 'Impact' }],
        'rel-c': [{ id: 'ta-9', shortName: 'impact', name: 'Business Impact' }],
      },
    );
    const user = userEvent.setup();

    await user.click(
      await within(attackSection()).findByRole('combobox', { name: 'Group' }),
    );
    expect(
      await screen.findByRole('option', { name: 'Business Impact' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Impact' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Business Impact' }));

    expect(
      within(attackSection()).getByRole('cell', { name: /CAPEC-66/ }),
    ).toBeInTheDocument();
    expect(
      within(attackSection()).queryByRole('cell', { name: /T1059/ }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: a group name that two domains both use is listed once for each, with its domain, so the options can be told
   * apart.
   * Interacts with: TechniquePoolComponent.refreshPoolFacets.
   * Data: T1059 (enterprise) and CAPEC-66 (capec) both in a group "impact" named Impact.
   */
  it('tells a group name that two domains share apart by its domain', async () => {
    const enterprise = {
      ...T1059,
      technique: { ...T1059.technique, tactics: ['impact'] },
    };
    const capec = {
      ...CAPEC_66_IN_POOL,
      technique: { ...CAPEC_66, tactics: ['impact'] },
    };
    await renderTechniques(
      [enterprise, capec],
      [ENTERPRISE_RELEASE, CAPEC_RELEASE],
      {},
      NO_MAPPINGS,
      {},
      {
        'rel-1': [{ id: 'ta-1', shortName: 'impact', name: 'Impact' }],
        'rel-c': [{ id: 'ta-9', shortName: 'impact', name: 'Impact' }],
      },
    );
    const user = userEvent.setup();

    await user.click(
      await within(attackSection()).findByRole('combobox', { name: 'Group' }),
    );

    expect(
      await screen.findByRole('option', { name: 'Impact (capec)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Impact (enterprise-attack)' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: a group filter whose group leaves the pool is dropped, so every row shows again and the table does not stay
   * empty behind a control that is no longer shown.
   * Interacts with: TechniquePoolComponent.refreshPoolFacets, MselTechniqueService.deleteMselTechnique (stub).
   * Data: T1059 in "execution" and T1003 in "credential-access"; filtered to Execution, then T1059 removed; ManageMsels granted.
   */
  it('drops a group filter when its last technique is removed', async () => {
    const execution = {
      ...T1059,
      technique: { ...T1059.technique, tactics: ['execution'] },
    };
    const credentials = {
      ...T1003,
      technique: { ...T1003.technique, tactics: ['credential-access'] },
    };
    await renderTechniques(
      [execution, credentials],
      [ENTERPRISE_RELEASE],
      {},
      NO_MAPPINGS,
      { system: [SystemPermission.ManageMsels] },
      {
        'rel-1': [
          { id: 'ta-1', shortName: 'execution', name: 'Execution' },
          {
            id: 'ta-2',
            shortName: 'credential-access',
            name: 'Credential Access',
          },
        ],
      },
      { confirm: () => dialogRefStub<unknown, boolean>(true).dialogRef },
    );
    const user = userEvent.setup();
    await user.click(
      await within(attackSection()).findByRole('combobox', { name: 'Tactic' }),
    );
    await user.click(await screen.findByRole('option', { name: 'Execution' }));

    await user.click(
      within(attackSection()).getByRole('button', { name: 'Remove T1059' }),
    );

    expect(
      await within(attackSection()).findByRole('cell', { name: 'T1003' }),
    ).toBeInTheDocument();
    expect(
      within(attackSection()).queryByRole('combobox', { name: 'Tactic' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: a group filter chosen before its release's group names arrive still applies once they do, because the group's
   * key does not depend on those names.
   * Interacts with: TechniquePoolComponent.loadTacticNames, groupKey.
   * Data: T1059 and T1003 in two groups; the names are held back, then released.
   */
  it('keeps a group filter when the group names arrive', async () => {
    const execution = {
      ...T1059,
      technique: { ...T1059.technique, tactics: ['execution'] },
    };
    const credentials = {
      ...T1003,
      technique: { ...T1003.technique, tactics: ['credential-access'] },
    };
    const names = new Subject<TechniqueTactic[]>();
    await renderTechniques(
      [execution, credentials],
      [ENTERPRISE_RELEASE],
      {},
      NO_MAPPINGS,
      {},
      {},
      undefined,
      () => names,
    );
    const user = userEvent.setup();
    await user.click(
      await within(attackSection()).findByRole('combobox', { name: 'Tactic' }),
    );
    await user.click(
      await screen.findByRole('option', { name: 'credential-access' }),
    );
    expect(
      within(attackSection()).queryByRole('cell', { name: 'T1059' }),
    ).not.toBeInTheDocument();

    names.next([
      { id: 'ta-1', shortName: 'execution', name: 'Execution' },
      { id: 'ta-2', shortName: 'credential-access', name: 'Credential Access' },
    ]);
    names.complete();

    expect(
      await within(attackSection()).findByRole('cell', { name: 'T1003' }),
    ).toBeInTheDocument();
    expect(
      within(attackSection()).queryByRole('cell', { name: 'T1059' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: the pool's group column sorts by the group names.
   * Interacts with: TechniquePoolComponent.sortValue.
   * Data: T1059 in "execution" (Execution) and T1003 in "credential-access" (Credential Access).
   */
  it('sorts the pool by its group column', async () => {
    const execution = {
      ...T1059,
      technique: { ...T1059.technique, tactics: ['execution'] },
    };
    const credentials = {
      ...T1003,
      technique: { ...T1003.technique, tactics: ['credential-access'] },
    };
    const { fixture } = await renderTechniques(
      [execution, credentials],
      [ENTERPRISE_RELEASE],
      {},
      NO_MAPPINGS,
      {},
      {
        'rel-1': [
          { id: 'ta-1', shortName: 'execution', name: 'Execution' },
          {
            id: 'ta-2',
            shortName: 'credential-access',
            name: 'Credential Access',
          },
        ],
      },
    );
    const user = userEvent.setup();
    const ids = () =>
      within(attackSection())
        .getAllByRole('cell', { name: /^T\d{4}$/ })
        .map((c) => c.textContent?.trim());
    await within(attackSection()).findByRole('cell', { name: 'T1059' });

    await user.click(
      within(attackSection()).getAllByRole('columnheader', {
        name: 'Tactics',
      })[0],
    );
    fixture.detectChanges();
    // Credential Access comes before Execution
    expect(ids()).toEqual(['T1003', 'T1059']);

    await user.click(
      within(attackSection()).getAllByRole('columnheader', {
        name: 'Tactics',
      })[0],
    );
    fixture.detectChanges();
    expect(ids()).toEqual(['T1059', 'T1003']);
  });

  /**
   * Verifies: the browser sorts by Name, and sorts its group column again when the group names arrive after the techniques.
   * Interacts with: TechniquePoolComponent.loadRelease, sortValue.
   * Data: T1110 in group "a" and T1059 in group "b" that are named Zulu and Alpha once the names arrive.
   */
  it('sorts the browser by Name and by its group names', async () => {
    const brute = {
      id: 'at-b',
      techniqueReleaseId: 'rel-1',
      domain: 'enterprise-attack',
      externalId: 'T1110',
      name: 'Brute Force',
      tactics: ['a'],
    };
    const command = {
      id: 'at-a',
      techniqueReleaseId: 'rel-1',
      domain: 'enterprise-attack',
      externalId: 'T1059',
      name: 'Command and Scripting Interpreter',
      tactics: ['b'],
    };
    const names = new Subject<TechniqueTactic[]>();
    const { fixture } = await renderTechniques(
      [],
      [ENTERPRISE_RELEASE],
      { 'rel-1': [brute, command] },
      NO_MAPPINGS,
      {},
      {},
      undefined,
      () => names,
    );
    const user = userEvent.setup();
    const ids = () =>
      within(attackSection())
        .getAllByRole('cell', { name: /^T\d{4}$/ })
        .map((c) => c.textContent?.trim());
    await within(attackSection()).findByRole('cell', { name: 'T1110' });

    await user.click(
      within(attackSection()).getAllByRole('columnheader', { name: 'Name' })[0],
    );
    fixture.detectChanges();
    expect(ids()).toEqual(['T1110', 'T1059']);

    // sorted by group, with the names still short names: a before b
    await user.click(
      within(attackSection()).getAllByRole('columnheader', {
        name: 'Tactics',
      })[0],
    );
    fixture.detectChanges();
    expect(ids()).toEqual(['T1110', 'T1059']);

    names.next([
      { id: 'ta-a', shortName: 'a', name: 'Zulu' },
      { id: 'ta-b', shortName: 'b', name: 'Alpha' },
    ]);
    names.complete();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Alpha (b) now comes before Zulu (a)
    expect(ids()).toEqual(['T1059', 'T1110']);
  });
});
