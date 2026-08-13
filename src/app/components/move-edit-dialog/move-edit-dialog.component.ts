// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EDITOR_CONFIG } from 'src/app/utilities/editor-config';

@Component({
    selector: 'app-move-edit-dialog',
    templateUrl: './move-edit-dialog.component.html',
    styleUrls: ['./move-edit-dialog.component.scss'],
    standalone: false
})

export class MoveEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  public situationDateFormControl = new UntypedFormControl(
    this.data.move.situationTime,
    []
  );
  editorConfig = EDITOR_CONFIG;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  saveMove(which: string) {
    switch (which) {
      case 'situationDate':
        if (this.situationDateFormControl.value) {
          this.data.move.situationTime = new Date(this.situationDateFormControl.value);
        }
        break;
      default:
        break;
    }
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, move: null });
    } else {
      this.editComplete.emit({
        saveChanges: saveChanges,
        move: this.data.move,
      });
    }
  }

  getUserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  getTimezoneAbbr(): string {
    try {
      const date = new Date();
    const timeZone = this.getUserTimezone();
    const formatted = date.toLocaleTimeString('en-US', {
      timeZoneName: 'short',
      timeZone
    });
    const parts = formatted.split(' ');
    return parts[parts.length - 1] || 'UTC';
    } catch {
      return 'UTC';
    }
  }
}
