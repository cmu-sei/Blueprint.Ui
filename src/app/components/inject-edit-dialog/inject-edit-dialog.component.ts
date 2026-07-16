// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DataValue } from 'src/app/generated/blueprint.api';

@Component({
    selector: 'app-inject-edit-dialog',
    templateUrl: './inject-edit-dialog.component.html',
    styleUrls: ['./inject-edit-dialog.component.scss'],
    standalone: false
})
export class InjectEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  errorFree() {
    return this.data.inject.name && this.data.inject.description;
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, inject: null });
    } else {
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          inject: this.data.inject,
        });
      }
    }
  }

  getDataValue(dataFieldId: string): DataValue {
    const dataValue = this.data.inject.dataValues.find(
      (dv) => dv.dataFieldId === dataFieldId
    );
    return dataValue ? dataValue : ({} as DataValue);
  }

  otherInjects(id: string) {
    return this.data.injectList.filter((i) => i.id !== id);
  }
}
