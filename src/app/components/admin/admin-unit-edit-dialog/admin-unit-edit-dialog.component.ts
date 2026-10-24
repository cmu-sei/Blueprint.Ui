// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject, output } from '@angular/core';
import { UntypedFormControl, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EDITOR_CONFIG } from 'src/app/utilities/editor-config';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput, MatError } from '@angular/material/input';
import { AngularEditorModule } from '@kolkov/angular-editor';

@Component({
    selector: 'app-admin-unit-edit-dialog',
    templateUrl: './admin-unit-edit-dialog.component.html',
    styleUrls: ['./admin-unit-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule, ReactiveFormsModule, MatError, AngularEditorModule]
})

export class AdminUnitEditDialogComponent {
  data = inject(MAT_DIALOG_DATA);

  readonly editComplete = output<any>();

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
  editorConfig = EDITOR_CONFIG;

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
