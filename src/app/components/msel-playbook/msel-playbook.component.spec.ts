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
} from 'src/app/generated/blueprint.api';
import { DataFieldStore } from 'src/app/data/data-field/data-field.store';
import { DataValueStore } from 'src/app/data/data-value/data-value.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { MoveStore } from 'src/app/data/move/move.store';
import { MselPageStore } from 'src/app/data/msel-page/msel-page.store';
import { ScenarioEventStore } from 'src/app/data/scenario-event/scenario-event.store';
import { formatPlaybookDuration, MselPlaybookComponent, opensWithHeading, playbookFooterCss } from './msel-playbook.component';
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
