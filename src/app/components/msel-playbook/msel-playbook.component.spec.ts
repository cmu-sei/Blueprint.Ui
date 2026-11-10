// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { screen, within } from '@testing-library/angular';
import { of, throwError } from 'rxjs';
import {
  DataField,
  DataFieldType,
  DataValue,
  Move,
  Msel,
  MselImageService,
  MselPage,
  ScenarioEvent,
  Competency,
  CompetencyFramework,
  CompetencyFrameworkService,
  MselCompetency,
  MselCompetencyService,
  TeamCompetency,
  TeamCompetencyService,
} from 'src/app/generated/blueprint.api';
import { DataFieldStore } from 'src/app/data/data-field/data-field.store';
import { DataValueStore } from 'src/app/data/data-value/data-value.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { MoveStore } from 'src/app/data/move/move.store';
import { MselPageStore } from 'src/app/data/msel-page/msel-page.store';
import { ScenarioEventStore } from 'src/app/data/scenario-event/scenario-event.store';
import { TestBed } from '@angular/core/testing';
import {
  formatPlaybookDuration,
  frameworkCompetencyGroups,
  imagesReady,
  MselPlaybookComponent,
  opensWithHeading,
  playbookFooterCss,
  withoutMedia,
} from './msel-playbook.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';

@Component({ selector: 'app-duration-view', template: '', standalone: false })
class DurationViewStub {
  readonly startTime = input<Date>(undefined);
  readonly durationSeconds = input<number>(undefined);
  readonly showRealTime = input<boolean>(undefined);
}

const MSEL: Msel = { id: 'msel-1', name: 'Exercise Alpha', createdBy: 'someone-else', teams: [], units: [], userMselRoles: [] };
const FIELDS: DataField[] = [
  { id: 'df-title', mselId: 'msel-1', name: 'Title', dataType: DataFieldType.String, displayOrder: 1 },
  { id: 'df-detail', mselId: 'msel-1', name: 'Detail', dataType: DataFieldType.String, displayOrder: 2 },
];
const EVENT: ScenarioEvent = { id: 'se-1', mselId: 'msel-1', deltaSeconds: 600, groupOrder: 1 };
const VALUES: DataValue[] = [
  { id: 'dv-1', scenarioEventId: 'se-1', dataFieldId: 'df-title', value: 'Phishing wave' },
  { id: 'dv-2', scenarioEventId: 'se-1', dataFieldId: 'df-detail', value: 'Users receive a phish' },
];

function seeded<S extends { set(entities: unknown[]): void }>(Store: new () => S, entities: unknown[]) {
  return {
    provide: Store,
    useFactory: () => {
      const store = new Store();
      store.set(structuredClone(entities));
      return store;
    },
  };
}

interface PlaybookData {
  msel?: Partial<Msel>;
  moves?: Move[];
  pages?: MselPage[];
  events?: ScenarioEvent[];
  values?: DataValue[];
  getMselImage?: ApiStub<MselImageService>['getMselImage'];
  mselCompetencies?: MselCompetency[];
  teamCompetencies?: TeamCompetency[];
  frameworks?: CompetencyFramework[];
}

async function renderPlaybook(canEditMsel: boolean, data: PlaybookData = {}) {
  const imageApi = {
    getMselImage: data.getMselImage ?? vi.fn(() => of(new Blob(['image'], { type: 'image/png' }))),
  } satisfies ApiStub<MselImageService>;
  const rendered = await renderComponent(MselPlaybookComponent, {
    imports: [MatButtonModule, MatIconModule, MatPaginatorModule],
    declarations: [MselPlaybookComponent, DurationViewStub],
    providers: [
      // The MSEL page loads all of this; the stores are seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([structuredClone({ ...MSEL, ...data.msel })]);
          store.setActive('msel-1');
          return store;
        },
      },
      seeded(DataFieldStore, FIELDS),
      seeded(DataValueStore, data.values ?? VALUES),
      seeded(ScenarioEventStore, data.events ?? [EVENT]),
      seeded(MoveStore, data.moves ?? []),
      seeded(MselPageStore, data.pages ?? []),
      { provide: MselImageService, useValue: imageApi },
      { provide: MselCompetencyService, useValue: { getMselCompetencies: vi.fn(() => of(data.mselCompetencies ?? [])) } },
      { provide: TeamCompetencyService, useValue: { getMselTeamCompetencies: vi.fn(() => of(data.teamCompetencies ?? [])) } },
      { provide: CompetencyFrameworkService, useValue: { getCompetencyFrameworks: vi.fn(() => of(data.frameworks ?? [{ id: 'fw-1', name: 'DCWF 5.1' }, { id: 'fw-2', name: 'NICE 2.0' }])) } },
    ],
    inputs: { canEditMsel, loggedInUserId: 'user-1' },
  });
  // The cover, MSEL pages and move titles show when the page size covers
  // every event, as "Print All Events" sets it.
  const playbook = rendered.fixture.componentInstance;
  playbook.changePage({ pageIndex: 0, pageSize: playbook.sortedScenarioEvents.length, length: playbook.sortedScenarioEvents.length });
  rendered.fixture.detectChanges();
  return { ...rendered, imageApi };
}

const MOVES: Move[] = [
  {
    id: 'move-1',
    mselId: 'msel-1',
    moveNumber: 1,
    description: 'Initial access',
    deltaSeconds: 0,
    situationTime: new Date('2026-03-02T14:00:00Z'),
    situationDescription: '<p>Analysts see odd logins.</p>',
  },
  { id: 'move-2', mselId: 'msel-1', moveNumber: 2, description: 'Containment', deltaSeconds: 3600 },
];
const MOVE_EVENTS: ScenarioEvent[] = [
  { id: 'se-1', mselId: 'msel-1', deltaSeconds: 600, groupOrder: 1 },
  { id: 'se-2', mselId: 'msel-1', deltaSeconds: 4200, groupOrder: 1 },
];
const MOVE_VALUES: DataValue[] = [
  ...VALUES,
  { id: 'dv-3', scenarioEventId: 'se-2', dataFieldId: 'df-title', value: 'Isolate hosts' },
];
const PAGES: MselPage[] = [
  { id: 'page-1', mselId: 'msel-1', name: 'Rules of Engagement', content: '<p>No production systems.</p>', includeInPlaybook: true },
  { id: 'page-2', mselId: 'msel-1', name: 'Network Map', content: '<p>Three subnets.</p>', includeInPlaybook: true },
  { id: 'page-3', mselId: 'msel-1', name: 'Planner Notes', content: '<p>Not for print.</p>', includeInPlaybook: false },
];

// The cover, MSEL pages and move title blocks are print-only. Role queries
// include hidden elements, and sections are found by their aria-label
// (hidden elements have no accessible name).
const hidden = { hidden: true };

describe('MselPlaybookComponent', () => {
  // jsdom has no object URLs.
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:cover');
    URL.revokeObjectURL = vi.fn();
  });

  /**
   * Verifies: the playbook shows each event's title and data values.
   * Interacts with: real MselQuery, DataFieldQuery, DataValueQuery and ScenarioEventQuery (seeded).
   * Data: one event, "Phishing wave", with a Detail value.
   */
  it('shows the events with their data values', async () => {
    await renderPlaybook(true);

    expect(screen.getByRole('heading', { name: 'MSEL Playbook' })).toBeInTheDocument();
    const event = within(screen.getByRole('table'));
    expect(event.getByRole('columnheader', { name: 'Phishing wave' })).toBeInTheDocument();
    expect(event.getByText('Users receive a phish')).toBeInTheDocument();
  });

  /**
   * Verifies: the playbook is read-only whatever canEditMsel is: it renders no editable control, only paging and printing.
   * Interacts with: MselPlaybookComponent template (canEditMsel is an input the template does not read).
   * Data: canEditMsel true and false.
   */
  it.each([true, false])('renders no editing controls with canEditMsel %s', async (canEditMsel) => {
    await renderPlaybook(canEditMsel);

    expect(screen.queryAllByRole('textbox')).toEqual([]);
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Print Current Page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print All Events' })).toBeInTheDocument();
  });

  /**
   * Verifies: the print cover shows the MSEL image when the API returns one, in place of the theme-color band.
   * Interacts with: MselImageService.getMselImage (stub, answers a PNG blob), URL.createObjectURL (stub).
   * Data: Exercise Alpha with ImageDateModified set.
   */
  it('shows the MSEL image on the cover', async () => {
    const getMselImage = vi.fn(() => of(new Blob(['image'], { type: 'image/png' })));
    await renderPlaybook(true, { msel: { imageDateModified: new Date('2026-10-23T12:00:00Z') }, getMselImage });

    const cover = within(screen.getByLabelText('Cover'));
    expect(getMselImage.mock.calls).toEqual([['msel-1']]);
    expect(cover.getByAltText('MSEL image')).toHaveAttribute('src', 'blob:cover');
    expect(cover.queryByTestId('cover-band')).toBeNull();
  });

  /**
   * Verifies: with no image, or an image the API can't return, the cover shows the theme-color band instead.
   * Interacts with: MselImageService.getMselImage (stub: not called without ImageDateModified; answers 404 with it).
   * Data: Exercise Alpha without ImageDateModified; Exercise Alpha with ImageDateModified whose image is gone.
   */
  it.each([
    ['has no image', {}],
    ['image is gone', { msel: { imageDateModified: new Date('2026-10-23T12:00:00Z') }, getMselImage: vi.fn(() => throwError(() => ({ status: 404 }))) }],
  ] as [string, PlaybookData][])('shows the theme band on the cover when the MSEL %s', async (_case, data) => {
    await renderPlaybook(true, data);

    const cover = within(screen.getByLabelText('Cover'));
    expect(cover.getByTestId('cover-band')).toBeInTheDocument();
    expect(cover.queryByRole('img', hidden)).toBeNull();
  });

  /**
   * Verifies: the cover shows the MSEL name and description, the facts (start, duration, counts, teams, subject, educational level, keywords) and a contents list of the playbook pages then the moves.
   * Interacts with: real MselQuery, MoveQuery, MselPageQuery and ScenarioEventQuery (seeded).
   * Data: two moves with one event each, two playbook pages and one page left out of the playbook, two teams.
   */
  it('shows the facts and the contents on the cover', async () => {
    await renderPlaybook(true, {
      msel: {
        description: 'A ransomware tabletop.',
        startTime: new Date('2026-03-02T13:00:00Z'),
        durationSeconds: 93600,
        subject: 'Incident response',
        educationalLevel: 'Intermediate',
        keywords: 'ransomware, tabletop',
        teams: [
          { id: 'team-1', name: 'Blue Team', shortName: 'BLUE' },
          { id: 'team-2', name: 'Red Cell', shortName: 'RED' },
        ],
      },
      moves: MOVES,
      events: MOVE_EVENTS,
      values: MOVE_VALUES,
      pages: PAGES,
    });

    const cover = within(screen.getByLabelText('Cover'));
    expect(cover.getByRole('heading', { level: 1, ...hidden })).toHaveTextContent('Exercise Alpha');
    expect(cover.getByText('A ransomware tabletop.')).toBeInTheDocument();

    const facts = cover.getByLabelText('MSEL facts');
    const terms = Array.from(facts.querySelectorAll('dt')).map((dt) => [dt.textContent.trim(), dt.nextElementSibling.textContent.trim()]);
    expect(terms).toEqual([
      ['Start', expect.stringMatching(/^\d{2} Mar 2026 \d{2}:\d{2} \S+$/)],
      ['Duration', '1 day 2 hours'],
      ['Moves', '2'],
      ['Scenario Events', '2'],
      ['Teams', 'Blue Team, Red Cell'],
      ['Subject', 'Incident response'],
      ['Educational Level', 'Intermediate'],
      ['Keywords', 'ransomware, tabletop'],
    ]);

    const contents = within(cover.getByLabelText('Contents'));
    // Pages come in MselPageQuery's order (by name), then the moves.
    expect(contents.getAllByRole('listitem', hidden).map((li) => li.textContent.trim())).toEqual([
      'Network Map',
      'Rules of Engagement',
      'Move 1: Initial access',
      'Move 2: Containment',
    ]);
  });

  /**
   * Verifies: the facts leave out the teams, subject, educational level and keywords when the MSEL has none.
   * Interacts with: real MselQuery (seeded).
   * Data: Exercise Alpha with no teams or catalog fields.
   */
  it('leaves empty facts off the cover', async () => {
    await renderPlaybook(true);

    const facts = screen.getByLabelText('MSEL facts');
    expect(Array.from(facts.querySelectorAll('dt')).map((dt) => dt.textContent.trim())).toEqual(['Moves', 'Scenario Events']);
  });

  /**
   * Verifies: each move gets a title block (Move N, description, situation date/time, briefing) followed by its own events.
   * Interacts with: real MoveQuery and ScenarioEventQuery (seeded); ScenarioEventDataService.getMoveAndGroupNumbers.
   * Data: move 1 with a situation time and briefing and event "Phishing wave"; move 2 with neither and event "Isolate hosts".
   */
  it('starts each move with its title block', async () => {
    const { container } = await renderPlaybook(true, { moves: MOVES, events: MOVE_EVENTS, values: MOVE_VALUES });

    const move1 = screen.getByLabelText('Move 1');
    expect(within(move1).getByText('Move 1')).toHaveClass('move-number');
    expect(within(move1).getByRole('heading', hidden)).toHaveTextContent('Initial access');
    expect(within(move1).getByText('Situation Date/Time:').parentElement.textContent).toMatch(/02 Mar 2026 \d{2}:\d{2} \S+/);
    expect(within(move1).getByText('Analysts see odd logins.').closest('.move-briefing')).not.toBeNull();

    const move2 = screen.getByLabelText('Move 2');
    expect(within(move2).getByRole('heading', hidden)).toHaveTextContent('Containment');
    expect(within(move2).queryByText('Situation Date/Time:')).toBeNull();
    expect(move2.querySelector('.move-briefing')).toBeNull();

    // Print order: move 1's title, its event, move 2's title, its event.
    const order = Array.from(container.querySelectorAll('.move-title, #eventDetails thead th:last-child')).map((el) =>
      el.classList.contains('move-title') ? el.getAttribute('aria-label') : el.textContent.trim()
    );
    expect(order).toEqual(['Move 1', 'Phishing wave', 'Move 2', 'Isolate hosts']);
  });

  /**
   * Verifies: each playbook MSEL page prints in its own section with its name as the heading; pages left out of the playbook don't print.
   * Interacts with: real MselPageQuery (seeded).
   * Data: two playbook pages and one page with includeInPlaybook off.
   */
  it('prints each MSEL page in its own section', async () => {
    await renderPlaybook(true, { pages: PAGES });

    const roe = within(screen.getByLabelText('Rules of Engagement'));
    expect(roe.getByRole('heading', hidden)).toHaveTextContent('Rules of Engagement');
    expect(roe.getByText('No production systems.')).toBeInTheDocument();
    const map = within(screen.getByLabelText('Network Map'));
    expect(map.getByText('Three subnets.')).toBeInTheDocument();
    expect(map.queryByText('No production systems.')).toBeNull();
    expect(screen.queryByLabelText('Planner Notes')).toBeNull();
  });

  /**
   * Verifies: a page whose content opens with a heading of its own name, as a drafted profiles page does, prints that
   * heading once, not the page name above it as well; a page without one still gets the name.
   * Interacts with: real MselPageQuery (seeded), opensWithHeading.
   * Data: Team Profiles, whose content starts with <h2>Team Profiles</h2> inside the article table, and Rules of Engagement.
   */
  it('prints a page title once when the content already has it', async () => {
    const profiles: MselPage = {
      id: 'page-4', mselId: 'msel-1', name: 'Team Profiles', includeInPlaybook: true,
      content: '<table><tbody><tr><td><section><h2>Team  profiles</h2><p>The participant teams.</p></section></td></tr></tbody></table>',
    };
    await renderPlaybook(true, { pages: [PAGES[0], profiles] });

    expect(within(screen.getByLabelText('Team Profiles')).getAllByRole('heading', hidden)).toHaveLength(1);
    expect(within(screen.getByLabelText('Rules of Engagement')).getByRole('heading', hidden)).toHaveTextContent('Rules of Engagement');
    expect(opensWithHeading('<p>Intro</p><h3>Other</h3>', 'Team Profiles')).toBe(false);
    expect(opensWithHeading('<p>No heading.</p>', 'Team Profiles')).toBe(false);
    // the heading has to come first: an intro or an image before it keeps the page's own title
    expect(opensWithHeading('<p>Intro.</p><h3>Team Profiles</h3>', 'Team Profiles')).toBe(false);
    expect(opensWithHeading('<p><img src="x.png"></p><h2>Team Profiles</h2>', 'Team Profiles')).toBe(false);
    // empty paragraphs and wrappers before it don't count
    expect(opensWithHeading('<p><br></p>\n<div><h2>Team Profiles</h2><p>Text.</p></div>', 'Team Profiles')).toBe(true);
  });

  /**
   * Verifies: on screen a row's audio plays in the playbook; drawn for print, the player becomes a line saying where the
   * clip plays and the transcript opens, so the print never loads the clip.
   * Interacts with: the printing flag, withoutMedia, the rows' innerHTML.
   * Data: a Detail with an audio player of a data URI and a closed transcript.
   */
  it('keeps audio playable on screen and prints a note instead', async () => {
    const audio = '<p>Listen.</p><audio controls src="data:audio/mpeg;base64,AAAA"></audio><details><summary>Transcript</summary><p>Hello.</p></details>';
    const values: DataValue[] = [VALUES[0], { ...VALUES[1], value: audio }];
    const { fixture, container } = await renderPlaybook(true, { values });

    expect(container.querySelector('audio')).not.toBeNull();

    fixture.componentInstance.printing = true;
    fixture.detectChanges();

    expect(container.querySelector('audio')).toBeNull();
    expect(screen.getByText('Audio clip: plays in Gallery.')).toBeInTheDocument();
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(true);
  });

  /**
   * Verifies: withoutMedia leaves a value with no media or transcript as it is, and names a video clip as video.
   * Interacts with: withoutMedia.
   */
  it('takes only audio and video out of a printed value', () => {
    expect(withoutMedia('<p>No media.</p>')).toBe('<p>No media.</p>');
    expect(withoutMedia('<video controls><source src="data:video/mp4;base64,AAAA"></video>')).toBe(
      '<p class="playbook-media-note"><em>Video clip: plays in Gallery.</em></p>'
    );
  });

  /**
   * Verifies: after the cover the print lists the MSEL's competencies by framework, each as its ID number and name in
   * number order, then each team's, and the contents name the section; a MSEL with none prints no section.
   * Interacts with: MselCompetencyService, TeamCompetencyService, CompetencyFrameworkService (stubs), competencyLabel.
   * Data: two DCWF competencies out of order and one NICE one; team BLUE with one; a competency with no name.
   */
  it('lists the MSEL and team competencies after the cover', async () => {
    const t10: Competency = { id: 'c-10', competencyFrameworkId: 'fw-1', idNumber: 'T-10', shortName: 'Analyze logs' };
    const t2: Competency = { id: 'c-2', competencyFrameworkId: 'fw-1', idNumber: 'T-2', shortName: 'Triage alerts' };
    // a task's wording is long; the print keeps all of it
    const long = 'Knowledge of networking. '.repeat(10).trim();
    const nice: Competency = { id: 'c-n', competencyFrameworkId: 'fw-2', idNumber: 'K0001', description: long };
    await renderPlaybook(true, {
      msel: { teams: [{ id: 'team-blue', name: 'Blue Team', shortName: 'BLUE' }] },
      mselCompetencies: [t10, t2, nice].map((competency) => ({ id: competency.id, mselId: 'msel-1', competencyId: competency.id, competency })),
      teamCompetencies: [{ id: 'tc-1', teamId: 'team-blue', competencyId: 'c-2', competency: t2 }],
    });

    const section = within(screen.getByLabelText('Competencies'));
    expect(section.getAllByRole('heading', hidden).map((h) => h.textContent)).toEqual(['Competencies', 'DCWF 5.1', 'NICE 2.0', 'Team competencies', 'Blue Team']);
    expect(section.getAllByRole('listitem', hidden).map((li) => li.textContent)).toEqual([
      'T-2 Triage alerts', 'T-10 Analyze logs', `K0001 ${long}`, 'T-2 Triage alerts',
    ]);
    expect(within(screen.getByLabelText('Contents')).getAllByRole('listitem', hidden)[0]).toHaveTextContent('Competencies');
  });

  it('prints no Competencies section for a MSEL without any', async () => {
    await renderPlaybook(true);

    expect(screen.queryByLabelText('Competencies')).toBeNull();
  });

  /**
   * Verifies: competencies group by framework id and team id, not by name, so two versions of a framework or two teams
   * with one name print apart, each heading told apart by version or short name.
   * Interacts with: CompetencyFrameworkService and the competency services (stubs), frameworkCompetencyGroups.
   * Data: NICE 1.0 and NICE 2.0 (one name), two teams named Blue Team (BLUE1, BLUE2).
   */
  it('keeps same-named frameworks and teams apart', async () => {
    const v1: Competency = { id: 'c-1', competencyFrameworkId: 'fw-1', idNumber: 'K0001', shortName: 'Networking' };
    const v2: Competency = { id: 'c-2', competencyFrameworkId: 'fw-2', idNumber: 'K0001', shortName: 'Networks' };
    await renderPlaybook(true, {
      msel: {
        teams: [
          { id: 'team-1', name: 'Blue Team', shortName: 'BLUE1' },
          { id: 'team-2', name: 'Blue Team', shortName: 'BLUE2' },
        ],
      },
      frameworks: [
        { id: 'fw-2', name: 'NICE', version: '2.0' },
        { id: 'fw-1', name: 'NICE', version: '1.0' },
      ],
      mselCompetencies: [v1, v2].map((competency) => ({ id: competency.id, mselId: 'msel-1', competencyId: competency.id, competency })),
      teamCompetencies: [
        { id: 'tc-1', teamId: 'team-1', competencyId: 'c-1', competency: v1 },
        { id: 'tc-2', teamId: 'team-2', competencyId: 'c-2', competency: v2 },
      ],
    });

    const section = within(screen.getByLabelText('Competencies'));
    expect(section.getAllByRole('heading', hidden).map((h) => h.textContent)).toEqual([
      'Competencies', 'NICE (1.0)', 'NICE (2.0)', 'Team competencies', 'Blue Team (BLUE1)', 'Blue Team (BLUE2)',
    ]);
    expect(section.getAllByRole('listitem', hidden).map((li) => li.textContent)).toEqual([
      'K0001 Networking', 'K0001 Networks', 'K0001 Networking', 'K0001 Networks',
    ]);
  });

  /**
   * Verifies: competencies whose framework isn't in the list are listed last, apart from a real framework that happens
   * to be called "Competencies".
   * Interacts with: frameworkCompetencyGroups.
   */
  it('lists competencies of an unknown framework apart', () => {
    const known: Competency = { id: 'c-1', competencyFrameworkId: 'fw-1', idNumber: 'A1' };
    const unknown: Competency = { id: 'c-2', competencyFrameworkId: 'fw-gone', idNumber: 'B1' };
    const groups = frameworkCompetencyGroups(
      [known, unknown].map((competency) => ({ id: competency.id, competency })),
      [{ id: 'fw-1', name: 'Competencies' }],
    );
    expect(groups.map((g) => [g.key, g.name, g.competencies.map((c) => c.id)])).toEqual([
      ['fw-1', 'Competencies', ['c-1']],
      ['', 'Other competencies', ['c-2']],
    ]);
    expect(frameworkCompetencyGroups([{ id: 'c-2', competency: unknown }], []).map((g) => g.name)).toEqual(['Competencies']);
  });

  /**
   * Verifies: a team that reaches the MSEL after the competencies were read still gets its competencies, and the cover's
   * Teams fact follows it.
   * Interacts with: real MselStore and MselQuery; TeamCompetencyService (stub).
   * Data: Exercise Alpha with no teams at first, then Blue Team; one team competency for Blue Team.
   */
  it('shows team competencies for teams added after load', async () => {
    const t2: Competency = { id: 'c-2', competencyFrameworkId: 'fw-1', idNumber: 'T-2', shortName: 'Triage alerts' };
    const { fixture } = await renderPlaybook(true, {
      mselCompetencies: [{ id: 'mc-1', mselId: 'msel-1', competencyId: 'c-2', competency: t2 }],
      teamCompetencies: [{ id: 'tc-1', teamId: 'team-blue', competencyId: 'c-2', competency: t2 }],
    });
    expect(within(screen.getByLabelText('Competencies')).queryByText('Team competencies')).toBeNull();

    TestBed.inject(MselStore).update('msel-1', { teams: [{ id: 'team-blue', name: 'Blue Team', shortName: 'BLUE' }] });
    fixture.detectChanges();

    const section = within(screen.getByLabelText('Competencies'));
    expect(section.getAllByRole('heading', hidden).map((h) => h.textContent)).toEqual(['Competencies', 'DCWF 5.1', 'Team competencies', 'Blue Team']);
    const facts = Array.from(screen.getByLabelText('MSEL facts').querySelectorAll('dt')).map((dt) => [dt.textContent.trim(), dt.nextElementSibling.textContent.trim()]);
    expect(facts).toContainEqual(['Teams', 'Blue Team']);
  });

  /**
   * Verifies: every move prints its own page, in the contents too, and a move with no events says so; the cover's move
   * count matches the pages.
   * Interacts with: real MoveQuery and ScenarioEventQuery (seeded); getPrintMoves.
   * Data: moves 1 and 2 with one event each, and move 3 with none.
   */
  it('prints a page for a move with no events', async () => {
    const move3: Move = { id: 'move-3', mselId: 'msel-1', moveNumber: 3, description: 'Recovery', deltaSeconds: 7200 };
    const { container } = await renderPlaybook(true, { moves: [...MOVES, move3], events: MOVE_EVENTS, values: MOVE_VALUES });

    const contents = within(screen.getByLabelText('Contents'));
    expect(contents.getAllByRole('listitem', hidden).map((li) => li.textContent.trim())).toEqual([
      'Move 1: Initial access',
      'Move 2: Containment',
      'Move 3: Recovery',
    ]);
    const facts = Array.from(screen.getByLabelText('MSEL facts').querySelectorAll('dt')).map((dt) => [dt.textContent.trim(), dt.nextElementSibling.textContent.trim()]);
    expect(facts).toContainEqual(['Moves', '3']);

    expect(within(screen.getByLabelText('Move 3')).getByRole('heading', hidden)).toHaveTextContent('Recovery');
    const order = Array.from(container.querySelectorAll('.move-title, #eventDetails thead th:last-child, .move-no-events')).map((el) =>
      el.classList.contains('move-title') ? el.getAttribute('aria-label') : el.textContent.trim()
    );
    expect(order).toEqual(['Move 1', 'Phishing wave', 'Move 2', 'Isolate hosts', 'Move 3', 'No events for this move']);
  });

  /**
   * Verifies: events in a MSEL with no moves print under "Scenario Events", not "Move -1", and events before the first
   * move print ahead of it under "Before Move N".
   * Interacts with: real MoveQuery and ScenarioEventQuery (seeded); getPrintMoves.
   */
  it('labels events outside any move', async () => {
    await renderPlaybook(true);
    expect(screen.getByLabelText('Scenario Events')).toHaveTextContent('Scenario Events');
    expect(screen.queryByLabelText('Move -1')).toBeNull();
  });

  it('labels events before the first move', async () => {
    const lateMove: Move = { id: 'move-1', mselId: 'msel-1', moveNumber: 1, description: 'Late start', deltaSeconds: 3600 };
    const { container } = await renderPlaybook(true, { moves: [lateMove], events: MOVE_EVENTS, values: MOVE_VALUES });

    const order = Array.from(container.querySelectorAll('.move-title, #eventDetails thead th:last-child')).map((el) =>
      el.classList.contains('move-title') ? el.getAttribute('aria-label') : el.textContent.trim()
    );
    expect(order).toEqual(['Before Move 1', 'Phishing wave', 'Move 1', 'Isolate hosts']);
  });

  /**
   * Verifies: Print All Events from a later paginator page still prints every event, by starting from the first page.
   * Interacts with: the paginator state (changePage), printAllEvents; the print itself is held back by fake timers.
   * Data: two moves with one event each, the playbook paged one event at a time and on page 2.
   */
  it('prints every event from a later page', async () => {
    const { fixture } = await renderPlaybook(true, { moves: MOVES, events: MOVE_EVENTS, values: MOVE_VALUES });
    const playbook = fixture.componentInstance;
    playbook.changePage({ pageIndex: 1, pageSize: 1, length: 2 });
    fixture.detectChanges();

    vi.useFakeTimers();
    try {
      playbook.printAllEvents();
      fixture.detectChanges();
      expect(playbook.getPrintMoves().map((m) => [m.label, m.events.map((e) => e.id)])).toEqual([
        ['Move 1', ['se-1']],
        ['Move 2', ['se-2']],
      ]);
    } finally {
      // the print would replace the page body and reload
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  /**
   * Verifies: the print waits for the copied body's images to decode, but not past its time limit, and an image that
   * fails doesn't hold it.
   * Interacts with: imagesReady.
   */
  it('waits for images before printing', async () => {
    const root = document.createElement('div');
    const loaded = document.createElement('img');
    const failed = document.createElement('img');
    let finishLoad: () => void;
    loaded.decode = vi.fn(() => new Promise<void>((resolve) => (finishLoad = resolve)));
    failed.decode = vi.fn(() => Promise.reject(new Error('broken')));
    root.append(loaded, failed);

    let ready = false;
    const waiting = imagesReady(root).then(() => (ready = true));
    await Promise.resolve();
    expect(ready).toBe(false);
    finishLoad();
    await waiting;
    expect(ready).toBe(true);

    const stuck = document.createElement('img');
    stuck.decode = vi.fn(() => new Promise<void>(() => undefined));
    root.replaceChildren(stuck);
    await expect(imagesReady(root, 10)).resolves.toBeUndefined();
  });

  /**
   * Verifies: the print footer writes the MSEL name into the playbook page's bottom-left margin box, escaped as a CSS string.
   * Interacts with: playbookFooterCss.
   * Data: a name with quotes, a backslash and a line break.
   */
  it('writes the MSEL name into the print footer', () => {
    expect(playbookFooterCss('Exercise Alpha')).toBe('@page playbook { @bottom-left { content: "Exercise Alpha"; } }');
    expect(playbookFooterCss('Op "Red"\\X\nTwo')).toBe('@page playbook { @bottom-left { content: "Op \\"Red\\"\\\\X Two"; } }');
  });

  /**
   * Verifies: the cover's duration reads as days, hours and minutes, with seconds only for durations under a minute.
   * Interacts with: formatPlaybookDuration.
   * Data: 0 s, 45 s, 1 h, 1 d 2 h 30 min.
   */
  it('formats the cover duration', () => {
    expect(formatPlaybookDuration(0)).toBe('0 seconds');
    expect(formatPlaybookDuration(45)).toBe('45 seconds');
    expect(formatPlaybookDuration(3600)).toBe('1 hour');
    expect(formatPlaybookDuration(95400)).toBe('1 day 2 hours 30 minutes');
  });
});
