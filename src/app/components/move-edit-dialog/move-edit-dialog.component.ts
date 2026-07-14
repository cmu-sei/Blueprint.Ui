// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AngularEditorConfig } from '@kolkov/angular-editor';

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
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'auto',
    width: 'auto',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: true,
    showToolbar: true,
    placeholder: 'Enter text here...',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    fonts: [
      { class: 'arial', name: 'Arial' },
      { class: 'times-new-roman', name: 'Times New Roman' },
      { class: 'calibri', name: 'Calibri' },
      { class: 'comic-sans-ms', name: 'Comic Sans MS' },
    ],
    uploadUrl: '',
    uploadWithCredentials: false,
    sanitize: false,
    toolbarPosition: 'top',
    toolbarHiddenButtons: [['backgroundColor']],
  };

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
