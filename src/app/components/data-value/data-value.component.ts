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
import { AngularEditorConfig } from '@kolkov/angular-editor';

@Component({
  selector: 'app-data-value',
  templateUrl: './data-value.component.html',
  styleUrls: ['./data-value.component.scss'],
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
  @Input() userOptions: any[] = [];
  @Output() valueChange = new EventEmitter<any>();
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
  viewConfig: AngularEditorConfig = {
    editable: false,
    height: 'auto',
    minHeight: '1200px',
    width: '100%',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: false,
    showToolbar: false,
    placeholder: '',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    sanitize: false,
  };
  dataType: typeof DataFieldType = DataFieldType;
  itemStatus = [
    MselItemStatus.Pending,
    MselItemStatus.Entered,
    MselItemStatus.Approved,
    MselItemStatus.Complete,
    MselItemStatus.Deployed,
    MselItemStatus.Archived,
  ];

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

  getUserName(id: string): string {
    const user = this.userOptions?.find((m) => m.id === id);
    return user ? user.name : '';
  }
}
