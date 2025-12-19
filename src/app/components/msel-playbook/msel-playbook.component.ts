/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/
import {
  ComnSettingsService,
  Theme
} from '@cmusei/crucible-common';
import { ActivatedRoute} from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { Subject, Observable } from 'rxjs';
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { TeamDataService } from 'src/app/data/team/team-data.service';
import { OrganizationDataService } from 'src/app/data/organization/organization-data.service';
import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { DataValueDataService } from 'src/app/data/data-value/data-value-data.service';
import {
  ScenarioEventDataService,
  DataValuePlus,
} from 'src/app/data/scenario-event/scenario-event-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { MoveQuery } from 'src/app/data/move/move.query';
import {
  DataField,
  DataFieldType,
  DataValue,
  Move,
  ScenarioEvent,
  MselItemStatus,
  Card,
} from 'src/app/generated/blueprint.api';
import { UntypedFormControl } from '@angular/forms';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { Sort } from '@angular/material/sort';
import { Component, Input } from '@angular/core';
import { UIDataService } from 'src/app/data/ui/ui-data.service';
import { CardQuery } from 'src/app/data/card/card.query';
import { CardDataService } from 'src/app/data/card/card-data.service';
import { PageEvent } from '@angular/material/paginator';

@Component({
    selector: 'app-msel-playbook',
    templateUrl: './msel-playbook.component.html',
    styleUrls: ['./msel-playbook.component.scss'],
    standalone: false
})
export class MselPlaybookComponent {
  @Input() userTheme: Theme;
  @Input() isContentDeveloper: boolean;
  @Input() loggedInUserId: string;
  pageIndex = 0;
  pageSize = 1;
  defaultPageSizeOptions = [1, 5, 10, 20];
  pageSizeOptions = this.defaultPageSizeOptions;
  imageFilePath = '';
  scenarioEventId = '';
  selectedMselId = '';
  selectedScenarioEventId = '';
  private unsubscribe$ = new Subject();
  msel = new MselPlus();
  sortedDataFields: DataField[] = [];
  cardList: Card[] = [];
  allDataFields: DataField[] = [];
  dateFormControls = new Map<string, UntypedFormControl>();
  dataValues: DataValue[] = [];
  mselScenarioEvents: ScenarioEvent[] = [];
  sortedScenarioEvents: ScenarioEvent[] = [];
  moveAndGroupNumbers: Record<string, number[]>[] = [];
  moveList: Move[] = [];
  filteredScenarioEventList: ScenarioEvent[] = [];
  filterString = '';
  blankDataValue = {
    id: '',
    scenarioEventId: '',
    dataFieldId: '',
    value: '',
    valueArray: [],
  } as DataValuePlus;
  sort: Sort = { active: 'deltaSeconds', direction: 'asc' };
  itemStatus = [
    MselItemStatus.Pending,
    MselItemStatus.Entered,
    MselItemStatus.Approved,
    MselItemStatus.Complete,
    MselItemStatus.Deployed,
    MselItemStatus.Archived,
  ];
  darkThemeTint = this.settingsService.settings.DarkThemeTint
    ? this.settingsService.settings.DarkThemeTint
    : 0.7;
  lightThemeTint = this.settingsService.settings.LightThemeTint
    ? this.settingsService.settings.LightThemeTint
    : 0.4;

  constructor(
    private settingsService: ComnSettingsService,
    private moveDataService: MoveDataService,
    private organizationDataService: OrganizationDataService,
    private mselDataService: MselDataService,
    private teamDataService: TeamDataService,
    private dataFieldDataService: DataFieldDataService,
    private dataValueDataService: DataValueDataService,
    private scenarioEventDataService: ScenarioEventDataService,
    private mselQuery: MselQuery,
    private dataFieldQuery: DataFieldQuery,
    private moveQuery: MoveQuery,
    private dataValueQuery: DataValueQuery,
    private scenarioEventQuery: ScenarioEventQuery,
    private cardQuery: CardQuery,
    private activatedRoute: ActivatedRoute
  ) {
    // set image
    this.activatedRoute.paramMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((params) => {
        // load the selected MSEL data
        const mselId = params.get('id');
        const scenarioEventId = params.get('scenarioEventId');
        this.scenarioEventId = scenarioEventId;
        if (mselId && this.selectedMselId !== mselId) {
          // load the selected MSEL and make it active
          this.mselDataService.loadById(mselId);
          this.mselDataService.setActive(mselId);
          // // load the MSELs moves
          this.moveDataService.loadByMsel(mselId);
          // // load the MSEL Teams
          this.teamDataService.loadByMsel(mselId);
          // // load the MSEL organizations and templates
          this.organizationDataService.loadByMsel(mselId);
          // // load data fields and values
          this.dataFieldDataService.loadByMsel(mselId);
          this.dataValueDataService.loadByMsel(mselId);
          // // load scenario events
          if (scenarioEventId) {
            this.scenarioEventDataService.loadById(scenarioEventId);
          }
        }
      });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
        if (msel && this.msel.id !== msel.id) {
          this.msel = this.getEditableMsel(msel) as MselPlus;
        }
      });
    // subscribe to data fields
    this.dataFieldQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((dataFields) => {
        this.getSortedDataFields(dataFields);
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
      });
    this.cardQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((cards) => {
        this.cardList = cards;
      });

    this.scenarioEventQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((scenarioEvents) => {
        this.mselScenarioEvents = this.getEditableScenarioEvents(
          scenarioEvents as ScenarioEvent[]
        );
        if (scenarioEvents && scenarioEvents.length > 0) {
          this.moveAndGroupNumbers =
            this.scenarioEventDataService.getMoveAndGroupNumbers(
              this.mselScenarioEvents,
              this.moveList
            );
          this.filteredScenarioEventList = this.getFilteredScenarioEvents();
          this.sortedScenarioEvents = this.getSortedScenarioEvents(
            this.filteredScenarioEventList
          );
          this.setPageSizeOptions();
        }
      });
    this.moveQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((moves) => {
        this.moveList = moves.sort((a, b) =>
          +a.moveNumber < +b.moveNumber ? -1 : 1
        );
        this.moveAndGroupNumbers =
          this.scenarioEventDataService.getMoveAndGroupNumbers(
            this.mselScenarioEvents,
            this.moveList
          );
      });
  }

  getEditableMsel(msel: MselPlus): MselPlus {
    const editableMsel = new MselPlus();
    Object.assign(editableMsel, msel);
    editableMsel.teams = editableMsel.teams
      .slice(0)
      .sort((a, b) =>
        a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1
      );
    editableMsel.units = editableMsel.units
      .slice(0)
      .sort((a, b) =>
        a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1
      );

    return editableMsel;
  }

  getSortedDataFields(dataFields: DataField[]) {
    if (dataFields) {
      this.sortedDataFields = dataFields
        .filter((df) => df.onScenarioEventList)
        .sort((a, b) => (+a.displayOrder > +b.displayOrder ? 1 : -1));
      this.allDataFields = dataFields.sort((a, b) =>
        +a.displayOrder > +b.displayOrder ? 1 : -1
      );
    }
    // create date form controls
    this.allDataFields.forEach((df) => {
      if (df.dataType === DataFieldType.DateTime) {
        this.dateFormControls[df.id] = new UntypedFormControl();
      }
    });
  }

  getEditableScenarioEvents(scenarioEvents: ScenarioEvent[]): ScenarioEvent[] {
    const editableList: ScenarioEvent[] = [];
    scenarioEvents.forEach((scenarioEvent) => {
      const newScenarioEvent = { ...scenarioEvent };
      editableList.push(newScenarioEvent);
    });

    return editableList;
  }

  getFilteredScenarioEvents(): ScenarioEvent[] {
    const mselScenarioEvents: ScenarioEvent[] = [];
    if (this.mselScenarioEvents) {
      this.mselScenarioEvents.forEach((se) => {
        if (se.mselId === this.msel.id) {
          mselScenarioEvents.push({ ...se });
        }
      });
      if (
        mselScenarioEvents &&
        mselScenarioEvents.length > 0 &&
        this.filterString
      ) {
        const filterString = this.filterString.toLowerCase();
        const that = this;
        const filteredScenarioEvents = mselScenarioEvents.filter((a) =>
          this.sortedDataFields.some((df) =>
            that
              .getDataValue(a, df.name)
              .value?.toLowerCase()
              .includes(filterString)
          )
        );
        return filteredScenarioEvents;
      }
    }
    return mselScenarioEvents;
  }

  getDataValue(
    scenarioEvent: ScenarioEvent,
    dataFieldName: string
  ): DataValuePlus {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return this.blankDataValue;
    }
    const dataFieldId = this.getDataFieldIdByName(scenarioEvent, dataFieldName);
    if (!dataFieldId) {
      return this.blankDataValue;
    }
    let dataValuePlus = this.dataValues.find(
      (dv) =>
        dv.dataFieldId === dataFieldId &&
        dv.scenarioEventId === scenarioEvent.id
    ) as DataValuePlus;
    if (dataValuePlus) {
      dataValuePlus.valueArray = dataValuePlus.value
        ? dataValuePlus.value.split(', ')
        : [];
    } else {
      dataValuePlus = this.blankDataValue;
    }
    return dataValuePlus;
  }

  getDataFieldIdByName(scenarioEvent: ScenarioEvent, name: string): string {
    const dataField = this.allDataFields.find(
      (df) => df.name.toLowerCase() === name.toLowerCase()
    );
    return dataField ? dataField.id : '';
  }

  getSortedScenarioEvents(scenarioEvents: ScenarioEvent[]): ScenarioEvent[] {
    let sortedScenarioEvents: ScenarioEvent[];
    if (scenarioEvents) {
      if (scenarioEvents.length > 0 && this.sort && this.sort.direction) {
        sortedScenarioEvents = (scenarioEvents as ScenarioEvent[]).sort(
          (a: ScenarioEvent, b: ScenarioEvent) => this.sortScenarioEvents(a, b)
        );
      } else {
        sortedScenarioEvents = (scenarioEvents as ScenarioEvent[]).sort(
          (a, b) => (+a.deltaSeconds > +b.deltaSeconds ? 1 : -1)
        );
      }
    }
    return sortedScenarioEvents;
  }

  private sortScenarioEvents(a: ScenarioEvent, b: ScenarioEvent): number {
    const dir = this.sort.direction === 'desc' ? -1 : 1;
    if (!this.sort.direction || this.sort.active === 'deltaSeconds') {
      this.sort = { active: 'deltaSeconds', direction: 'asc' };
      return +a.deltaSeconds < +b.deltaSeconds ? -dir : dir;
    } else {
      const aValue = this.getDataValue(a, this.sort.active)
        .value?.toString()
        .toLowerCase();
      const bValue = this.getDataValue(b, this.sort.active)
        .value?.toString()
        .toLowerCase();
      if (aValue === bValue) {
        return +a.deltaSeconds < +b.deltaSeconds ? -dir : dir;
      } else {
        return aValue < bValue ? -dir : dir;
      }
    }
  }

  getScenarioEventValue(scenarioEvent: ScenarioEvent, columnName: string) {
    if (!(this.msel && scenarioEvent && scenarioEvent.id)) {
      return '';
    }
    const dataField = this.allDataFields.find((df) => df.name === columnName);
    if (!dataField) {
      return '';
    }
    const dataValue = this.dataValues.find(
      (dv) =>
        dv.dataFieldId === dataField.id &&
        dv.scenarioEventId === scenarioEvent.id
    );

    if (dataValue) {
      if (dataField.dataType === 'Card') {
        return this.getCardNameById(dataValue.value);
      } else {
        return dataValue.value != null ? dataValue.value : '';
      }
    } else {
      return '';
    }
  }

  getScenarioEventById(id: string): ScenarioEvent | undefined {
    return this.mselScenarioEvents.find((se) => se.id === id);
  }

  getScenarioEventTitle(scenarioEvent: ScenarioEvent): string {
    if (!scenarioEvent) {
      return '';
    }
    const titleField = this.allDataFields.find((df) => df.name === 'Title');
    if (!titleField) {
      return '';
    }
    const titleDataValue = this.dataValues.find(
      (dv) =>
        dv.dataFieldId === titleField.id &&
        dv.scenarioEventId === scenarioEvent.id
    );
    return titleDataValue ? titleDataValue.value : '';
  }

  getTitleForScenarioEvent(scenarioEventId: string): string {
    const scenarioEvent = this.getScenarioEventById(scenarioEventId);
    return scenarioEvent ? this.getScenarioEventTitle(scenarioEvent) : '';
  }

  printpage() {
    const printContents = document.getElementById('printable-area').innerHTML;
    document.body.innerHTML = printContents;
    window.print();
    location.reload();
  }

  getCardNameById(cardId: string): string {
    const card = this.cardList.find((c) => c.id === cardId);
    return card ? card.name : 'Unknown';
  }

  removeHtmlTags(content) {
    const template = document.createElement('template');
    template.innerHTML = content;
    return template.content.textContent;
  }

  changePage(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  getPagedScenarioEvents(): ScenarioEvent[] {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.sortedScenarioEvents.slice(startIndex, endIndex);
  }

  setPageSizeOptions() {
    const newOptions = [];
    const max = this.sortedScenarioEvents.length;
    this.defaultPageSizeOptions.forEach((m) => {
      if (m < max) {
        newOptions.push(m);
      }
    });
    newOptions.push(max);
    this.pageSizeOptions = newOptions;
  }
}
