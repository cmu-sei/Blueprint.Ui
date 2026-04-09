// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, OnInit, Output } from '@angular/core';
import {
  UntypedFormControl,
  FormGroupDirective,
  NgForm,
  Validators,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { ProficiencyScale, ProficiencyScaleService } from 'src/app/generated/blueprint.api';
import { take } from 'rxjs/operators';

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

@Component({
    selector: 'app-admin-competency-framework-edit-dialog',
    templateUrl: './admin-competency-framework-edit-dialog.component.html',
    styleUrls: ['./admin-competency-framework-edit-dialog.component.scss'],
    standalone: false
})

export class AdminCompetencyFrameworkEditDialogComponent implements OnInit {
  @Output() editComplete = new EventEmitter<any>();
  isChanged = false;
  proficiencyScales: ProficiencyScale[] = [];

  constructor(
    public dialogService: DialogService,
    dialogRef: MatDialogRef<AdminCompetencyFrameworkEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private proficiencyScaleService: ProficiencyScaleService
  ) {
    dialogRef.disableClose = true;
  }

  ngOnInit() {
    this.proficiencyScaleService.getProficiencyScales()
      .pipe(take(1))
      .subscribe(scales => {
        this.proficiencyScales = scales;
      });
  }

  errorFree() {
    return this.data.competencyFramework.name;
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, competencyFramework: null });
    } else {
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          competencyFramework: this.data.competencyFramework,
        });
      }
    }
  }

}
