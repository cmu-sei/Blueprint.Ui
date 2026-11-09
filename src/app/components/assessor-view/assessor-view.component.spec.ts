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
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, of, Subject } from 'rxjs';
import {
  CiteService,
  CiteTeamResponses,
  CiteTeamResponsesStatus,
  DataField,
  DataFieldType,
  DataValue,
  EventType,
  Move,
  Msel,
  MselCompetency,
  MselCompetencyService,
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
import { AssessorViewComponent } from './assessor-view.component';
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
    teams?: Team[];
    mselCompetencies?: MselCompetency[];
    teamCompetencies?: TeamCompetency[];
    teamResponses?: (mselId: string, moveNumber: number, teamId: string) => Observable<CiteTeamResponses>;
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
    teams = [],
    mselCompetencies = [],
    teamCompetencies = [],
    teamResponses = () => of<CiteTeamResponses>({}),
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
      seeded(ScenarioEventStore, [EVENT]),
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

  describe('Team Responses', () => {
    const MOVE_1: Move = { id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0, description: 'Initial access' };
    const COMPETENCY_FIELD: DataField = {
      id: 'df-comp', mselId: 'msel-1', name: 'Competencies', dataType: DataFieldType.Competency, displayOrder: 4, isAssessorVisible: false,
    };
    const BLUE: Team = { id: 'team-blue', mselId: 'msel-1', name: 'Blue Team', shortName: 'Blue' };
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
      fields: [...FIELDS, COMPETENCY_FIELD],
      values: [...VALUES, { id: 'dv-comp', scenarioEventId: 'se-1', dataFieldId: 'df-comp', value: 'T0001' }],
      teams: [BLUE],
      mselCompetencies: [{ id: 'mc-1', mselId: 'msel-1', competencyId: 'comp-1', competency: { id: 'comp-1', idNumber: 'T0001' } }],
      teamCompetencies: [{ id: 'tc-1', teamId: 'team-blue', competencyId: 'comp-1' }],
      teamResponses,
    });
    const panel = (fixture: ComponentFixture<unknown>) =>
      fixture.debugElement.query(By.directive(TeamResponsesStub))?.componentInstance as TeamResponsesStub | undefined;

    beforeEach(() => {
      calls = [];
    });

    async function openMove(fixture: ComponentFixture<unknown>) {
      const user = userEvent.setup();
      await user.click(screen.getByText('Move 1'));
      TestBed.inject(HttpTestingController)
        .expectOne((req) => req.url === '/api/xapi/statements')
        .flush({ statements: [] });
      fixture.detectChanges();
      return user;
    }

    async function chooseBlue(fixture: ComponentFixture<unknown>, user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('combobox', { name: 'Assess Team' }));
      await user.click(await screen.findByRole('option', { name: 'Blue' }));
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
     * Verifies: Refresh xAPI statements reloads the team answers already shown, alongside the statements.
     * Interacts with: refreshStatements (refresh button), HttpClient GET api/xapi/statements (HttpTestingController), CiteService.getMselCiteTeamResponses (stub).
     * Data: Blue's answers for move 1 loaded once as NotAnswered, then Answered on refresh.
     */
    it('reloads the answers with Refresh xAPI statements', async () => {
      const { fixture, citeApi } = await renderAssessorView(assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }));
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);
      answer(calls[0], { ...ANSWERED, status: CiteTeamResponsesStatus.NotAnswered, teamSubmission: null });
      fixture.detectChanges();

      await user.click(screen.getByTitle('Refresh xAPI statements'));
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
  });
});
