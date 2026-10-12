// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'app-admin-competency-edit-dialog',
    templateUrl: './admin-competency-edit-dialog.component.html',
    styleUrls: ['./admin-competency-edit-dialog.component.scss'],
    standalone: false
})
export class AdminCompetencyEditDialogComponent {
  @Output() editComplete = new EventEmitter<any>();
  typeHint = '';
  typeHintLocked = false;
  availableTypes: string[] = [];
  availableParents: { id: string; label: string }[] = [];
  private typePrefixMap: Record<string, string> = {
    'Work Role': 'WRL-',
    'Task': 'T',
    'Knowledge': 'K',
    'Skill': 'S',
    'Ability': 'A',
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.typeHint = this.data.typeHint || '';
    this.typeHintLocked = !!this.data.typeHint;
    this.availableTypes = this.data.availableTypes || [];
    this.availableParents = this.data.availableParents || [];
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
