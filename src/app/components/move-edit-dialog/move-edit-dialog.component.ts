// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, inject, output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselPageDraftDialogComponent, MselPageDraftDialogData } from '../msel-page-draft-dialog/msel-page-draft-dialog.component';
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
    imports: [CrucibleDialogComponent, MatIconButton, MatIcon, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule, DurationEditComponent, NgxMatDatepickerInput, ReactiveFormsModule, MatDatepickerToggle, MatSuffix, NgxMatDatetimepicker, NgxMatDatepickerActions, MatButton, NgxMatDatepickerApply, NgxMatDatepickerCancel, AngularEditorModule, DatePipe, TimezoneAbbrPipe]
})

export class MoveEditDialogComponent {
  data = inject(MAT_DIALOG_DATA);
  private dialog = inject(MatDialog);
  private mselDataService = inject(MselDataService);

  readonly editComplete = output<any>();

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

  // the briefing participants get when the move opens, written with AI from the moves and injects; what the planner uses goes
  // into the move, which they still save
  writeSituationWithAi() {
    const move = this.data.move;
    const data: MselPageDraftDialogData = {
      mselId: this.data.mselId,
      name: 'the situation briefing',
      content: move.situationDescription ?? '',
      title: `Write move ${move.moveNumber}'s situation briefing with AI`,
      about: "Writes from the MSEL's scenario, the moves, and the injects before this move, keeping clear of what its own injects bring",
      write: (instruction) =>
        this.mselDataService.draftMoveSituation(this.data.mselId, {
          moveId: move.id,
          moveNumber: move.moveNumber,
          description: move.description,
          situationTime: move.situationTime,
          situationDescription: move.situationDescription,
          instruction,
        }),
    };
    this.dialog
      .open<MselPageDraftDialogComponent, MselPageDraftDialogData, string>(MselPageDraftDialogComponent, { width: '95vw', maxWidth: '1600px', data })
      .afterClosed()
      .subscribe((html) => {
        if (html) {
          move.situationDescription = html;
        }
      });
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
