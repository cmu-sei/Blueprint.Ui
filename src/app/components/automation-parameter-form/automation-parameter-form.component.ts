// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MatFormField,
  MatHint,
  MatInput,
  MatLabel,
} from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import {
  AutomationActionDefinition,
  AutomationParameterDefinition,
} from 'src/app/generated/blueprint.api';
import {
  AutomationTaskDraft,
  hasSecret,
} from 'src/app/utilities/automation-tasks';

/**
 * The parameters of a task's action, as the action catalog describes them. A secret is never shown: one the task
 * holds reads "stored", and can be replaced or cleared.
 */
@Component({
  selector: 'app-automation-parameter-form',
  imports: [
    FormsModule,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
  ],
  templateUrl: './automation-parameter-form.component.html',
  styleUrls: ['./automation-parameter-form.component.scss'],
})
export class AutomationParameterFormComponent {
  readonly definition = input<AutomationActionDefinition>(undefined);
  readonly draft = input<AutomationTaskDraft>(undefined);
  readonly canEdit = input(false);
  readonly changed = output<void>();

  // the secrets being replaced, which show an input instead of "stored"
  replacing = new Set<string>();

  parameters(): AutomationParameterDefinition[] {
    return (this.definition()?.parameters ?? []).filter((p) => !p.secret);
  }

  secrets(): AutomationParameterDefinition[] {
    return (this.definition()?.parameters ?? []).filter((p) => p.secret);
  }

  value(key: string): string {
    return this.draft().actionParameters?.[key] ?? '';
  }

  setValue(key: string, value: string | boolean | number) {
    const draft = this.draft();
    draft.actionParameters = { ...(draft.actionParameters ?? {}) };
    draft.actionParameters[key] = value == null ? '' : `${value}`;
    this.changed.emit();
  }

  isStored(key: string): boolean {
    return (
      hasSecret(this.draft(), key) &&
      this.draft().secretChanges[key] === undefined &&
      !this.replacing.has(key)
    );
  }

  isCleared(key: string): boolean {
    return this.draft().secretChanges[key] === '';
  }

  secretValue(key: string): string {
    return this.draft().secretChanges[key] ?? '';
  }

  setSecret(key: string, value: string) {
    this.draft().secretChanges[key] = value;
    this.changed.emit();
  }

  replace(key: string) {
    this.replacing.add(key);
  }

  clear(key: string) {
    this.replacing.delete(key);
    this.draft().secretChanges[key] = '';
    this.changed.emit();
  }

  /** Back to what the task holds. */
  keep(key: string) {
    this.replacing.delete(key);
    delete this.draft().secretChanges[key];
    this.changed.emit();
  }

  label(p: AutomationParameterDefinition): string {
    return p.display || p.key;
  }
}
