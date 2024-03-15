// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import {
  UntypedFormControl,
  FormGroupDirective,
  NgForm,
  Validators,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { Unit } from 'src/app/generated/blueprint.api';

/** Error when invalid control is dirty, touched, or submitted. */
export class UserErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(
    control: UntypedFormControl | null,
    form: FormGroupDirective | NgForm | null
  ): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || isSubmitted));
  }
}

const MIN_NAME_LENGTH = 3;

@Component({
  selector: 'app-team-add-dialog',
  templateUrl: './team-add-dialog.component.html',
  styleUrls: ['./team-add-dialog.component.scss'],
})

export class TeamAddDialogComponent {
  @Output() editComplete = new EventEmitter<any>();
  public filterString = '';

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<TeamAddDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(unitId: string): void {
    if (!unitId) {
      this.editComplete.emit({ saveChanges: false, team: null });
    } else {
      this.editComplete.emit({
        saveChanges: true,
        unitId: unitId,
      });
    }
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
  }

  filteredList(): Unit[] {
    const filteredList = [...this.data?.unitList];
    const filterValue = this.filterString.toLowerCase();
    return filteredList.filter(u => {
      const testString = u.name.toLowerCase() + u.shortName.toLowerCase();
      return testString.indexOf(filterValue) > -1;
    });
  }

}
