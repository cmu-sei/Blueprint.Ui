// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Output, inject } from '@angular/core';
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EDITOR_CONFIG } from 'src/app/utilities/editor-config';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput, MatSuffix } from '@angular/material/input';
import { DurationEditComponent } from '../shared/duration-edit/duration-edit.component';
import { NgxMatDatepickerInput, NgxMatDatetimepicker, NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel } from '@ngxmc/datetime-picker';
import { MatDatepickerToggle } from '@angular/material/datepicker';
import { MatButton } from '@angular/material/button';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { DatePipe } from '@angular/common';
import { TimezoneAbbrPipe } from '../../utilities/timezone-abbr';

@Component({
    selector: 'app-move-edit-dialog',
    templateUrl: './move-edit-dialog.component.html',
    styleUrls: ['./move-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule, DurationEditComponent, NgxMatDatepickerInput, ReactiveFormsModule, MatDatepickerToggle, MatSuffix, NgxMatDatetimepicker, NgxMatDatepickerActions, MatButton, NgxMatDatepickerApply, NgxMatDatepickerCancel, AngularEditorModule, DatePipe, TimezoneAbbrPipe]
})

export class MoveEditDialogComponent {
  data = inject(MAT_DIALOG_DATA);

  @Output() editComplete = new EventEmitter<any>();

  public situationDateFormControl = new UntypedFormControl(
    this.data.move.situationTime,
    []
  );
  editorConfig = EDITOR_CONFIG;

  saveMove(which: string) {
    switch (which) {
      case 'situationDate':
        if (this.situationDateFormControl.value) {
          this.data.move.situationTime = new Date(this.situationDateFormControl.value);
        }
        break;
      default:
        break;
    }
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, move: null });
    } else {
      this.editComplete.emit({
        saveChanges: saveChanges,
        move: this.data.move,
      });
    }
  }
}
