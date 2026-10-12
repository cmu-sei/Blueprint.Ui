// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'app-inject-select-dialog',
    templateUrl: './inject-select-dialog.component.html',
    standalone: false
})
export class InjectSelectDialogComponent {
  @Output() editComplete = new EventEmitter<any>();
  selectedInjectIdList: string[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  errorFree() {
    return this.selectedInjectIdList.length > 0;
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
          selectedInjectIdList: this.selectedInjectIdList,
        });
      }
    }
  }

}
