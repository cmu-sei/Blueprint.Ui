// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Output, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Unit } from 'src/app/generated/blueprint.api';
import { CrucibleDialogComponent, CrucibleDialogContentDirective, CrucibleDialogActionsDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput, MatSuffix } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatIconButton, MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'app-team-add-dialog',
    templateUrl: './team-add-dialog.component.html',
    styleUrls: ['./team-add-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule, MatIconButton, MatSuffix, MatIcon, MatButton, CrucibleDialogActionsDirective]
})

export class TeamAddDialogComponent {
  data = inject(MAT_DIALOG_DATA);

  @Output() editComplete = new EventEmitter<any>();
  public filterString = '';

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
