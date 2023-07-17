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
  private addedDataFieldOptions: DataOption[] = [];
  private changedDataFieldOptions: DataOption[] = [];
  private deletedDataFieldOptions: DataOption[] = [];

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
      if (selectedDataType === 'DeliveryMethod') {
        this.data.dataField.isChosenFromList = true;
        // Add the default options for DeliveryMethod
        const defaultOptions = this.settingsService.settings.DefaultDeliveryMethodOptions;
        defaultOptions.forEach(defopt => {
          const alreadyExists = this.data.dataFieldOptions.some(dfo =>
            dfo.optionName === defopt.optName && dfo.optionValue === defopt.optionValue);
          if (!alreadyExists) {
            const newDataOption = {
              id: uuidv4(),
              displayOrder: this.data.dataFieldOptions.length + 1,
              dataFieldId: this.data.dataField.id,
              optionName: defopt.optionName,
              optionValue: defopt.optionValue,
            };
            // add to displayed data options
            this.data.dataFieldOptions.push(newDataOption);
            // make sure data option gets added when we are done
            this.addedDataFieldOptions.push(newDataOption);
          }
        });
      }
      // set the new value
      this.data.dataField.dataType = selectedDataType;
    }
  }

  addDataOption(dataField: DataField) {
    this.addOrEditDataOption({
      displayOrder: this.data.dataFieldOptions.length + 1,
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
          const existingIndex = this.data.dataFieldOptions.findIndex(x => x.id === dataOption.id);
          this.data.dataFieldOptions[existingIndex] = dataOption;
          // make sure this data option gets saved when we are finished
          const changedIndex = this.changedDataFieldOptions.findIndex(x => x.id === dataOption.id);
          // is it on the changed list already?
          if (changedIndex < 0) {
            // not on changed list, is it on the added list?
            const addedIndex = this.addedDataFieldOptions.findIndex(ado => ado.id === dataOption.id);
            if (addedIndex < 0) {
              // not on added list either, so add to changed list
              this.changedDataFieldOptions.push(dataOption);
            } else {
              // on added list, so update with new values
              this.addedDataFieldOptions[addedIndex] = dataOption;
            }
          } else {
            // on the changed list, so update with new values
            this.changedDataFieldOptions[changedIndex] = dataOption;
          }
        } else {
          // no id means this data option has just been entered
          dataOption.id = uuidv4();
          // add to displayed data options
          this.data.dataFieldOptions.push(dataOption);
          // make sure data option gets added when we are done
          this.addedDataFieldOptions.push(dataOption);
        }
      }
      dialogRef.close();
    });
  }

  deleteDataOption(dataOption: DataOption) {
    // remove this from the displayed list
    const index = this.data.dataFieldOptions.findIndex(x => x.id === dataOption.id);
    this.data.dataFieldOptions.splice(index, 1);
    // determine if this has just been added or if it existed previously
    const addedIndex = this.addedDataFieldOptions.findIndex(ado => ado.id === dataOption.id);
    if (addedIndex < 0) {
      const changedIndex = this.changedDataFieldOptions.findIndex(x => x.id === dataOption.id);
      // if this was previously changed, delete it from the changed list
      if (changedIndex >= 0) {
        this.changedDataFieldOptions.splice(changedIndex, 1);
      }
      // push this onto the delted list
      this.deletedDataFieldOptions.push(dataOption);
    } else {
      // since this is an added data field option, just remove it from the added list
      this.addedDataFieldOptions.splice(addedIndex, 1);
    }
  }

  sortedDataFieldOptions() {
    return this.data.dataFieldOptions
      .sort((a, b) => a.displayOrder < b.displayOrder ? -1 : 1);
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
          dataField: this.data.dataField,
          addedDataFieldOptions: this.addedDataFieldOptions,
          changedDataFieldOptions: this.changedDataFieldOptions,
          deletedDataFieldOptions: this.deletedDataFieldOptions
        });
      }
    }
  }

}
