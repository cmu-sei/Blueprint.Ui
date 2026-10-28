// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject, output } from '@angular/core';
import { UntypedFormControl, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EDITOR_CONFIG } from 'src/app/utilities/editor-config';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput, MatError, MatHint } from '@angular/material/input';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';
import { MatCheckbox } from '@angular/material/checkbox';

const MIN_NAME_LENGTH = 3;

import { ProfileWriterComponent } from '../profile-writer/profile-writer.component';
@Component({
    selector: 'app-team-edit-dialog',
    templateUrl: './team-edit-dialog.component.html',
    styleUrls: ['./team-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule, ReactiveFormsModule, MatError, AngularEditorModule, MatSelect, MatOption, MatHint, MatCheckbox, ProfileWriterComponent]
})

export class TeamEditDialogComponent {
  data = inject(MAT_DIALOG_DATA);

  readonly editComplete = output<any>();

  public teamNameFormControl = new UntypedFormControl(
    this.data.team.name,
    [
      Validators.required,
    ]
  );
  public teamShortNameFormControl = new UntypedFormControl(
    this.data.team.shortName,
    [
      Validators.required,
    ]
  );
  public emailFormControl = new UntypedFormControl(
    this.data.team.email,
    []
  );
  public descriptionFormControl = new UntypedFormControl(
    this.data.team.description,
    []
  );
  public citeTeamTypeIdFormControl = new UntypedFormControl(
    this.data.team.citeTeamTypeId,
    []
  );
  public casterTeamVariableFormControl = new UntypedFormControl(
    this.data.team.casterTeamVariable ?? '',
    []
  );
  editorConfig = EDITOR_CONFIG;

  constructor() {
    // Make CITE Team Type required when CITE is being used
    if (this.data.useCite) {
      this.citeTeamTypeIdFormControl.setValidators([Validators.required]);
      this.citeTeamTypeIdFormControl.updateValueAndValidity();
    }
  }

  readonly MIN_NAME_LENGTH = MIN_NAME_LENGTH;

  errorFree() {
    const hasNameErrors = this.teamNameFormControl.hasError('required') ||
      this.teamNameFormControl.hasError('minlength') ||
      this.teamShortNameFormControl.hasError('required') ||
      this.teamShortNameFormControl.hasError('minlength');

    const hasCiteTeamTypeError = this.data.useCite &&
      this.citeTeamTypeIdFormControl.hasError('required');

    return !(hasNameErrors || hasCiteTeamTypeError);
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, team: null });
    } else {
      this.data.team.name = this.teamNameFormControl.value
        .toString()
        .trim();
      this.data.team.shortName = this.teamShortNameFormControl.value
        .toString()
        .trim();
      this.data.team.description = this.descriptionFormControl.value
        ? this.descriptionFormControl.value.toString().trim()
        : '';
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          team: this.data.team,
        });
      }
    }
  }

  /**
   * Saves the current team
   */
  // a profile written with AI replaces the description, and is saved as an edited one is
  useProfile(html: string) {
    this.descriptionFormControl.setValue(html);
    this.saveTeam('description');
  }

  saveTeam(changedField): void {
    switch (changedField) {
      case 'name':
        this.data.team.name = this.teamNameFormControl.value?.toString() || '';
        break;
      case 'shortName':
        this.data.team.shortName = this.teamShortNameFormControl.value?.toString() || '';
        break;
      case 'email':
        this.data.team.email = this.emailFormControl.value?.toString() || '';
        break;
      case 'description':
        this.data.team.description = this.descriptionFormControl.value?.toString() || '';
        break;
      case 'casterTeamVariable':
        this.data.team.casterTeamVariable = this.casterTeamVariableFormControl.value?.toString() || null;
        break;
      case 'citeTeamTypeId':
        this.data.team.citeTeamTypeId = this.citeTeamTypeIdFormControl.value?.toString() || '';
        break;
      default:
        break;
    }
  }

  // keeps a mapping the template no longer declares selectable, so opening the dialog does not drop it
  topologyTeamOptions(): string[] {
    const options = [...(this.data.casterTeamVariables ?? [])];
    const current = this.data.team.casterTeamVariable;
    if (current && !options.includes(current)) {
      options.push(current);
    }
    return options;
  }

  // names the other teams that already write a variable, e.g. "blue_cell (used by Blue Team)"
  topologyTeamLabel(variable: string): string {
    const users: string[] = this.data.casterTeamVariableUsers?.[variable] ?? [];
    return users.length > 0 ? variable + ' (used by ' + users.join(', ') + ')' : variable;
  }

  getUserName(userId: string) {
    return this.data.userList.find(u => u.id === userId).name;
  }

}
