// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ComnSettingsService } from '@cmusei/crucible-common';
import {
  DataField,
  DataFieldType,
  DataOption
} from 'src/app/generated/blueprint.api';
import { DataOptionEditDialogComponent } from '../data-option-edit-dialog/data-option-edit-dialog.component';
import { DataOptionImportDialogComponent } from '../data-option-import-dialog/data-option-import-dialog.component';
import { DataOptionListDialogComponent } from '../data-option-list-dialog/data-option-list-dialog.component';
import { CompetencyOptionsDialogComponent } from '../competency-options-dialog/competency-options-dialog.component';
import { v4 as uuidv4 } from 'uuid';

@Component({
    selector: 'app-data-field-edit-dialog',
    templateUrl: './data-field-edit-dialog.component.html',
    styleUrls: ['./data-field-edit-dialog.component.scss'],
    standalone: false
})

export class DataFieldEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();

  constructor(
    public dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private settingsService: ComnSettingsService
  ) {}

  errorFree() {
    const base = this.data.dataField.name && this.data.dataField.name.length > 0 &&
      this.data.dataField.displayOrder > 0;
    if (this.isCompetency()) {
      return base && this.data.dataField.dataOptions && this.data.dataField.dataOptions.length > 0;
    }
    return base;
  }

  changeDataFieldDataType(selectedDataType: string) {
    // only process if it changed
    if (this.data.dataField.dataType !== selectedDataType) {
      // set the new value
      this.data.dataField.dataType = selectedDataType;
      // Competency fields are always option-list + multi-select
      if (selectedDataType === DataFieldType.Competency) {
        this.data.dataField.isChosenFromList = true;
        this.data.dataField.isMultiSelect = true;
        this.data.dataField.isFacilitationField = true;
      }
    }
  }

  addDataOption(dataField: DataField) {
    this.addOrEditDataOption({
      displayOrder: this.data.dataField.dataOptions.length + 1,
      dataFieldId: dataField.id
    });
  }

  editDataOption(dataOption: DataOption) {
    const selected = { ...dataOption };
    this.addOrEditDataOption(selected);
  }

  addOrEditDataOption(dataOption: DataOption) {
    const dialogRef = this.dialog.open(DataOptionEditDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: 'auto',
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

  importDataOptions(dataField: DataField) {
    // If field is not saved yet, save it first
    if (!dataField.id) {
      if (!this.errorFree()) {
        return; // Can't save if there are validation errors
      }
      // Save via callback if provided, otherwise emit event
      if (this.data.onSave) {
        const savedId = this.data.onSave(this.data.dataField);
        if (savedId) {
          this.data.dataField.id = savedId;
          // Now open import dialog with the new ID
          this.openImportDialog(this.data.dataField);
        }
      }
      return;
    }

    this.openImportDialog(dataField);
  }

  private openImportDialog(dataField: DataField) {
    const dialogRef = this.dialog.open(DataOptionImportDialogComponent, {
      width: '800px',
      maxWidth: '90vw',
      data: {
        dataFieldId: dataField.id,
        existingOptions: this.data.dataField.dataOptions
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result && Array.isArray(result)) {
        // Add imported options to the displayed list
        this.data.dataField.dataOptions.push(...result);
      }
    });
  }

  viewAllOptions() {
    const canEdit = this.data.canEdit || this.data.isOwner;
    const canAddOptions = canEdit && !this.optionListNotAllowed();

    if (this.data.dataField.dataType === DataFieldType.Competency) {
      const compDialogRef = this.dialog.open(CompetencyOptionsDialogComponent, {
        width: '900px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        data: {
          dataFieldId: this.data.dataField.id,
          dataOptions: this.data.dataField.dataOptions,
          canEdit: canAddOptions
        }
      });
      compDialogRef.afterClosed().subscribe((updatedOptions) => {
        if (updatedOptions) {
          this.data.dataField = { ...this.data.dataField, dataOptions: updatedOptions };
        }
      });
    } else {
      this.dialog.open(DataOptionListDialogComponent, {
        width: '900px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        data: {
          dataOptions: this.data.dataField.dataOptions,
          canEdit: canAddOptions,
          canImport: canAddOptions,
          onEdit: (option: DataOption) => this.editDataOption(option),
          onDelete: (option: DataOption) => this.deleteDataOption(option),
          onAdd: () => this.addDataOption(this.data.dataField),
          onImport: () => this.importDataOptions(this.data.dataField)
        }
      });
    }
  }

  sortedDataFieldOptions() {
    return this.data.dataField.dataOptions
      .sort((a, b) => +a.displayOrder < +b.displayOrder ? -1 : 1);
  }

  isCompetency(): boolean {
    return this.data.dataField.dataType === DataFieldType.Competency;
  }

  optionListNotAllowed(): boolean {
    return !(
      this.data.dataField.dataType === DataFieldType.Double ||
      this.data.dataField.dataType === DataFieldType.Integer ||
      this.data.dataField.dataType === DataFieldType.String ||
      this.data.dataField.dataType === DataFieldType.Competency
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
