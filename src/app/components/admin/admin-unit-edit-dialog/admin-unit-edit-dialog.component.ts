// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { UntypedFormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AngularEditorConfig } from '@kolkov/angular-editor';

@Component({
    selector: 'app-admin-unit-edit-dialog',
    templateUrl: './admin-unit-edit-dialog.component.html',
    styleUrls: ['./admin-unit-edit-dialog.component.scss'],
    standalone: false
})

export class AdminUnitEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  public unitNameFormControl = new UntypedFormControl(
    this.data.unit.name,
    [
      Validators.required,
    ]
  );
  public unitShortNameFormControl = new UntypedFormControl(
    this.data.unit.shortName,
    [
      Validators.required,
    ]
  );
  public descriptionFormControl = new UntypedFormControl(
    this.data.unit.description,
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
  ) {}

  errorFree() {
    return !(
      this.unitNameFormControl.hasError('required') ||
      this.unitNameFormControl.hasError('minlength') ||
      this.unitShortNameFormControl.hasError('required') ||
      this.unitShortNameFormControl.hasError('minlength')
    );
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, unit: null });
    } else {
      this.data.unit.name = this.unitNameFormControl.value
        .toString()
        .trim();
      this.data.unit.shortName = this.unitShortNameFormControl.value
        .toString()
        .trim();
      this.data.unit.description = this.descriptionFormControl.value
        ? this.descriptionFormControl.value.toString().trim()
        : '';
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          unit: this.data.unit,
        });
      }
    }
  }

  /**
   * Saves the current unit
   */
  saveUnit(changedField): void {
    switch (changedField) {
      case 'name':
        this.data.unit.name = this.unitNameFormControl.value.toString();
        break;
      case 'shortName':
        this.data.unit.shortName = this.unitShortNameFormControl.value.toString();
        break;
      case 'description':
        this.data.unit.description = this.descriptionFormControl.value
          ? this.descriptionFormControl.value.toString()
          : '';
        break;
      default:
        break;
    }
  }

  getUserName(userId: string) {
    return this.data.userList.find(u => u.id === userId).name;
  }

}
