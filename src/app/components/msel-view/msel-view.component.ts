// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
} from '@cmusei/crucible-common';
import {
  DataField,
  DataValue,
  Move,
  Msel,
  ScenarioEvent,
  User
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { MoveQuery } from 'src/app/data/move/move.query';
import { ScenarioEventDataService, ScenarioEventPlus } from 'src/app/data/scenario-event/scenario-event-data.service';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { AngularEditorConfig } from '@kolkov/angular-editor';

@Component({
  selector: 'app-msel-view',
  templateUrl: './msel-view.component.html',
  styleUrls: ['./msel-view.component.scss'],
})
export class MselViewComponent implements OnDestroy {
  @Input() tabHeight: number;
  @Input() userTheme: Theme;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };  myTopHeight = 79;
  msel: Msel = {};
  expandedScenarioEventIds: string[] = [];
  expandedMoreScenarioEventIds: string[] = [];
  sortedScenarioEvents: ScenarioEvent[];
  sortedDataFields: DataField[];
  dataValues: DataValue[] = [];
  names: string[] = [];
  mselUsers: User[] = [];
  darkThemeTint = this.settingsService.settings.DarkThemeTint ? this.settingsService.settings.DarkThemeTint : 0.7;
  lightThemeTint = this.settingsService.settings.LightThemeTint ? this.settingsService.settings.LightThemeTint : 0.4;
  mselScenarioEvents: ScenarioEventPlus[] = [];
  filteredScenarioEventList: ScenarioEventPlus[] = [];
  showRealTime = false;
  moveAndGroupNumbers: Record<string, number[]>[] = [];
  moveList: Move[] = [];
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
    private dataValueDataService: DataValueDataService,
    private dataValueQuery: DataValueQuery,
    private dataFieldDataService: DataFieldDataService,
    private dataFieldQuery: DataFieldQuery,
    private moveQuery: MoveQuery,
    private scenarioEventDataService: ScenarioEventDataService,
    private scenarioEventQuery: ScenarioEventQuery,
    private uiDataService: UIDataService
  ) {
    // subscribe to the route parameters.  Used when viewing independently.
    this.activatedRoute.params.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      const mselId = params['mselid'];
      if (mselId) {
        this.mselDataService.loadById(mselId);
        this.loadInitialData(mselId);
        this.mselDataService.setActive(mselId);
      }
    });
    // subscribe to the route query parameters.  Used when editing the MSEL and checking the view.
    activatedRoute.queryParamMap.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
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
    (this.mselQuery.selectActive() as Observable<Msel>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        this.msel = {... msel};
        this.mselUsers = this.getMselUsers();
      }
    });
    // subscribe to data fields
    this.dataFieldQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(dataFields => {
      this.sortedDataFields = this.getSortedDataFields(dataFields);
    });
    // subscribe to data values
    this.dataValueQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(dataValues => {
      this.dataValues = [];
      dataValues.forEach(dv => {
        this.dataValues.push({ ... dv });
      });
    });
    // subscribe to scenario events
    (this.scenarioEventQuery.selectAll()).pipe(takeUntil(this.unsubscribe$)).subscribe(scenarioEvents => {
      this.sortedScenarioEvents = this.getSortedScenarioEvents(scenarioEvents);
      this.moveAndGroupNumbers = this.scenarioEventDataService.getMoveAndGroupNumbers(this.sortedScenarioEvents, this.moveList);
    });
    // observe the Moves
    this.moveQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(moves => {
      this.moveList = moves.sort((a, b) => +a.moveNumber < +b.moveNumber ? -1 : 1);
      this.moveAndGroupNumbers = this.scenarioEventDataService.getMoveAndGroupNumbers(this.sortedScenarioEvents, this.moveList);
    });
    // set the time display format
    this.showRealTime = this.uiDataService.useRealTime();
  }

  loadInitialData(mselId: string) {
    this.dataFieldDataService.loadByMsel(mselId);
    this.dataValueDataService.loadByMsel(mselId);
    this.scenarioEventDataService.loadByMsel(mselId);
  }

  getSortedScenarioEvents(scenarioEvents: ScenarioEvent[]): ScenarioEvent[] {
    const sortedScenarioEvents: ScenarioEvent[] = [];
    if (scenarioEvents) {
      scenarioEvents.forEach(se => {
        if (!se.isHidden) {
          sortedScenarioEvents.push({... se});
        }
      });
      sortedScenarioEvents.sort((a, b) => +a.groupOrder > +b.groupOrder ? 1 : -1);
    }
    return sortedScenarioEvents;
  }

  getSortedDataFields(dataFields: DataField[]): DataField[] {
    this.names = [];
    const sortedDataFields: DataField[] = [];
    if (dataFields) {
      dataFields.forEach(df => {
        if (df.onExerciseView) {
          sortedDataFields.push({... df});
          this.names.push(df.name);
        }
      });
      sortedDataFields.sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
    }
    return sortedDataFields;
  }

  getMselUsers(): User[] {
    let users = [];
    this.msel.teams.forEach(team => {
      team.users.forEach(user => {
        users.push({... user});
      });
    });
    users = users.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
    return users;
  }

  trackByFn(index, item) {
    return item.id;
  }

  getScrollingHeight() {
    const topHeight = this.tabHeight ? this.myTopHeight + this.tabHeight : this.myTopHeight;
    return 'calc(100vh - ' + topHeight + 'px)';
  }

  getScenarioEventValue(scenarioEvent: ScenarioEvent, dataField: DataField) {
    const dataValue = this.dataValues
      .filter(dv => dv.scenarioEventId === scenarioEvent.id)
      .find(dv => dv.dataFieldId === dataField.id);
    return dataValue && dataValue.value != null ? dataValue.value : ' ';
  }

  getScenarioEventDateValue(scenarioEvent: ScenarioEvent, dataField: DataField) {
    const dataValue = this.dataValues
      .filter(dv => dv.scenarioEventId === scenarioEvent.id)
      .find(dv => dv.dataFieldId === dataField.id);
    const dateValue = dataValue && dataValue.value != null ? dataValue.value : ' ';
    const formattedValue = new Date(dateValue).toLocaleString();
    return formattedValue === 'Invalid Date' ? ' ' : formattedValue;
  }

  getUserName(scenarioEvent: ScenarioEvent, dataField: DataField) {
    let name = '';
    const dataValue = this.dataValues
      .filter(dv => dv.scenarioEventId === scenarioEvent.id)
      .find(dv => dv.dataFieldId === dataField.id);
    if (dataValue && dataValue.value != null) {
      const user = this.mselUsers.find(u => u.id === dataValue.value);
      if (user) {
        name = user.name;
      } else {
        name = dataValue.value;
      }
    }
    return name;
  }

  saveDataValue(scenarioEvent: ScenarioEvent, dataField: DataField, newValue: string) {
    const dataValue = { ...(this.dataValues
      .filter(dv => dv.scenarioEventId === scenarioEvent.id)
      .find(dv => dv.dataFieldId === dataField.id)) };
    dataValue.value = newValue;
    this.dataValueDataService.updateDataValue(dataValue);
  }

  getRowStyle(scenarioEvent: ScenarioEvent) {
    if (!scenarioEvent || !scenarioEvent.rowMetadata) {
      return '';
    }
    const rowMetadata = scenarioEvent.rowMetadata ? scenarioEvent.rowMetadata.split(',') : [];
    const color = rowMetadata.length >= 4 ? rowMetadata[1] + ', ' + rowMetadata[2] + ', ' + rowMetadata[3] : '';
    const tint = this.userTheme === 'dark-theme' ? this.darkThemeTint : this .lightThemeTint;
    const style = color ? {'background-color': 'rgba(' + color + ', ' + tint + ')'} : {};
    return style;
  }

  getStyle(dataField: DataField): string {
    if (dataField && dataField.columnMetadata) {
      const width = Math.trunc(+dataField.columnMetadata * 7);  // 7 converts excel widths to http widths
      return 'width: ' + width.toString() + 'px;';
    } else if (dataField.dataType.toString() === 'DateTime') {
      return 'width: max-content';
    } else {
      return 'width: ' + Math.trunc( 100 / this.sortedDataFields.length) + 'vh;';
      // return 'width: 100%;';
    }
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
