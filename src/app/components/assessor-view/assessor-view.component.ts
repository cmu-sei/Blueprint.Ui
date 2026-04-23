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

  private static FILTERABLE_TYPES = new Set([
    'Organization', 'Team', 'TeamsMultiple', 'Status', 'Card',
    'SourceType', 'Move', 'IntegrationTarget', 'Checkbox', 'Competency',
  ]);

  sortableDataTypes = this.scenarioEventDataService.sortableDataTypes;
  showRealTime = false;
  showSearch = false;
  selectedMoveNumber: number | null = null;
  topFieldFilters = new Map<string, string[]>();
  sectionTeamFilter = new Map<string, string[]>();
  sectionSourceFilter = new Map<string, string[]>();
  sectionVerbFilter = new Map<string, string[]>();
  sectionTeamInitialized = new Set<string>();
  availableVerbs: string[] = [];
  keyUp = new Subject<KeyboardEvent>();
  private subscription: Subscription;
  expandedEventIds = new Set<string>();
  expandedMoveNumbers = new Set<number>();
  expandedGroupKeys = new Set<string>();
  eventStatements: Map<string, XApiStatement[]> = new Map();
  moveStatements: Map<number, XApiStatement[]> = new Map();
  groupStatements: Map<string, XApiStatement[]> = new Map();
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

  filterByTeams(sectionKey: string, teamIds: string[]) {
    this.sectionTeamFilter.set(sectionKey, teamIds);
    this.sectionTeamInitialized.add(sectionKey);
  }

  filterBySources(sectionKey: string, sources: string[]) {
    this.sectionSourceFilter.set(sectionKey, sources);
  }

  filterByVerbs(sectionKey: string, verbs: string[]) {
    this.sectionVerbFilter.set(sectionKey, verbs);
  }

  getSectionTeams(sectionKey: string): string[] {
    return this.sectionTeamFilter.get(sectionKey) ?? [];
  }

  getSectionSources(sectionKey: string): string[] {
    return this.sectionSourceFilter.get(sectionKey) ?? [];
  }

  getSectionVerbs(sectionKey: string): string[] {
    return this.sectionVerbFilter.get(sectionKey) ?? [];
  }

  initEventTeamDefault(eventId: string) {
    const sectionKey = `event-${eventId}`;
    if (this.sectionTeamInitialized.has(sectionKey)) return;
    this.sectionTeamInitialized.add(sectionKey);

    const event = this.mselScenarioEvents.find(e => e.id === eventId);
    if (!event) return;

    const orgField = this.assessorDataFields.find(df =>
      df.dataType?.toString().toLowerCase() === 'organization'
    );
    if (!orgField) return;

    const dv = this.getDataValue(event, orgField.name);
    const orgValue = (dv.value || '').trim();
    if (!orgValue || orgValue.toUpperCase() === 'ALL') return;

    const orgNames = orgValue.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
    const matchedIds = this.teamList
      .filter(t =>
        orgNames.includes((t.shortName || '').toLowerCase()) ||
        orgNames.includes((t.name || '').toLowerCase())
      )
      .map(t => t.id);

    if (matchedIds.length > 0) {
      this.sectionTeamFilter.set(sectionKey, matchedIds);
    }
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
  statementsLoading = false;

  toggleEvent(eventId: string) {
    if (this.expandedEventIds.has(eventId)) {
      this.expandedEventIds.delete(eventId);
    } else {
      this.expandedEventIds.add(eventId);
      this.initEventTeamDefault(eventId);
      if (!this.statementsLoaded) {
        this.loadAllStatements();
      }
    }
  }

  toggleMoveExpand(moveNumber: number) {
    if (this.expandedMoveNumbers.has(moveNumber)) {
      this.expandedMoveNumbers.delete(moveNumber);
    } else {
      this.expandedMoveNumbers.add(moveNumber);
      if (!this.statementsLoaded) {
        this.loadAllStatements();
      }
    }
  }

  toggleGroupExpand(groupKey: string) {
    if (this.expandedGroupKeys.has(groupKey)) {
      this.expandedGroupKeys.delete(groupKey);
    } else {
      this.expandedGroupKeys.add(groupKey);
      if (!this.statementsLoaded) {
        this.loadAllStatements();
      }
    }
  }

  getMoveStatements(moveNumber: number): XApiStatement[] {
    return this.moveStatements.get(moveNumber) || [];
  }

  getGroupStatements(groupKey: string): XApiStatement[] {
    return this.groupStatements.get(groupKey) || [];
  }

  getFilteredMoveStatements(moveNumber: number): XApiStatement[] {
    return this.applyStatementFilters(this.getMoveStatements(moveNumber), `move-${moveNumber}`);
  }

  getFilteredGroupStatements(groupKey: string): XApiStatement[] {
    return this.applyStatementFilters(this.getGroupStatements(groupKey), `group-${groupKey}`);
  }

  getMoveDescription(moveNumber: number): string {
    const move = this.moveList.find(m => +m.moveNumber === moveNumber);
    return move?.description || `Move ${moveNumber}`;
  }

  getGroupDescription(moveNumber: number, groupNumber: number): string {
    return `Group ${groupNumber}`;
  }

  get filterableFields(): DataField[] {
    return this.assessorDataFields.filter(df =>
      AssessorViewComponent.FILTERABLE_TYPES.has(df.dataType?.toString() || '')
      || (df.isChosenFromList && df.dataOptions?.length > 0)
    );
  }

  getFieldDistinctValues(df: DataField): string[] {
    if (df.dataOptions?.length > 0) {
      return df.dataOptions.map(o => o.optionName).filter(n => !!n).sort();
    }
    const vals = new Set<string>();
    for (const event of this.mselScenarioEvents) {
      const dv = this.getDataValue(event, df.name);
      const v = (dv.value || '').trim();
      if (v) vals.add(v);
    }
    return Array.from(vals).sort();
  }

  getTopFieldFilter(fieldId: string): string[] {
    return this.topFieldFilters.get(fieldId) ?? [];
  }

  setTopFieldFilter(fieldId: string, values: string[]) {
    this.topFieldFilters.set(fieldId, values);
  }

  clearAllTopFilters() {
    this.topFieldFilters.clear();
    this.filterString = '';
    this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
  }

  get hasActiveTopFilters(): boolean {
    for (const vals of this.topFieldFilters.values()) {
      if (vals.length > 0) return true;
    }
    return !!this.filterString;
  }

  private applyTopFieldFilters(events: ScenarioEvent[]): ScenarioEvent[] {
    for (const [fieldId, selected] of this.topFieldFilters) {
      if (selected.length === 0) continue;
      const df = this.assessorDataFields.find(d => d.id === fieldId);
      if (!df) continue;
      events = events.filter(event => {
        const dv = this.getDataValue(event, df.name);
        const val = (dv.value || '').trim();
        if (!val) return false;
        if (val.toUpperCase() === 'ALL') return true;
        return selected.some(s => val.toLowerCase().includes(s.toLowerCase()));
      });
    }
    return events;
  }

  get displayRows(): { type: 'move' | 'group' | 'event'; moveNumber?: number; groupNumber?: number; groupKey?: string; event?: ScenarioEvent; rowIndex?: number }[] {
    const filtered = this.applyTopFieldFilters(this.displayedScenarioEvents);
    const rows: { type: 'move' | 'group' | 'event'; moveNumber?: number; groupNumber?: number; groupKey?: string; event?: ScenarioEvent; rowIndex?: number }[] = [];
    let lastMove = -1;
    let lastGroup = '';
    let rowIndex = 0;
    for (const event of filtered) {
      const nums = this.moveAndGroupNumbers[event.id];
      const moveNum = nums ? +nums[0] : 0;
      const groupNum = nums ? +nums[1] : 0;
      const groupKey = `${moveNum}-${groupNum}`;

      if (moveNum !== lastMove) {
        rows.push({ type: 'move', moveNumber: moveNum });
        lastMove = moveNum;
        lastGroup = '';
      }
      if (groupKey !== lastGroup) {
        rows.push({ type: 'group', moveNumber: moveNum, groupNumber: groupNum, groupKey });
        lastGroup = groupKey;
      }
      rows.push({ type: 'event', event, rowIndex: ++rowIndex, moveNumber: moveNum, groupNumber: groupNum, groupKey });
    }
    return rows;
  }

  private applyStatementFilters(stmts: XApiStatement[], sectionKey?: string): XApiStatement[] {
    if (sectionKey) {
      const sources = this.sectionSourceFilter.get(sectionKey);
      if (sources && sources.length > 0) {
        stmts = stmts.filter(s =>
          sources.includes((s.context?.platform || '').toLowerCase())
        );
      }
      const verbs = this.sectionVerbFilter.get(sectionKey);
      if (verbs && verbs.length > 0) {
        stmts = stmts.filter(s => {
          const v = s.verb?.display?.['en-US'] || s.verb?.id?.split('/').pop() || '';
          return verbs.includes(v);
        });
      }
      const teamIds = this.sectionTeamFilter.get(sectionKey);
      if (teamIds && teamIds.length > 0) {
        const teamNames = new Set<string>();
        for (const id of teamIds) {
          const team = this.teamList.find(t => t.id === id);
          if (team) {
            if (team.shortName) teamNames.add(team.shortName);
            if (team.name) teamNames.add(team.name);
          }
        }
        stmts = stmts.filter(s => teamNames.has(s.context?.team?.name || ''));
      }
    }
    return stmts;
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
    this.moveStatements.clear();
    this.groupStatements.clear();
    for (const event of this.mselScenarioEvents) {
      this.eventStatements.set(event.id, []);
    }
    if (this.mselScenarioEvents.length === 0 || this.allMselStatements.length === 0) return;

    const moveGroupToEvents = new Map<string, ScenarioEvent[]>();
    const knownMoveNumbers = new Set<number>();

    for (const event of this.mselScenarioEvents) {
      const nums = this.moveAndGroupNumbers[event.id];
      if (!nums) continue;
      const moveNum = +nums[0];
      const groupNum = +nums[1];
      knownMoveNumbers.add(moveNum);

      const mgKey = `${moveNum}-${groupNum}`;
      if (!moveGroupToEvents.has(mgKey)) moveGroupToEvents.set(mgKey, []);
      moveGroupToEvents.get(mgKey).push(event);
    }

    const matchedTimeline: { timestamp: string; moveNumber: number }[] = [];

    for (const stmt of this.allMselStatements) {
      const moveInfo = this.extractMoveFromStatement(stmt);

      // Resolve move number (explicit, by name, or null)
      let moveNum = moveInfo.number;
      if (moveNum == null && moveInfo.name) {
        const move = this.moveList.find(m => m.description?.toLowerCase() === moveInfo.name);
        if (move) moveNum = +move.moveNumber;
      }

      if (moveNum != null && knownMoveNumbers.has(moveNum)) {
        matchedTimeline.push({ timestamp: stmt.timestamp || '', moveNumber: moveNum });

        // If we have a group, add to group bucket only (not move)
        if (moveInfo.group != null) {
          const gk = `${moveNum}-${moveInfo.group}`;
          let matchedEvent = false;

          const stmtPlatform = (stmt.context?.platform || '').toLowerCase();
          const stmtObjectName = (stmt.object?.definition?.name?.['en-US'] || '').toLowerCase();
          if (moveGroupToEvents.has(gk)) {
            for (const event of moveGroupToEvents.get(gk)) {
              const eventTarget = (event.integrationTarget || '').toLowerCase();
              if (eventTarget && stmtPlatform && eventTarget === stmtPlatform) {
                const groupEvents = moveGroupToEvents.get(gk).filter(e =>
                  (e.integrationTarget || '').toLowerCase() === stmtPlatform
                );
                if (groupEvents.length === 1) {
                  this.eventStatements.get(event.id).push(stmt);
                  matchedEvent = true;
                } else if (stmtObjectName && this.eventNameContains(event, stmtObjectName)) {
                  this.eventStatements.get(event.id).push(stmt);
                  matchedEvent = true;
                }
              }
            }
          }

          if (!matchedEvent) {
            if (!this.groupStatements.has(gk)) this.groupStatements.set(gk, []);
            this.groupStatements.get(gk).push(stmt);
          }
        } else {
          // Move-only (no group) — add to move bucket
          if (!this.moveStatements.has(moveNum)) this.moveStatements.set(moveNum, []);
          this.moveStatements.get(moveNum).push(stmt);
        }
      }
    }

    // Second pass: statements with no move context — infer move by timestamp
    if (matchedTimeline.length > 0) {
      matchedTimeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      for (const stmt of this.allMselStatements) {
        const moveInfo = this.extractMoveFromStatement(stmt);
        let moveNum = moveInfo.number;
        if (moveNum == null && moveInfo.name) {
          const move = this.moveList.find(m => m.description?.toLowerCase() === moveInfo.name);
          if (move) moveNum = +move.moveNumber;
        }
        if (moveNum != null) continue; // already handled

        const ts = stmt.timestamp || '';
        let inferredMove = matchedTimeline[0].moveNumber;
        for (let i = matchedTimeline.length - 1; i >= 0; i--) {
          if (matchedTimeline[i].timestamp <= ts) {
            inferredMove = matchedTimeline[i].moveNumber;
            break;
          }
        }
        if (!this.moveStatements.has(inferredMove)) this.moveStatements.set(inferredMove, []);
        this.moveStatements.get(inferredMove).push(stmt);
      }
    }

    for (const bucket of this.eventStatements.values()) {
      bucket.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    }
    for (const bucket of this.moveStatements.values()) {
      bucket.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    }
    for (const bucket of this.groupStatements.values()) {
      bucket.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    }
  }

  private extractMoveFromStatement(stmt: XApiStatement): { name: string | null; number: number | null; group: number | null } {
    const grouping = stmt.context?.contextActivities?.grouping || [];
    let moveNumber: number | null = null;
    let moveName: string | null = null;
    let groupNumber: number | null = null;

    for (const g of grouping) {
      const id = g.id || '';
      const name = g.definition?.name?.['en-US'] || '';
      if (id.includes('/group/')) {
        const numMatch = id.match(/\/group\/(\d+)$/);
        if (numMatch) groupNumber = parseInt(numMatch[1], 10);
      } else if (id.includes('/inject/')) {
        const numMatch = id.match(/\/inject\/(\d+)$/);
        if (numMatch) groupNumber = parseInt(numMatch[1], 10);
      } else if (id.includes('/move/')) {
        const numMatch = id.match(/\/move\/(\d+)$/);
        if (numMatch) {
          moveNumber = parseInt(numMatch[1], 10);
          moveName = name.toLowerCase() || null;
        } else {
          const uuidMatch = id.match(/\/move\/([0-9a-f-]{36})$/i);
          const move = (uuidMatch && this.moveList.find(m => m.id === uuidMatch[1]))
            || this.moveList.find(m => m.description?.toLowerCase() === name.toLowerCase());
          if (move) {
            moveNumber = +move.moveNumber;
            moveName = (move.description || '').toLowerCase() || null;
          } else {
            moveName = name.toLowerCase() || null;
          }
        }
      }
    }
    if (moveNumber != null || moveName != null) {
      return { name: moveName, number: moveNumber, group: groupNumber };
    }

    const objectName = stmt.object?.definition?.name?.['en-US'] || '';
    const prefixMatch = objectName.match(/^(\d+)-(\d+)\s/);
    if (prefixMatch) {
      return { name: null, number: parseInt(prefixMatch[1], 10), group: parseInt(prefixMatch[2], 10) };
    }
    return { name: null, number: null, group: null };
  }

  private eventNameContains(event: ScenarioEvent, needle: string): boolean {
    for (const df of this.assessorDataFields) {
      const dv = this.getDataValue(event, df.name);
      if (dv.value && dv.value.toLowerCase().includes(needle)) return true;
    }
    return false;
  }

  getStatements(eventId: string): XApiStatement[] {
    return this.eventStatements.get(eventId) || [];
  }

  getFilteredStatements(eventId: string): XApiStatement[] {
    let stmts = this.getStatements(eventId);
    stmts = this.applyStatementFilters(stmts, `event-${eventId}`);
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

  expandedStatementIds = new Set<string>();

  toggleStatement(stmtId: string) {
    if (this.expandedStatementIds.has(stmtId)) {
      this.expandedStatementIds.delete(stmtId);
    } else {
      this.expandedStatementIds.add(stmtId);
    }
  }

  getMovePart(stmt: XApiStatement): string {
    const grouping = stmt.context?.contextActivities?.grouping || [];
    for (const g of grouping) {
      const id = g.id || '';
      const name = g.definition?.name?.['en-US'] || '';
      if (id.includes('/move/') && !id.includes('/group/') && !id.includes('/inject/')) {
        const numMatch = id.match(/\/move\/(\d+)$/);
        if (numMatch) return `M${numMatch[1]}`;
        const uuidMatch = id.match(/\/move\/([0-9a-f-]{36})$/i);
        const move = (uuidMatch && this.moveList.find(m => m.id === uuidMatch[1]))
          || this.moveList.find(m => m.description?.toLowerCase() === name.toLowerCase());
        return move ? `M${move.moveNumber}` : name;
      }
    }
    const objectName = stmt.object?.definition?.name?.['en-US'] || '';
    const prefixMatch = objectName.match(/^(\d+)-\d+\s/);
    if (prefixMatch) return `M${parseInt(prefixMatch[1], 10)}`;
    return '';
  }

  getGroupPart(stmt: XApiStatement): string {
    const grouping = stmt.context?.contextActivities?.grouping || [];
    for (const g of grouping) {
      const id = g.id || '';
      if (id.includes('/group/')) {
        const numMatch = id.match(/\/group\/(\d+)$/);
        if (numMatch) return `G${numMatch[1]}`;
      } else if (id.includes('/inject/')) {
        const numMatch = id.match(/\/inject\/(\d+)$/);
        if (numMatch) return `G${numMatch[1]}`;
      }
    }
    const objectName = stmt.object?.definition?.name?.['en-US'] || '';
    const prefixMatch = objectName.match(/^\d+-(\d+)\s/);
    if (prefixMatch) return `G${parseInt(prefixMatch[1], 10)}`;
    return '';
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
