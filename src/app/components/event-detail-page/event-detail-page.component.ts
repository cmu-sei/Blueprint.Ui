/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { TopbarView } from 'src/app/components/shared/top-bar/topbar.models';
import {
  ComnSettingsService,
  Theme
} from '@cmusei/crucible-common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
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
  Organization,
  MselItemStatus,
  Team,
  Unit,
  User,
  Card,
  ScenarioEvent,
} from 'src/app/generated/blueprint.api';
import { UntypedFormControl } from '@angular/forms';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { ScenarioEventQuery } from 'src/app/data/scenario-event/scenario-event.query';
import { Sort } from '@angular/material/sort';
import { Component, Input } from '@angular/core';
import { AngularEditorConfig } from '@kolkov/angular-editor';
import { CardQuery } from 'src/app/data/card/card.query';
import { UIDataService } from 'src/app/data/ui/ui-data.service';

@Component({
  selector: 'app-event-detail-page',
  templateUrl: './event-detail-page.component.html',
  styleUrls: ['./event-detail-page.component.scss'],
})
export class EventDetailPageComponent {
  @Input() userTheme: Theme;
  @Input() isContentDeveloper: boolean;
  @Input() loggedInUserId: string;
  topbarText = 'Scenario Event Details';
  hideTopbar = false;
  imageFilePath = '';
  scenarioEventId = '';
  topbarColor = '#ef3a47';
  topbarTextColor = '#FFFFFF';
  topbarImage = this.settingsService.settings.AppTopBarImage;
  TopbarView = TopbarView;
  appTitle = 'Scenario Event Details';
  mselId = '';
  private unsubscribe$ = new Subject();
  msel = new MselPlus();
  sortedDataFields: DataField[] = [];
  cardList: Card[] = [];
  dateFormControls = new Map<string, UntypedFormControl>();
  dataValues: DataValue[] = [];
  scenarioEvent: ScenarioEvent = {};
  moveList: Move[] = [];
  teamList: Team[] = [];
  unitList: Unit[] = [];
  filterString = '';
  blankDataValue = {
    id: '',
    scenarioEventId: '',
    dataFieldId: '',
    value: '',
    valueArray: [],
  } as DataValuePlus;
  organizationList: Organization[] = [];
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
  selectedEventIdList: string[] = [];
  mselUsers: User[] = [];
  showRealTime = false;
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
  dataType: typeof DataFieldType = DataFieldType;
  dataValueId = '';

  constructor(
    private settingsService: ComnSettingsService,
    private router: Router,
    private moveDataService: MoveDataService,
    private organizationDataService: OrganizationDataService,
    private mselDataService: MselDataService,
    private titleService: Title,
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
    private activatedRoute: ActivatedRoute,
    private uiDataService: UIDataService
  ) {
    this.hideTopbar = this.uiDataService.inIframe();
    // set image
    this.imageFilePath = this.settingsService.settings.AppTopBarImage.replace(
      'white',
      'blue'
    );
    this.titleService.setTitle(this.appTitle);
    // Set the display settings from config file
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor
      ? this.settingsService.settings.AppTopBarHexColor
      : this.topbarColor;
    this.topbarTextColor = this.settingsService.settings.AppTopBarHexTextColor
      ? this.settingsService.settings.AppTopBarHexTextColor
      : this.topbarTextColor;
    this.activatedRoute.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((queryParams) => {
        // load the selected MSEL data
        const mselId = queryParams.get('msel');
        const scenarioEventId = queryParams.get('scenarioEvent');
        this.dataValueId = queryParams.get('dataValue');
        this.scenarioEventId = scenarioEventId;
        if (mselId && this.mselId !== mselId) {
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
        if (scenarioEvents && scenarioEvents.length > 0) {
          this.scenarioEvent = scenarioEvents.find(
            (m) => m.id === this.scenarioEventId
          );
        }
      });
    this.moveQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((moves) => {
        this.moveList = moves.sort((a, b) =>
          +a.moveNumber < +b.moveNumber ? -1 : 1
        );
      });
  }

  topBarNavigate(url): void {
    this.router.navigate([url]);
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
      this.sortedDataFields = dataFields.sort((a, b) =>
        +a.displayOrder > +b.displayOrder ? 1 : -1
      );
    }
    // create date form controls
    this.sortedDataFields.forEach((df) => {
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

  getDataValue(dataFieldId: string): DataValuePlus {
    if (!(this.msel && this.scenarioEvent && this.scenarioEvent.id)) {
      return this.blankDataValue;
    }
    if (!dataFieldId) {
      return this.blankDataValue;
    }
    let dataValuePlus = this.dataValues.find(
      (dv) =>
        dv.dataFieldId === dataFieldId &&
        dv.scenarioEventId === this.scenarioEvent.id
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

  getDataValueById() {
    if (this.dataValueId) {
      const dataValue = this.dataValues.find(
        (dv) => dv.id === this.dataValueId
      );
      return dataValue ? dataValue.value : '';
    }
    return '';
  }

  getScenarioEventValue(dataField: DataField) {
    if (!(this.msel && this.scenarioEvent && this.scenarioEvent.id)) {
      return '';
    }
    const dataValue = this.dataValues.find(
      (dv) =>
        dv.dataFieldId === dataField.id &&
        dv.scenarioEventId === this.scenarioEvent.id
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

  openInNewTab(scenarioEventId: string, dataFieldId: string) {
    const dataValue = this.dataValues.find(
      (dv) =>
        dv.dataFieldId === dataFieldId && dv.scenarioEventId === scenarioEventId
    );
    if (dataValue && dataValue.id) {
      const url =
        document.baseURI +
        '/eventdetail?msel=' +
        this.msel.id +
        '&scenarioEvent=' +
        this.scenarioEventId +
        '&dataValue=' +
        dataValue.id;
      window.open(url);
    }
  }
}
