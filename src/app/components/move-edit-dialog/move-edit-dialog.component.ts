// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject, output } from '@angular/core';
import { UntypedFormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EDITOR_CONFIG } from 'src/app/utilities/editor-config';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput, MatSuffix, MatError } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { DurationEditComponent } from '../shared/duration-edit/duration-edit.component';
import { NgxMatDatepickerInput, NgxMatDatetimepicker, NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel } from '@ngxmc/datetime-picker';
import { MatDatepickerToggle } from '@angular/material/datepicker';
import { MatButton } from '@angular/material/button';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { DatePipe } from '@angular/common';
import { TimezoneAbbrPipe } from '../../utilities/timezone-abbr';
import { moveOrderConflict } from '../../utilities/move-order';

@Component({
    selector: 'app-move-edit-dialog',
    templateUrl: './move-edit-dialog.component.html',
    styleUrls: ['./move-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule, DurationEditComponent, NgxMatDatepickerInput, ReactiveFormsModule, MatDatepickerToggle, MatSuffix, NgxMatDatetimepicker, NgxMatDatepickerActions, MatButton, NgxMatDatepickerApply, NgxMatDatepickerCancel, AngularEditorModule, DatePipe, TimezoneAbbrPipe, MatError, MatIcon]
})

export class MoveEditDialogComponent {
  data = inject(MAT_DIALOG_DATA);

  readonly editComplete = output<any>();

  public situationDateFormControl = new UntypedFormControl(
    this.data.move.situationTime,
    []
  );
  editorConfig = EDITOR_CONFIG;

  // the number and start the move had when the dialog opened
  private readonly openedMoveNumber = +this.data.move.moveNumber;
  private readonly openedDeltaSeconds = +this.data.move.deltaSeconds;

  // the start must fall after the move numbered before it and before the one after it, as the API checks;
  // data.otherMoves is the MSEL's other moves. Like the API, an edit is only checked once its number or start
  // changes, so the text of a move that already shares its start can still be saved.
  orderError(): string {
    if (
      this.data.move.id &&
      +this.data.move.moveNumber === this.openedMoveNumber &&
      +this.data.move.deltaSeconds === this.openedDeltaSeconds
    ) {
      return '';
    }
    return moveOrderConflict(
      this.data.move.moveNumber,
      this.data.move.deltaSeconds,
      this.data.otherMoves,
    );
  }

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
    } else if (!this.orderError()) {
      this.editComplete.emit({
        saveChanges: saveChanges,
        move: this.data.move,
      });
    }
  }
}
