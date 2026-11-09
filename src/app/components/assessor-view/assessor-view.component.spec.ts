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

  describe('statement grouping', () => {
    const MOVE_1: Move = { id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0, description: 'Initial access' };
    const BLUE: Team = { id: 'team-blue', mselId: 'msel-1', name: 'Blue Team', shortName: 'Blue' };
    const RED: Team = { id: 'team-red', mselId: 'msel-1', name: 'Red Team', shortName: 'Red' };
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
        TestBed.inject(MselStore).update('msel-1', { hideNamesOnAssessorView: true } as Partial<Msel>);
      }
      const user = userEvent.setup();
      await user.click(screen.getByText('Move 1'));
      TestBed.inject(HttpTestingController)
        .expectOne((req) => req.url === '/api/xapi/statements' && req.params.get('mselId') === 'msel-1')
        .flush({ statements });
      rendered.fixture.detectChanges();
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
     * Verifies: by default (Team) repeats by different members of a team collapse into one row that names the first person, counts the others, spans first–last time and shows ×N; another team's repeat stays apart.
     * Interacts with: toggleMoveExpand, HttpClient GET api/xapi/statements (HttpTestingController), getMoveStatementItems, buildStatementGroups, formatTimestamp.
     * Data: TZ America/New_York; Ann, Bo, Cy, Ann view one article for Blue (12:00–12:04 EDT), Rex views it for Red at 12:03.
     */
    it('merges a team\'s repeats across its members by default', async () => {
      await openMoveWith(REPEATS());

      expect(screen.getByRole('combobox', { name: 'Group by' })).toHaveTextContent('Team');
      expect(rowsShown()).toEqual([
        ['', 'Rex Raider', 'Red Team'],
        ['×4', 'Ann Analyst + 2 others', 'Blue Team'],
      ]);
      expect(screen.getByRole('button', { name: /^×4/ })).toHaveTextContent('20 Oct 2026 12:00 EDT – 20 Oct 2026 12:04 EDT');
      expect(screen.getByText('5 / 5')).toBeInTheDocument();
    });

    /**
     * Verifies: by User, each person's repeats collapse separately, and groups are placed by their newest statement.
     * Interacts with: Group by mat-select (setStatementGrouping), getMoveStatementItems.
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
     * Interacts with: Group by mat-select (setStatementGrouping), getMoveStatementItems.
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
     * Verifies: when the API removed every actor's identity, Group by offers only Team and Off, and a group is labeled Team member.
     * Interacts with: MselStore (hideNamesOnAssessorView set), Group by mat-select options, statementGroupActorLabel.
     * Data: MSEL hides names; three Blue statements on one article whose actors carry only objectType Agent.
     */
    it('offers only Team and Off when the statements carry no names', async () => {
      const { user } = await openMoveWith(
        [0, 1, 2].map((m) => statement(`s-${m}`, m, { actor: MASKED })),
        { hideNames: true },
      );

      expect(rowsShown()).toEqual([['×3', 'Team member', 'Blue Team']]);
      await user.click(screen.getByRole('combobox', { name: 'Group by' }));
      expect((await screen.findAllByRole('option')).map((o) => o.textContent.trim())).toEqual(['Team', 'Off']);
    });

    /**
     * Verifies: competency assertions and CITE submitted and evaluated statements always keep their own rows, while the same verb from another app still groups.
     * Interacts with: isNeverGrouped, getMoveStatementItems.
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
      expect(rowsShown()).toEqual([['×3', 'Team member', 'Blue Team']]);
      expect(JSON.parse(localStorage.getItem('uiState')).statementGrouping).toBe('user');
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
    const MOVE_1: Move = { id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0, description: 'Initial access' };
    const COMPETENCY_FIELD: DataField = {
      id: 'df-comp', mselId: 'msel-1', name: 'Competencies', dataType: DataFieldType.Competency, displayOrder: 4, isAssessorVisible: false,
    };
    const BLUE: Team = { id: 'team-blue', mselId: 'msel-1', name: 'Blue Team', shortName: 'Blue' };
    const EXCON: Team = { id: 'team-excon', mselId: 'msel-1', name: 'Exercise Control', shortName: 'EXCON' };
    // Move 1 holds se-1, tagged with competency T0001; Blue and EXCON are both assigned T0001.
    const ASSESSABLE = {
      moves: [MOVE_1],
      fields: [...FIELDS, COMPETENCY_FIELD],
      values: [...VALUES, { id: 'dv-comp', scenarioEventId: 'se-1', dataFieldId: 'df-comp', value: 'T0001' }],
      teams: [BLUE, EXCON],
      mselCompetencies: [{ id: 'mc-1', mselId: 'msel-1', competencyId: 'comp-1', competency: { id: 'comp-1', idNumber: 'T0001' } }],
      teamCompetencies: [
        { id: 'tc-1', teamId: 'team-blue', competencyId: 'comp-1' },
        { id: 'tc-2', teamId: 'team-excon', competencyId: 'comp-1' },
      ],
    };

    async function openMove(fixture: ComponentFixture<unknown>) {
      const user = userEvent.setup();
      await user.click(screen.getByText('Move 1'));
      TestBed.inject(HttpTestingController)
        .expectOne((req) => req.url === '/api/xapi/statements')
        .flush({ statements: [] });
      fixture.detectChanges();
      return user;
    }

    /** Toggles one team in the evidence Team filter (a multiple select) and closes it. */
    async function toggleTeamFilter(fixture: ComponentFixture<unknown>, user: ReturnType<typeof userEvent.setup>, team: string) {
      await user.click(screen.getByRole('combobox', { name: 'Team' }));
      await user.click(await screen.findByRole('option', { name: team }));
      await user.keyboard('{Escape}');
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
       * Verifies: changing the Team filter of an open move to exactly one team selects that team in Assess Team, each time it changes; two teams leave it alone.
       * Interacts with: toggleMoveExpand (move header clicked), evidence Team mat-select (filterByTeams), Assess Team mat-select.
       * Data: Move 1 with competency T0001 assigned to Blue and EXCON; the filter goes Blue, then Blue + EXCON, then EXCON.
       */
      it('follows the Team filter whenever it narrows to one team after the move opened', async () => {
        const { fixture } = await renderAssessorView(ASSESSABLE);
        const user = await openMove(fixture);
        expect(assessTeam()).toHaveTextContent('None');

        await toggleTeamFilter(fixture, user, 'Blue');
        expect(assessTeam()).toHaveTextContent('Blue');

        await toggleTeamFilter(fixture, user, 'EXCON');
        expect(assessTeam()).toHaveTextContent('Blue');

        await toggleTeamFilter(fixture, user, 'Blue');
        expect(assessTeam()).toHaveTextContent('EXCON');
      });

      /**
       * Verifies: a team the user picked in Assess Team is kept when the Team filter later narrows to a different team.
       * Interacts with: toggleMoveExpand (move header clicked), Assess Team mat-select (setAssertionTeam), evidence Team mat-select (filterByTeams).
       * Data: Move 1 with competency T0001 assigned to Blue and EXCON; Blue is picked by hand, then the filter is set to EXCON.
       */
      it('keeps a team picked by hand when the Team filter changes', async () => {
        const { fixture } = await renderAssessorView(ASSESSABLE);
        const user = await openMove(fixture);

        await user.click(assessTeam());
        await user.click(await screen.findByRole('option', { name: 'Blue' }));
        fixture.detectChanges();
        await toggleTeamFilter(fixture, user, 'EXCON');

        expect(assessTeam()).toHaveTextContent('Blue');
      });
    });

    /**
     * Verifies: the Refresh evidence button is named and described for what it reloads, and reloads the MSEL's xAPI statements.
     * Interacts with: refreshStatements (button clicked), MatTooltip description, HttpClient GET api/xapi/statements (HttpTestingController).
     * Data: Move 1 opened with no statements yet.
     */
    it('reloads the statements with Refresh evidence', async () => {
      const { fixture } = await renderAssessorView(ASSESSABLE);
      const user = await openMove(fixture);
      const refresh = screen.getByRole('button', { name: 'Refresh evidence' });

      expect(refresh).toHaveAccessibleDescription('Reload the xAPI statements and the CITE answers shown');
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
    const MOVE_1: Move = { id: 'move-1', mselId: 'msel-1', moveNumber: 1, deltaSeconds: 0, description: 'Initial access' };
    const COMPETENCY_FIELD: DataField = {
      id: 'df-comp', mselId: 'msel-1', name: 'Competencies', dataType: DataFieldType.Competency, displayOrder: 4, isAssessorVisible: false,
    };
    const BLUE: Team = { id: 'team-blue', mselId: 'msel-1', name: 'Blue Team', shortName: 'Blue' };
    const RED: Team = { id: 'team-red', mselId: 'msel-1', name: 'Red Team', shortName: 'Red' };
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

    afterEach(() => {
      vi.restoreAllMocks();
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
     * Verifies: Refresh evidence reloads the team answers already shown, alongside the statements.
     * Interacts with: refreshStatements (refresh button), HttpClient GET api/xapi/statements (HttpTestingController), CiteService.getMselCiteTeamResponses (stub).
     * Data: Blue's answers for move 1 loaded once as NotAnswered, then Answered on refresh.
     */
    it('reloads the answers with Refresh evidence', async () => {
      const { fixture, citeApi } = await renderAssessorView(assessable({ ...MSEL, useCite: true, citeEvaluationId: 'eval-1' }));
      const user = await openMove(fixture);
      await chooseBlue(fixture, user);
      answer(calls[0], { ...ANSWERED, status: CiteTeamResponsesStatus.NotAnswered, teamSubmission: null });
      fixture.detectChanges();

      await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
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
