// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { AsyncPipe } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MatAccordion,
  MatExpansionPanel,
  MatExpansionPanelActionRow,
  MatExpansionPanelDescription,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import {
  MatError,
  MatFormField,
  MatHint,
  MatInput,
  MatLabel,
} from '@angular/material/input';
import { MatOptgroup, MatOption, MatSelect } from '@angular/material/select';
import {
  AutomationAction,
  AutomationRun,
  AutomationTrigger,
} from 'src/app/generated/blueprint.api';
import { AutomationActionDataService } from 'src/app/data/automation-action/automation-action-data.service';
import {
  AutomationTaskDraft,
  ITERATION_TERMINATIONS,
  TRIGGERS,
  applyDefaults,
  copyDrafts,
  isChained,
  newDraft,
  taskErrors,
  triggerSummary,
} from 'src/app/utilities/automation-tasks';
import { AutomationParameterFormComponent } from '../automation-parameter-form/automation-parameter-form.component';
import { AutomationStatusChipComponent } from '../automation-status-chip/automation-status-chip.component';

/** A task of another scenario event that a task here can be triggered by. */
export interface AutomationTriggerOption {
  id: string;
  label: string;
}

/**
 * The automation tasks of the scenario event being edited, on its Automation tab. The tasks are drafts until the
 * event is saved; each change is announced, so the dialog knows to send them.
 */
@Component({
  selector: 'app-automation-task-list',
  imports: [
    AsyncPipe,
    AutomationParameterFormComponent,
    AutomationStatusChipComponent,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    FormsModule,
    MatAccordion,
    MatButton,
    MatCheckbox,
    MatError,
    MatExpansionPanel,
    MatExpansionPanelActionRow,
    MatExpansionPanelDescription,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
    MatOptgroup,
    MatOption,
    MatSelect,
  ],
  templateUrl: './automation-task-list.component.html',
  styleUrls: ['./automation-task-list.component.scss'],
})
export class AutomationTaskListComponent {
  private actionData = inject(AutomationActionDataService);

  readonly drafts = input<AutomationTaskDraft[]>([]);
  readonly canEdit = input(false);
  /** The tasks of the MSEL's other events, labelled "Event › Task". */
  readonly triggerOptions = input<AutomationTriggerOption[]>([]);
  /** Each saved task's newest test run. */
  readonly latestTests = input<Map<string, AutomationRun>>(new Map());
  /** Whether the user may test: a test runs as Blueprint against a Player view of theirs. */
  readonly canTest = input(false);
  readonly changed = output<void>();
  readonly test = output<AutomationTaskDraft>();

  readonly categories = this.actionData.byCategory;
  readonly triggers = TRIGGERS;
  readonly terminations = ITERATION_TERMINATIONS;
  expandedId = '';

  constructor() {
    this.actionData.load();
  }

  definition(draft: AutomationTaskDraft) {
    return this.actionData.get(draft.action);
  }

  actionLabel(draft: AutomationTaskDraft): string {
    return this.actionData.label(draft.action);
  }

  errors(draft: AutomationTaskDraft): string[] {
    const known = new Set([
      ...this.drafts().map((d) => d.id),
      ...this.triggerOptions().map((o) => o.id),
    ]);
    return taskErrors(draft, this.definition(draft), known);
  }

  /** The tasks this one can be triggered by: the event's other tasks first. */
  localOptions(draft: AutomationTaskDraft): AutomationTriggerOption[] {
    return this.drafts()
      .map((d, i) => ({ id: d.id, label: `${i + 1}. ${d.name || 'New task'}` }))
      .filter((o) => o.id !== draft.id);
  }

  triggerName(draft: AutomationTaskDraft): string | undefined {
    if (!draft.triggerTaskId) return undefined;
    const index = this.drafts().findIndex((d) => d.id === draft.triggerTaskId);
    if (index >= 0) {
      return `${index + 1}. ${this.drafts()[index].name || 'New task'}`;
    }
    return this.triggerOptions().find((o) => o.id === draft.triggerTaskId)
      ?.label;
  }

  summary(draft: AutomationTaskDraft): string {
    return triggerSummary(draft.triggerCondition, this.triggerName(draft));
  }

  isChained(trigger: AutomationTrigger) {
    return isChained(trigger);
  }

  add() {
    const draft = newDraft(
      this.actionData.get(AutomationAction.PlayerNotification),
    );
    this.drafts().push(draft);
    this.expandedId = draft.id;
    this.changed.emit();
  }

  duplicate(draft: AutomationTaskDraft) {
    const [copy] = copyDrafts([draft]);
    copy.name = `${draft.name} (copy)`;
    const list = this.drafts();
    list.splice(list.indexOf(draft) + 1, 0, copy);
    this.expandedId = copy.id;
    this.changed.emit();
  }

  remove(draft: AutomationTaskDraft) {
    const list = this.drafts();
    list.splice(list.indexOf(draft), 1);
    // a task it triggered is now run by hand, as the API does with a deleted task
    list
      .filter((d) => d.triggerTaskId === draft.id)
      .forEach((d) => {
        d.triggerTaskId = null;
        d.triggerCondition = AutomationTrigger.Manual;
      });
    this.changed.emit();
  }

  drop(event: CdkDragDrop<AutomationTaskDraft[]>) {
    moveItemInArray(this.drafts(), event.previousIndex, event.currentIndex);
    this.changed.emit();
  }

  setAction(draft: AutomationTaskDraft, action: AutomationAction) {
    const definition = this.actionData.get(action);
    const keys = new Set((definition?.parameters ?? []).map((p) => p.key));
    draft.action = action;
    // the parameters the new action shares are kept; a secret of the old one is cleared by the API
    draft.actionParameters = Object.fromEntries(
      Object.entries(draft.actionParameters ?? {}).filter(([k]) => keys.has(k)),
    );
    draft.secretChanges = Object.fromEntries(
      Object.entries(draft.secretChanges).filter(([k]) => keys.has(k)),
    );
    applyDefaults(draft, definition);
    if (!definition?.requiresVm) {
      draft.vmMask = null;
    }
    this.changed.emit();
  }

  setTrigger(draft: AutomationTaskDraft, trigger: AutomationTrigger) {
    draft.triggerCondition = trigger;
    if (!isChained(trigger)) {
      draft.triggerTaskId = null;
    }
    this.changed.emit();
  }

  touch() {
    this.changed.emit();
  }

  latest(draft: AutomationTaskDraft): AutomationRun | undefined {
    return this.latestTests().get(draft.id);
  }
}
