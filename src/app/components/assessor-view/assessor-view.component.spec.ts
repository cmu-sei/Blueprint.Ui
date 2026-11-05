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
import { of } from 'rxjs';
import {
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
    teams?: Team[];
    mselCompetencies?: MselCompetency[];
    teamCompetencies?: TeamCompetency[];
  } = {}
) {
  const {
    canEditCheckboxes = false,
    moves = [],
    fields = FIELDS,
    values = VALUES,
    standalone = false,
    canChooseFields = false,
    teams = [],
    mselCompetencies = [],
    teamCompetencies = [],
  } = overrides;
  const poolApi = {
    getMselCompetencies: vi.fn(() => of<MselCompetency[]>(structuredClone(mselCompetencies))),
  } satisfies ApiStub<MselCompetencyService>;
  const teamCompetencyApi = {
    getMselTeamCompetencies: vi.fn(() => of<TeamCompetency[]>(structuredClone(teamCompetencies))),
  } satisfies ApiStub<TeamCompetencyService>;
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
      // The component reads xAPI statements over HttpClient when an event is expanded.
      provideHttpClient(),
      provideHttpClientTesting(),
      // The MSEL page loads all of this; the stores are seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          store.set([structuredClone(MSEL)]);
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
});
