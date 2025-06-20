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
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { ComnSettingsService } from '@cmusei/crucible-common';
import {
  DataField,
  DataFieldType,
  DataOption
} from 'src/app/generated/blueprint.api';
import { DataOptionEditDialogComponent } from '../data-option-edit-dialog/data-option-edit-dialog.component';
import { v4 as uuidv4 } from 'uuid';
import { IntegrationTarget } from 'src/app/data/scenario-event/scenario-event-data.service';

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

@Component({
  selector: 'app-data-field-edit-dialog',
  templateUrl: './data-field-edit-dialog.component.html',
  styleUrls: ['./data-field-edit-dialog.component.scss'],
})

export class DataFieldEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  constructor(
    public dialog: MatDialog,
    public dialogService: DialogService,
    dialogRef: MatDialogRef<DataFieldEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private settingsService: ComnSettingsService
  ) {
    dialogRef.disableClose = true;
  }

  errorFree() {
    return this.data.dataField.name && this.data.dataField.name.length > 0 &&
      this.data.dataField.displayOrder > 0;
  }

  changeDataFieldDataType(selectedDataType: string) {
    // only process if it changed
    if (this.data.dataField.dataType !== selectedDataType) {
      if (selectedDataType === 'IntegrationTarget') {
        this.data.dataField.isChosenFromList = false;
        // Add the default options for Integration Target
        const defaultOptions = [IntegrationTarget.Email, IntegrationTarget.Gallery, IntegrationTarget.Notification];
        defaultOptions.forEach(defopt => {
          const alreadyExists = this.data.dataField.dataOptions.some(dfo =>
            dfo.optionName === defopt && dfo.optionValue === defopt);
          if (!alreadyExists) {
            const newDataOption = {
              id: uuidv4(),
              displayOrder: this.data.dataField.dataOptions.length + 1,
              dataFieldId: this.data.dataField.id,
              optionName: defopt,
              optionValue: defopt,
            };
            // add to displayed data options
            this.data.dataField.dataOptions.push(newDataOption);
          }
        });
      }
      // set the new value
      this.data.dataField.dataType = selectedDataType;
    }
  }

  addDataOption(dataField: DataField) {
    this.addOrEditDataOption({
      displayOrder: this.data.dataField.dataOptions.length + 1,
      dataFieldId: dataField.id
    });
  }

  editDataOption(dataOption: DataOption) {
    const selected = {... dataOption};
    this.addOrEditDataOption(selected);
  }

  addOrEditDataOption(dataOption: DataOption) {
    const dialogRef = this.dialog.open(DataOptionEditDialogComponent, {
      width: '800px',
      data: {
        dataOption: dataOption
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.dataOption) {
        // an id means this data option is being edited
        if (dataOption.id) {
          // update the displayed data options
          const existingIndex = this.data.dataField.dataOptions.findIndex(x => x.id === dataOption.id);
          this.data.dataField.dataOptions[existingIndex] = dataOption;
        } else {
          // no id means this data option has just been entered
          dataOption.id = uuidv4();
          // add to displayed data options
          this.data.dataField.dataOptions.push(dataOption);
        }
      }
      dialogRef.close();
    });
  }

  deleteDataOption(dataOption: DataOption) {
    // remove this from the displayed list
    const index = this.data.dataField.dataOptions.findIndex(x => x.id === dataOption.id);
    this.data.dataField.dataOptions.splice(index, 1);
  }

  sortedDataFieldOptions() {
    return this.data.dataField.dataOptions
      .sort((a, b) => +a.displayOrder < +b.displayOrder ? -1 : 1);
  }

  optionListNotAllowed(): boolean {
    return !(
      this.data.dataField.dataType === DataFieldType.Double ||
      this.data.dataField.dataType === DataFieldType.Integer ||
      this.data.dataField.dataType === DataFieldType.String
    );
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, dataField: null });
    } else {
      if (this.errorFree) {
        this.editComplete.emit({
          saveChanges: saveChanges,
          dataField: this.data.dataField
        });
      }
    }
  }

}
