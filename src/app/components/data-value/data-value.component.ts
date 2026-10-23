/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  DataField,
  DataFieldType,
  MselItemStatus,
} from 'src/app/generated/blueprint.api';
import { EDITOR_CONFIG, VIEW_CONFIG } from 'src/app/utilities/editor-config';
import { ErrorStateMatcher } from '@angular/material/core';
import { dataValueError } from 'src/app/utilities/ip-address';

@Component({
    selector: 'app-data-value',
    templateUrl: './data-value.component.html',
    styleUrls: ['./data-value.component.scss'],
    standalone: false
})
export class DataValueComponent {
  @Input() value: any;
  @Input() dataField: DataField;
  @Input() canEdit: boolean; // enables editing of values
  @Input() canApprove: boolean; // enables editing of status value
  @Input() isOwner: boolean; // enables editing of assigned unit value
  @Input() showValueOnly: boolean; // displays the value without a matFormField
  @Input() organizationOptions: any[] = [];
  @Input() teamOptions: any[] = [];
  @Input() unitOptions: any[] = [];
  @Input() cardOptions: any[] = [];
  @Input() moveOptions: any[] = [];
  @Input() gallerySourceTypeOptions: any[] = [];
  @Input() galleryItemStatusOptions: string[] = [];
  @Input() userOptions: any[] = [];
  @Input() canAiWrite = false; // offers Write with AI on text fields
  @Output() valueChange = new EventEmitter<any>();
  @Output() aiWrite = new EventEmitter<void>();
  editorConfig = EDITOR_CONFIG;
  viewConfig = VIEW_CONFIG;
  dataType: typeof DataFieldType = DataFieldType;
  itemStatus = [
    MselItemStatus.Pending,
    MselItemStatus.Entered,
    MselItemStatus.Approved,
    MselItemStatus.Complete,
    MselItemStatus.Deployed,
    MselItemStatus.Archived,
  ];
  // the color Gallery shows for each article status
  galleryItemStatusColors: { [status: string]: string } = {
    Gray: '#b5b5b5',
    Green: 'rgb(163, 235, 163)',
    Yellow: 'rgb(250, 235, 100)',
    Orange: 'rgb(250, 163, 2)',
    Red: '#ff3333',
  };
  // the names Gallery used before its statuses were named for colors; existing MSELs still hold them
  legacyGalleryItemStatuses: { [status: string]: string } = {
    unused: 'Gray',
    closed: 'Red',
    critical: 'Orange',
    affected: 'Yellow',
    open: 'Green',
  };

  // the data field that sets a Gallery Article's status
  get isGalleryItemStatus(): boolean {
    return this.dataField?.galleryArticleParameter === 'Status';
  }

  // the MSEL's Gallery statuses replace free text and the field's own option list
  get useGalleryItemStatusSelect(): boolean {
    return (
      this.isGalleryItemStatus &&
      this.galleryItemStatusOptions?.length > 0 &&
      (this.dataField.isChosenFromList ||
        this.dataField.dataType === DataFieldType.String ||
        this.dataField.dataType === DataFieldType.Url)
    );
  }

  // --- Competency chips + search list ---
  competencyFilter = '';

  get selectedCompetencies(): string[] {
    return this.value ? this.value.split(', ').filter(v => v) : [];
  }

  get filteredCompetencyOptions() {
    const options = this.dataField?.dataOptions || [];
    if (!this.competencyFilter) return options;
    const s = this.competencyFilter.toLowerCase();
    return options.filter(o =>
      o.optionName?.toLowerCase().includes(s) ||
      o.optionValue?.toLowerCase().includes(s) ||
      o.optionDescription?.toLowerCase().includes(s)
    );
  }

  displayCompetency = (val: string): string => {
    if (!val || !this.dataField?.dataOptions) return val || '';
    const opt = this.dataField.dataOptions.find(o => o.optionName === val);
    return opt ? opt.optionName : val;
  }

  getCompetencyTooltip = (val: string): string => {
    if (!val || !this.dataField?.dataOptions) return '';
    const opt = this.dataField.dataOptions.find(o => o.optionName === val);
    return opt?.optionValue || '';
  }

  isCompetencySelected(optionName: string): boolean {
    return this.selectedCompetencies.includes(optionName);
  }

  toggleCompetency(optionName: string) {
    const current = this.selectedCompetencies;
    const idx = current.indexOf(optionName);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(optionName);
    }
    this.value = current.join(', ');
    this.valueChangeHandler();
  }

  removeCompetency(id: string) {
    const current = this.selectedCompetencies.filter(v => v !== id);
    this.value = current.join(', ');
    this.valueChangeHandler();
  }

  // shows the address error as soon as it applies, rather than waiting for the field to lose focus
  addressErrorMatcher: ErrorStateMatcher = {
    isErrorState: () => !!this.addressError(),
  };

  addressError(): string {
    return dataValueError(this.dataField?.dataType, this.value);
  }

  valueChangeHandler() {
    this.valueChange.emit(this.value);
  }

  getValueArray(): any[] {
    return this.value ? this.value.split(', ') : [];
  }

  setDataValueArray(newValues: string[]) {
    if (newValues.includes('None')) {
      newValues = new Array();
    }
    this.value = newValues.join(', ');
    this.valueChangeHandler();
  }

  verifyNumber(value: string) {
    // remove non numeric characters, but allow '.' and '-'
    value = value.replace(/[^\d.-]/g, '');
  }

  getCardName(id: string): string {
    const card = this.cardOptions?.find((m) => m.id === id);
    return card ? card.name : '';
  }

  getMoveTitle(id: string): string {
    const move = this.moveOptions?.find((m) => m.id === id);
    return move ? move.title : '';
  }

  // a color name or a legacy name, any case, as the color name; anything else unchanged
  getGalleryItemStatus(value: string): string {
    const status = value?.trim() || '';
    const color = Object.keys(this.galleryItemStatusColors).find(
      (c) => c.toLowerCase() === status.toLowerCase()
    );
    return color || this.legacyGalleryItemStatuses[status.toLowerCase()] || value;
  }

  galleryItemStatusChange(status: string) {
    this.value = status;
    this.valueChangeHandler();
  }

  getUserName(id: string): string {
    const user = this.userOptions?.find((m) => m.id === id);
    return user ? user.name : '';
  }
}
