// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { UntypedFormControl, FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';

@Component({
    selector: 'app-card-edit-dialog',
    templateUrl: './card-edit-dialog.component.html',
    styleUrls: ['./card-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule, MatSelect, MatOption]
})

export class CardEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  public situationDateFormControl = new UntypedFormControl(
    this.data.card.situationTime,
    []
  );
  public cardStartTimeFormControl = new UntypedFormControl(
    this.data.card.cardStartTime,
    []
  );
  public cardStopTimeFormControl = new UntypedFormControl(
    this.data.card.cardStopTime,
    []
  );

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  saveCard(which: string) {
    switch (which) {
      case 'situationDate':
        const newPosted = new Date(this.situationDateFormControl.value);
        this.data.card.situationTime = newPosted;
        break;
      case 'cardStartTime':
        const cardStartTime = this.cardStartTimeFormControl.value;
        this.data.card.cardStartTime = cardStartTime;
        break;
      case 'cardStopTime':
        const cardStopTime = this.cardStopTimeFormControl.value;
        this.data.card.cardStopTime = cardStopTime;
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
      this.editComplete.emit({ saveChanges: false, card: null });
    } else {
      this.editComplete.emit({
        saveChanges: saveChanges,
        card: this.data.card,
      });
    }
  }

}
