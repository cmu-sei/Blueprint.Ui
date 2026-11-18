// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { fireEvent, screen, within } from '@testing-library/angular';
import { of } from 'rxjs';
import {
  TechniqueRelease,
  TechniqueCountermeasure,
  MselTechnique,
  MselTechniqueService,
  MselCountermeasures,
  MselTechniqueCountermeasures,
} from 'src/app/generated/blueprint.api';
import { TechniqueReleaseStore } from 'src/app/data/technique-release/technique-release.store';
import { MselTechniqueStore } from 'src/app/data/msel-technique/msel-technique.store';
import { TechniqueCountermeasuresComponent } from './technique-countermeasures.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';

// what the release's framework definition says (test data): the relation its mappings read with, and its tactic order
const D3FEND_RELEASE: TechniqueRelease = {
  id: 'rel-d3',
  domain: 'd3fend',
  isDefensive: true,
  name: 'MITRE D3FEND',
  version: '1.6.0',
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
};
const cm = (
  externalId: string,
  name: string,
  tactic: string,
  weight: number,
  rationale = `${tactic.toLowerCase()}s something`,
): TechniqueCountermeasure => ({
  id: `cm-${externalId}`,
  techniqueReleaseId: 'rel-d3',
  offensiveExternalId: 'T1003.005',
  defensiveTechniqueId: `at-${externalId}`,
  defensiveTechnique: {
    id: `at-${externalId}`,
    techniqueReleaseId: 'rel-d3',
    domain: 'd3fend',
    isDefensive: true,
    externalId,
    name,
    url: `https://d3fend.mitre.org/technique/d3f:${name.replace(/\W/g, '')}/`,
  },
  defensiveTactic: tactic,
  rationale,
  weight,
});
// Harden before Detect in the matrix, though Detect arrives first; four Harden countermeasures, so one is folded away.
const COUNTERMEASURES: TechniqueCountermeasure[] = [
  cm('D3-FA', 'File Analysis', 'Detect', 1),
  cm('D3-TB', 'Token Binding', 'Harden', 1),
  cm(
    'D3-CH',
    'Credential Hardening',
    'Harden',
    3,
    'hardens Credential; T1003.005 accesses Encrypted Credential',
  ),
  cm('D3-CBAN', 'Certificate-based Authentication', 'Harden', 1),
  cm('D3-MFA', 'Multi-factor Authentication', 'Harden', 2),
  cm('D3-PH', 'Process Termination', 'Evict', 1),
];
const GROUP: MselTechniqueCountermeasures = {
  techniqueId: 'at-1',
  offensiveExternalId: 'T1003.005',
  inheritedFrom: null,
  countermeasures: COUNTERMEASURES,
};
const ANSWER: MselCountermeasures = {
  mselId: 'msel-1',
  techniqueReleaseId: 'rel-d3',
  hasMappings: true,
  techniques: [GROUP],
};
const D3_CH_IN_POOL: MselTechnique = {
  id: 'mat-d3',
  mselId: 'msel-1',
  techniqueId: 'at-D3-CH',
  technique: {
    id: 'at-D3-CH',
    techniqueReleaseId: 'rel-d3',
    domain: 'd3fend',
    isDefensive: true,
    externalId: 'D3-CH',
    name: 'Credential Hardening',
  },
};

interface Options {
  group?: MselTechniqueCountermeasures;
  countermeasures?: MselCountermeasures;
  canEdit?: boolean;
  hasDefensiveRelease?: boolean;
  pool?: MselTechnique[];
  releases?: TechniqueRelease[];
}

async function renderCounteredBy(options: Options = {}) {
  // an explicit undefined is a case under test (nothing loaded yet), not a request for the default
  const group = 'group' in options ? options.group : GROUP;
  const countermeasures =
    'countermeasures' in options ? options.countermeasures : ANSWER;
  const {
    canEdit = true,
    hasDefensiveRelease = true,
    pool = [],
    releases = [D3FEND_RELEASE],
  } = options;
  const poolApi = {
    createMselTechnique: vi.fn((body: MselTechnique) =>
      of({
        id: 'mat-new',
        ...body,
        technique: {
          id: body.techniqueId,
          domain: 'd3fend',
          isDefensive: true,
        },
      }),
    ),
  } satisfies ApiStub<MselTechniqueService>;
  const rendered = await renderComponent(TechniqueCountermeasuresComponent, {
    providers: [{ provide: MselTechniqueService, useValue: poolApi }],
    inputs: {
      mselId: 'msel-1',
      externalId: 'T1003.005',
      group,
      countermeasures,
      canEdit,
      hasDefensiveRelease,
    },
  });
  TestBed.inject(TechniqueReleaseStore).set(releases);
  TestBed.inject(MselTechniqueStore).set(pool);
  rendered.fixture.detectChanges();
  return { ...rendered, poolApi };
}

const toggleButton = () =>
  screen.getByRole('button', { name: /, T1003\.005$/ });
const open = () => Promise.resolve(fireEvent.click(toggleButton()));
const tactic = (name: string) =>
  screen.getByText(name).closest<HTMLElement>('.tactic');
const idsIn = (section: HTMLElement) =>
  within(section)
    .getAllByRole('link')
    .map((a) => a.textContent.trim());

describe('TechniqueCountermeasuresComponent', () => {
  /**
   * Verifies: collapsed, the row is a one-line summary under the relation the release's framework names
   * ("Countered by (N)"); opened, the mappings are grouped by tactic in the framework's order (Harden, Detect,
   * Evict) and ranked by weight within each.
   * Interacts with: the toggle, groups, groupByTactic.
   * Data: six countermeasures across three tactics, arriving out of order.
   */
  it("groups the countermeasures by tactic in the framework's order and ranks them by weight", async () => {
    await renderCounteredBy();

    const toggle = screen.getByRole('button', {
      name: 'Countered by, T1003.005',
    });
    expect(toggle).toHaveTextContent('Countered by (6)');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Harden')).not.toBeInTheDocument();

    await open();

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getAllByText(/^(Harden|Detect|Evict)$/).map((e) => e.textContent),
    ).toEqual(['Harden', 'Detect', 'Evict']);
    expect(idsIn(tactic('Harden'))).toEqual(['D3-CH', 'D3-MFA', 'D3-CBAN']);
    expect(idsIn(tactic('Detect'))).toEqual(['D3-FA']);
    expect(screen.getByRole('link', { name: 'D3-CH' })).toHaveAttribute(
      'href',
      'https://d3fend.mitre.org/technique/d3f:CredentialHardening/',
    );
  });

  /**
   * Verifies: a tactic shows its top three and offers "Show all N", which unfolds the rest and turns into
   * "Show top 3".
   * Interacts with: visible, toggleAll, showsAll.
   * Data: four Harden countermeasures; one Detect.
   */
  it('shows the top three of a tactic until asked for all', async () => {
    await renderCounteredBy();
    await open();

    expect(idsIn(tactic('Harden'))).toHaveLength(3);
    expect(
      within(tactic('Detect')).queryByRole('button', { name: /Show all/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(tactic('Harden')).getByRole('button', { name: 'Show all 4' }),
    );

    expect(idsIn(tactic('Harden'))).toEqual([
      'D3-CH',
      'D3-MFA',
      'D3-CBAN',
      'D3-TB',
    ]);
    fireEvent.click(
      within(tactic('Harden')).getByRole('button', { name: 'Show top 3' }),
    );
    expect(idsIn(tactic('Harden'))).toHaveLength(3);
  });

  /**
   * Verifies: the rationale and the number of artifact paths are the name's tooltip.
   * Interacts with: tooltip.
   * Data: D3-CH with the three-path rationale.
   */
  it('explains a countermeasure with its rationale', async () => {
    const { fixture } = await renderCounteredBy();
    await open();

    const name = screen.getByText('Credential Hardening');
    const tooltip = fixture.componentInstance.tooltip(COUNTERMEASURES[2]);
    expect(tooltip).toBe(
      'hardens Credential; T1003.005 accesses Encrypted Credential (3 paths)',
    );
    expect(name).toHaveClass('cm-name');
  });

  /**
   * Verifies: a sub-technique with no mappings of its own is marked as showing its parent's.
   * Interacts with: inheritedFrom.
   * Data: a group inherited from T1003.
   */
  it('marks countermeasures inherited from the parent technique', async () => {
    await renderCounteredBy({ group: { ...GROUP, inheritedFrom: 'T1003' } });

    expect(screen.getByText('(from T1003)')).toBeInTheDocument();
    expect(screen.getByText('(from T1003)')).toHaveAttribute(
      'title',
      "T1003.005 has no mappings of its own; these are T1003's",
    );
  });

  /**
   * Verifies: ticking a countermeasure adds its D3FEND technique to the MSEL's defensive pool, and one already
   * pooled is shown ticked and disabled.
   * Interacts with: add, isPooled, MselTechniqueDataService.add, MselTechniqueService.createMselTechnique (stub).
   * Data: D3-CH already in the defensive pool; D3-MFA not.
   */
  it('adds a countermeasure to the defensive pool and marks the ones already there', async () => {
    const { poolApi } = await renderCounteredBy({ pool: [D3_CH_IN_POOL] });
    await open();

    const pooled = screen.getByRole('checkbox', { name: 'Add D3-CH' });
    expect(pooled).toBeChecked();
    expect(pooled).toBeDisabled();
    const mfa = screen.getByRole('checkbox', { name: 'Add D3-MFA' });
    expect(mfa).not.toBeChecked();

    fireEvent.click(mfa);

    expect(poolApi.createMselTechnique).toHaveBeenCalledWith({
      mselId: 'msel-1',
      techniqueId: 'at-D3-MFA',
    });
  });

  /**
   * Verifies: without the right to edit the MSEL there are no checkboxes, and a pooled countermeasure is marked
   * with a tick instead.
   * Interacts with: canEdit, isPooled.
   * Data: D3-CH in the defensive pool; canEdit false.
   */
  it('offers no checkboxes to a viewer', async () => {
    await renderCounteredBy({ canEdit: false, pool: [D3_CH_IN_POOL] });
    await open();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(
      screen.getByTitle("In this MSEL's defensive techniques"),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: each way of having nothing to list is explained: still loading, no D3FEND release imported, no
   * mappings imported on any, the pinned release without mappings, and a technique nothing is mapped to.
   * Interacts with: emptyMessage, hasDefensiveRelease, TechniqueReleaseQuery.getEntity.
   * Data: the answers the API gives in each case.
   */
  it.each([
    {
      name: 'still loading',
      options: {
        countermeasures: undefined as MselCountermeasures,
        group: undefined as MselTechniqueCountermeasures,
      },
      message: 'Loading countermeasures...',
    },
    {
      name: 'no defensive release imported',
      options: {
        countermeasures: {
          mselId: 'msel-1',
          techniqueReleaseId: null,
          hasMappings: false,
          techniques: [],
        },
        group: undefined,
        hasDefensiveRelease: false,
      },
      message:
        'No defensive release has been imported. An administrator imports one on the Technique Frameworks page.',
    },
    {
      name: 'no mappings imported on any release',
      options: {
        countermeasures: {
          mselId: 'msel-1',
          techniqueReleaseId: null,
          hasMappings: false,
          techniques: [],
        },
        group: undefined as MselTechniqueCountermeasures,
      },
      message:
        'No mappings have been imported. An administrator imports them on the Technique Frameworks page.',
    },
    {
      name: 'the pinned release without mappings',
      options: {
        countermeasures: {
          mselId: 'msel-1',
          techniqueReleaseId: 'rel-d3',
          hasMappings: false,
          techniques: [],
        },
        group: { ...GROUP, countermeasures: [] },
      },
      message:
        'MITRE D3FEND 1.6.0 has no mappings. An administrator imports them on the Technique Frameworks page.',
    },
    {
      name: 'a technique nothing is mapped to',
      options: { group: { ...GROUP, countermeasures: [] } },
      message: 'No technique of MITRE D3FEND 1.6.0 is mapped to T1003.005.',
    },
  ])('explains an empty list: $name', async ({ options, message }) => {
    await renderCounteredBy(options);
    await open();

    expect(screen.getByText(message)).toBeInTheDocument();
    // no count when there is nothing to list; the relation is the framework's once a release is named
    expect(toggleButton()).toHaveTextContent(/^(Countered by|Mapped to)$/);
  });

  /**
   * Verifies: what the row shows comes from the release's framework: without a relation it reads "Mapped to", and
   * without a tactic order the groups are alphabetical; a technique with no page is shown without a link.
   * Interacts with: relation, groups, the technique link.
   * Data: the same mappings, from a release whose framework gives no relation, order or technique pages.
   */
  it('shows what the framework gives, and only that', async () => {
    const plain: TechniqueRelease = {
      id: 'rel-d3',
      domain: 'other',
      isDefensive: true,
      name: 'Other defences',
      version: '1',
    };
    const unlinked = COUNTERMEASURES.map((c) => ({
      ...c,
      defensiveTechnique: { ...c.defensiveTechnique, url: null },
    }));
    await renderCounteredBy({
      releases: [plain],
      group: { ...GROUP, countermeasures: unlinked },
    });

    expect(
      screen.getByRole('button', { name: 'Mapped to, T1003.005' }),
    ).toHaveTextContent('Mapped to (6)');
    await open();
    expect(
      screen.getAllByText(/^(Harden|Detect|Evict)$/).map((e) => e.textContent),
    ).toEqual(['Detect', 'Evict', 'Harden']);
    expect(
      screen.queryByRole('link', { name: 'D3-CH' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('D3-CH')).toBeInTheDocument();
  });
});
