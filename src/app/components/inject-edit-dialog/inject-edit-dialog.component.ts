// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Output, inject as inject_1 } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DataValue } from 'src/app/generated/blueprint.api';
import { hasInvalidAddress } from 'src/app/utilities/ip-address';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';
import { DataValueComponent } from '../data-value/data-value.component';

@Component({
    selector: 'app-inject-edit-dialog',
    templateUrl: './inject-edit-dialog.component.html',
    styleUrls: ['./inject-edit-dialog.component.scss'],
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, MatFormField, MatLabel, MatInput, FormsModule, MatSelect, MatOption, DataValueComponent]
})
export class InjectEditDialogComponent {
  data = inject_1(MAT_DIALOG_DATA);

  @Output() editComplete = new EventEmitter<any>();

  errorFree() {
    return this.data.inject.name && this.data.inject.description &&
      !hasInvalidAddress(this.data.dataFieldList, this.data.inject.dataValues);
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
