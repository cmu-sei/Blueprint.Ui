/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Component, Input, OnChanges, OnDestroy, inject, input, output } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  AttackTechnique,
  DataField,
  DataFieldType,
  MselItemStatus,
} from 'src/app/generated/blueprint.api';
import { EDITOR_CONFIG, VIEW_CONFIG } from 'src/app/utilities/editor-config';
import { ErrorStateMatcher } from '@angular/material/core';
import { dataValueError } from 'src/app/utilities/ip-address';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatTooltip } from '@angular/material/tooltip';
import { MatFormField, MatLabel, MatInput, MatError, MatSuffix } from '@angular/material/input';
import { MatSelect, MatSelectTrigger } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatOption } from '@angular/material/autocomplete';
import { NgxMatDatepickerInput, NgxMatDatetimepicker, NgxMatDatepickerActions, NgxMatDatepickerApply, NgxMatDatepickerCancel } from '@ngxmc/datetime-picker';
import { MatDatepickerToggle } from '@angular/material/datepicker';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatChipSet, MatChip, MatChipRemove } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { TimezoneAbbrPipe } from '../../utilities/timezone-abbr';
import { IsDateTimeValuePipe } from '../../utilities/date-time-value';
import { MselAttackTechniqueQuery } from 'src/app/data/msel-attack-technique/msel-attack-technique.query';
import { MselAttackTechniqueDataService } from 'src/app/data/msel-attack-technique/msel-attack-technique-data.service';

@Component({
    selector: 'app-data-value',
    templateUrl: './data-value.component.html',
    styleUrls: ['./data-value.component.scss'],
    imports: [AngularEditorModule, MatCheckbox, MatTooltip, MatFormField, MatLabel, MatSelect, FormsModule, MatSelectTrigger, MatOption, MatInput, MatError, NgxMatDatepickerInput, MatDatepickerToggle, MatSuffix, NgxMatDatetimepicker, NgxMatDatepickerActions, MatButton, NgxMatDatepickerApply, NgxMatDatepickerCancel, MatChipSet, MatChip, MatChipRemove, MatIcon, MatIconButton, DatePipe, TimezoneAbbrPipe, NgTemplateOutlet, IsDateTimeValuePipe]
})
export class DataValueComponent implements OnChanges, OnDestroy {
  private mselAttackTechniqueQuery = inject(MselAttackTechniqueQuery);
  private mselAttackTechniqueDataService = inject(MselAttackTechniqueDataService);

  @Input() value: any;
  @Input() dataField: DataField;
  readonly canEdit = input<boolean>(undefined); // enables editing of values
  readonly canApprove = input<boolean>(undefined); // enables editing of status value
  readonly isOwner = input<boolean>(undefined); // enables editing of assigned unit value
  readonly showValueOnly = input<boolean>(undefined); // displays the value without a matFormField
  readonly organizationOptions = input<any[]>([]);
  readonly teamOptions = input<any[]>([]);
  readonly unitOptions = input<any[]>([]);
  readonly cardOptions = input<any[]>([]);
  readonly moveOptions = input<any[]>([]);
  readonly gallerySourceTypeOptions = input<any[]>([]);
  readonly galleryItemStatusOptions = input<string[]>([]);
  readonly userOptions = input<any[]>([]);
  readonly valueChange = output<any>();
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
      this.galleryItemStatusOptions()?.length > 0 &&
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

  // --- ATT&CK technique chips + search list, offered from the MSEL's technique pool ---
  attackTechniqueFilter = '';
  attackTechniqueOptions: AttackTechnique[] = [];
  private attackTechniquesById = new Map<string, AttackTechnique>();
  private unsubscribe$ = new Subject();

  constructor() {
    this.mselAttackTechniqueQuery.selectTechniques().pipe(takeUntil(this.unsubscribe$)).subscribe(techniques => {
      this.attackTechniqueOptions = techniques;
      this.attackTechniquesById = new Map(techniques.map(t => [t.externalId, t]));
    });
  }

  ngOnChanges() {
    if (this.dataField?.dataType === DataFieldType.AttackTechnique) {
      this.mselAttackTechniqueDataService.ensureLoaded(this.dataField.mselId);
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  get selectedAttackTechniques(): string[] {
    return this.value ? this.value.split(',').map(v => v.trim()).filter(v => v) : [];
  }

  get filteredAttackTechniqueOptions(): AttackTechnique[] {
    if (!this.attackTechniqueFilter) return this.attackTechniqueOptions;
    const s = this.attackTechniqueFilter.toLowerCase();
    return this.attackTechniqueOptions.filter(t =>
      t.externalId?.toLowerCase().includes(s) ||
      t.name?.toLowerCase().includes(s)
    );
  }

  getAttackTechnique(externalId: string): AttackTechnique {
    return this.attackTechniquesById.get(externalId);
  }

  getAttackTechniqueTooltip(externalId: string): string {
    const t = this.attackTechniquesById.get(externalId);
    return t ? t.name : 'Not in this MSEL\'s ATT&CK techniques';
  }

  // ids the pool no longer offers aren't options, so keep them rather than let the select drop them
  setAttackTechniques(selected: string[]) {
    const kept = this.selectedAttackTechniques.filter(id => !this.attackTechniquesById.has(id));
    this.value = [...kept, ...selected].join(', ');
    this.valueChangeHandler();
  }

  removeAttackTechnique(externalId: string) {
    this.value = this.selectedAttackTechniques.filter(v => v !== externalId).join(', ');
    this.valueChangeHandler();
  }

  // shows the value's error as soon as it applies, rather than waiting for the field to lose focus
  valueErrorMatcher: ErrorStateMatcher = {
    isErrorState: () => !!this.valueError(),
  };

  valueError(): string {
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
    const card = this.cardOptions()?.find((m) => m.id === id);
    return card ? card.name : '';
  }

  getMoveTitle(id: string): string {
    const move = this.moveOptions()?.find((m) => m.id === id);
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
    const user = this.userOptions()?.find((m) => m.id === id);
    return user ? user.name : '';
  }
}
