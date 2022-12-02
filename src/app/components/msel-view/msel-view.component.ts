// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
} from '@cmusei/crucible-common';
import {
  DataField,
  Msel,
  ScenarioEvent
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatMenuTrigger } from '@angular/material/menu';

@Component({
  selector: 'app-msel-view',
  templateUrl: './msel-view.component.html',
  styleUrls: ['./msel-view.component.scss'],
})
export class MselViewComponent implements OnDestroy {
  @Input() tabHeight: number;
  @Input() userTheme: Theme;
  myTopHeight = 79;
  msel: Msel = {};
  expandedScenarioEventIds: string[] = [];
  expandedMoreScenarioEventIds: string[] = [];
  sortedScenarioEvents: ScenarioEvent[];
  sortedDataFields: DataField[];
  private unsubscribe$ = new Subject();
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  darkThemeTint = this.settingsService.settings.DarkThemeTint ? this.settingsService.settings.DarkThemeTint : 0.7;
  lightThemeTint = this.settingsService.settings.LightThemeTint ? this.settingsService.settings.LightThemeTint : 0.4;

  constructor(
    private activatedRoute: ActivatedRoute,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery
  ) {
    this.activatedRoute.params.pipe(takeUntil(this.unsubscribe$)).subscribe(params => {
      const mselId = params['mselid'];
      if (mselId) {
        this.mselDataService.loadById(mselId);
        this.mselDataService.setActive(mselId);
      }
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<Msel>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        this.msel = {... msel};
        this.sortedScenarioEvents = this.getSortedScenarioEvents(msel.scenarioEvents);
        this.sortedDataFields = this.getSortedDataFields(msel.dataFields);
      }
    });
  }

  getSortedScenarioEvents(scenarioEvents: ScenarioEvent[]): ScenarioEvent[] {
    const sortedScenarioEvents: ScenarioEvent[] = [];
    if (scenarioEvents) {
      scenarioEvents.forEach(se => {
        sortedScenarioEvents.push({... se});
      });
      sortedScenarioEvents.sort((a, b) => +a.rowIndex > +b.rowIndex ? 1 : -1);
    }
    return sortedScenarioEvents;
  }

  getSortedDataFields(dataFields: DataField[]): DataField[] {
    const sortedDataFields: DataField[] = [];
    if (dataFields) {
      dataFields.forEach(df => {
        sortedDataFields.push({... df});
      });
      sortedDataFields.sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
    }
    return sortedDataFields;
  }

  trackByFn(index, item) {
    return item.id;
  }

  getScrollingHeight() {
    const topHeight = this.tabHeight ? this.myTopHeight + this.tabHeight : this.myTopHeight;
    return 'calc(100vh - ' + topHeight + 'px)';
  }

  getScenarioEventValue(scenarioEvent: ScenarioEvent, columnName: string) {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) return '';
    const dataField = this.msel.dataFields.find(df => df.name.toLowerCase().replace(/ /gi,'') === columnName.toLowerCase().replace(/ /gi,''));
    if (!dataField) return '';
    const dataValue = scenarioEvent.dataValues.find(dv => dv.dataFieldId === dataField.id);
    return dataValue && dataValue.value != null ? dataValue.value : ' ';
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

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
