// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy } from '@angular/core';
import { Subject, Subscription, Observable, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, mergeMap, delay } from 'rxjs/operators';
import { Sort } from '@angular/material/sort';
import { HttpClient } from '@angular/common/http';
import { ComnSettingsService, Theme } from '@cmusei/crucible-common';
import {
  Card,
  DataField,
  DataValue,
  Move,
  Msel,
  Organization,
  ScenarioEvent,
  Team,
  User,
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { MoveQuery } from 'src/app/data/move/move.query';
import { CardQuery } from 'src/app/data/card/card.query';
import { OrganizationQuery } from 'src/app/data/organization/organization.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import {
  DataValuePlus,
  ScenarioEventDataService,
  ScenarioEventView,
  ScenarioEventViewIndexing,
} from 'src/app/data/scenario-event/scenario-event-data.service';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { AngularEditorConfig } from '@kolkov/angular-editor';

export interface XApiStatement {
  id?: string;
  actor?: { name?: string; account?: { name?: string } };
  verb?: { id?: string; display?: { 'en-US'?: string } };
  object?: { id?: string; definition?: { name?: { 'en-US'?: string }; type?: string } };
  result?: { score?: { raw?: number }; completion?: boolean; success?: boolean };
  timestamp?: string;
  context?: {
    team?: { name?: string };
    platform?: string;
    extensions?: Record<string, any>;
    contextActivities?: {
      grouping?: { id?: string; definition?: { name?: { 'en-US'?: string }; type?: string } }[];
    };
  };
}

@Component({
  selector: 'app-assessor-view',
  templateUrl: './assessor-view.component.html',
  styleUrls: ['./assessor-view.component.scss'],
  standalone: false
})
export class AssessorViewComponent implements OnDestroy, ScenarioEventView {
  @Input() loggedInUserId: string;
  @Input() userTheme: Theme;
  msel = new MselPlus();

  // ScenarioEventView fields
  mselScenarioEvents: ScenarioEvent[] = [];
  filterString = '';
  sort: Sort = { active: '', direction: '' };
  displayedScenarioEvents: ScenarioEvent[] = [];
  assessorDataFields: DataField[] = [];
  dataValues: DataValue[] = [];
  cardList: Card[] = [];
  mselUsers: User[] = [];
  viewIndex = new ScenarioEventViewIndexing();

  moveList: Move[] = [];
  teamList: Team[] = [];
  organizationList: Organization[] = [];
  moveAndGroupNumbers: Record<string, number[]>[] = [];
  blankDataValue = {
    id: '',
    scenarioEventId: '',
    dataFieldId: '',
    value: '',
    valueArray: [],
  } as DataValuePlus;
  darkThemeTint = this.settingsService.settings.DarkThemeTint
    ? this.settingsService.settings.DarkThemeTint
    : 0.7;
  lightThemeTint = this.settingsService.settings.LightThemeTint
    ? this.settingsService.settings.LightThemeTint
    : 0.4;
  viewConfig: AngularEditorConfig = {
    editable: false,
    height: 'auto',
    minHeight: '1200px',
    width: '100%',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: false,
    showToolbar: false,
    placeholder: '',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    sanitize: false,
  };

  sortableDataTypes = this.scenarioEventDataService.sortableDataTypes;
  showRealTime = false;
  showSearch = false;
  selectedMoveNumber: number | null = null;
  selectedTeamId: string | null = null;
  selectedSource: string | null = null;
  topSourceFilter: string | null = null;
  topVerbFilter: string | null = null;
  excludedSources: string[] = [];
  availableVerbs: string[] = [];
  keyUp = new Subject<KeyboardEvent>();
  private subscription: Subscription;
  expandedEventId = '';
  eventStatements: Map<string, XApiStatement[]> = new Map();
  loadingStatements: Set<string> = new Set();
  private apiUrl: string;
  private unsubscribe$ = new Subject();

  constructor(
    private mselQuery: MselQuery,
    private dataFieldQuery: DataFieldQuery,
    private dataValueQuery: DataValueQuery,
    private dataValueDataService: DataValueDataService,
    private moveQuery: MoveQuery,
    private cardQuery: CardQuery,
    private organizationQuery: OrganizationQuery,
    private teamQuery: TeamQuery,
    private scenarioEventDataService: ScenarioEventDataService,
    private scenarioEventQuery: ScenarioEventQuery,
    private uiDataService: UIDataService,
    private http: HttpClient,
    private settingsService: ComnSettingsService
  ) {
    this.apiUrl = this.settingsService.settings.ApiUrl;
    this.showRealTime = this.uiDataService.useRealTime();

    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(msel => {
        if (msel) {
          this.msel = { ...msel } as MselPlus;
        }
      });

    this.dataFieldQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(dataFields => {
        this.assessorDataFields = dataFields
          .filter(df => df.isAssessorVisible)
          .sort((a, b) => (+a.displayOrder > +b.displayOrder ? 1 : -1));
        this.scenarioEventDataService.updateScenarioEventViewDataFields(this);
        this.scenarioEventDataService.updateScenarioEventViewDataValues(this);
        this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
      });

    this.dataValueQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(dataValues => {
        this.dataValues = [];
        dataValues.forEach(dv => {
          this.dataValues.push({ ...dv });
        });
        this.scenarioEventDataService.updateScenarioEventViewDataValues(this);
        this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
      });

    this.scenarioEventQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(scenarioEvents => {
        this.scenarioEventDataService.refreshScenarioEventViewEvents(this, scenarioEvents);
        if (scenarioEvents && scenarioEvents.length > 0) {
          this.moveAndGroupNumbers = this.scenarioEventDataService.getMoveAndGroupNumbers(
            this.mselScenarioEvents, this.moveList
          );
          this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
        }
      });

    this.cardQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(cards => {
        this.cardList = cards;
      });
    this.scenarioEventDataService.updateScenarioEventViewCards(this);
    this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);

    this.moveQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(moves => {
        this.moveList = moves.sort((a, b) =>
          +a.moveNumber < +b.moveNumber ? -1 : 1
        );
        this.moveAndGroupNumbers = this.scenarioEventDataService.getMoveAndGroupNumbers(
          this.mselScenarioEvents, this.moveList
        );
      });

    this.organizationQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(organizations => {
        this.organizationList = organizations.filter(
          org => !org.isTemplate && org.mselId === this.msel.id
        );
      });

    this.teamQuery.selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(teams => {
        this.teamList = teams;
      });

    this.subscription = this.keyUp
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        mergeMap(search => of(search).pipe(delay(250)))
      )
      .subscribe(event => {
        this.applyFilter(this.filterString);
      });
  }

  // ScenarioEventView interface
  get dataFields(): DataField[] {
    return this.assessorDataFields;
  }

  get userList(): User[] {
    return this.mselUsers;
  }

  get showHiddenEvents(): boolean {
    return false;
  }

  getDataValue(scenarioEvent: ScenarioEvent, dataFieldName: string): DataValuePlus {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return this.blankDataValue;
    }
    return this.scenarioEventDataService.getDataValueFromView(this, scenarioEvent, dataFieldName);
  }

  getSortedOrganizationOptions(): string[] {
    let orgs: string[] = [];
    this.organizationList.forEach(o => {
      orgs.push(o.shortName);
    });
    this.msel.teams?.forEach(t => {
      orgs.push(t.shortName);
    });
    orgs = orgs.sort((a, b) => (a < b ? -1 : 1));
    return orgs;
  }

  getRowStyle(scenarioEvent: ScenarioEvent) {
    if (!scenarioEvent || !scenarioEvent.rowMetadata) {
      return '';
    }
    const rowMetadata = scenarioEvent.rowMetadata
      ? scenarioEvent.rowMetadata.split(',')
      : [];
    const color =
      rowMetadata.length >= 4
        ? rowMetadata[1] + ', ' + rowMetadata[2] + ', ' + rowMetadata[3]
        : '';
    const tint =
      this.userTheme === 'dark-theme'
        ? this.darkThemeTint
        : this.lightThemeTint;
    const style = color
      ? { 'background-color': 'rgba(' + color + ', ' + tint + ')' }
      : {};
    return style;
  }

  getStyle(dataField: DataField): string {
    if (dataField && dataField.columnMetadata) {
      const width = Math.trunc(+dataField.columnMetadata * 7);
      return 'text-align: left; width: ' + width.toString() + 'px;';
    } else {
      return 'text-align: left; width: 90%; min-width: 40px;';
    }
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
  }

  setSearch(value: boolean) {
    if (!value) {
      this.applyFilter('');
    }
    this.showSearch = value;
  }

  setRealTime(value: boolean) {
    this.showRealTime = value;
    this.uiDataService.setUseRealTime(value);
  }

  filterByMove(moveNumber: number | null) {
    this.selectedMoveNumber = moveNumber;
  }

  filterByTeam(teamId: string | null) {
    this.selectedTeamId = teamId;
  }

  filterBySource(source: string | null) {
    this.selectedSource = source;
  }

  setTopSourceFilter(source: string | null) {
    this.topSourceFilter = source;
  }

  setTopVerbFilter(verb: string | null) {
    this.topVerbFilter = verb;
  }

  setExcludedSources(sources: string[]) {
    this.excludedSources = sources;
  }

  refreshStatements() {
    if (this.statementsLoading || !this.msel.id) return;
    this.statementsLoading = true;
    this.loadingStatements.add('_all');

    const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl : this.apiUrl + '/';
    const params: any = { mselId: this.msel.id };
    if (this.allMselStatements.length > 0) {
      const latest = this.allMselStatements[this.allMselStatements.length - 1];
      if (latest.timestamp) {
        params.since = latest.timestamp;
      }
    }
    this.http.get<any>(`${baseUrl}api/xapi/statements`, { params })
      .subscribe({
        next: (response) => {
          const statements = response?.statements || response || [];
          const newStmts: XApiStatement[] = Array.isArray(statements) ? statements : [];
          const existingIds = new Set(this.allMselStatements.map(s => s.id));
          const added = newStmts.filter(s => !s.id || !existingIds.has(s.id));
          if (added.length > 0) {
            this.allMselStatements.push(...added);
            this.allMselStatements.sort((a, b) =>
              (a.timestamp || '').localeCompare(b.timestamp || '')
            );
            this.distributeStatements();
            this.buildVerbList();
          }
          this.statementsLoading = false;
          this.loadingStatements.delete('_all');
        },
        error: () => {
          this.statementsLoading = false;
          this.loadingStatements.delete('_all');
        }
      });
  }

  getPlatformClass(stmt: XApiStatement): string {
    const platform = (stmt.context?.platform || '').toLowerCase();
    return `platform-${platform || 'unknown'}`;
  }

  trackByFn(index, item) {
    return item.id;
  }

  private buildVerbList() {
    const verbs = new Set<string>();
    for (const stmt of this.allMselStatements) {
      const verb = stmt.verb?.display?.['en-US'] || stmt.verb?.id?.split('/').pop() || '';
      if (verb) verbs.add(verb);
    }
    this.availableVerbs = Array.from(verbs).sort();
  }

  // xAPI evidence
  private allMselStatements: XApiStatement[] = [];
  private statementsLoaded = false;
  private statementsLoading = false;

  toggleEvent(eventId: string) {
    if (this.expandedEventId === eventId) {
      this.expandedEventId = '';
    } else {
      this.expandedEventId = eventId;
      if (!this.statementsLoaded) {
        this.loadAllStatements();
      }
    }
  }

  private loadAllStatements() {
    if (this.statementsLoading || !this.msel.id) return;
    this.statementsLoading = true;
    this.loadingStatements.add('_all');

    const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl : this.apiUrl + '/';
    this.http.get<any>(`${baseUrl}api/xapi/statements`, { params: { mselId: this.msel.id } })
      .subscribe({
        next: (response) => {
          const statements = response?.statements || response || [];
          this.allMselStatements = Array.isArray(statements) ? statements : [];
          this.allMselStatements.sort((a, b) =>
            (a.timestamp || '').localeCompare(b.timestamp || '')
          );
          this.statementsLoaded = true;
          this.statementsLoading = false;
          this.loadingStatements.delete('_all');
          this.filterToCurrentSession();
          this.distributeStatements();
          this.buildVerbList();
        },
        error: () => {
          this.allMselStatements = [];
          this.statementsLoaded = true;
          this.statementsLoading = false;
          this.loadingStatements.delete('_all');
        }
      });
  }

  private filterToCurrentSession() {
    let launchTimestamp = '';
    for (const stmt of this.allMselStatements) {
      const verb = stmt.verb?.id || '';
      const platform = (stmt.context?.platform || '').toLowerCase();
      if (platform === 'blueprint' && verb.endsWith('/launched') && (stmt.timestamp || '') > launchTimestamp) {
        launchTimestamp = stmt.timestamp || '';
      }
    }
    if (launchTimestamp) {
      this.allMselStatements = this.allMselStatements.filter(s =>
        (s.timestamp || '') >= launchTimestamp
      );
    }
  }

  private distributeStatements() {
    this.eventStatements.clear();
    for (const event of this.mselScenarioEvents) {
      this.eventStatements.set(event.id, []);
    }
    if (this.mselScenarioEvents.length === 0 || this.allMselStatements.length === 0) return;

    const moveNameToEvents = new Map<string, ScenarioEvent[]>();
    for (const event of this.mselScenarioEvents) {
      const nums = this.moveAndGroupNumbers[event.id];
      if (nums) {
        const move = this.moveList.find(m => +m.moveNumber === +nums[0]);
        if (move?.description) {
          const key = move.description.toLowerCase();
          if (!moveNameToEvents.has(key)) {
            moveNameToEvents.set(key, []);
          }
          moveNameToEvents.get(key).push(event);
        }
      }
    }

    const moveNumToEvents = new Map<number, ScenarioEvent[]>();
    for (const event of this.mselScenarioEvents) {
      const nums = this.moveAndGroupNumbers[event.id];
      if (nums) {
        const moveNum = +nums[0];
        if (!moveNumToEvents.has(moveNum)) {
          moveNumToEvents.set(moveNum, []);
        }
        moveNumToEvents.get(moveNum).push(event);
      }
    }

    const unmatched: XApiStatement[] = [];
    const matchedTimeline: { timestamp: string; moveNumber: number }[] = [];

    for (const stmt of this.allMselStatements) {
      const moveInfo = this.extractMoveFromStatement(stmt);
      let matched = false;

      if (moveInfo.name && moveNameToEvents.has(moveInfo.name)) {
        for (const event of moveNameToEvents.get(moveInfo.name)) {
          this.eventStatements.get(event.id).push(stmt);
        }
        if (moveInfo.number != null) {
          matchedTimeline.push({ timestamp: stmt.timestamp || '', moveNumber: moveInfo.number });
        }
        matched = true;
      } else if (moveInfo.number != null && moveNumToEvents.has(moveInfo.number)) {
        for (const event of moveNumToEvents.get(moveInfo.number)) {
          this.eventStatements.get(event.id).push(stmt);
        }
        matchedTimeline.push({ timestamp: stmt.timestamp || '', moveNumber: moveInfo.number });
        matched = true;
      }

      if (!matched) {
        unmatched.push(stmt);
      }
    }

    if (unmatched.length > 0 && matchedTimeline.length > 0) {
      matchedTimeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      for (const stmt of unmatched) {
        const ts = stmt.timestamp || '';
        let moveNum = matchedTimeline[0].moveNumber;
        for (let i = matchedTimeline.length - 1; i >= 0; i--) {
          if (matchedTimeline[i].timestamp <= ts) {
            moveNum = matchedTimeline[i].moveNumber;
            break;
          }
        }
        if (moveNumToEvents.has(moveNum)) {
          for (const event of moveNumToEvents.get(moveNum)) {
            this.eventStatements.get(event.id).push(stmt);
          }
        }
      }
    } else if (unmatched.length > 0) {
      for (const event of this.mselScenarioEvents) {
        this.eventStatements.get(event.id).push(...unmatched);
      }
    }

    for (const bucket of this.eventStatements.values()) {
      bucket.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    }
  }

  private extractMoveFromStatement(stmt: XApiStatement): { name: string | null; number: number | null } {
    const grouping = stmt.context?.contextActivities?.grouping || [];
    for (const g of grouping) {
      const id = g.id || '';
      const name = g.definition?.name?.['en-US'] || '';
      if (id.includes('/move/')) {
        const numMatch = id.match(/\/move\/(\d+)$/);
        if (numMatch) {
          return { name: name.toLowerCase() || null, number: parseInt(numMatch[1], 10) };
        }
        const uuidMatch = id.match(/\/move\/([0-9a-f-]{36})$/i);
        const move = (uuidMatch && this.moveList.find(m => m.id === uuidMatch[1]))
          || this.moveList.find(m => m.description?.toLowerCase() === name.toLowerCase());
        if (move) {
          return { name: (move.description || '').toLowerCase() || null, number: +move.moveNumber };
        }
        return { name: name.toLowerCase() || null, number: null };
      }
    }
    return { name: null, number: null };
  }

  getStatements(eventId: string): XApiStatement[] {
    return this.eventStatements.get(eventId) || [];
  }

  getFilteredStatements(eventId: string): XApiStatement[] {
    let stmts = this.getStatements(eventId);
    if (this.excludedSources.length > 0) {
      stmts = stmts.filter(s =>
        !this.excludedSources.includes((s.context?.platform || '').toLowerCase())
      );
    }
    if (this.topSourceFilter) {
      stmts = stmts.filter(s =>
        (s.context?.platform || '').toLowerCase() === this.topSourceFilter
      );
    }
    if (this.topVerbFilter) {
      stmts = stmts.filter(s => {
        const verb = s.verb?.display?.['en-US'] || s.verb?.id?.split('/').pop() || '';
        return verb === this.topVerbFilter;
      });
    }
    if (this.selectedSource) {
      stmts = stmts.filter(s =>
        (s.context?.platform || '').toLowerCase() === this.selectedSource
      );
    }
    if (this.selectedTeamId) {
      const team = this.teamList.find(t => t.id === this.selectedTeamId);
      if (team) {
        stmts = stmts.filter(s =>
          s.context?.team?.name === team.shortName || s.context?.team?.name === team.name
        );
      }
    }
    if (this.selectedMoveNumber != null) {
      const move = this.moveList.find(m => +m.moveNumber === +this.selectedMoveNumber);
      const targetName = move?.description?.toLowerCase();
      const targetNum = +this.selectedMoveNumber;
      stmts = stmts.filter(s => {
        const info = this.extractMoveFromStatement(s);
        return (targetName && info.name === targetName) || (info.number != null && info.number === targetNum);
      });
    }
    return stmts;
  }

  isLoading(eventId: string): boolean {
    return this.loadingStatements.has('_all');
  }

  expandedStatementId = '';

  toggleStatement(stmtId: string) {
    this.expandedStatementId = this.expandedStatementId === stmtId ? '' : stmtId;
  }

  getMovePart(stmt: XApiStatement): string {
    const grouping = stmt.context?.contextActivities?.grouping || [];
    let movePart = '';
    let injectPart = '';
    for (const g of grouping) {
      const id = g.id || '';
      const name = g.definition?.name?.['en-US'] || '';
      if (id.includes('/move/')) {
        const numMatch = id.match(/\/move\/(\d+)$/);
        if (numMatch) {
          movePart = `M${numMatch[1]}`;
        } else {
          const uuidMatch = id.match(/\/move\/([0-9a-f-]{36})$/i);
          const move = (uuidMatch && this.moveList.find(m => m.id === uuidMatch[1]))
            || this.moveList.find(m => m.description?.toLowerCase() === name.toLowerCase());
          movePart = move ? `M${move.moveNumber}` : name;
        }
      } else if (id.includes('/inject/')) {
        const numMatch = id.match(/\/inject\/(\d+)$/);
        injectPart = numMatch ? `I${numMatch[1]}` : name;
      }
    }
    return [movePart, injectPart].filter(Boolean).join('.');
  }

  getObjectType(stmt: XApiStatement): string {
    return stmt.object?.definition?.type?.split('/').pop() || '';
  }

  copyStatement(stmt: XApiStatement, event: MouseEvent) {
    event.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(stmt, null, 2));
  }

  formatStatementJson(stmt: XApiStatement): string {
    return JSON.stringify(stmt, null, 2);
  }

  formatTimestamp(timestamp: string): string {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${minutes} ${this.getTimezoneAbbr()}`;
  }

  private getTimezoneAbbr(): string {
    try {
      const date = new Date();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const formatted = date.toLocaleTimeString('en-US', { timeZoneName: 'short', timeZone });
      const parts = formatted.split(' ');
      return parts[parts.length - 1] || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
