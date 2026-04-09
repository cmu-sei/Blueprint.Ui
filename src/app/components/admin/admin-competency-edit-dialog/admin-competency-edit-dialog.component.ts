// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Competency } from 'src/app/generated/blueprint.api';

@Component({
    selector: 'app-admin-competency-edit-dialog',
    templateUrl: './admin-competency-edit-dialog.component.html',
    styleUrls: ['./admin-competency-edit-dialog.component.scss'],
    standalone: false
})
export class AdminCompetencyEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();
  searchText = '';
  filteredCompetencies: Competency[] = [];
  private allCompetencies: Competency[] = [];
  typeHint = '';
  typeHintLocked = false;
  availableTypes: string[] = [];
  private typePrefixMap: Record<string, string> = {
    'Work Role': 'WRL-',
    'Task': 'T',
    'Knowledge': 'K',
    'Skill': 'S',
    'Ability': 'A',
  };

  constructor(
    dialogRef: MatDialogRef<AdminCompetencyEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
    if (!this.data.competency.relatedIdNumbers) {
      this.data.competency.relatedIdNumbers = [];
    }
    this.allCompetencies = this.data.allCompetencies || [];
    this.typeHint = this.data.typeHint || '';
    this.typeHintLocked = !!this.data.typeHint;
    this.availableTypes = this.data.availableTypes || [];
    if (this.typeHintLocked && !this.data.competency.id) {
      this.onTypeChange(this.typeHint);
    }
  }

  onTypeChange(type: string) {
    const oldPrefix = this.typePrefixMap[this.typeHint] || '';
    this.typeHint = type;
    const newPrefix = this.typePrefixMap[type] || '';
    const current = this.data.competency.idNumber || '';
    if (!current) {
      // Empty — set new prefix
      this.data.competency.idNumber = newPrefix;
    } else if (oldPrefix && newPrefix && current.startsWith(oldPrefix)) {
      // Both types have prefixes — swap old for new
      this.data.competency.idNumber = newPrefix + current.substring(oldPrefix.length);
    } else if (!oldPrefix && newPrefix && !current) {
      // Old type had no prefix, new does, field empty — set prefix
      this.data.competency.idNumber = newPrefix;
    }
    // Otherwise leave the ID as-is
  }

  errorFree() {
    return this.data.competency.idNumber || this.data.competency.shortName;
  }

  onSearchChanged(): void {
    if (typeof this.searchText !== 'string') {
      this.searchText = '';
      this.filteredCompetencies = [];
      return;
    }
    const term = this.searchText.toLowerCase();
    if (term.length < 1) {
      this.filteredCompetencies = [];
      return;
    }
    const related = new Set(this.data.competency.relatedIdNumbers);
    const selfId = this.data.competency.idNumber;
    this.filteredCompetencies = this.allCompetencies
      .filter(c =>
        c.idNumber !== selfId &&
        !related.has(c.idNumber) &&
        (c.idNumber?.toLowerCase().includes(term) ||
         c.shortName?.toLowerCase().includes(term) ||
         c.description?.toLowerCase().includes(term)))
      .slice(0, 50);
  }

  displayFn(val: any): string {
    return typeof val === 'string' ? val : '';
  }

  selectCompetency(comp: Competency): void {
    if (comp.idNumber && !this.data.competency.relatedIdNumbers.includes(comp.idNumber)) {
      this.data.competency.relatedIdNumbers = [...this.data.competency.relatedIdNumbers, comp.idNumber];
    }
    this.searchText = '';
    this.filteredCompetencies = [];
  }

  removeRelated(id: string): void {
    this.data.competency.relatedIdNumbers = this.data.competency.relatedIdNumbers.filter((x: string) => x !== id);
  }

  handleEditComplete(saveChanges: boolean): void {
    if (!saveChanges) {
      this.editComplete.emit({ saveChanges: false, competency: null });
    } else {
      if (this.errorFree()) {
        this.editComplete.emit({
          saveChanges: true,
          competency: this.data.competency,
        });
      }
    }
  }
}
