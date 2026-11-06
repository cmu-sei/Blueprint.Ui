// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import {
  Competency,
  CompetencyFramework,
  CompetencyFrameworkService,
  DataField,
  DataFieldType,
  DataValue,
  EventType,
  Move,
  Msel,
  MselCompetency,
  MselCompetencyService,
  ProficiencyLevel,
  ProficiencyScale,
  ProficiencyScaleService,
  ScenarioEvent,
  TeamCompetency,
  TeamCompetencyService,
} from 'src/app/generated/blueprint.api';
import { DataFieldStore } from 'src/app/data/data-field/data-field.store';
import { DataValueStore } from 'src/app/data/data-value/data-value.store';
import { MoveStore } from 'src/app/data/move/move.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { ScenarioEventStore } from 'src/app/data/scenario-event/scenario-event.store';
import { AssessorViewComponent } from './assessor-view.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DurationViewComponent } from '../shared/duration-view/duration-view.component';
import { DataValueComponent } from '../data-value/data-value.component';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';
import { Router } from '@angular/router';
import { UIDataService } from 'src/app/data/ui/ui-data.service';

@Component({ selector: 'app-duration-view', template: '' })
class DurationViewStub {
  readonly startTime = input<Date>(undefined);
  readonly durationSeconds = input<number>(undefined);
  readonly showRealTime = input<boolean>(undefined);
}
@Component({ selector: 'app-data-value', template: '' })
class DataValueStub {
  readonly value = input<string>(undefined);
  readonly valueChange = output<string>();
  readonly dataField = input<DataField>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly canApprove = input<boolean>(undefined);
  readonly isOwner = input<boolean>(undefined);
  readonly showValueOnly = input<boolean>(undefined);
  readonly organizationOptions = input<unknown[]>(undefined);
  readonly teamOptions = input<unknown[]>(undefined);
  readonly cardOptions = input<unknown[]>(undefined);
  readonly moveOptions = input<unknown[]>(undefined);
  readonly userOptions = input<unknown[]>(undefined);
}

const MSEL: Msel = { id: 'msel-1', name: 'Exercise Alpha', teams: [], units: [], userMselRoles: [] };
const FIELDS: DataField[] = [
  { id: 'df-title', mselId: 'msel-1', name: 'Title', dataType: DataFieldType.String, displayOrder: 1, isAssessorVisible: true },
  { id: 'df-done', mselId: 'msel-1', name: 'Observed', dataType: DataFieldType.Checkbox, displayOrder: 2, isAssessorVisible: true },
  { id: 'df-notes', mselId: 'msel-1', name: 'Planner Notes', dataType: DataFieldType.String, displayOrder: 3, isAssessorVisible: false },
];
const EVENT: ScenarioEvent = { id: 'se-1', mselId: 'msel-1', scenarioEventType: EventType.Inject, deltaSeconds: 0, groupOrder: 1 };
const VALUES: DataValue[] = [
  { id: 'dv-1', scenarioEventId: 'se-1', dataFieldId: 'df-title', value: 'Phishing wave' },
  { id: 'dv-2', scenarioEventId: 'se-1', dataFieldId: 'df-done', value: 'false' },
];

const LEVELS: ProficiencyLevel[] = [
  { id: 'level-3', proficiencyScaleId: 'scale-1', name: 'Expert', value: 3, displayOrder: 3 },
  { id: 'level-1', proficiencyScaleId: 'scale-1', name: 'Novice', value: 1, displayOrder: 1 },
  { id: 'level-2', proficiencyScaleId: 'scale-1', name: 'Proficient', value: 2, displayOrder: 2 },
];

// The printed report's exercise: two teams, two moves, four injects, three of them with competencies.
const BLUE = { id: 'team-blue', mselId: 'msel-1', name: 'Blue Team', shortName: 'BLUE' };
const RED = { id: 'team-red', mselId: 'msel-1', name: 'Red Team', shortName: 'RED' };
const REPORT_MSEL: Msel = {
  ...MSEL,
  name: 'Scoring Model Check',
  description: 'Rehearse triage and containment of a ransomware intrusion.',
  startTime: new Date('2026-11-03T14:00:00Z'),
  durationSeconds: 5400,
  teams: [RED, BLUE],
};
const TRIAGE: Competency = { id: 'comp-t1', competencyFrameworkId: 'fw-1', idNumber: 'T-1', shortName: 'Incident triage' };
const CONTAIN: Competency = { id: 'comp-k2', competencyFrameworkId: 'fw-1', idNumber: 'K-2', shortName: 'Containment knowledge' };
const REPORT_COMPETENCIES: MselCompetency[] = [
  { id: 'mc-1', mselId: 'msel-1', competencyId: TRIAGE.id, competency: TRIAGE },
  { id: 'mc-2', mselId: 'msel-1', competencyId: CONTAIN.id, competency: CONTAIN },
];
const REPORT_MOVES: Move[] = [
  { id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0, description: 'Initial Reports' },
  { id: 'move-2', mselId: 'msel-1', moveNumber: 2, deltaSeconds: 3600, description: 'Escalation' },
];
const REPORT_FIELDS: DataField[] = [
  { id: 'df-title', mselId: 'msel-1', name: 'Title', dataType: DataFieldType.String, displayOrder: 1, isAssessorVisible: true },
  { id: 'df-comps', mselId: 'msel-1', name: 'Competencies', dataType: DataFieldType.Competency, displayOrder: 3, isAssessorVisible: true },
];
const inject = (id: string, deltaSeconds: number): ScenarioEvent =>
  ({ id, mselId: 'msel-1', scenarioEventType: EventType.Inject, deltaSeconds, groupOrder: 1 });
const REPORT_EVENTS = [inject('se-1', 900), inject('se-2', 1800), inject('se-3', 3900), inject('se-4', 4000)];
const value = (scenarioEventId: string, dataFieldId: string, v: string): DataValue =>
  ({ id: `dv-${scenarioEventId}-${dataFieldId}`, scenarioEventId, dataFieldId, value: v });
const REPORT_VALUES: DataValue[] = [
  value('se-1', 'df-title', 'Unusual logins'),
  value('se-1', 'df-comps', 'T-1'),
  value('se-2', 'df-title', 'Locked accounts'),
  value('se-2', 'df-comps', 'T-1, K-2'),
  value('se-3', 'df-title', 'Ransom note'),
  value('se-3', 'df-comps', 'K-2'),
  value('se-4', 'df-title', 'Press call'),
];

// An assessor's assertion as Blueprint's API writes it to the LRS.
function asserted(
  id: string,
  timestamp: string,
  competency: Competency,
  score: number,
  grouping: string,
  team = BLUE,
  comment?: string
) {
  return {
    id,
    timestamp,
    actor: { name: 'J. Doe' },
    verb: { id: 'https://w3id.org/xapi/tla/verbs/asserted', display: { 'en-US': 'asserted' } },
    object: {
      id: `https://blueprint.example/api/competencies/${competency.id}`,
      definition: {
        type: 'https://w3id.org/xapi/tla/activity-types/competency',
        extensions: { 'https://w3id.org/xapi/tla/extensions/competency-identifier': competency.idNumber },
      },
    },
    result: { score: { raw: score }, completion: true, ...(comment ? { response: comment } : {}) },
    context: {
      platform: 'Blueprint',
      team: { name: team.shortName, account: { name: team.id } },
      extensions: { 'https://w3id.org/xapi/tla/extensions/confidence': 1 },
      contextActivities: { grouping: [{ id: grouping }] },
    },
  };
}
const onEvent = (eventId: string) => `https://blueprint.example/api/scenarioevents/${eventId}`;

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

async function renderAssessorView(
  overrides: {
    canEditCheckboxes?: boolean;
    moves?: Move[];
    fields?: DataField[];
    standalone?: boolean;
    canChooseFields?: boolean;
    msel?: Msel;
    events?: ScenarioEvent[];
    values?: DataValue[];
    mselCompetencies?: MselCompetency[];
    teamCompetencies?: TeamCompetency[];
  } = {}
) {
  const {
    canEditCheckboxes = false,
    moves = [],
    fields = FIELDS,
    standalone = false,
    canChooseFields = false,
    msel = MSEL,
    events = [EVENT],
    values = VALUES,
    mselCompetencies = [],
    teamCompetencies = [],
  } = overrides;
  const poolApi = {
    getMselCompetencies: vi.fn(() => of<MselCompetency[]>(structuredClone(mselCompetencies))),
  } satisfies ApiStub<MselCompetencyService>;
  const teamCompetencyApi = {
    getMselTeamCompetencies: vi.fn(() => of<TeamCompetency[]>(structuredClone(teamCompetencies))),
  } satisfies ApiStub<TeamCompetencyService>;
  // the MSEL competencies' framework, and its proficiency scale, which names each assertion's result
  const frameworkApi = {
    getCompetencyFramework: vi.fn((id: string) => of<CompetencyFramework>({ id, name: 'NICE', defaultProficiencyScaleId: 'scale-1' })),
  } satisfies ApiStub<CompetencyFrameworkService>;
  const scaleApi = {
    getProficiencyScale: vi.fn((id: string) => of<ProficiencyScale>({ id, name: 'Proficiency', proficiencyLevels: structuredClone(LEVELS) })),
  } satisfies ApiStub<ProficiencyScaleService>;
  const rendered = await renderComponent(AssessorViewComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatProgressBarModule,
      MatSelectModule,
      MatSortModule,
      MatTooltipModule,
    ],
    childStubs: [
      { replace: DurationViewComponent, with: DurationViewStub },
      { replace: DataValueComponent, with: DataValueStub },
    ],
    providers: [
      { provide: MselCompetencyService, useValue: poolApi },
      { provide: TeamCompetencyService, useValue: teamCompetencyApi },
      { provide: CompetencyFrameworkService, useValue: frameworkApi },
      { provide: ProficiencyScaleService, useValue: scaleApi },
      // The component reads xAPI statements over HttpClient when an event is expanded.
      provideHttpClient(),
      provideHttpClientTesting(),
      // The MSEL page loads all of this; the stores are seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([structuredClone(msel)]);
          store.setActive('msel-1');
          return store;
        },
      },
      seeded(DataFieldStore, fields),
      seeded(DataValueStore, values),
      seeded(ScenarioEventStore, events),
      seeded(MoveStore, moves),
    ],
    inputs: { canEditCheckboxes, loggedInUserId: 'user-me', standalone, canChooseFields },
  });
  return { ...rendered, poolApi };
}

function values(fixture: ComponentFixture<unknown>): DataValueStub[] {
  return fixture.debugElement.queryAll(By.directive(DataValueStub)).map((d) => d.componentInstance);
}
const byField = (fixture: ComponentFixture<unknown>, name: string) => values(fixture).find((v) => v.dataField().name === name);

describe('AssessorViewComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // A test that sets TZ runs in a zone with daylight saving time; this restores the host's.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * Verifies: only the assessor-visible data fields are shown, and the MSEL's competencies are loaded.
   * Interacts with: real DataFieldQuery, DataValueQuery and ScenarioEventQuery (seeded), MselCompetencyService.getMselCompetencies (stub), DataValueStub inputs.
   * Data: Title and Observed are assessor-visible; Planner Notes is not.
   */
  it('shows only the assessor-visible fields', async () => {
    const { fixture, poolApi } = await renderAssessorView();

    expect(poolApi.getMselCompetencies).toHaveBeenCalledWith('msel-1');
    expect(values(fixture).map((v) => [v.dataField().name, v.value()])).toEqual([
      ['Title', 'Phishing wave'],
      ['Observed', 'false'],
    ]);
    expect(screen.queryByText('No data fields are marked as assessor-visible.')).not.toBeInTheDocument();
  });

  describe('with no assessor-visible fields', () => {
    const HIDDEN = FIELDS.map((f) => ({ ...f, isAssessorVisible: false }));

    /**
     * Verifies: inside the MSEL editor the empty state points at the Data Fields tab beside it.
     * Interacts with: real DataFieldQuery (seeded).
     * Data: no field is assessor-visible; standalone false.
     */
    it('points at the Data Fields tab inside the MSEL editor', async () => {
      await renderAssessorView({ fields: HIDDEN });

      expect(screen.getByText('No data fields are marked as assessor-visible.')).toBeInTheDocument();
      expect(screen.getByText(/^Go to the Data Fields tab/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open Data Fields' })).not.toBeInTheDocument();
    });

    /**
     * Verifies: on the assessor page, a user who can choose the fields gets a button that opens the MSEL editor on its Data Fields tab.
     * Interacts with: Router.navigate (spy), UIDataService saved MSEL tab (real, localStorage).
     * Data: no field is assessor-visible; standalone and canChooseFields true.
     */
    it('opens the Data Fields tab for a user who can choose the fields', async () => {
      const { fixture } = await renderAssessorView({ fields: HIDDEN, standalone: true, canChooseFields: true });
      const router = fixture.debugElement.injector.get(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      expect(screen.queryByText(/^Go to the Data Fields tab/)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Open Data Fields' }));

      expect(navigate).toHaveBeenCalledWith(['/build'], { queryParams: { msel: 'msel-1' } });
      expect(fixture.debugElement.injector.get(UIDataService).getMselTab()).toBe('Data Fields');
    });

    /**
     * Verifies: on the assessor page, a user who cannot choose the fields is told to ask the MSEL owner, with no button.
     * Interacts with: real DataFieldQuery (seeded).
     * Data: no field is assessor-visible; standalone true, canChooseFields false.
     */
    it('tells a user who cannot choose the fields to ask the MSEL owner', async () => {
      await renderAssessorView({ fields: HIDDEN, standalone: true });

      expect(screen.getByText(/^Ask the MSEL owner/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open Data Fields' })).not.toBeInTheDocument();
    });
  });

  /**
   * Verifies: with canEditCheckboxes only the Checkbox field is editable; nothing is approvable or owned.
   * Interacts with: DataValueStub inputs.
   * Data: canEditCheckboxes true; Title (String) and Observed (Checkbox).
   */
  it('lets an assessor tick the checkbox fields with canEditCheckboxes', async () => {
    const { fixture } = await renderAssessorView({ canEditCheckboxes: true });

    expect(byField(fixture, 'Observed')?.canEdit()).toBe(true);
    expect(byField(fixture, 'Title')?.canEdit()).toBe(false);
    for (const value of values(fixture)) {
      expect(value.canApprove()).toBe(false);
      expect(value.isOwner()).toBe(false);
      expect(value.showValueOnly()).toBe(true);
    }
  });

  /**
   * Verifies: without canEditCheckboxes every field, the Checkbox field included, is read-only.
   * Interacts with: DataValueStub inputs.
   * Data: canEditCheckboxes false.
   */
  it('makes the checkbox fields read-only without canEditCheckboxes', async () => {
    const { fixture } = await renderAssessorView({ canEditCheckboxes: false });

    expect(byField(fixture, 'Observed')?.canEdit()).toBe(false);
    expect(byField(fixture, 'Title')?.canEdit()).toBe(false);
  });

  /**
   * Verifies: copying a statement lets a rejected clipboard write escape (current behavior).
   * Interacts with: HttpClient, navigator.clipboard.writeText, captureUnhandledRxErrors.
   * Data: one CITE statement in Move 1; clipboard access is refused.
   */
  it('leaves a rejected statement clipboard write unhandled', async () => {
    const errors = captureUnhandledRxErrors();
    const failure = new Error('clipboard access denied');
    const { fixture } = await renderAssessorView({
      moves: [{ id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0, description: 'Initial access' }],
    });
    const user = userEvent.setup();
    const writes: string[] = [];
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({
      writeText: (text: string) => {
        writes.push(text);
        return Promise.reject(failure);
      },
    } satisfies Pick<Clipboard, 'writeText'> as Clipboard);
    const statement = {
      id: 'stmt-1',
      timestamp: '2026-10-20T16:00:00Z',
      actor: { name: 'Blue Analyst' },
      verb: { id: 'http://adlnet.gov/expapi/verbs/experienced', display: { 'en-US': 'experienced' } },
      context: { platform: 'cite', contextActivities: { grouping: [{ id: 'https://blueprint.example/move/1' }] } },
    };
    await user.click(screen.getByText('Move 1'));
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url === '/api/xapi/statements' && req.params.get('mselId') === 'msel-1')
      .flush({ statements: [statement] });
    fixture.detectChanges();

    await user.click(screen.getByRole('button', { name: 'Copy JSON' }));
    await flush();

    expect(writes).toEqual([JSON.stringify(statement, null, 2)]);
    expect(errors).toEqual([failure]);
  });

  /**
   * Verifies: each xAPI statement in an opened move is timed with the zone in effect on its own date.
   * Interacts with: toggleMoveExpand (move header clicked), HttpClient GET api/xapi/statements (HttpTestingController), formatTimestamp, getTimezoneAbbr.
   * Data: TZ America/New_York; Move 1 at 0 s; two CITE statements for move 1, 20 Oct 2026 16:00 UTC (EDT) and 20 Nov 2026 17:00 UTC (EST).
   */
  it('times each move statement with the zone in effect on its date', async () => {
    vi.stubEnv('TZ', 'America/New_York');
    const { fixture } = await renderAssessorView({
      moves: [{ id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0, description: 'Initial access' }],
    });
    const user = userEvent.setup();

    await user.click(screen.getByText('Move 1'));
    const statement = (id: string, timestamp: string) => ({
      id,
      timestamp,
      actor: { name: 'Blue Analyst' },
      verb: { id: 'http://adlnet.gov/expapi/verbs/experienced', display: { 'en-US': 'experienced' } },
      context: { platform: 'cite', contextActivities: { grouping: [{ id: 'https://blueprint.example/move/1' }] } },
    });
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url === '/api/xapi/statements' && req.params.get('mselId') === 'msel-1')
      .flush({ statements: [statement('stmt-oct', '2026-10-20T16:00:00Z'), statement('stmt-nov', '2026-11-20T17:00:00Z')] });
    fixture.detectChanges();

    expect(Array.from(document.querySelectorAll('.statement-time'), (e) => e.textContent)).toEqual([
      '20 Oct 2026 12:00 EDT',
      '20 Nov 2026 12:00 EST',
    ]);
  });

  describe('printed assessment report', () => {
    const STATEMENTS = [
      asserted('st-1', '2026-11-03T14:20:00Z', TRIAGE, 2, onEvent('se-1'), BLUE, 'Slow to isolate'),
      asserted('st-2', '2026-11-03T14:30:00Z', TRIAGE, 3, onEvent('se-1'), BLUE, 'Isolated both hosts'),
      asserted('st-3', '2026-11-03T15:10:00Z', CONTAIN, 1, onEvent('se-3')),
      asserted('st-4', '2026-11-03T15:05:00Z', CONTAIN, 2, 'https://blueprint.example/api/msels/msel-1/moves/2'),
    ];

    // Clicks Print Assessment Report, answers the statements request, and waits until the report would be printed.
    // printDocument, which copies the area into the body, prints and reloads, is stubbed: jsdom can do neither.
    async function printReport(
      statements: unknown[] | 'unavailable',
      overrides: Parameters<typeof renderAssessorView>[0] = {},
      beforePrinting?: () => void
    ) {
      vi.stubEnv('TZ', 'America/New_York');
      const rendered = await renderAssessorView({
        msel: REPORT_MSEL,
        moves: REPORT_MOVES,
        fields: REPORT_FIELDS,
        events: REPORT_EVENTS,
        values: REPORT_VALUES,
        mselCompetencies: REPORT_COMPETENCIES,
        ...overrides,
      });
      const printDocument = vi
        .spyOn(rendered.fixture.componentInstance as unknown as { printDocument(): void }, 'printDocument')
        .mockImplementation(() => undefined);
      beforePrinting?.();

      await userEvent.click(screen.getByRole('button', { name: 'Print Assessment Report' }));
      const request = TestBed.inject(HttpTestingController).expectOne(
        (req) => req.url === '/api/xapi/statements' && req.params.get('mselId') === 'msel-1'
      );
      if (statements === 'unavailable') {
        request.flush('LRS down', { status: 503, statusText: 'Service Unavailable' });
      } else {
        request.flush({ statements });
      }
      rendered.fixture.detectChanges();
      await vi.waitFor(() => expect(printDocument).toHaveBeenCalledTimes(1));
      rendered.fixture.detectChanges();
      return { ...rendered, printDocument };
    }

    const texts = (root: ParentNode, selector: string) =>
      Array.from(root.querySelectorAll(selector), (e) => e.textContent.replace(/\s+/g, ' ').trim());
    const section = (name: string) => screen.getByLabelText(name);

    /**
     * Verifies: the report is drawn only when printing, so the view on screen is unchanged; Print Assessment Report
     * reads the statements first when no section has been opened yet.
     * Interacts with: printReport, HttpClient GET api/xapi/statements (HttpTestingController), printDocument (spy).
     * Data: the report exercise, nothing expanded before printing.
     */
    it('draws the report only when printing', async () => {
      let drawnBeforePrinting: boolean | undefined;
      const { printDocument } = await printReport(STATEMENTS, {}, () => {
        drawnBeforePrinting = !!document.getElementById('assessment-print-area');
      });

      expect(drawnBeforePrinting).toBe(false);

      expect(printDocument).toHaveBeenCalledTimes(1);
      expect(document.getElementById('assessment-print-area')).not.toBeNull();
    });

    const tableRows = (table: Element) => Array.from(table.querySelectorAll('tbody tr'), (row) => texts(row, 'td'));

    /**
     * Verifies: the cover shows the theme band (no MSEL image), "Assessment Report", the MSEL name and facts, and the
     * purpose: the MSEL description and each move's description.
     * Interacts with: buildAssessmentReport, reportMoves, DatePipe, TimezoneAbbrPipe.
     * Data: TZ America/New_York; start 3 Nov 2026 14:00 UTC, 90 minutes; two described moves.
     */
    it('prints a cover with the exercise and its purpose', async () => {
      await printReport(STATEMENTS);

      const cover = section('Cover');
      expect(within(cover).getByTestId('cover-band')).toBeInTheDocument();
      expect(within(cover).getByText('Assessment Report')).toBeInTheDocument();
      expect(within(cover).getByRole('heading', { level: 1, hidden: true })).toHaveTextContent('Scoring Model Check');
      const facts = cover.querySelector('.cover-facts');
      expect(texts(facts, 'dt')).toEqual(['Start', 'Duration', 'Moves', 'Injects', 'Teams', 'Assessors', 'Printed']);
      expect(texts(facts, 'dd').slice(0, 6)).toEqual(['03 Nov 2026 09:00 EST', '1 hour 30 minutes', '2', '4', '2', 'J. Doe']);
      const purpose = within(cover).getByLabelText('Purpose');
      expect(texts(purpose, '.purpose-description')).toEqual(['Rehearse triage and containment of a ransomware intrusion.']);
      expect(texts(purpose, '.purpose-moves li')).toEqual(['Move 1: Initial Reports', 'Move 2: Escalation']);
    });

    /**
     * Verifies: with no objective data field the results are measured by competency, and the report says so; each
     * competency row gives its code and name, the injects that exercise it, how many of those were assessed, and the
     * latest ratings per level across teams, the levels in scale order; then a row per team.
     * Interacts with: buildAssessmentReport, ProficiencyScaleService.getProficiencyScale (stub).
     * Data: Blue rated Expert on T-1 for "Unusual logins" (after an earlier Proficient), Novice on K-2 for "Ransom
     * note" and Proficient on K-2 for Move 2 as a whole; Red not rated.
     */
    it('prints results by competency and by team', async () => {
      await printReport(STATEMENTS);

      const results = section('Results');
      expect(texts(results, 'h2')).toEqual(['Results by competency', 'Results by team']);
      expect(within(results).getByText('This MSEL has no objectives, so its competencies measure the results.')).toBeInTheDocument();
      const byCompetency = within(results).getByLabelText('Results by competency');
      expect(texts(byCompetency, 'thead th')).toEqual(['Competency', 'Injects', 'Assessed', 'Novice', 'Proficient', 'Expert']);
      expect(tableRows(byCompetency)).toEqual([
        ['K-2 Containment knowledge', '2', '1', '1', '1', '0'],
        ['T-1 Incident triage', '2', '1', '0', '0', '1'],
      ]);
      const byTeam = within(results).getByLabelText('Results by team');
      expect(texts(byTeam, 'thead th')).toEqual(['Team', 'Injects assessed', 'Not assessed', 'Novice', 'Proficient', 'Expert']);
      expect(tableRows(byTeam)).toEqual([
        ['Blue Team', '2', '1', '1', '1', '1'],
        ['Red Team', '0', '3', '0', '0', '0'],
      ]);
    });

    /**
     * Verifies: when the MSEL has a data field named for objectives, results are rolled up by its values too, before
     * the competencies, and the report names the field.
     * Interacts with: buildAssessmentReport (objective field found by name).
     * Data: an Objectives field, not assessor-visible: "Detect intrusion" on the first two injects, "Contain
     * ransomware" on "Ransom note".
     */
    it('prints results by objective when the MSEL has an objective field', async () => {
      await printReport(STATEMENTS, {
        fields: [
          ...REPORT_FIELDS,
          { id: 'df-obj', mselId: 'msel-1', name: 'Objectives', dataType: DataFieldType.String, displayOrder: 4, isAssessorVisible: false },
        ],
        values: [
          ...REPORT_VALUES,
          value('se-1', 'df-obj', 'Detect intrusion'),
          value('se-2', 'df-obj', '<p>Detect intrusion</p>'),
          value('se-3', 'df-obj', 'Contain ransomware'),
        ],
      });

      const results = section('Results');
      expect(texts(results, 'h2')).toEqual(['Results by objective', 'Results by competency', 'Results by team']);
      expect(within(results).getByText('Objectives are the values of the Objectives data field.')).toBeInTheDocument();
      expect(tableRows(within(results).getByLabelText('Results by objective'))).toEqual([
        ['Detect intrusion', '2', '1', '0', '0', '1'],
        ['Contain ransomware', '1', '1', '1', '0', '0'],
      ]);
    });

    /**
     * Verifies: each team prints on its own page as one table of its assessed injects in time order, with the move it
     * was rated on as a whole; each rating reads "CODE Level", followed by the assessor's comment only when there is
     * one; a "Not assessed" line names the injects with competencies the team was not rated on.
     * Interacts with: buildAssessmentReport, readAssertion.
     * Data: as above; "Press call" has no competencies, so it is never listed as not assessed.
     */
    it('prints each team as one table with a not-assessed line', async () => {
      await printReport(STATEMENTS);

      expect(texts(document, '.report-team .team-title')).toEqual(['Blue Team', 'Red Team']);
      const blue = section('Blue Team');
      expect(texts(blue, 'thead th')).toEqual(['Time', 'Inject', 'Rating']);
      expect(tableRows(blue.querySelector('table')).map((row) => row.slice(1))).toEqual([
        ['Unusual logins', 'T-1 Expert Isolated both hosts'],
        ['Move 2 (whole move)', 'K-2 Proficient'],
        ['Ransom note', 'K-2 Novice'],
      ]);
      expect(blue.querySelectorAll('.rating-comment')).toHaveLength(1);
      expect(texts(blue, '.not-assessed')).toEqual(['Not assessed: Locked accounts']);

      const red = section('Red Team');
      expect(within(red).getByText('No assessments recorded for this team.')).toBeInTheDocument();
      expect(texts(red, '.not-assessed')).toEqual(['Not assessed: Unusual logins, Locked accounts, Ransom note']);
      expect(document.querySelector('#assessment-print-area')?.textContent).not.toMatch(/Confidence/);
    });

    /**
     * Verifies: with team competency assignments, a team's not-assessed line keeps only the injects with one of its
     * competencies, and a team rated on everything it has gets no line.
     * Interacts with: buildAssessmentReport (isAssessableFor), TeamCompetencyService (stub).
     * Data: Red is assigned K-2 only; Blue is assigned T-1 and K-2 and is rated on every inject with competencies.
     */
    it('narrows the not-assessed injects to the team\'s competencies', async () => {
      await printReport([...STATEMENTS, asserted('st-5', '2026-11-03T14:45:00Z', TRIAGE, 2, onEvent('se-2'))], {
        teamCompetencies: [
          { id: 'tc-1', teamId: RED.id, competencyId: CONTAIN.id, competency: CONTAIN },
          { id: 'tc-2', teamId: BLUE.id, competencyId: TRIAGE.id, competency: TRIAGE },
          { id: 'tc-3', teamId: BLUE.id, competencyId: CONTAIN.id, competency: CONTAIN },
        ],
      });

      expect(texts(section('Red Team'), '.not-assessed')).toEqual(['Not assessed: Locked accounts, Ransom note']);
      expect(section('Blue Team').querySelector('.not-assessed')).toBeNull();
    });

    /**
     * Verifies: a MSEL with no teams prints the cover and results with a no-teams line and no team pages; a MSEL with
     * no competencies on its injects says so in the competency results.
     * Interacts with: buildAssessmentReport (reportTeams).
     * Data: the report exercise without teams or MSEL competencies; no statements.
     */
    it('prints no team pages for a MSEL with no teams', async () => {
      await printReport([], { msel: { ...REPORT_MSEL, teams: [] }, mselCompetencies: [] });

      const results = section('Results');
      expect(within(results).getByText('This MSEL has no teams.')).toBeInTheDocument();
      expect(within(results).getByText('No injects exercise a competency.')).toBeInTheDocument();
      expect(document.querySelectorAll('.report-team')).toHaveLength(0);
    });

    /**
     * Verifies: when the statements can't be read the report still prints, says why it shows no assessments, and
     * names every inject with competencies as not assessed.
     * Interacts with: loadAllStatements error path, buildAssessmentReport.
     * Data: GET api/xapi/statements answers 503.
     */
    it('says so when the statements could not be read', async () => {
      await printReport('unavailable');

      expect(within(section('Cover')).getByText(/^The xAPI statements could not be read/)).toBeInTheDocument();
      expect(within(section('Blue Team')).getByText('No assessments recorded for this team.')).toBeInTheDocument();
      expect(texts(section('Blue Team'), '.not-assessed')).toEqual(['Not assessed: Unusual logins, Locked accounts, Ransom note']);
    });

    /**
     * Verifies: a rating for no team of the MSEL prints on a "No team" page, which has no not-assessed line; with no
     * such rating there is no "No team" page.
     * Interacts with: buildAssessmentReport.
     * Data: one T-1 rating on "Unusual logins" whose statement names a team not on the MSEL.
     */
    it('prints a rating for no MSEL team on its own page', async () => {
      const other = { ...BLUE, id: 'team-gone', shortName: 'GONE' };
      await printReport([asserted('st-9', '2026-11-03T14:20:00Z', TRIAGE, 1, onEvent('se-1'), other)]);

      expect(texts(document, '.report-team .team-title')).toEqual(['Blue Team', 'Red Team', 'No team']);
      expect(tableRows(section('No team').querySelector('table')).map((row) => row.slice(1))).toEqual([
        ['Unusual logins', 'T-1 Novice'],
      ]);
      expect(section('No team').querySelector('.not-assessed')).toBeNull();
    });
  });
});
