// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  DestroyRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import {
  MatFormField,
  MatInput,
  MatLabel,
  MatSuffix,
} from '@angular/material/input';
import {
  MatSidenav,
  MatSidenavContainer,
  MatSidenavContent,
} from '@angular/material/sidenav';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { Sort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { ComnSettingsService, Theme } from '@cmusei/crucible-common';
import { Observable, Subject, interval } from 'rxjs';
import { debounceTime, take } from 'rxjs/operators';
import {
  AutomationRun,
  AutomationRunKind,
  AutomationStatus,
  AutomationTask,
  Card,
  DataField,
  DataValue,
  Move,
  MselExecution,
  MselItemStatus,
  Organization,
  ScenarioEvent,
  Team,
  User,
} from 'src/app/generated/blueprint.api';
import {
  AutomationRunQuery,
  newestFirst,
} from 'src/app/data/automation-run/automation-run.query';
import {
  AutomationTaskQuery,
  byDisplayOrder,
} from 'src/app/data/automation-task/automation-task.query';
import { CardQuery } from 'src/app/data/card/card.query';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { MoveQuery } from 'src/app/data/move/move.query';
import { MselExecutionDataService } from 'src/app/data/msel-execution/msel-execution-data.service';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { OrganizationQuery } from 'src/app/data/organization/organization.query';
import {
  DataValuePlus,
  ScenarioEventDataService,
  ScenarioEventView,
  ScenarioEventViewIndexing,
} from 'src/app/data/scenario-event/scenario-event-data.service';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { UserQuery } from 'src/app/data/user/user.query';
import {
  DeploymentRuns,
  eventAutomationSummary,
  formatOffset,
  isCurrentGroup,
  manualTasksOf,
  moveState,
  nextMove,
  MselScore,
  relativeTime,
  runCounts,
  scoreTasks,
} from 'src/app/utilities/facilitation';
import {
  MoveAndGroupNumbers,
  MselSectionExpansion,
  MselSectionRow,
  buildSectionRows,
} from 'src/app/utilities/msel-section-rows';
import { AutomationResultsDrawerComponent } from '../automation-results-drawer/automation-results-drawer.component';
import { AutomationStatusChipComponent } from '../automation-status-chip/automation-status-chip.component';
import { DataValueComponent } from '../data-value/data-value.component';
import { FacilitatorAutomationPanelComponent } from '../facilitator-automation-panel/facilitator-automation-panel.component';
import {
  MselAdvanceDialogComponent,
  MselAdvanceDialogData,
} from '../msel-advance-dialog/msel-advance-dialog.component';
import { DurationViewComponent } from '../shared/duration-view/duration-view.component';

/**
 * The Facilitator View: a deployed MSEL's events by move and group, with what their automation tasks have done in
 * this deployment. A Facilitator or Owner starts moves and groups, runs, reruns and cancels tasks, and pauses the
 * automation; an Editor or Approver sees the same, read-only.
 */
@Component({
  selector: 'app-facilitator-view',
  imports: [
    AutomationResultsDrawerComponent,
    AutomationStatusChipComponent,
    DataValueComponent,
    DurationViewComponent,
    FacilitatorAutomationPanelComponent,
    FormsModule,
    MatButton,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatInput,
    MatLabel,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    MatSlideToggle,
    MatSuffix,
    MatTooltip,
  ],
  templateUrl: './facilitator-view.component.html',
  styleUrls: ['./facilitator-view.component.scss'],
})
export class FacilitatorViewComponent implements ScenarioEventView {
  private mselQuery = inject(MselQuery);
  private dataFieldQuery = inject(DataFieldQuery);
  private dataValueQuery = inject(DataValueQuery);
  private moveQuery = inject(MoveQuery);
  private cardQuery = inject(CardQuery);
  private organizationQuery = inject(OrganizationQuery);
  private teamQuery = inject(TeamQuery);
  private userQuery = inject(UserQuery);
  private scenarioEventDataService = inject(ScenarioEventDataService);
  private scenarioEventQuery = inject(ScenarioEventQuery);
  private automationTaskQuery = inject(AutomationTaskQuery);
  private automationRunQuery = inject(AutomationRunQuery);
  private executionData = inject(MselExecutionDataService);
  private uiDataService = inject(UIDataService);
  private settingsService = inject(ComnSettingsService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  readonly loggedInUserId = input<string>(undefined);
  readonly userTheme = input<Theme>(undefined);
  /** Whether the user may act: start moves and groups, run tasks and pause. */
  readonly canFacilitate = input(false);
  // On the standalone page there is no Data Fields tab beside this view.
  readonly standalone = input(false);
  readonly canChooseFields = input(false);

  readonly drawer = viewChild(MatSidenav);

  msel = new MselPlus();
  // ScenarioEventView
  mselScenarioEvents: ScenarioEvent[] = [];
  filterString = '';
  sort: Sort = { active: '', direction: '' };
  displayedScenarioEvents: ScenarioEvent[] = [];
  facilitatorDataFields: DataField[] = [];
  dataValues: DataValue[] = [];
  cardList: Card[] = [];
  users: User[] = [];
  viewIndex = new ScenarioEventViewIndexing();

  moveList: Move[] = [];
  teamList: Team[] = [];
  organizationList: Organization[] = [];
  /** The client's numbering, until the server's arrives. */
  private clientNumbers: MoveAndGroupNumbers = [];
  moveAndGroupNumbers: MoveAndGroupNumbers = [];
  execution: MselExecution | undefined;
  tasksByEvent = new Map<string, AutomationTask[]>();
  taskNames = new Map<string, string>();
  private exerciseRuns: AutomationRun[] = [];
  deploymentRuns = new DeploymentRuns([], null);
  scoring: MselScore = { score: 0, scoreEarned: 0, tasks: new Map() };
  userNames = new Map<string, string>();
  onlyEventsWithTasks = this.uiDataService.getFacilitatorOnlyEventsWithTasks();
  readonly sections = new MselSectionExpansion();
  private sectionsOpened = false;
  drawerTask: AutomationTask | null = null;
  showRealTime = this.uiDataService.useRealTime();
  readonly filterChange = new Subject<string>();
  readonly now = signal(new Date());
  readonly pausing = signal(false);
  readonly errorMessage = signal('');
  private positionsChanged = new Subject<void>();
  private executionMselId = '';

  blankDataValue = {
    id: '',
    scenarioEventId: '',
    dataFieldId: '',
    value: '',
    valueArray: [],
  } as DataValuePlus;
  // settings.json's tints for a highlighted event's row, as the other MSEL views use them
  private readonly tints = this.settingsService.settings as {
    DarkThemeTint?: number;
    LightThemeTint?: number;
  };
  private darkThemeTint = this.tints.DarkThemeTint || 0.7;
  private lightThemeTint = this.tints.LightThemeTint || 0.4;

  constructor() {
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntilDestroyed())
      .subscribe((msel) => {
        if (!msel) return;
        const changed = this.msel.id !== msel.id;
        this.msel = { ...msel } as MselPlus;
        this.rebuildRuns();
        if (changed && msel.id) {
          this.watchExecution(msel.id);
        }
      });
    this.dataFieldQuery
      .selectAll()
      .pipe(takeUntilDestroyed())
      .subscribe((dataFields) => {
        this.facilitatorDataFields = dataFields
          .filter((df) => df.onFacilitatorView)
          .sort((a, b) => +a.displayOrder - +b.displayOrder);
        this.scenarioEventDataService.updateScenarioEventViewDataFields(this);
        this.scenarioEventDataService.updateScenarioEventViewDataValues(this);
        this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(
          this,
        );
      });
    this.dataValueQuery
      .selectAll()
      .pipe(takeUntilDestroyed())
      .subscribe((dataValues) => {
        this.dataValues = dataValues.map((dv) => ({ ...dv }));
        this.scenarioEventDataService.updateScenarioEventViewDataValues(this);
        this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(
          this,
        );
      });
    this.scenarioEventQuery
      .selectAll()
      .pipe(takeUntilDestroyed())
      .subscribe((scenarioEvents) => {
        this.scenarioEventDataService.refreshScenarioEventViewEvents(
          this,
          scenarioEvents,
        );
        this.renumber();
        this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(
          this,
        );
        this.positionsChanged.next();
      });
    this.moveQuery
      .selectAll()
      .pipe(takeUntilDestroyed())
      .subscribe((moves) => {
        // the API sends the numbers as strings
        this.moveList = moves
          .map((m) => ({
            ...m,
            moveNumber: Number(m.moveNumber),
            deltaSeconds: Number(m.deltaSeconds ?? 0),
          }))
          .sort((a, b) => a.moveNumber - b.moveNumber);
        this.renumber();
        this.positionsChanged.next();
      });
    this.cardQuery
      .selectAll()
      .pipe(takeUntilDestroyed())
      .subscribe((cards) => {
        this.cardList = cards;
        this.scenarioEventDataService.updateScenarioEventViewCards(this);
      });
    this.organizationQuery
      .selectAll()
      .pipe(takeUntilDestroyed())
      .subscribe((organizations) => {
        this.organizationList = organizations.filter(
          (org) => !org.isTemplate && org.mselId === this.msel.id,
        );
      });
    this.teamQuery
      .selectAll()
      .pipe(takeUntilDestroyed())
      .subscribe((teams) => (this.teamList = teams));
    this.userQuery
      .selectAll()
      .pipe(takeUntilDestroyed())
      .subscribe((users) => {
        this.users = users;
        this.userNames = new Map(users.map((u) => [u.id, u.name]));
      });
    this.automationTaskQuery
      .selectAll({ sortBy: byDisplayOrder })
      .pipe(takeUntilDestroyed())
      .subscribe((tasks) => {
        const byEvent = new Map<string, AutomationTask[]>();
        tasks
          .filter((t) => t.mselId === this.msel.id)
          .forEach((t) =>
            byEvent.set(t.scenarioEventId, [
              ...(byEvent.get(t.scenarioEventId) ?? []),
              t,
            ]),
          );
        this.tasksByEvent = byEvent;
        this.taskNames = new Map(tasks.map((t) => [t.id, t.name]));
        this.rescore();
        if (this.drawerTask) {
          this.drawerTask =
            tasks.find((t) => t.id === this.drawerTask.id) ?? this.drawerTask;
        }
      });
    this.automationRunQuery
      .selectAll({
        filterBy: (r) => r.kind === AutomationRunKind.Exercise,
        sortBy: newestFirst,
      })
      .pipe(takeUntilDestroyed())
      .subscribe((runs) => {
        this.exerciseRuns = runs;
        this.rebuildRuns();
      });
    // the server numbers the moves and groups the start endpoints take; ask again when events or moves change
    this.positionsChanged
      .pipe(debounceTime(500), takeUntilDestroyed())
      .subscribe(() => {
        if (this.executionMselId) this.executionData.load(this.executionMselId);
      });
    this.filterChange
      .pipe(debounceTime(250), takeUntilDestroyed())
      .subscribe(() => this.applyFilter(this.filterString));
    // relative times ("in 12 min") move on by themselves
    interval(30000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(new Date()));
  }

  // ScenarioEventView
  get dataFields(): DataField[] {
    return this.facilitatorDataFields;
  }

  get userList(): User[] {
    return this.users;
  }

  // a facilitator runs every event, those hidden from the Exercise View too
  readonly showHiddenEvents = true;

  private watchExecution(mselId: string) {
    this.executionMselId = mselId;
    this.executionData
      .select(mselId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((execution) => {
        if (execution?.mselId !== this.executionMselId) return;
        this.execution = execution;
        this.renumber();
      });
  }

  /** The server's numbering when there is one, which is the one the start endpoints take. */
  private renumber() {
    this.clientNumbers = this.scenarioEventDataService.getMoveAndGroupNumbers(
      this.mselScenarioEvents,
      this.moveList,
    );
    const positions = this.execution?.positions;
    if (!positions || positions.length === 0) {
      this.moveAndGroupNumbers = this.clientNumbers;
      return;
    }
    const numbers = [] as unknown as MoveAndGroupNumbers;
    const byEvent = numbers as unknown as Record<string, number[]>;
    positions.forEach(
      (p) => (byEvent[p.scenarioEventId] = [p.moveNumber, p.groupNumber]),
    );
    this.moveAndGroupNumbers = numbers;
  }

  private rebuildRuns() {
    this.deploymentRuns = new DeploymentRuns(
      this.exerciseRuns,
      this.msel.deploymentId,
    );
    this.rescore();
  }
  private rescore() {
    this.scoring = scoreTasks(this.allTasks, this.deploymentRuns);
  }

  get canAct(): boolean {
    return this.canFacilitate() && this.msel.status === MselItemStatus.Deployed;
  }

  get isPaused(): boolean {
    return !!(this.execution?.automationPaused ?? this.msel.automationPaused);
  }

  get currentMove(): number | null | undefined {
    const current =
      this.execution?.currentMoveNumber ?? this.msel.currentMoveNumber;
    return current == null ? current : Number(current);
  }

  get currentGroup(): number | null | undefined {
    const current =
      this.execution?.currentGroupNumber ?? this.msel.currentGroupNumber;
    return current == null ? current : Number(current);
  }

  private get position(): MselExecution {
    return {
      currentMoveNumber: this.currentMove,
      currentGroupNumber: this.currentGroup,
    };
  }

  eventTasks(event: ScenarioEvent): AutomationTask[] {
    return this.tasksByEvent.get(event.id) ?? [];
  }

  get allTasks(): AutomationTask[] {
    return [...this.tasksByEvent.values()].flat();
  }

  get counts() {
    return runCounts(this.allTasks, this.deploymentRuns);
  }

  summary(event: ScenarioEvent) {
    return eventAutomationSummary(this.eventTasks(event), this.deploymentRuns);
  }

  get next(): { label: string; detail: string } | undefined {
    const move = nextMove(this.moveList, this.position);
    if (!move) return undefined;
    const at = new Date(
      new Date(this.msel.startTime).valueOf() + (move.deltaSeconds ?? 0) * 1000,
    );
    return {
      label: `Move ${move.moveNumber} at ${formatOffset(move.deltaSeconds ?? 0)}`,
      detail: relativeTime(at, this.now()),
    };
  }

  /**
   * The rows: every move and group, so a move can always be started, and the events the search and the toggle leave.
   * The events stay in time order, the order the moves and groups run in.
   */
  get displayRows(): MselSectionRow[] {
    const rows = this.buildRows();
    // a facilitator works through the moves and groups, so they start open; the events start closed
    if (!this.sectionsOpened && rows.some((r) => r.type === 'event')) {
      this.sectionsOpened = true;
      rows.forEach((r) => {
        if (r.type === 'move') this.sections.moveNumbers.add(r.moveNumber);
        if (r.type === 'group') this.sections.groupKeys.add(r.groupKey);
      });
    }
    return rows;
  }

  private buildRows(): MselSectionRow[] {
    const rows = buildSectionRows(
      this.displayedScenarioEvents,
      this.moveAndGroupNumbers,
    ).filter(
      (row) =>
        row.type !== 'event' ||
        !this.onlyEventsWithTasks ||
        this.eventTasks(row.event).length > 0,
    );
    const shown = new Set(
      rows.filter((r) => r.type === 'move').map((r) => r.moveNumber),
    );
    this.moveList
      .filter((m) => !shown.has(m.moveNumber))
      .forEach((m) => {
        const index = rows.findIndex(
          (r) => r.type === 'move' && r.moveNumber > m.moveNumber,
        );
        const row: MselSectionRow = { type: 'move', moveNumber: m.moveNumber };
        if (index < 0) rows.push(row);
        else rows.splice(index, 0, row);
      });
    return rows;
  }

  get columnCount(): number {
    return (
      this.facilitatorDataFields.length +
      3 +
      (this.msel.showMoveOnFacilitatorView ? 1 : 0) +
      (this.msel.showGroupOnFacilitatorView ? 1 : 0) +
      (this.msel.showTimeOnFacilitatorView ? 1 : 0) +
      (this.msel.showIntegrationTargetOnFacilitatorView ? 1 : 0)
    );
  }

  moveDescription(moveNumber: number): string {
    return (
      this.moveList.find((m) => +m.moveNumber === moveNumber)?.description ?? ''
    );
  }

  /** "Completed", "Current · started 10:45", or "scheduled +01:00:00 · in 12 min". */
  moveStatus(moveNumber: number): string {
    const state = moveState(moveNumber, this.position);
    if (state === 'completed') return 'Completed';
    if (state === 'current') {
      const started =
        this.execution?.currentGroupStartedAt ??
        this.msel.currentGroupStartedAt;
      return started
        ? `Current · started ${new Date(started).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Current';
    }
    const move = this.moveList.find((m) => +m.moveNumber === moveNumber);
    if (!move) return '';
    const at = new Date(
      new Date(this.msel.startTime).valueOf() + (move.deltaSeconds ?? 0) * 1000,
    );
    return `Scheduled ${formatOffset(move.deltaSeconds ?? 0)} · ${relativeTime(at, this.now())}`;
  }

  moveTone(moveNumber: number) {
    return moveState(moveNumber, this.position);
  }

  isCurrentGroup(row: MselSectionRow): boolean {
    return isCurrentGroup(row.moveNumber, row.groupNumber, this.position);
  }

  /** The events of a move, or of one of its groups, whether or not the list shows them. */
  private eventIdsOf(moveNumber: number, groupNumber?: number): string[] {
    const byEvent = this.moveAndGroupNumbers as unknown as Record<
      string,
      number[] | undefined
    >;
    return this.mselScenarioEvents
      .filter((e) => {
        const nums = byEvent[e.id];
        return (
          !!nums &&
          +nums[0] === moveNumber &&
          (groupNumber === undefined || +nums[1] === groupNumber)
        );
      })
      .map((e) => e.id);
  }

  groupWaiting(row: MselSectionRow): number {
    return this.eventIdsOf(row.moveNumber, row.groupNumber)
      .flatMap((id) => this.tasksByEvent.get(id) ?? [])
      .filter(
        (t) =>
          this.deploymentRuns.latest(t.id)?.status === AutomationStatus.Pending,
      ).length;
  }

  eventLabel(eventId: string): string {
    return `Event ${this.mselScenarioEvents.findIndex((e) => e.id === eventId) + 1}`;
  }

  startMove(moveNumber: number, event?: Event) {
    event?.stopPropagation();
    this.openAdvance(moveNumber, undefined);
  }

  startGroup(row: MselSectionRow, event?: Event) {
    event?.stopPropagation();
    this.openAdvance(row.moveNumber, row.groupNumber);
  }

  private openAdvance(moveNumber: number, groupNumber: number | undefined) {
    const eventIds = this.eventIdsOf(moveNumber, groupNumber);
    const tasks = manualTasksOf(eventIds, this.tasksByEvent).map((task) => {
      const index = (this.tasksByEvent.get(task.scenarioEventId) ?? []).indexOf(
        task,
      );
      return {
        task,
        label: `${this.eventLabel(task.scenarioEventId)} › ${index + 1}. ${task.name}`,
        cannotRun:
          !task.repeatable && this.deploymentRuns.hasSucceeded(task.id)
            ? 'it has succeeded, and runs only once'
            : undefined,
      };
    });
    this.dialog.open(MselAdvanceDialogComponent, {
      width: '560px',
      maxWidth: '90vw',
      data: {
        mselId: this.msel.id,
        moveNumber,
        groupNumber,
        hasCite: !!this.msel.useCite && !!this.msel.citeEvaluationId,
        hasGallery: !!this.msel.useGallery && !!this.msel.galleryExhibitId,
        tasks,
      } satisfies MselAdvanceDialogData,
    });
  }

  togglePause() {
    this.pausing.set(true);
    this.errorMessage.set('');
    this.executionData
      .setPaused(this.msel.id, !this.isPaused)
      .pipe(take(1))
      .subscribe({
        next: () => this.pausing.set(false),
        error: () => {
          this.pausing.set(false);
          this.errorMessage.set(
            'The automation could not be paused or resumed.',
          );
        },
      });
  }

  setOnlyEventsWithTasks(value: boolean) {
    this.onlyEventsWithTasks = value;
    this.uiDataService.setFacilitatorOnlyEventsWithTasks(value);
  }

  openHistory(task: AutomationTask) {
    this.drawerTask = task;
    void this.drawer()?.open();
  }

  closeHistory() {
    void this.drawer()?.close();
  }

  historyLabel(task: AutomationTask): string {
    const index = (this.tasksByEvent.get(task.scenarioEventId) ?? []).indexOf(
      task,
    );
    return `${this.eventLabel(task.scenarioEventId)} › ${index + 1}. ${task.name}`;
  }

  toggleMove(moveNumber: number) {
    this.sections.toggleMove(moveNumber);
  }

  toggleGroup(groupKey: string) {
    this.sections.toggleGroup(groupKey);
  }

  toggleEvent(eventId: string) {
    this.sections.toggleEvent(eventId);
  }

  expandAll() {
    this.sections.expandAll(this.displayRows);
  }

  collapseAll() {
    this.sections.collapseAll();
  }

  get isFullyExpanded(): boolean {
    return this.sections.isFullyExpanded(this.displayRows);
  }

  getDataValue(
    scenarioEvent: ScenarioEvent,
    dataFieldName: string,
  ): DataValuePlus {
    if (!scenarioEvent?.id) {
      return this.blankDataValue;
    }
    return this.scenarioEventDataService.getDataValueFromView(
      this,
      scenarioEvent,
      dataFieldName,
    );
  }

  getSortedOrganizationOptions(): string[] {
    return [
      ...this.organizationList.map((o) => o.shortName),
      ...(this.msel.teams ?? []).map((t) => t.shortName),
    ].sort((a, b) => (a < b ? -1 : 1));
  }

  getRowStyle(scenarioEvent: ScenarioEvent) {
    const meta = scenarioEvent?.rowMetadata?.split(',') ?? [];
    if (meta.length < 4) return {};
    const tint =
      this.userTheme() === Theme.DARK
        ? this.darkThemeTint
        : this.lightThemeTint;
    return {
      'background-color': `rgba(${meta[1]}, ${meta[2]}, ${meta[3]}, ${tint})`,
    };
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
  }

  setRealTime(value: boolean) {
    this.showRealTime = value;
    this.uiDataService.setUseRealTime(value);
  }

  // The MSEL editor opens on the tab saved in the UI state, so save Data Fields first.
  openDataFields() {
    this.uiDataService.setMselTab('Data Fields');
    void this.router.navigate(['/build'], {
      queryParams: { msel: this.msel.id },
    });
  }
}
