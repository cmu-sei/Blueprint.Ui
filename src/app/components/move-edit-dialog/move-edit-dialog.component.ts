// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import {
  UntypedFormControl,
  FormGroupDirective,
  NgForm,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { AngularEditorConfig } from '@kolkov/angular-editor';

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

const MIN_NAME_LENGTH = 3;

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
    public dialogService: DialogService,
    dialogRef: MatDialogRef<MoveEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
  }

  saveMove(which: string) {
    let timeParts: string[];
    switch (which) {
      case 'situationDate':
        const newPosted = new Date(this.situationDateFormControl.value);
        const oldPosted = new Date(this.data.move.situationTime);
        this.data.move.situationTime = newPosted;
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
}
