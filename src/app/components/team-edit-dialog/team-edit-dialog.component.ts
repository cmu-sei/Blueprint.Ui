// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { UntypedFormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AngularEditorConfig } from '@kolkov/angular-editor';

const MIN_NAME_LENGTH = 3;

@Component({
    selector: 'app-team-edit-dialog',
    templateUrl: './team-edit-dialog.component.html',
    styleUrls: ['./team-edit-dialog.component.scss'],
    standalone: false
})

export class TeamEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

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
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'auto',
    width: 'auto',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: true,
    showToolbar: true,
    placeholder: 'Enter text here...',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    fonts: [
      { class: 'arial', name: 'Arial' },
      { class: 'times-new-roman', name: 'Times New Roman' },
      { class: 'calibri', name: 'Calibri' },
      { class: 'comic-sans-ms', name: 'Comic Sans MS' },
    ],
    uploadUrl: '',
    uploadWithCredentials: false,
    sanitize: false,
    toolbarPosition: 'top',
    toolbarHiddenButtons: [['backgroundColor']],
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
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
      case 'citeTeamTypeId':
        this.data.team.citeTeamTypeId = this.citeTeamTypeIdFormControl.value?.toString() || '';
        break;
      default:
        break;
    }
  }

  getUserName(userId: string) {
    return this.data.userList.find(u => u.id === userId).name;
  }

}
