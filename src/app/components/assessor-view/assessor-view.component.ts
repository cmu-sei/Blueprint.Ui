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
  actor?: { name?: string; account?: { name?: string } };
  verb?: { id?: string; display?: { 'en-US'?: string } };
  object?: { id?: string; definition?: { name?: { 'en-US'?: string }; type?: string } };
  result?: { score?: { raw?: number }; completion?: boolean; success?: boolean };
  timestamp?: string;
  context?: { team?: { name?: string }; platform?: string; extensions?: Record<string, any> };
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
          this.displayedScenarioEvents, this.moveList
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

  trackByFn(index, item) {
    return item.id;
  }

  // xAPI evidence
  toggleEvent(eventId: string) {
    if (this.expandedEventId === eventId) {
      this.expandedEventId = '';
    } else {
      this.expandedEventId = eventId;
      const cached = this.eventStatements.get(eventId);
      if (!cached || cached.length === 0) {
        this.loadStatementsForEvent(eventId);
      }
    }
  }

  private loadStatementsForEvent(eventId: string) {
    const event = this.mselScenarioEvents.find(e => e.id === eventId);
    if (!event || !this.msel.id) return;

    const sortedIndex = this.displayedScenarioEvents.indexOf(event);
    const nextEvent = this.displayedScenarioEvents[sortedIndex + 1];

    const params: any = { mselId: this.msel.id };
    if (event.deltaSeconds != null && this.msel.startTime) {
      const baseTime = new Date(this.msel.startTime);
      const since = new Date(baseTime.getTime() + (event.deltaSeconds * 1000));
      params.since = since.toISOString();
      if (nextEvent?.deltaSeconds != null) {
        const until = new Date(baseTime.getTime() + (nextEvent.deltaSeconds * 1000));
        params.until = until.toISOString();
      }
    }

    const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl : this.apiUrl + '/';
    if (params.since && params.until && params.since > params.until) {
      delete params.until;
    }
    this.loadingStatements.add(eventId);
    this.http.get<any>(`${baseUrl}api/xapi/statements`, { params })
      .subscribe({
        next: (response) => {
          const statements = response?.statements || response || [];
          this.eventStatements.set(eventId, Array.isArray(statements) ? statements : []);
          this.loadingStatements.delete(eventId);
        },
        error: () => {
          this.eventStatements.set(eventId, []);
          this.loadingStatements.delete(eventId);
        }
      });
  }

  getStatements(eventId: string): XApiStatement[] {
    return this.eventStatements.get(eventId) || [];
  }

  isLoading(eventId: string): boolean {
    return this.loadingStatements.has(eventId);
  }

  formatStatement(stmt: XApiStatement): string {
    const actor = stmt.actor?.name || stmt.actor?.account?.name || 'Unknown';
    const team = stmt.context?.team?.name ? ` (${stmt.context.team.name})` : '';
    const verb = stmt.verb?.display?.['en-US'] || stmt.verb?.id?.split('/').pop() || '?';
    const object = stmt.object?.definition?.name?.['en-US'] || stmt.object?.id || '?';
    const platform = stmt.context?.platform ? `[${stmt.context.platform}]` : '';
    return `${platform} ${actor}${team} ${verb} ${object}`.trim();
  }

  formatTimestamp(timestamp: string): string {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
