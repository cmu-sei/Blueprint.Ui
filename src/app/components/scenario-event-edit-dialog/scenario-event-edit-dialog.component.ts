// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, OnInit, inject, output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTabLabel } from '@angular/material/tabs';
import {
  AutomationTaskDraft,
  taskErrors,
  toFields,
  triggerLoops,
} from 'src/app/utilities/automation-tasks';
import { AutomationActionDataService } from 'src/app/data/automation-action/automation-action-data.service';
import {
  AutomationTaskListComponent,
  AutomationTriggerOption,
} from '../automation-task-list/automation-task-list.component';
import {
  AutomationTestDialogComponent,
  AutomationTestDialogData,
} from '../automation-test-dialog/automation-test-dialog.component';
import { Subject } from 'rxjs';
import {
  AutomationRun,
  AutomationTaskFields,
  Card,
  DataField,
  DataFieldType,
  EventType,
  MselItemStatus,
  MselRole,
  Move,
  ScenarioEvent,
  Team,
  Unit,
  User,
} from 'src/app/generated/blueprint.api';
import { Sort } from '@angular/material/sort';
import {
  DataValuePlus,
  IntegrationTarget,
} from 'src/app/data/scenario-event/scenario-event-data.service';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EDITOR_CONFIG, VIEW_CONFIG } from 'src/app/utilities/editor-config';
import { hasInvalidDataValue } from 'src/app/utilities/ip-address';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatOption } from '@angular/material/autocomplete';
import { MatTabGroup, MatTab } from '@angular/material/tabs';
import { DurationEditComponent } from '../shared/duration-edit/duration-edit.component';
import { DataValueComponent } from '../data-value/data-value.component';

/** What the scenario event list opens the dialog with. */
export interface ScenarioEventEditDialogData {
  /** The event being edited; a save sends automationTasks only once they changed. */
  scenarioEvent: ScenarioEvent & { automationTasks?: AutomationTaskFields[] };
  integrationTargetOptions: string[];
  dataFields: DataField[];
  organizationList: string[];
  teamList: Team[];
  unitList: Unit[];
  moveList: Move[];
  cardList: Card[];
  gallerySourceTypes: string[];
  galleryItemStatuses: string[];
  isNew: boolean;
  isOwner: boolean;
  isApprover: boolean;
  isEditor: boolean;
  isContentDeveloper?: boolean;
  isEditingRestricted: boolean;
  showScenarioEventType: boolean;
  useCite: boolean;
  useGallery: boolean;
  userList: User[];
  mselStartTime: Date;
  mselId?: string;
  /** The event's tasks as drafts, copies of them for a copied event. */
  automationTasks?: AutomationTaskDraft[];
  /** Which of the tasks are saved, and so can be tested with their history. */
  savedTaskIds?: string[];
  /** The tasks of the MSEL's other events, which a task here can be triggered by. */
  triggerOptions?: AutomationTriggerOption[];
  /** The triggers of the other events' tasks, for finding a loop. */
  otherTriggers?: Map<string, string | null>;
  latestTests?: Map<string, AutomationRun>;
  canTest?: boolean;
  eventLabel?: string;
  testPlayerViewId?: string | null;
  deployedPlayerViewId?: string | null;
  /** The tab to open on, as the Automation column opens it. */
  initialTab?: string;
}

@Component({
  selector: 'app-scenario-event-edit-dialog',
  templateUrl: './scenario-event-edit-dialog.component.html',
  styleUrls: ['./scenario-event-edit-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    MatFormField,
    MatLabel,
    MatSelect,
    FormsModule,
    MatOption,
    MatTabGroup,
    MatTab,
    DurationEditComponent,
    DataValueComponent,
    MatInput,
    MatTabLabel,
    AutomationTaskListComponent,
  ],
})
export class ScenarioEventEditDialogComponent implements OnDestroy, OnInit {
  data = inject<ScenarioEventEditDialogData>(MAT_DIALOG_DATA);
  private dialog = inject(MatDialog);
  private actionData = inject(AutomationActionDataService);

  readonly editComplete = output<any>();
  sort: Sort = { active: '', direction: '' };
  sortedScenarioEvents: ScenarioEvent[] = [];
  newScenarioEvent: ScenarioEvent;
  isAddingScenarioEvent = false;
  canDoAnything = false;
  private unsubscribe$ = new Subject();
  editorConfig = EDITOR_CONFIG;
  viewConfig = VIEW_CONFIG;
  dataType: typeof DataFieldType = DataFieldType;
  eventType: typeof EventType = EventType;
  eventTypes = [
    EventType.Inject,
    EventType.Information,
    EventType.Facilitation,
  ];
  itemStatus = [
    MselItemStatus.Pending,
    MselItemStatus.Entered,
    MselItemStatus.Approved,
    MselItemStatus.Complete,
    MselItemStatus.Deployed,
    MselItemStatus.Archived,
  ];
  mselRole = {
    Owner: MselRole.Owner,
    Approver: MselRole.Approver,
    Editor: MselRole.Editor,
  };
  blankDataValue = {
    id: '',
    value: '',
    valueArray: [],
  } as DataValuePlus;
  scenarioEventBackgroundColors: Array<string>;
  sortedDataFields: DataField[] = [];
  selectedTab = 0;
  selectedTabName = '';
  currentFilterBy = 'all';
  integrationTarget = IntegrationTarget;
  // the event's tasks as this edit leaves them; sent with the event only once changed
  automationTasks: AutomationTaskDraft[] = [];
  tasksChanged = false;
  readonly emptyRuns = new Map<string, AutomationRun>();

  ngOnInit() {
    if (!this.data.isNew && this.showDefaultTab()) {
      this.sortedDataFields = this.getFilteredDataFields('default');
    } else {
      this.sortedDataFields = this.getFilteredDataFields('all');
    }
    this.automationTasks = this.data.automationTasks ?? [];
    // a copied event's tasks are new, so they are sent even if left as they are
    this.tasksChanged = !!this.data.isNew && this.automationTasks.length > 0;
    this.actionData.load();
    const initial = this.tabLabels().indexOf(this.data.initialTab);
    if (initial >= 0) {
      this.selectedTab = initial;
      this.selectedTabName = this.data.initialTab;
    }
  }

  /** The tabs, in order. An event that is not an inject has its details and its automation. */
  tabLabels(): string[] {
    const labels: string[] = [];
    if (this.data.scenarioEvent.scenarioEventType === EventType.Inject) {
      if (this.showDefaultTab()) {
        labels.push('Default');
      }
      labels.push('All');
      if (
        this.data.useGallery &&
        this.data.scenarioEvent.integrationTarget?.includes(
          IntegrationTarget.Gallery,
        )
      ) {
        labels.push('Gallery Article');
      }
    } else {
      labels.push('Details');
    }
    labels.push('Automation');
    return labels;
  }

  /** What is wrong with the tasks, which keeps Save disabled: the dialog closes on Save. */
  automationErrors(): string[] {
    if (!this.tasksChanged) {
      return [];
    }
    const known = new Set([
      ...this.automationTasks.map((t) => t.id),
      ...(this.data.triggerOptions ?? []).map((o) => o.id),
    ]);
    const errors = this.automationTasks.flatMap((t) =>
      taskErrors(t, this.actionData.get(t.action), known),
    );
    const loops = triggerLoops(
      this.automationTasks,
      this.data.otherTriggers ?? new Map(),
    );
    return [
      ...errors,
      ...loops.map((name) => `${name}: its triggers lead back to it.`),
    ];
  }

  openTest(draft: AutomationTaskDraft) {
    this.dialog.open(AutomationTestDialogComponent, {
      width: '900px',
      maxWidth: '90vw',
      data: {
        mselId: this.data.mselId,
        scenarioEventId: this.data.scenarioEvent.id,
        eventLabel: this.data.eventLabel,
        tasks: this.automationTasks,
        taskId: draft.id,
        savedTaskIds: this.data.savedTaskIds ?? [],
        playerViewId: this.data.testPlayerViewId,
        deployedPlayerViewId: this.data.deployedPlayerViewId,
      } satisfies AutomationTestDialogData,
    });
  }

  trackByFn(index, item) {
    return item.id;
  }

  getDataValue(dataFieldName: string): DataValuePlus {
    const dataFieldId = this.getDataFieldIdByName(dataFieldName);
    if (!dataFieldId) {
      return this.blankDataValue;
    }
    const dataValue = this.data.scenarioEvent.dataValues.find(
      (dv) => dv.dataFieldId === dataFieldId,
    );
    return dataValue ? (dataValue as DataValuePlus) : this.blankDataValue;
  }

  setDataValue(dataFieldName: string, value: string) {
    const dataFieldId = this.getDataFieldIdByName(dataFieldName);
    if (dataFieldId) {
      const dataValue = this.data.scenarioEvent.dataValues.find(
        (dv) => dv.dataFieldId === dataFieldId,
      );
      dataValue.value = value;
    }
  }

  setDataValueArray(dataFieldName: string, newValues: string[]) {
    if (newValues.includes('None')) {
      newValues = new Array();
    }
    this.getDataValue(dataFieldName).valueArray = newValues;
    this.getDataValue(dataFieldName).value = newValues.join(', ');
  }

  getDataFieldByName(name: string) {
    return this.data.dataFields.find(
      (df) => df.name.toLowerCase() === name.toLowerCase(),
    );
  }

  getDataFieldIdByName(name: string): string {
    const dataField = this.getDataFieldByName(name);
    return dataField ? dataField.id : '';
  }

  verifyNumber(newValue: DataValuePlus) {
    if (!newValue || !newValue.value) {
      return;
    }
    // remove non numeric characters, but allow '.' and '-'
    newValue.value = newValue.value.replace(/[^\d.-]/g, '');
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, organization: null });
    } else {
      if (this.tasksChanged) {
        this.data.scenarioEvent.automationTasks =
          this.automationTasks.map(toFields);
      }
      this.editComplete.emit({
        saveChanges: saveChanges,
        scenarioEvent: this.data.scenarioEvent,
      });
    }
  }

  tabChange(event) {
    this.selectedTabName = event.tab.textLabel;
    if (event.tab.textLabel === 'Automation') {
      return;
    }
    if (event.tab.textLabel === 'Details') {
      this.scenarioEventTypeChange();
      return;
    }
    const injectData = event.tab.textLabel.toLowerCase().replace(' ', '');
    this.sortedDataFields = this.getFilteredDataFields(injectData);
  }

  scenarioEventTypeChange() {
    const filterBy = this.showDefaultTab() ? 'default' : 'all';
    this.sortedDataFields = this.getFilteredDataFields(filterBy);
  }

  // filter the data fields by the selected tab
  getFilteredDataFields(filter: string): DataField[] {
    this.currentFilterBy = filter;
    let filteredList = [];
    switch (filter) {
      case 'default':
        filteredList = this.getScenarioTypeDataFields().filter(
          (x) => x.isShownOnDefaultTab,
        );
        break;
      case 'gallery':
        filteredList = this.data.dataFields.filter(
          (x) => !!x.galleryArticleParameter,
        );
        break;
      default:
        filteredList = this.data.dataFields.slice();
        break;
    }
    filteredList = filteredList.sort((a, b) =>
      +a.displayOrder < +b.displayOrder ? -1 : 1,
    );
    return filteredList;
  }

  // get the datafields based on the selected scenario event type
  getScenarioTypeDataFields(): DataField[] {
    const dataFields = new Array<DataField>();
    this.data.dataFields.forEach((df) => {
      if (
        (this.data.scenarioEvent.scenarioEventType === EventType.Inject &&
          df.onScenarioEventList) ||
        (this.data.scenarioEvent.scenarioEventType === EventType.Information &&
          df.isInformationField) ||
        (this.data.scenarioEvent.scenarioEventType === EventType.Facilitation &&
          df.isFacilitationField)
      ) {
        dataFields.push(df);
      }
    });
    return dataFields;
  }

  hasBadData(): boolean {
    return (
      this.automationErrors().length > 0 ||
      (this.data.scenarioEvent.scenarioEventType === this.eventType.Inject &&
        this.getScenarioTypeDataFields().length === 0) ||
      // only the values on screen that can be changed, since Save must not wait on one that can't be fixed
      (this.canEditDataValues() &&
        hasInvalidDataValue(
          this.sortedDataFields,
          this.data.scenarioEvent.dataValues,
        ))
    );
  }

  canEditDataValues(): boolean {
    return (
      this.data.isEditor &&
      (!this.data.isEditingRestricted ||
        this.data.scenarioEvent.scenarioEventType ===
          this.eventType.Information)
    );
  }

  showDefaultTab(): boolean {
    return (
      this.data.showScenarioEventType &&
      this.data.dataFields.some((d) => d.isShownOnDefaultTab)
    );
  }

  getIntegrationTargetArray(): string[] {
    const val = this.data.scenarioEvent.integrationTarget;
    return val ? val.split(', ').filter((s) => s.length > 0) : [];
  }

  onIntegrationTargetChange(newValues: string[]) {
    this.data.scenarioEvent.integrationTarget = newValues.join(', ');
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
