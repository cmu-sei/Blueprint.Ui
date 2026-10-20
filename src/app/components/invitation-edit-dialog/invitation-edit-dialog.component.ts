// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput, MatSuffix } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatOption } from '@angular/material/autocomplete';
import { NgxMatDatepickerInput, NgxMatDatetimepicker, NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel } from '@ngxmc/datetime-picker';
import { MatDatepickerToggle } from '@angular/material/datepicker';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { DatePipe } from '@angular/common';
import { TimezoneAbbrPipe } from '../../utilities/timezone-abbr';

@Component({
    selector: 'app-invitation-edit-dialog',
    templateUrl: './invitation-edit-dialog.component.html',
    styleUrls: ['./invitation-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatSelect, FormsModule, MatOption, MatInput, NgxMatDatepickerInput, MatDatepickerToggle, MatSuffix, NgxMatDatetimepicker, NgxMatDatepickerActions, MatButton, NgxMatDatepickerApply, NgxMatDatepickerCancel, MatCheckbox, DatePipe, TimezoneAbbrPipe]
})

export class InvitationEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  errorFree() {
    return this.data.invitation.teamId &&
      (!this.data.invitation.emailDomain ||
        (this.data.invitation.emailDomain.length > 3 &&
          this.data.invitation.emailDomain.includes('@')
        )
      );
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, invitation: null });
    } else {
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          invitation: this.data.invitation,
        });
      }
    }
  }

  getTeamName(teamId: string) {
    const team = this.data.teamList.find(t => t.id === teamId);
    return team.shortName + ' - ' + team.name;
  }

}
