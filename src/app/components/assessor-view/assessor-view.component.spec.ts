// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
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
import { Observable, of, Subject } from 'rxjs';
import {
  Competency,
  CiteService,
  CiteTeamResponses,
  CiteTeamResponsesStatus,
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
  Team,
  TeamCompetency,
  TeamCompetencyService,
} from 'src/app/generated/blueprint.api';
import { DataFieldStore } from 'src/app/data/data-field/data-field.store';
import { DataValueStore } from 'src/app/data/data-value/data-value.store';
import { MoveStore } from 'src/app/data/move/move.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { ScenarioEventStore } from 'src/app/data/scenario-event/scenario-event.store';
import { TeamStore } from 'src/app/data/team/team.store';
import { AssessorViewComponent, TEAM_RESPONSES_STALE_MS } from './assessor-view.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DurationViewComponent } from '../shared/duration-view/duration-view.component';
import { DataValueComponent } from '../data-value/data-value.component';
import { TeamResponsesComponent } from '../team-responses/team-responses.component';
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

@Component({ selector: 'app-team-responses', template: '' })
class TeamResponsesStub {
  readonly responses = input<CiteTeamResponses | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly teamName = input<string>('');
  readonly prompt = input<string>('');
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
const MOVE_1: Move = { id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0, description: 'Initial access' };
const BLUE: Team = { id: 'team-blue', mselId: 'msel-1', name: 'Blue Team', shortName: 'Blue' };
const RED: Team = { id: 'team-red', mselId: 'msel-1', name: 'Red Team', shortName: 'Red' };
const EXCON: Team = { id: 'team-excon', mselId: 'msel-1', name: 'Exercise Control', shortName: 'EXCON' };
const COMPETENCY_FIELD: DataField = {
  id: 'df-comp', mselId: 'msel-1', name: 'Competencies', dataType: DataFieldType.Competency, displayOrder: 4, isAssessorVisible: false,
};
// se-1 tagged with T0001, the MSEL's one competency; Move 1 holds se-1, so the move has it too.
const ASSESSABLE_FIELDS = [...FIELDS, COMPETENCY_FIELD];
const ASSESSABLE_VALUES: DataValue[] = [...VALUES, { id: 'dv-comp', scenarioEventId: 'se-1', dataFieldId: 'df-comp', value: 'T0001' }];
const T0001: MselCompetency[] = [{ id: 'mc-1', mselId: 'msel-1', competencyId: 'comp-1', competency: { id: 'comp-1', idNumber: 'T0001' } }];

const LEVELS: ProficiencyLevel[] = [
  { id: 'level-3', proficiencyScaleId: 'scale-1', name: 'Expert', value: 3, displayOrder: 3 },
  { id: 'level-1', proficiencyScaleId: 'scale-1', name: 'Novice', value: 1, displayOrder: 1 },
  { id: 'level-2', proficiencyScaleId: 'scale-1', name: 'Proficient', value: 2, displayOrder: 2 },
];

// The printed report's exercise: two teams (BLUE and RED above), two moves, four injects, three of them with competencies.
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
    values?: DataValue[];
    standalone?: boolean;
    canChooseFields?: boolean;
    msel?: Msel;
    events?: ScenarioEvent[];
    teams?: Team[];
    mselCompetencies?: MselCompetency[];
    teamCompetencies?: TeamCompetency[];
    teamResponses?: (mselId: string, moveNumber: number, teamId: string) => Observable<CiteTeamResponses>;
    /** The levels of the proficiency scale, loaded for a competency that has a framework. */
    proficiencyLevels?: ProficiencyLevel[];
  } = {}
) {
  const {
    canEditCheckboxes = false,
    moves = [],
    fields = FIELDS,
    values = VALUES,
    standalone = false,
    canChooseFields = false,
    msel = MSEL,
    events = [EVENT],
    teams = [],
    mselCompetencies = [],
    teamCompetencies = [],
    teamResponses = () => of<CiteTeamResponses>({}),
    proficiencyLevels = [],
  } = overrides;
  const poolApi = {
    getMselCompetencies: vi.fn(() => of<MselCompetency[]>(structuredClone(mselCompetencies))),
  } satisfies ApiStub<MselCompetencyService>;
  const teamCompetencyApi = {
    getMselTeamCompetencies: vi.fn(() => of<TeamCompetency[]>(structuredClone(teamCompetencies))),
  } satisfies ApiStub<TeamCompetencyService>;
  const citeApi = {
    getMselCiteTeamResponses: vi.fn(teamResponses),
  } satisfies ApiStub<CiteService>;
  const frameworkApi = {
    getCompetencyFramework: vi.fn((id: string) => of<CompetencyFramework>({ id, defaultProficiencyScaleId: 'scale-1' })),
  } satisfies ApiStub<CompetencyFrameworkService>;
  const scaleApi = {
    getProficiencyScale: vi.fn((id: string) => of<ProficiencyScale>({ id, proficiencyLevels: structuredClone(proficiencyLevels) })),
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
      { replace: TeamResponsesComponent, with: TeamResponsesStub },
    ],
    providers: [
      { provide: MselCompetencyService, useValue: poolApi },
      { provide: TeamCompetencyService, useValue: teamCompetencyApi },
      { provide: CiteService, useValue: citeApi },
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
      seeded(TeamStore, teams),
    ],
    inputs: { canEditCheckboxes, loggedInUserId: 'user-me', standalone, canChooseFields },
  });
  return { ...rendered, poolApi, citeApi };
}

function values(fixture: ComponentFixture<unknown>): DataValueStub[] {
  return fixture.debugElement.queryAll(By.directive(DataValueStub)).map((d) => d.componentInstance);
}
const byField = (fixture: ComponentFixture<unknown>, name: string) => values(fixture).find((v) => v.dataField().name === name);

/** Opens Move 1 and answers the MSEL's statement request with `statements`; returns the user. */
async function openMove(fixture: ComponentFixture<unknown>, statements: unknown[] = []) {
  const user = userEvent.setup();
  await user.click(screen.getByText('Move 1'));
  TestBed.inject(HttpTestingController)
    .expectOne((req) => req.url === '/api/xapi/statements' && req.params.get('mselId') === 'msel-1')
    .flush({ statements });
  fixture.detectChanges();
  return user;
}

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
   * Data: TZ America/New_York; Move 1 at 0 s; two CITE statements for move 1, 20 Oct 2026 16:00 UTC (EDT) and 20 Nov 2026 17:00 UTC (EST); grouping Off, as the two are otherwise one group.
   */
  it('times each move statement with the zone in effect on its date', async () => {
    vi.stubEnv('TZ', 'America/New_York');
    localStorage.setItem('uiState', JSON.stringify({ statementGrouping: 'off' }));
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
        proficiencyLevels: LEVELS,
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

    /**
     * Verifies: when the MSEL starts hiding names while the report's statements are being read, the read is dropped,
     * every statement is read again, and the report still prints, from the masked statements, with no Assessors line.
     * Interacts with: printReport, MselStore update (as a MselUpdated broadcast does), restartStatementsIfStale,
     * HttpClient GET api/xapi/statements (HttpTestingController), printDocument (spy).
     * Data: the report exercise; Print Assessment Report is clicked, the MSEL hides names, the first read answers with
     * J. Doe's ratings, and the second with the same ratings without the actor's name.
     */
    it('still prints when names are hidden during its read', async () => {
      vi.stubEnv('TZ', 'America/New_York');
      const { fixture } = await renderAssessorView({
        msel: REPORT_MSEL,
        moves: REPORT_MOVES,
        fields: REPORT_FIELDS,
        events: REPORT_EVENTS,
        values: REPORT_VALUES,
        mselCompetencies: REPORT_COMPETENCIES,
        proficiencyLevels: LEVELS,
      });
      const printDocument = vi
        .spyOn(fixture.componentInstance as unknown as { printDocument(): void }, 'printDocument')
        .mockImplementation(() => undefined);
      const http = TestBed.inject(HttpTestingController);
      const isRead = (req: { url: string; params: { get(name: string): string | null } }) =>
        req.url === '/api/xapi/statements' && req.params.get('mselId') === 'msel-1';

      await userEvent.click(screen.getByRole('button', { name: 'Print Assessment Report' }));
      const first = http.expectOne(isRead);
      TestBed.inject(MselStore).update('msel-1', { hideNamesOnAssessorView: true });
      fixture.detectChanges();
      first.flush({ statements: STATEMENTS });
      http.expectOne(isRead).flush({ statements: STATEMENTS.map((stmt) => ({ ...stmt, actor: { objectType: 'Agent' } })) });
      fixture.detectChanges();
      await vi.waitFor(() => expect(printDocument).toHaveBeenCalledTimes(1));
      fixture.detectChanges();

      const facts = section('Cover').querySelector('.cover-facts');
      expect(texts(facts, 'dt')).not.toContain('Assessors');
      expect(tableRows(section('Blue Team').querySelector('table')).map((row) => row.slice(1))).toEqual([
        ['Unusual logins', 'T-1 Expert Isolated both hosts'],
        ['Move 2 (whole move)', 'K-2 Proficient'],
        ['Ransom note', 'K-2 Novice'],
      ]);
    });
  });

  describe('statement grouping', () => {
    const VIEWED = 'http://id.tincanapi.com/verb/viewed';
    const ANN = { objectType: 'Agent', name: 'Ann Analyst', account: { homePage: 'https://id.example', name: 'ann' } };
    const BO = { objectType: 'Agent', name: 'Bo Builder', account: { homePage: 'https://id.example', name: 'bo' } };
    const CY = { objectType: 'Agent', name: 'Cy Cipher', account: { homePage: 'https://id.example', name: 'cy' } };
    const REX = { objectType: 'Agent', name: 'Rex Raider', account: { homePage: 'https://id.example', name: 'rex' } };
    // What the API leaves of an agent for an assessor on a MSEL that hides names.
    const MASKED = { objectType: 'Agent' };

    /** A Move 1 statement; by default Blue views the Phishing email in Gallery at 12:0<minute> EDT on 20 Oct 2026. */
    function statement(id: string, minute: number, overrides: Record<string, unknown> = {}) {
      const { team = BLUE, platform = 'gallery', verb = VIEWED, object = 'https://gallery.example/article/phish', ...rest } = overrides as {
        team?: Team;
        platform?: string;
        verb?: string;
        object?: string;
      };
      return {
        id,
        timestamp: `2026-10-20T16:0${minute}:00Z`,
        actor: ANN,
        verb: { id: verb, display: { 'en-US': verb.split('/').pop() } },
        object: { id: object, definition: { name: { 'en-US': object.split('/').pop() } } },
        context: {
          platform,
          team: { objectType: 'Group', name: team.name, account: { homePage: 'https://blueprint.example', name: team.id } },
          contextActivities: { grouping: [{ id: 'https://blueprint.example/move/1' }] },
        },
        ...rest,
      };
    }

    /** Opens Move 1 with the statements given and returns the user. */
    async function openMoveWith(statements: unknown[], options: { hideNames?: boolean } = {}) {
      vi.stubEnv('TZ', 'America/New_York');
      const rendered = await renderAssessorView({ moves: [MOVE_1], teams: [BLUE, RED] });
      if (options.hideNames) {
        TestBed.inject(MselStore).update('msel-1', { hideNamesOnAssessorView: true });
      }
      const user = await openMove(rendered.fixture, statements);
      return { ...rendered, user };
    }

    /** Each statement row shown: its count badge ('' for a single statement), actor and team. */
    const rowsShown = () =>
      Array.from(document.querySelectorAll('.statement-row'), (row) => [
        row.querySelector('.statement-group-count')?.textContent ?? '',
        row.querySelector('.stmt-actor')?.textContent,
        row.querySelector('.stmt-team')?.textContent,
      ]);

    async function chooseGrouping(fixture: ComponentFixture<unknown>, user: ReturnType<typeof userEvent.setup>, option: string) {
      await user.click(screen.getByRole('combobox', { name: 'Group by' }));
      await user.click(await screen.findByRole('option', { name: option }));
      fixture.detectChanges();
    }

    // Ann, Bo, Cy and Ann again view the same article for Blue; Rex views it for Red.
    const REPEATS = () => [
      statement('s-ann-1', 0),
      statement('s-bo', 1, { actor: BO }),
      statement('s-cy', 2, { actor: CY }),
      statement('s-rex', 3, { actor: REX, team: RED }),
      statement('s-ann-2', 4),
    ];

    /**
     * Verifies: by default (Team) repeats by different members of a team collapse into one row that names the first person, counts the others, spans first–last time (the end on its own line, only its time on the same day) and shows ×N; another team's repeat stays apart.
     * Interacts with: toggleMoveExpand, HttpClient GET api/xapi/statements (HttpTestingController), getSectionStatementList, buildStatementGroups, formatRangeEnd.
     * Data: TZ America/New_York; Ann, Bo, Cy, Ann view one article for Blue (12:00–12:04 EDT), Rex views it for Red at 12:03.
     */
    it('merges a team\'s repeats across its members by default', async () => {
      await openMoveWith(REPEATS());

      expect(screen.getByRole('combobox', { name: 'Group by' })).toHaveTextContent('Team');
      expect(rowsShown()).toEqual([
        ['', 'Rex Raider', 'Red Team'],
        ['×4', 'Ann Analyst + 2 others', 'Blue Team'],
      ]);
      const range = screen.getByRole('button', { name: /^×4/ }).querySelector('.statement-time-range');
      expect(Array.from(range.children, (line) => line.textContent.trim())).toEqual(['20 Oct 2026 12:00 EDT', '– 12:04 EDT']);
      expect(screen.getByText('5 / 5')).toBeInTheDocument();
    });

    /**
     * Verifies: by User, each person's repeats collapse separately, and groups are placed by their newest statement.
     * Interacts with: Group by mat-select (setStatementGrouping), getSectionStatementList.
     * Data: the same five statements; Ann's two are at 12:00 and 12:04.
     */
    it('keeps different people apart by User', async () => {
      const { fixture, user } = await openMoveWith(REPEATS());

      await chooseGrouping(fixture, user, 'User');

      expect(rowsShown()).toEqual([
        ['', 'Bo Builder', 'Blue Team'],
        ['', 'Cy Cipher', 'Blue Team'],
        ['', 'Rex Raider', 'Red Team'],
        ['×2', 'Ann Analyst', 'Blue Team'],
      ]);
    });

    /**
     * Verifies: Off shows every statement as its own row, in time order.
     * Interacts with: Group by mat-select (setStatementGrouping), getSectionStatementList.
     * Data: the same five statements.
     */
    it('shows every statement with grouping Off', async () => {
      const { fixture, user } = await openMoveWith(REPEATS());

      await chooseGrouping(fixture, user, 'Off');

      expect(rowsShown()).toEqual([
        ['', 'Ann Analyst', 'Blue Team'],
        ['', 'Bo Builder', 'Blue Team'],
        ['', 'Cy Cipher', 'Blue Team'],
        ['', 'Rex Raider', 'Red Team'],
        ['', 'Ann Analyst', 'Blue Team'],
      ]);
    });

    /**
     * Verifies: when the API removed every actor's identity, Group by offers only Team and Off, and a group is labeled Names hidden, as it cannot tell one person from several.
     * Interacts with: MselStore (hideNamesOnAssessorView set), Group by mat-select options, statementGroupActorLabel.
     * Data: MSEL hides names; three Blue statements on one article whose actors carry only objectType Agent.
     */
    it('offers only Team and Off when the statements carry no names', async () => {
      const { user } = await openMoveWith(
        [0, 1, 2].map((m) => statement(`s-${m}`, m, { actor: MASKED })),
        { hideNames: true },
      );

      expect(rowsShown()).toEqual([['×3', 'Names hidden', 'Blue Team']]);
      await user.click(screen.getByRole('combobox', { name: 'Group by' }));
      expect((await screen.findAllByRole('option')).map((o) => o.textContent.trim())).toEqual(['Team', 'Off']);
    });

    /**
     * Verifies: on a MSEL that hides names, a single statement the API stripped of its actor shows as a team member of its team.
     * Interacts with: MselStore (hideNamesOnAssessorView set), getActorLabel.
     * Data: MSEL hides names; one Blue statement whose actor carries only objectType Agent.
     */
    it('shows a team member of the team when the MSEL hides names', async () => {
      await openMoveWith([statement('s-1', 0, { actor: MASKED })], { hideNames: true });

      expect(rowsShown()).toEqual([['', 'Team member', 'Blue Team']]);
    });

    /**
     * Verifies: the MSEL's owner, whom the API sends the names, still sees them on a MSEL that hides names.
     * Interacts with: MselStore (hideNamesOnAssessorView set), getActorLabel.
     * Data: MSEL hides names; one Blue statement whose actor is Ann Analyst.
     */
    it('shows the name the API sent on a MSEL that hides names', async () => {
      await openMoveWith([statement('s-1', 0)], { hideNames: true });

      expect(rowsShown()).toEqual([['', 'Ann Analyst', 'Blue Team']]);
    });

    /**
     * Verifies: on a MSEL that shows names, a statement with no actor identity is Unknown, as before.
     * Interacts with: getActorLabel.
     * Data: MSEL shows names; one Blue statement whose actor carries only objectType Agent.
     */
    it('calls an actor with no name Unknown when the MSEL shows names', async () => {
      await openMoveWith([statement('s-1', 0, { actor: MASKED })]);

      expect(rowsShown()).toEqual([['', 'Unknown', 'Blue Team']]);
    });

    /**
     * Verifies: on a MSEL that hides names, a person the API sent no identity for on a statement with no team (a facilitator's launch) is a hidden name, not a team member.
     * Interacts with: MselStore (hideNamesOnAssessorView set), getActorLabel.
     * Data: MSEL hides names; one Blueprint launched statement with no context.team whose actor carries only objectType Agent.
     */
    it('calls a person with no team a hidden name when the MSEL hides names', async () => {
      await openMoveWith(
        [statement('s-1', 0, {
          actor: MASKED,
          context: { platform: 'blueprint', contextActivities: { grouping: [{ id: 'https://blueprint.example/move/1' }] } },
        })],
        { hideNames: true },
      );

      expect(rowsShown()).toEqual([['', 'Name hidden', '']]);
    });

    /**
     * Verifies: an actor the API sent with only an email address (as it does for the MSEL's owner) is shown by that address, not as a team member.
     * Interacts with: MselStore (hideNamesOnAssessorView set), getActorLabel, agentName.
     * Data: MSEL hides names; one Blue statement whose actor is mailto:pat@example.com.
     */
    it('shows the email address the API sent on a MSEL that hides names', async () => {
      await openMoveWith([statement('s-1', 0, { actor: { objectType: 'Agent', mbox: 'mailto:pat@example.com' } })], { hideNames: true });

      expect(rowsShown()).toEqual([['', 'pat@example.com', 'Blue Team']]);
    });

    /**
     * Verifies: a Group actor with no name is Unknown, not one team member, since the API never strips a group's own identity.
     * Interacts with: MselStore (hideNamesOnAssessorView set), getActorLabel, isAnonymousActor.
     * Data: MSEL hides names; one Blue statement whose actor is a Group with no name.
     */
    it('calls a group actor with no name Unknown when the MSEL hides names', async () => {
      await openMoveWith([statement('s-1', 0, { actor: { objectType: 'Group' } })], { hideNames: true });

      expect(rowsShown()).toEqual([['', 'Unknown', 'Blue Team']]);
    });

    /**
     * Verifies: a statement about a person whose identity the API removed shows Name hidden in the object column, and a named one shows the name.
     * Interacts with: MselStore (hideNamesOnAssessorView set), getObjectLabel, isAnonymousAgentObject.
     * Data: MSEL hides names; grouping Off; two Blue statements whose objects are an Agent with only objectType, then Ann Analyst.
     */
    it('shows a person a statement is about as a hidden name', async () => {
      localStorage.setItem('uiState', JSON.stringify({ statementGrouping: 'off' }));
      await openMoveWith(
        [statement('s-1', 0, { object: undefined }), statement('s-2', 1, { object: undefined })].map((stmt, i) => ({
          ...stmt,
          object: i === 0 ? MASKED : ANN,
        })),
        { hideNames: true },
      );

      expect(Array.from(document.querySelectorAll('.stmt-object'), (e) => e.textContent)).toEqual(['Name hidden', 'Ann Analyst']);
    });

    /**
     * Verifies: actors whose account has a homePage but no name are not told apart, so User grouping is not offered for them.
     * Interacts with: Group by mat-select options, hasAgentIdentity, agentIdentityKey.
     * Data: MSEL shows names; three Blue statements whose actors carry only account.homePage https://lrs.example.
     */
    it('does not offer User grouping for accounts with no name', async () => {
      const { user } = await openMoveWith(
        [0, 1, 2].map((m) => statement(`s-${m}`, m, { actor: { objectType: 'Agent', account: { homePage: 'https://lrs.example' } } })),
      );

      await user.click(screen.getByRole('combobox', { name: 'Group by' }));
      expect((await screen.findAllByRole('option')).map((o) => o.textContent.trim())).toEqual(['Team', 'Off']);
    });

    /** The preview beside an opened statement's actor section ('{...}' when it has none). */
    const actorPreview = () =>
      Array.from(document.querySelectorAll('.json-section'))
        .find((section) => section.querySelector('.json-key')?.textContent === '"actor"')
        ?.querySelector('.json-preview')?.textContent;

    /**
     * Verifies: on a MSEL that shows names, an opened statement whose actor has no identity previews its actor section as {...}, as before, not as Unknown.
     * Interacts with: toggleStatement (row clicked), getStatementSections.
     * Data: MSEL shows names; one Blue statement whose actor carries only objectType Agent.
     */
    it('previews an actor with no name as {...} when the MSEL shows names', async () => {
      const { user } = await openMoveWith([statement('s-1', 0, { actor: MASKED })]);

      await user.click(screen.getByText('Unknown'));

      expect(actorPreview()).toBe('{...}');
    });

    describe('when the MSEL starts hiding names', () => {
      const statements = () => TestBed.inject(HttpTestingController);
      const hideNames = () => TestBed.inject(MselStore).update('msel-1', { hideNamesOnAssessorView: true });
      const isFullRead = (req: { url: string; params: { get(name: string): string | null; has(name: string): boolean } }) =>
        req.url === '/api/xapi/statements' && req.params.get('mselId') === 'msel-1' && !req.params.has('since');

      /**
       * Verifies: hiding names on an open Assessor View reads every statement again, so the names already on screen, in the rows and an opened statement's preview, are replaced by what the API now sends.
       * Interacts with: MselStore update (as a MselUpdated broadcast does), reloadStatements, HttpClient GET api/xapi/statements without since (HttpTestingController), getStatementSections.
       * Data: MSEL shows names; one Blue statement by Ann Analyst, opened; the MSEL then hides names and the API sends it back masked.
       */
      it('reads the statements again without the names', async () => {
        const { fixture, user } = await openMoveWith([statement('s-1', 0)]);
        await user.click(screen.getByText('Ann Analyst'));
        expect(actorPreview()).toBe('Ann Analyst');

        hideNames();
        statements().expectOne(isFullRead).flush({ statements: [statement('s-1', 0, { actor: MASKED })] });
        fixture.detectChanges();

        expect(rowsShown()).toEqual([['', 'Team member', 'Blue Team']]);
        expect(screen.queryByText('Ann Analyst')).not.toBeInTheDocument();
        // The statement stays open, and its preview is rebuilt from the masked statement.
        expect(actorPreview()).toBe('Team member');
      });

      /**
       * Verifies: a refresh under way when names are hidden is dropped, since the API answered it with the names, and every statement is read again.
       * Interacts with: refreshStatements (Refresh evidence clicked), MselStore update, restartStatementsIfStale, HttpTestingController.
       * Data: MSEL shows names; one Blue statement by Ann Analyst; Refresh is clicked, the MSEL hides names, then the refresh answers with a newer Bo Builder statement.
       */
      it('drops a refresh that was under way and reads again', async () => {
        const { fixture, user } = await openMoveWith([statement('s-1', 0)]);
        await user.click(screen.getAllByRole('button', { name: 'Refresh evidence' })[0]);
        const refresh = statements().expectOne((req) => req.url === '/api/xapi/statements' && req.params.has('since'));

        hideNames();
        refresh.flush({ statements: [statement('s-2', 1, { actor: BO })] });
        statements()
          .expectOne(isFullRead)
          .flush({ statements: [statement('s-1', 0, { actor: MASKED }), statement('s-2', 1, { actor: MASKED })] });
        fixture.detectChanges();

        expect(rowsShown()).toEqual([['×2', 'Names hidden', 'Blue Team']]);
        expect(screen.queryByText(/Ann Analyst|Bo Builder/)).not.toBeInTheDocument();
      });
    });

    /**
     * Verifies: competency assertions and CITE submitted and evaluated statements always keep their own rows, while the same verb from another app still groups.
     * Interacts with: isNeverGrouped, getSectionStatementList.
     * Data: two identical Blueprint asserted statements, two CITE submitted, two CITE evaluated (none with a score), and two Gallery submitted.
     */
    it('never groups assertions or CITE submissions and scores', async () => {
      await openMoveWith([
        statement('s-assert-1', 0, { platform: 'blueprint', verb: 'https://w3id.org/xapi/tla/verbs/asserted' }),
        statement('s-assert-2', 1, { platform: 'blueprint', verb: 'https://w3id.org/xapi/tla/verbs/asserted' }),
        statement('s-submit-1', 2, { platform: 'cite', verb: 'https://w3id.org/xapi/dod-isd/verbs/submitted' }),
        statement('s-submit-2', 3, { platform: 'cite', verb: 'https://w3id.org/xapi/dod-isd/verbs/submitted' }),
        statement('s-eval-1', 4, { platform: 'cite', verb: 'https://w3id.org/xapi/dod-isd/verbs/evaluated' }),
        statement('s-eval-2', 5, { platform: 'cite', verb: 'https://w3id.org/xapi/dod-isd/verbs/evaluated' }),
        statement('s-gallery-1', 6, { verb: 'https://w3id.org/xapi/dod-isd/verbs/submitted' }),
        statement('s-gallery-2', 7, { verb: 'https://w3id.org/xapi/dod-isd/verbs/submitted' }),
      ]);

      expect(rowsShown().map(([count]) => count)).toEqual(['', '', '', '', '', '', '×2']);
    });

    /**
     * Verifies: statements with different results never merge, statements with the same result do, and a scored statement is always its own row.
     * Interacts with: statementGroupKey (result part), isNeverGrouped (score rule).
     * Data: Blue answers one question: success true, success false, success true again, and two identical score 5 results.
     */
    it('does not merge statements with different results', async () => {
      const answered = 'http://adlnet.gov/expapi/verbs/answered';
      await openMoveWith([
        statement('s-right-1', 0, { verb: answered, result: { success: true, response: 'A' } }),
        statement('s-wrong', 1, { verb: answered, result: { success: false, response: 'B' } }),
        statement('s-right-2', 2, { verb: answered, result: { success: true, response: 'A' } }),
        statement('s-score-1', 3, { verb: answered, result: { score: { raw: 5 } } }),
        statement('s-score-2', 4, { verb: answered, result: { score: { raw: 5 } } }),
      ]);

      expect(rowsShown().map(([count]) => count)).toEqual(['', '×2', '', '']);
    });

    /**
     * Verifies: clicking a group lists its statements in time order under it, each still shows its JSON and copies it; clicking again collapses it.
     * Interacts with: toggleStatementGroup, toggleStatement, copyStatement, navigator.clipboard.writeText (spy).
     * Data: Ann, Bo and Cy view one article for Blue.
     */
    it('expands a group to its statements, which still copy their JSON', async () => {
      const statements = REPEATS().slice(0, 3);
      const { fixture, user } = await openMoveWith(statements);
      const writes: string[] = [];
      vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({
        writeText: (text: string) => {
          writes.push(text);
          return Promise.resolve();
        },
      } satisfies Pick<Clipboard, 'writeText'> as Clipboard);
      const group = screen.getByRole('button', { name: /^×3/ });
      expect(group).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: 'Copy JSON' })).not.toBeInTheDocument();

      await user.click(group);
      fixture.detectChanges();

      expect(group).toHaveAttribute('aria-expanded', 'true');
      expect(rowsShown()).toEqual([
        ['×3', 'Ann Analyst + 2 others', 'Blue Team'],
        ['', 'Ann Analyst', 'Blue Team'],
        ['', 'Bo Builder', 'Blue Team'],
        ['', 'Cy Cipher', 'Blue Team'],
      ]);
      await user.click(screen.getAllByRole('button', { name: 'Copy JSON' })[1]);
      expect(writes).toEqual([JSON.stringify(statements[1], null, 2)]);
      await user.click(screen.getByText('Bo Builder'));
      fixture.detectChanges();
      expect(screen.getByText('"actor"')).toBeInTheDocument();

      await user.click(group);
      fixture.detectChanges();
      expect(rowsShown()).toEqual([['×3', 'Ann Analyst + 2 others', 'Blue Team']]);
    });

    /**
     * Verifies: the Group by choice is saved in the browser's UI state.
     * Interacts with: setStatementGrouping, UIDataService (real, localStorage).
     * Data: the five repeats; Off is chosen.
     */
    it('remembers the choice in localStorage', async () => {
      const { fixture, user } = await openMoveWith(REPEATS());

      await chooseGrouping(fixture, user, 'Off');

      expect(JSON.parse(localStorage.getItem('uiState')).statementGrouping).toBe('off');
    });

    /**
     * Verifies: a choice saved in an earlier visit is restored.
     * Interacts with: UIDataService.getStatementGrouping (real, localStorage), statementGrouping.
     * Data: saved Off; the five repeats.
     */
    it('restores the saved choice', async () => {
      localStorage.setItem('uiState', JSON.stringify({ statementGrouping: 'off' }));
      await openMoveWith(REPEATS());
      expect(screen.getByRole('combobox', { name: 'Group by' })).toHaveTextContent('Off');
      expect(rowsShown()).toHaveLength(5);
    });

    /**
     * Verifies: a saved User falls back to Team when the statements carry no names, and what was saved is kept.
     * Interacts with: UIDataService.getStatementGrouping (real, localStorage), statementGrouping.
     * Data: saved User; MSEL hides names; three masked Blue statements on one article.
     */
    it('falls back from a saved User to Team when names are hidden', async () => {
      localStorage.setItem('uiState', JSON.stringify({ statementGrouping: 'user' }));
      await openMoveWith(
        [0, 1, 2].map((m) => statement(`s-${m}`, m, { actor: MASKED })),
        { hideNames: true },
      );

      expect(screen.getByRole('combobox', { name: 'Group by' })).toHaveTextContent('Team');
      expect(rowsShown()).toEqual([['×3', 'Names hidden', 'Blue Team']]);
      expect(JSON.parse(localStorage.getItem('uiState')).statementGrouping).toBe('user');
    });

    /**
     * Verifies: a range that ends on another day shows the end's full date.
     * Interacts with: buildStatementGroups, formatRangeEnd.
     * Data: TZ America/New_York; Ann views the article for Blue at 12:00 EDT on 20 Oct and at 09:00 EDT on 21 Oct.
     */
    it('dates the end of a range that ends on another day', async () => {
      await openMoveWith([statement('s-1', 0), statement('s-2', 0, { timestamp: '2026-10-21T13:00:00Z' })]);

      const range = screen.getByRole('button', { name: /^×2/ }).querySelector('.statement-time-range');
      expect(Array.from(range.children, (line) => line.textContent.trim())).toEqual(['20 Oct 2026 12:00 EDT', '– 21 Oct 2026 09:00 EDT']);
    });

    /**
     * Verifies: an inject's repeats from different groups stay apart, so each row's G column is true of all its statements.
     * Interacts with: statementGroupKey (move, group and inject parts), getGroupPart, toggleEvent (event row clicked).
     * Data: Blue views the same article for inject se-1 twice in group 1 and once in group 2; all three are routed to se-1.
     */
    it('keeps an inject\'s repeats from different groups apart', async () => {
      const inGroup = (group: number) => ({
        platform: 'gallery',
        team: { objectType: 'Group', name: BLUE.name, account: { homePage: 'https://blueprint.example', name: BLUE.id } },
        contextActivities: {
          grouping: [{ id: 'https://blueprint.example/scenarioevents/se-1' }, { id: `https://blueprint.example/group/${group}` }],
        },
      });
      const { fixture, user } = await openMoveWith([
        statement('s-g1-a', 0, { context: inGroup(1) }),
        statement('s-g1-b', 1, { context: inGroup(1) }),
        statement('s-g2', 2, { context: inGroup(2) }),
      ]);

      await user.click(screen.getByTitle('Click to expand/collapse'));
      fixture.detectChanges();

      expect(rowsShown().map(([count]) => count)).toEqual(['×2', '']);
      expect(Array.from(document.querySelectorAll('.stmt-group'), (e) => e.textContent)).toEqual(['G1', 'G2']);
    });

    /**
     * Verifies: opening a group rebuilds only its own section's rows, and a MSEL change that does not touch names does not rebuild the lists.
     * Interacts with: getSectionStatementList (cache), toggleStatementGroup, MselStore update (the MSEL subscription replaces this.msel).
     * Data: the five repeats in Move 1; the MSEL is renamed; the ×4 group is opened.
     */
    it('rebuilds only the section whose group was opened', async () => {
      const { fixture, user } = await openMoveWith(REPEATS());
      const view = fixture.componentInstance as AssessorViewComponent;
      const move = view.getSectionStatementList('move-1');
      const { filtered, items } = move;
      const eventItems = view.getSectionStatementList('event-se-1').items;

      TestBed.inject(MselStore).update('msel-1', { name: 'Exercise Alpha, renamed' });
      fixture.detectChanges();
      expect(view.getSectionStatementList('move-1').filtered).toBe(filtered);

      await user.click(screen.getByRole('button', { name: /^×4/ }));
      fixture.detectChanges();
      expect(view.getSectionStatementList('move-1').items).not.toBe(items);
      expect(view.getSectionStatementList('event-se-1').items).toBe(eventItems);
    });

    /**
     * Verifies: the Team and Verb filters narrow the statements before they are grouped, so a group counts only what passes.
     * Interacts with: evidence Team and Verb mat-selects (filterByTeams, filterByVerbs), getStatementList cache.
     * Data: Ann and Bo view the article for Blue and Bo also launches it; Rex views it for Red.
     */
    it('applies the filters before grouping', async () => {
      const { fixture, user } = await openMoveWith([
        statement('s-ann', 0),
        statement('s-bo', 1, { actor: BO }),
        statement('s-bo-launch', 2, { actor: BO, verb: 'http://adlnet.gov/expapi/verbs/launched' }),
        statement('s-rex', 3, { actor: REX, team: RED }),
        statement('s-rex-2', 4, { actor: REX, team: RED }),
      ]);
      expect(rowsShown()).toEqual([
        ['×2', 'Ann Analyst + 1 other', 'Blue Team'],
        ['', 'Bo Builder', 'Blue Team'],
        ['×2', 'Rex Raider', 'Red Team'],
      ]);

      await user.click(screen.getByRole('combobox', { name: 'Team' }));
      await user.click(await screen.findByRole('option', { name: 'Blue' }));
      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('combobox', { name: 'Verb' }));
      await user.click(await screen.findByRole('option', { name: 'viewed' }));
      await user.keyboard('{Escape}');
      fixture.detectChanges();

      expect(screen.getByText('2 / 5')).toBeInTheDocument();
      expect(rowsShown()).toEqual([['×2', 'Ann Analyst + 1 other', 'Blue Team']]);
    });
  });

  describe('an opened move', () => {
    // Move 1 holds se-1, tagged with competency T0001; Blue and EXCON are both assigned T0001.
    const ASSESSABLE = {
      moves: [MOVE_1],
      fields: ASSESSABLE_FIELDS,
      values: ASSESSABLE_VALUES,
      teams: [BLUE, EXCON],
      mselCompetencies: T0001,
      teamCompetencies: [
        { id: 'tc-1', teamId: 'team-blue', competencyId: 'comp-1' },
        { id: 'tc-2', teamId: 'team-excon', competencyId: 'comp-1' },
      ],
    };

    /** Toggles one team in the evidence Team filter (a multiple select) and closes it. */
    async function toggleTeamFilter(fixture: ComponentFixture<unknown>, user: ReturnType<typeof userEvent.setup>, team: string) {
      await user.click(screen.getByRole('combobox', { name: 'Team' }));
      await user.click(await screen.findByRole('option', { name: team }));
      await user.keyboard('{Escape}');
      fixture.detectChanges();
    }

    async function pickAssessTeam(fixture: ComponentFixture<unknown>, user: ReturnType<typeof userEvent.setup>, team: string) {
      await user.click(assessTeam());
      await user.click(await screen.findByRole('option', { name: team }));
      fixture.detectChanges();
    }

    const assessTeam = () => screen.getByRole('combobox', { name: 'Assess Team' });

    describe('Assess Team', () => {
      /**
       * Verifies: a Team filter of exactly one team, set before the move is opened, is preselected in Assess Team.
       * Interacts with: filterByTeams (called before the row opens, as an earlier opening of the row leaves it), toggleMoveExpand (move header clicked), Assess Team mat-select.
       * Data: Move 1 with competency T0001 assigned to Blue and EXCON; the move's Team filter is EXCON.
       */
      it('preselects the one team the evidence was filtered to before the move opened', async () => {
        const { fixture } = await renderAssessorView(ASSESSABLE);
        fixture.componentInstance.filterByTeams('move-1', ['team-excon']);

        await openMove(fixture);

        expect(assessTeam()).toHaveTextContent('EXCON');
      });

      /**
       * Verifies: while the Team filter of an open move names exactly one team, Assess Team shows that team; when it names two or none, the team it chose is cleared.
       * Interacts with: toggleMoveExpand (move header clicked), evidence Team mat-select (filterByTeams), Assess Team mat-select.
       * Data: Move 1 with competency T0001 assigned to Blue and EXCON; the filter goes Blue, Blue + EXCON, EXCON, then none.
       */
      it('follows the Team filter while it names one team, and clears when it does not', async () => {
        const { fixture } = await renderAssessorView(ASSESSABLE);
        const user = await openMove(fixture);
        expect(assessTeam()).toHaveTextContent('None');

        await toggleTeamFilter(fixture, user, 'Blue');
        expect(assessTeam()).toHaveTextContent('Blue');

        await toggleTeamFilter(fixture, user, 'EXCON');
        expect(assessTeam()).toHaveTextContent('None');

        await toggleTeamFilter(fixture, user, 'Blue');
        expect(assessTeam()).toHaveTextContent('EXCON');

        await toggleTeamFilter(fixture, user, 'EXCON');
        expect(assessTeam()).toHaveTextContent('None');
      });

      /**
       * Verifies: a team chosen from the filter is cleared when the filter moves to one team that Assess Team does not offer.
       * Interacts with: filterByTeams (evidence Team mat-select, then called with Red alone), getTeamsForContext.
       * Data: Move 1 with T0001 assigned to Blue and EXCON only; Red has no competency, so Assess Team does not offer it.
       */
      it('clears a chosen team when the filter moves to a team Assess Team does not offer', async () => {
        const { fixture } = await renderAssessorView({ ...ASSESSABLE, teams: [BLUE, EXCON, RED] });
        const user = await openMove(fixture);
        await toggleTeamFilter(fixture, user, 'Blue');
        expect(assessTeam()).toHaveTextContent('Blue');

        fixture.componentInstance.filterByTeams('move-1', ['team-red']);
        fixture.detectChanges();

        expect(assessTeam()).toHaveTextContent('None');
      });

      /**
       * Verifies: a team the user picked in Assess Team is kept when the Team filter later narrows to a different team.
       * Interacts with: toggleMoveExpand (move header clicked), Assess Team mat-select (setAssertionTeam), evidence Team mat-select (filterByTeams).
       * Data: Move 1 with competency T0001 assigned to Blue and EXCON; Blue is picked by hand, then the filter is set to EXCON.
       */
      it('keeps a team picked by hand when the Team filter changes', async () => {
        const { fixture } = await renderAssessorView(ASSESSABLE);
        const user = await openMove(fixture);

        await pickAssessTeam(fixture, user, 'Blue');
        await toggleTeamFilter(fixture, user, 'EXCON');

        expect(assessTeam()).toHaveTextContent('Blue');
      });

      /**
       * Verifies: once a rating is started under a team the filter chose, a later filter change keeps that team, so the unsubmitted comment stays on screen.
       * Interacts with: evidence Team mat-select (filterByTeams), Comment textarea (setRatingComment), getRating.
       * Data: Move 1 with T0001 assigned to Blue and EXCON; the filter chooses Blue, a comment is typed, then the filter goes to EXCON.
       */
      it('keeps the team a rating was started for when the Team filter changes', async () => {
        const { fixture } = await renderAssessorView(ASSESSABLE);
        const user = await openMove(fixture);
        await toggleTeamFilter(fixture, user, 'Blue');

        await user.type(screen.getByRole('textbox', { name: 'Comment' }), 'Phished twice');
        await toggleTeamFilter(fixture, user, 'Blue');
        await toggleTeamFilter(fixture, user, 'EXCON');

        expect(assessTeam()).toHaveTextContent('Blue');
        expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveValue('Phished twice');
      });

      /**
       * Verifies: a team picked by hand on one MSEL does not carry over to the same move of another MSEL, so the filter preselects there again.
       * Interacts with: Assess Team mat-select (setAssertionTeam), MselStore active MSEL (resetAssertionTeams), evidence Team mat-select (filterByTeams).
       * Data: Blue picked by hand on Move 1 of msel-1; the active MSEL goes to msel-2 and back; the filter is then set to EXCON.
       */
      it('forgets the teams picked on a MSEL when another MSEL is opened', async () => {
        const { fixture } = await renderAssessorView(ASSESSABLE);
        const user = await openMove(fixture);
        await pickAssessTeam(fixture, user, 'Blue');

        const mselStore = TestBed.inject(MselStore);
        mselStore.add({ ...MSEL, id: 'msel-2', name: 'Exercise Bravo' });
        mselStore.setActive('msel-2');
        mselStore.setActive('msel-1');
        fixture.detectChanges();

        expect(assessTeam()).toHaveTextContent('None');
        await toggleTeamFilter(fixture, user, 'EXCON');
        expect(assessTeam()).toHaveTextContent('EXCON');
      });

      /**
       * Verifies: the filter preselect runs when its inputs change, not on every change detection.
       * Interacts with: preselectAssertionTeam (spied on the prototype), getAssertionTeam (template, ngDoCheck), filterByTeams.
       * Data: Move 1 with T0001 assigned to Blue and EXCON; nothing is chosen, then the filter is set to Blue.
       */
      it('runs the filter preselect only when its inputs change', async () => {
        const { fixture } = await renderAssessorView(ASSESSABLE);
        const user = await openMove(fixture);
        const preselect = vi.spyOn(
          AssessorViewComponent.prototype as unknown as { preselectAssertionTeam: (contextKey: string, filterChanged?: boolean) => void },
          'preselectAssertionTeam',
        );

        fixture.detectChanges();
        fixture.detectChanges();
        expect(preselect).not.toHaveBeenCalled();

        await toggleTeamFilter(fixture, user, 'Blue');
        expect(preselect).toHaveBeenCalledWith('move-1', true);
        preselect.mockRestore();
      });

      describe('with assertions already submitted', () => {
        const PROFICIENT: ProficiencyLevel = { id: 'level-3', name: 'Proficient', value: 3, displayOrder: 3 };
        const SUBMITTED = {
          ...ASSESSABLE,
          // A competency with a framework, so the component loads the framework's proficiency scale.
          mselCompetencies: [{ ...T0001[0], competency: { ...T0001[0].competency, competencyFrameworkId: 'framework-1' } }],
          proficiencyLevels: [PROFICIENT],
        };
        /** Another assessor's assertion that Blue is Proficient at T0001 in Move 1. */
        const BLUE_ASSERTION = {
          id: 's-assert',
          timestamp: '2026-10-20T16:00:00Z',
          actor: { name: 'Another Assessor' },
          verb: { id: 'https://w3id.org/xapi/tla/verbs/asserted' },
          object: {
            id: 'https://blueprint.example/competencies/comp-1',
            definition: { type: 'https://w3id.org/xapi/tla/activity-types/competency' },
          },
          result: { score: { raw: 3 }, response: 'Clicked nothing' },
          context: {
            platform: 'blueprint',
            team: { name: 'Blue Team', account: { name: 'team-blue' } },
            contextActivities: { grouping: [{ id: 'https://blueprint.example/msels/msel-1/moves/1' }] },
          },
        };

        /**
         * Verifies: with no team chosen, Assess Team shows the team of an assertion already submitted, with its rating.
         * Interacts with: syncAssertionsFromStatements (on load), CompetencyFrameworkService / ProficiencyScaleService (stubs), Assess Team and Rating mat-selects.
         * Data: Move 1's statements hold Blue's T0001 assertion at Proficient (3).
         */
        it('shows the team and rating of a submitted assertion when no team was chosen', async () => {
          const { fixture } = await renderAssessorView(SUBMITTED);

          await openMove(fixture, [BLUE_ASSERTION]);

          expect(assessTeam()).toHaveTextContent('Blue');
          expect(screen.getByRole('combobox', { name: 'Rating' })).toHaveTextContent('Proficient (3)');
          expect(screen.getByText('Submitted')).toBeInTheDocument();
        });

        /**
         * Verifies: a team picked by hand, or chosen by the Team filter, is kept when Refresh evidence brings in another team's assertion.
         * Interacts with: Refresh evidence (refreshStatements → distributeStatements → syncAssertionsFromStatements), Assess Team mat-select, filterByTeams.
         * Data: EXCON picked by hand, or the filter set to EXCON; the refresh returns Blue's T0001 assertion.
         */
        it.each([
          ['picked by hand', (fixture: ComponentFixture<unknown>, user: ReturnType<typeof userEvent.setup>) => pickAssessTeam(fixture, user, 'EXCON')],
          ['chosen by the filter', (fixture: ComponentFixture<unknown>, user: ReturnType<typeof userEvent.setup>) => toggleTeamFilter(fixture, user, 'EXCON')],
        ])('keeps a team %s when Refresh evidence brings another team\'s assertion', async (_, choose) => {
          const { fixture } = await renderAssessorView(SUBMITTED);
          const user = await openMove(fixture);
          await choose(fixture, user);

          await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
          TestBed.inject(HttpTestingController)
            .expectOne((req) => req.url === '/api/xapi/statements')
            .flush({ statements: [BLUE_ASSERTION] });
          fixture.detectChanges();

          expect(assessTeam()).toHaveTextContent('EXCON');
          expect(screen.queryByText('Submitted')).not.toBeInTheDocument();
        });
      });
    });

    /**
     * Verifies: the Refresh evidence button is named and described for what it reloads, and reloads the MSEL's xAPI statements.
     * Interacts with: refreshStatements (button clicked), MatTooltip description, HttpClient GET api/xapi/statements (HttpTestingController).
     * Data: Move 1 opened with no statements yet, on a MSEL that does not use CITE.
     */
    it('reloads the statements with Refresh evidence', async () => {
      const { fixture } = await renderAssessorView(ASSESSABLE);
      const user = await openMove(fixture);
      const refresh = screen.getByRole('button', { name: 'Refresh evidence' });

      expect(refresh).toHaveAccessibleDescription('Reload the xAPI statements');
      await user.click(refresh);

      TestBed.inject(HttpTestingController)
        .expectOne((req) => req.url === '/api/xapi/statements' && req.params.get('mselId') === 'msel-1')
        .flush({ statements: [] });
      expect(screen.queryByRole('button', { name: 'Refresh xAPI statements' })).not.toBeInTheDocument();
    });

    /**
     * Verifies: each competency card puts its id beside its submit control, and its Rating beside a Comment that grows as it is typed in.
     * Interacts with: toggleMoveExpand (move header clicked), the rating card layout containers, CdkTextareaAutosize.
     * Data: Move 1 with competency T0001.
     */
    it('lays out each competency card in two rows', async () => {
      const { fixture } = await renderAssessorView(ASSESSABLE);
      await openMove(fixture);

      const header = screen.getByText('T0001').closest('.rating-card-header');
      expect(header).toContainElement(screen.getByRole('button', { name: 'Submit assertion' }));
      const fields = screen.getByRole('combobox', { name: 'Rating' }).closest('.rating-fields');
      const comment = screen.getByRole('textbox', { name: 'Comment' });
      expect(fields).toContainElement(comment);
      expect(comment.tagName).toBe('TEXTAREA');
      expect(fixture.debugElement.query(By.directive(CdkTextareaAutosize)).nativeElement).toBe(comment);
    });
  });

  describe('Team Responses', () => {
    const ANSWERED: CiteTeamResponses = {
      mselId: 'msel-1', teamId: 'team-blue', moveNumber: 1, status: CiteTeamResponsesStatus.Answered,
      teamSubmission: { score: 7.5, isAverage: false, categories: [] },
    };
    /** Each call to CiteService.getMselCiteTeamResponses, answered when the test says. */
    let calls: Subject<CiteTeamResponses>[];
    const teamResponses = () => {
      const call = new Subject<CiteTeamResponses>();
      calls.push(call);
      return call;
    };
    const answer = (call: Subject<CiteTeamResponses>, responses: CiteTeamResponses) => {
      call.next(responses);
      call.complete();
    };
    const assessable = (msel: Msel) => ({
      msel,
      moves: [MOVE_1],
      fields: ASSESSABLE_FIELDS,
      values: ASSESSABLE_VALUES,
      teams: [BLUE],
      mselCompetencies: T0001,
      teamCompetencies: [{ id: 'tc-1', teamId: 'team-blue', competencyId: 'comp-1' }],
      teamResponses,
    });
    const panel = (fixture: ComponentFixture<unknown>) =>
      fixture.debugElement.query(By.directive(TeamResponsesStub))?.componentInstance as TeamResponsesStub | undefined;

    beforeEach(() => {
      calls = [];
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    async function chooseBlue(fixture: ComponentFixture<unknown>, user: ReturnType<typeof userEvent.setup>) {
      await chooseTeam(fixture, user, 'Blue');
    }

    async function chooseTeam(
      fixture: ComponentFixture<unknown>, user: ReturnType<typeof userEvent.setup>, name: string, select = 0,
    ) {
      await user.click(screen.getAllByRole('combobox', { name: 'Assess Team' })[select]);
      await user.click(await screen.findByRole('option', { name }));
      fixture.detectChanges();
    }

    /** Collapses Move 1 and opens it again, as an Evaluator coming back to it. */
    async function reopenMove(fixture: ComponentFixture<unknown>, user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByText('Move 1'));
      fixture.detectChanges();
      await user.click(screen.getByText('Move 1'));
      fixture.detectChanges();
    }

    /**
     * Verifies: an opened move shows the Team Responses panel beside Competency Assessment, prompting for a team until one is chosen in Assess Team, then loading and showing that team's answers for the move.
     * Interacts with: toggleMoveExpand (move header clicked), Assess Team mat-select, CiteService.getMselCiteTeamResponses (stub, answered by a Subject), TeamResponsesStub inputs.
     * Data: MSEL uses CITE; Move 1 holds se-1 tagged with competency T0001, assigned to Blue; CITE answers Answered with a score of 7.5.
     */
    it('loads the answers of the team chosen in Assess Team', async () => {
      const { fixture, citeApi } = await renderAssessorView(assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }));
      const user = await openMove(fixture);

      expect(panel(fixture).prompt()).toBe('Choose a team in Assess Team to see its CITE answers.');
      expect(panel(fixture).responses()).toBeNull();
      expect(citeApi.getMselCiteTeamResponses).not.toHaveBeenCalled();

      await chooseBlue(fixture, user);

      expect(citeApi.getMselCiteTeamResponses).toHaveBeenCalledExactlyOnceWith('msel-1', 1, 'team-blue');
      expect(panel(fixture).loading()).toBe(true);
      expect(panel(fixture).teamName()).toBe('Blue');
      answer(calls[0], ANSWERED);
      fixture.detectChanges();

      expect(panel(fixture).loading()).toBe(false);
      expect(panel(fixture).responses()).toEqual(ANSWERED);
    });

    /**
     * Verifies: on a MSEL using CITE, Refresh evidence says it reloads the CITE answers, and reloads the team answers already shown, alongside the statements.
     * Interacts with: refreshStatements (refresh button), HttpClient GET api/xapi/statements (HttpTestingController), CiteService.getMselCiteTeamResponses (stub).
     * Data: Blue's answers for move 1 loaded once as NotAnswered, then Answered on refresh.
     */
    it('reloads the answers with Refresh evidence', async () => {
      const { fixture, citeApi } = await renderAssessorView(assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }));
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);
      answer(calls[0], { ...ANSWERED, status: CiteTeamResponsesStatus.NotAnswered, teamSubmission: null });
      fixture.detectChanges();

      const refresh = screen.getByRole('button', { name: 'Refresh evidence' });
      expect(refresh).toHaveAccessibleDescription('Reload the xAPI statements and the CITE answers shown');
      await user.click(refresh);
      fixture.detectChanges();

      expect(citeApi.getMselCiteTeamResponses).toHaveBeenCalledTimes(2);
      expect(citeApi.getMselCiteTeamResponses).toHaveBeenLastCalledWith('msel-1', 1, 'team-blue');
      expect(panel(fixture).loading()).toBe(true);
      TestBed.inject(HttpTestingController).expectOne((req) => req.url === '/api/xapi/statements').flush({ statements: [] });
      answer(calls[1], ANSWERED);
      fixture.detectChanges();

      expect(panel(fixture).loading()).toBe(false);
      expect(panel(fixture).responses().status).toBe(CiteTeamResponsesStatus.Answered);
    });

    /**
     * Verifies: a failed load is passed to the panel as an error rather than leaving it loading.
     * Interacts with: CiteService.getMselCiteTeamResponses (stub, errors).
     * Data: Blue chosen for move 1; the request fails.
     */
    it('passes a load failure to the panel', async () => {
      const { fixture } = await renderAssessorView(assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }));
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);

      calls[0].error(new Error('500 Server Error'));
      fixture.detectChanges();

      expect(panel(fixture).loading()).toBe(false);
      expect(panel(fixture).error()).toBe('Team responses could not be loaded.');
    });

    /**
     * Verifies: a MSEL that does not use CITE shows no Team Responses panel and asks for no answers.
     * Interacts with: toggleMoveExpand, Assess Team mat-select, CiteService.getMselCiteTeamResponses (stub).
     * Data: useCite false; otherwise the same assessable move and team.
     */
    it('is not shown for a MSEL that does not use CITE', async () => {
      const { fixture, citeApi } = await renderAssessorView(assessable({ ...MSEL, useCite: false }));
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);

      expect(screen.getByText('Move 1 — Competency Assessment')).toBeInTheDocument();
      expect(panel(fixture)).toBeUndefined();
      expect(citeApi.getMselCiteTeamResponses).not.toHaveBeenCalled();
    });

    /**
     * Verifies: a move CITE had not reached is read again when the move is shown again, so the answers appear once CITE advances.
     * Interacts with: toggleMoveExpand (collapse, expand), ngDoCheck, CiteService.getMselCiteTeamResponses (stub).
     * Data: Blue chosen for move 1; CITE first answers MoveNotStarted, then Answered.
     */
    it('reads a move that had not started again when it is shown again', async () => {
      const { fixture, citeApi } = await renderAssessorView(assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }));
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);
      answer(calls[0], { ...ANSWERED, status: CiteTeamResponsesStatus.MoveNotStarted, teamSubmission: null });
      fixture.detectChanges();

      await reopenMove(fixture, user);

      expect(citeApi.getMselCiteTeamResponses).toHaveBeenCalledTimes(2);
      answer(calls[1], ANSWERED);
      fixture.detectChanges();
      expect(panel(fixture).responses().status).toBe(CiteTeamResponsesStatus.Answered);
    });

    /**
     * Verifies: a failed load is read again when the move is shown again rather than kept.
     * Interacts with: toggleMoveExpand (collapse, expand), CiteService.getMselCiteTeamResponses (stub, errors once).
     * Data: Blue chosen for move 1; the first request fails.
     */
    it('reads a failed load again when it is shown again', async () => {
      const { fixture, citeApi } = await renderAssessorView(assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }));
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);
      calls[0].error(new Error('500 Server Error'));
      fixture.detectChanges();

      await reopenMove(fixture, user);

      expect(citeApi.getMselCiteTeamResponses).toHaveBeenCalledTimes(2);
      expect(panel(fixture).error()).toBeNull();
      expect(panel(fixture).loading()).toBe(true);
    });

    /**
     * Verifies: answers stay fresh for TEAM_RESPONSES_STALE_MS, then are read again when shown, with the previous answers on screen while they load.
     * Interacts with: toggleMoveExpand (collapse, expand), Date.now (spied), CiteService.getMselCiteTeamResponses (stub).
     * Data: Blue's Answered result for move 1; the move reopened just inside, then just past, the window.
     */
    it('keeps answers fresh for a while, then reads them again when shown', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const { fixture, citeApi } = await renderAssessorView(assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }));
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);
      answer(calls[0], ANSWERED);
      fixture.detectChanges();

      now.mockReturnValue(1_000_000 + TEAM_RESPONSES_STALE_MS);
      await reopenMove(fixture, user);
      expect(citeApi.getMselCiteTeamResponses).toHaveBeenCalledTimes(1);

      now.mockReturnValue(1_000_001 + TEAM_RESPONSES_STALE_MS);
      await reopenMove(fixture, user);
      expect(citeApi.getMselCiteTeamResponses).toHaveBeenCalledTimes(2);
      expect(panel(fixture).loading()).toBe(true);
      expect(panel(fixture).responses()).toEqual(ANSWERED);
    });

    /**
     * Verifies: an open panel left alone is not read again on a timer, but coming back to the browser tab re-reads it once stale.
     * Interacts with: document visibilitychange, CiteService.getMselCiteTeamResponses (stub).
     * Data: Blue chosen for move 1; CITE answers MoveNotStarted.
     */
    it('reads stale answers on screen again when the tab is shown', async () => {
      const { fixture, citeApi } = await renderAssessorView(assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }));
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);
      answer(calls[0], { ...ANSWERED, status: CiteTeamResponsesStatus.MoveNotStarted, teamSubmission: null });
      fixture.detectChanges();
      fixture.detectChanges();
      expect(citeApi.getMselCiteTeamResponses).toHaveBeenCalledTimes(1);

      document.dispatchEvent(new Event('visibilitychange'));
      fixture.detectChanges();

      expect(citeApi.getMselCiteTeamResponses).toHaveBeenCalledTimes(2);
    });

    /**
     * Verifies: Refresh reloads only the answers on screen, and drops the others so they load fresh when shown again.
     * Interacts with: refreshStatements (refresh button), Assess Team mat-select, CiteService.getMselCiteTeamResponses (stub).
     * Data: Blue's answers for move 1 loaded, then Red chosen instead; both teams assigned the move's competency.
     */
    it('refreshes only the answers on screen', async () => {
      const { fixture, citeApi } = await renderAssessorView({
        ...assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }),
        teams: [BLUE, RED],
        teamCompetencies: [
          { id: 'tc-1', teamId: 'team-blue', competencyId: 'comp-1' },
          { id: 'tc-2', teamId: 'team-red', competencyId: 'comp-1' },
        ],
      });
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);
      answer(calls[0], ANSWERED);
      await chooseTeam(fixture, user, 'Red');
      answer(calls[1], { ...ANSWERED, teamId: 'team-red' });
      fixture.detectChanges();

      await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
      TestBed.inject(HttpTestingController).expectOne((req) => req.url === '/api/xapi/statements').flush({ statements: [] });
      fixture.detectChanges();

      expect(citeApi.getMselCiteTeamResponses).toHaveBeenCalledTimes(3);
      expect(citeApi.getMselCiteTeamResponses).toHaveBeenLastCalledWith('msel-1', 1, 'team-red');

      await chooseBlue(fixture, user);
      expect(citeApi.getMselCiteTeamResponses).toHaveBeenCalledTimes(4);
      expect(citeApi.getMselCiteTeamResponses).toHaveBeenLastCalledWith('msel-1', 1, 'team-blue');
      expect(panel(fixture).responses()).toBeNull();
    });

    /**
     * Verifies: a move panel and an event panel for the same team and move share one read.
     * Interacts with: toggleMoveExpand, toggleEvent, both Assess Team mat-selects, CiteService.getMselCiteTeamResponses (stub).
     * Data: Blue chosen on Move 1 and on its event se-1.
     */
    it('reads a team and move once for every panel showing it', async () => {
      const { fixture, citeApi } = await renderAssessorView(assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }));
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);
      answer(calls[0], ANSWERED);
      await user.click(screen.getByTitle('Click to expand/collapse'));
      fixture.detectChanges();
      await chooseTeam(fixture, user, 'Blue', 1);

      expect(citeApi.getMselCiteTeamResponses).toHaveBeenCalledTimes(1);
      const panels = fixture.debugElement.queryAll(By.directive(TeamResponsesStub))
        .map(d => d.componentInstance as TeamResponsesStub);
      expect(panels).toHaveLength(2);
      expect(panels.map(p => p.responses())).toEqual([ANSWERED, ANSWERED]);
    });

    /**
     * Verifies: leaving the Assessor View cancels a read still in flight.
     * Interacts with: ngOnDestroy, CiteService.getMselCiteTeamResponses (stub).
     * Data: Blue chosen for move 1; CITE has not answered yet.
     */
    it('cancels a read in flight when the view is left', async () => {
      const { fixture } = await renderAssessorView(assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }));
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);
      expect(calls[0].observed).toBe(true);

      fixture.destroy();

      expect(calls[0].observed).toBe(false);
    });
  });
});
