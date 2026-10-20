// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Output, forwardRef, inject as inject_1 } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { InjectListComponent } from '../inject-list/inject-list.component';

@Component({
    selector: 'app-inject-select-dialog',
    templateUrl: './inject-select-dialog.component.html',
    // InjectListComponent opens this dialog, so the two files import each
    // other; forwardRef defers the reference until both have loaded.
    imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, forwardRef(() => InjectListComponent)]
})
export class InjectSelectDialogComponent {
  data = inject_1(MAT_DIALOG_DATA);

  @Output() editComplete = new EventEmitter<any>();
  selectedInjectIdList: string[] = [];

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
