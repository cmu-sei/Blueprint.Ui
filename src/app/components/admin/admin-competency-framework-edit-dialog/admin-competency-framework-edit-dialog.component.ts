// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ProficiencyScale, ProficiencyScaleService } from 'src/app/generated/blueprint.api';
import { take } from 'rxjs/operators';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';

@Component({
    selector: 'app-admin-competency-framework-edit-dialog',
    templateUrl: './admin-competency-framework-edit-dialog.component.html',
    styleUrls: ['./admin-competency-framework-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule, MatSelect, MatOption]
})

export class AdminCompetencyFrameworkEditDialogComponent implements OnInit {
  data = inject(MAT_DIALOG_DATA);
  private proficiencyScaleService = inject(ProficiencyScaleService);

  @Output() editComplete = new EventEmitter<any>();
  proficiencyScales: ProficiencyScale[] = [];

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
