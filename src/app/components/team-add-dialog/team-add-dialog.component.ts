// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Unit } from 'src/app/generated/blueprint.api';

@Component({
    selector: 'app-team-add-dialog',
    templateUrl: './team-add-dialog.component.html',
    styleUrls: ['./team-add-dialog.component.scss'],
    standalone: false
})

export class TeamAddDialogComponent {
  @Output() editComplete = new EventEmitter<any>();
  public filterString = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

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
