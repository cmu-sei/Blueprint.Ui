// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Sort } from '@angular/material/sort';
import { Subject, Subscription, Observable, of } from 'rxjs';
import {
  takeUntil,
  debounceTime,
  distinctUntilChanged,
  mergeMap,
  delay,
} from 'rxjs/operators';
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
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { CardQuery } from 'src/app/data/card/card.query';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { v4 as uuidv4 } from 'uuid';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { MoveQuery } from 'src/app/data/move/move.query';
import { OrganizationQuery } from 'src/app/data/organization/organization.query';
import {
  DataValuePlus,
  ScenarioEventDataService,
  ScenarioEventView,
  ScenarioEventViewIndexing,
} from 'src/app/data/scenario-event/scenario-event-data.service';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { AngularEditorConfig } from '@kolkov/angular-editor';

@Component({
  selector: 'app-msel-view',
  templateUrl: './msel-view.component.html',
  styleUrls: ['./msel-view.component.scss'],
})
export class MselViewComponent implements OnDestroy, ScenarioEventView {
  @Input() tabHeight: number;
  @Input() userTheme: Theme;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  myTopHeight = 79;
  msel: Msel = {};
  expandedScenarioEventIds: string[] = [];
  expandedMoreScenarioEventIds: string[] = [];
  showSearch = false;

  // ScenarioEventView Fields
  mselScenarioEvents: ScenarioEvent[] = [];
  filterString = '';
  sort: Sort = { active: '', direction: '' };
  sortedScenarioEvents: ScenarioEvent[];
  sortedDataFields: DataField[];
  dataValues: DataValue[] = [];
  cardList: Card[] = [];
  mselUsers: User[] = [];
  viewIndex = new ScenarioEventViewIndexing();

  sortableDataTypes = this.scenarioEventDataService.sortableDataTypes;
  names: string[] = [];
  organizationList: Organization[] = [];
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
  showRealTime = false;
  moveAndGroupNumbers: Record<string, number[]>[] = [];
  moveList: Move[] = [];
  teamList: Team[] = [];
  keyUp = new Subject<KeyboardEvent>();
  private subscription: Subscription;
  private unsubscribe$ = new Subject();
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
    sanitize: true,
  };

  constructor(
    private activatedRoute: ActivatedRoute,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private organizationQuery: OrganizationQuery,
    private dataValueDataService: DataValueDataService,
    private dataValueQuery: DataValueQuery,
    private teamQuery: TeamQuery,
    private dataFieldDataService: DataFieldDataService,
    private dataFieldQuery: DataFieldQuery,
    private cardQuery: CardQuery,
    private moveQuery: MoveQuery,
    private scenarioEventDataService: ScenarioEventDataService,
    private scenarioEventQuery: ScenarioEventQuery,
    private uiDataService: UIDataService
  ) {
    // subscribe to the route parameters.  Used when viewing independently.
    this.activatedRoute.params
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        const mselId = params['mselid'];
        if (mselId) {
          this.mselDataService.loadById(mselId);
          this.loadInitialData(mselId);
          this.mselDataService.setActive(mselId);
        }
      });
    // subscribe to the route query parameters.  Used when editing the MSEL and checking the view.
    activatedRoute.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        // set the selected tab based on the injectData
        const mselId = params.get('msel');
        if (!mselId) {
          this.mselDataService.setActive('');
        } else if (!this.msel || this.msel.id !== mselId) {
          this.loadInitialData(mselId);
          this.mselDataService.setActive(mselId);
        }
      });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<Msel>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel) {
          this.msel = { ...msel };
          this.mselUsers = this.getMselUsers();
        }
      });
    // subscribe to data fields
    this.dataFieldQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((dataFields) => {
        this.sortedDataFields = this.getSortedDataFields(dataFields);
        this.scenarioEventDataService.updateScenarioEventViewDataFields(this);
        this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(
          this
        );
      });
    // subscribe to data values
    this.dataValueQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((dataValues) => {
        this.dataValues = [];
        dataValues.forEach((dv) => {
          this.dataValues.push({ ...dv });
        });
        this.scenarioEventDataService.updateScenarioEventViewDataValues(this);
        this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(
          this
        );
      });
    // subscribe to scenario events
    this.scenarioEventQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((scenarioEvents) => {
        this.scenarioEventDataService.refreshScenarioEventViewEvents(
          this,
          scenarioEvents
        );
        if (scenarioEvents && scenarioEvents.length > 0) {
          this.moveAndGroupNumbers =
            this.scenarioEventDataService.getMoveAndGroupNumbers(
              this.mselScenarioEvents,
              this.moveList
            );
          this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(
            this
          );
        }
      });
    // subscribe to organizations
    this.organizationQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((organizations) => {
        this.organizationList = organizations.filter(
          (org) => !org.isTemplate && org.mselId === this.msel.id
        );
      });
    // observe the Cards
    this.cardQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((cards) => {
        this.cardList = cards;
      });
    this.scenarioEventDataService.updateScenarioEventViewCards(this);
    this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
    // observe the Moves
    this.moveQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((moves) => {
        this.moveList = moves.sort((a, b) =>
          +a.moveNumber < +b.moveNumber ? -1 : 1
        );
        this.moveAndGroupNumbers =
          this.scenarioEventDataService.getMoveAndGroupNumbers(
            this.sortedScenarioEvents,
            this.moveList
          );
      });
    // observe the Teams
    this.teamQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((teams) => {
        this.teamList = teams;
      });
    // subscribe to filter string changes for debounce
    this.subscription = this.keyUp
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        mergeMap((search) => of(search).pipe(delay(250)))
      )
      .subscribe((event) => {
        this.applyFilter(this.filterString);
      });
    // set the time display format
    this.showRealTime = this.uiDataService.useRealTime();
  }

  get userList(): User[] {
    return this.mselUsers;
  }

  get dataFields(): DataField[] {
    return this.sortedDataFields;
  }

  get showHiddenEvents(): boolean {
    return false;
  }

  get displayedScenarioEvents(): ScenarioEvent[] {
    return this.sortedScenarioEvents;
  }
  set displayedScenarioEvents(evts: ScenarioEvent[]) {
    this.sortedScenarioEvents = evts;
  }

  loadInitialData(mselId: string) {
    this.dataFieldDataService.loadByMsel(mselId);
    this.dataValueDataService.loadByMsel(mselId);
    this.scenarioEventDataService.loadByMsel(mselId);
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.scenarioEventDataService.updateScenarioEventViewDisplayedEvents(this);
  }

  getSortedDataFields(dataFields: DataField[]): DataField[] {
    this.names = [];
    const sortedDataFields: DataField[] = [];
    if (dataFields) {
      dataFields.forEach((df) => {
        if (df.onExerciseView) {
          sortedDataFields.push({ ...df });
          this.names.push(df.name);
        }
      });
      sortedDataFields.sort((a, b) =>
        +a.displayOrder > +b.displayOrder ? 1 : -1
      );
    }
    return sortedDataFields;
  }

  newDataValuePlus(
    scenarioEventId: string,
    dataFieldId: string
  ): DataValuePlus {
    const ndvp = {
      id: uuidv4(),
      scenarioEventId: scenarioEventId,
      dataFieldId: dataFieldId,
      value: '',
      valueArray: [],
    } as DataValuePlus;

    return ndvp;
  }

  getDataValue(
    scenarioEvent: ScenarioEvent,
    dataFieldName: string
  ): DataValuePlus {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return this.blankDataValue;
    }
    return this.scenarioEventDataService.getDataValueFromView(
      this,
      scenarioEvent,
      dataFieldName
    );
  }

  getDisplayValue(scenarioEvent: ScenarioEvent, dataFieldName: string): string {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return '';
    }
    return this.scenarioEventDataService.getDisplayValueFromView(
      this,
      scenarioEvent,
      dataFieldName
    );
  }

  getMselUsers(): User[] {
    let users = [];
    this.msel.teams.forEach((team) => {
      team.users.forEach((user) => {
        users.push({ ...user });
      });
    });
    this.msel.units.forEach((unit) => {
      unit.users.forEach((user) => {
        users.push({ ...user });
      });
    });
    users = users.sort((a, b) =>
      a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1
    );
    return users;
  }

  trackByFn(index, item) {
    return item.id;
  }

  getSortedOrganizationOptions(): string[] {
    let orgs: string[] = [];
    this.organizationList.forEach((o) => {
      orgs.push(o.shortName);
    });
    this.msel.teams.forEach((t) => {
      orgs.push(t.shortName);
    });
    orgs = orgs.sort((a, b) => (a < b ? -1 : 1));
    return orgs;
  }

  getSortedTeamOptions(): string[] {
    let teams: string[] = [];
    this.msel.teams.forEach((t) => {
      teams.push(t.shortName);
    });
    teams = teams.sort((a, b) => (a < b ? -1 : 1));
    return teams;
  }

  getScrollingHeight() {
    const topHeight = this.tabHeight
      ? this.myTopHeight + this.tabHeight
      : this.myTopHeight;
    return 'calc(100vh - ' + topHeight + 'px)';
  }

  blankDataValuePlus(): DataValuePlus {
    const bdvp = {
      id: '',
      scenarioEventId: '',
      dataFieldId: '',
      value: '',
      valueArray: [],
    } as DataValuePlus;

    return bdvp;
  }

  saveDataValue(
    scenarioEvent: ScenarioEvent,
    dataField: DataField,
    newValue: string
  ) {
    let dataValue = this.getDataValue(scenarioEvent, dataField.name);
    if (!dataValue || !dataValue.id) {
      // the dataValue doesn't exist, so create a new one
      const dataFieldId = this.sortedDataFields.find(
        (df) => df.name === dataField.name
      ).id;
      dataValue = this.newDataValuePlus(scenarioEvent.id, dataFieldId);
      dataValue.value = newValue;
      this.dataValueDataService.add(dataValue);
    } else {
      dataValue.value = newValue;
      this.dataValueDataService.updateDataValue(dataValue);
    }
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
      const width = Math.trunc(+dataField.columnMetadata * 7); // 7 converts excel widths to http widths
      return 'text-align: left; width: ' + width.toString() + 'px;';
    } else if (dataField.dataType.toString() === 'DateTime') {
      return 'width: max-content';
    } else {
      return 'text-align: left; width: 90%; min-width: 40px;';
      // return 'width: 100%;';
    }
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

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
