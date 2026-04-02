// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Output } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CompetencyFramework, CompetencyElement } from 'src/app/generated/blueprint.api';

interface ElementTypeCount {
  type: string;
  count: number;
}

@Component({
    selector: 'app-admin-competency-framework-import-dialog',
    templateUrl: './admin-competency-framework-import-dialog.component.html',
    styleUrls: ['./admin-competency-framework-import-dialog.component.scss'],
    standalone: false
})
export class AdminCompetencyFrameworkImportDialogComponent {
  @Output() importComplete = new EventEmitter<CompetencyFramework | null>();
  fileName = '';
  parseError = '';
  framework: CompetencyFramework | null = null;
  elementTypeCounts: ElementTypeCount[] = [];
  totalElements = 0;
  skippedTypes = ['sort', 'opm_code'];

  constructor(
    public dialogRef: MatDialogRef<AdminCompetencyFrameworkImportDialogComponent>
  ) {
    dialogRef.disableClose = true;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.fileName = file.name;
    this.parseError = '';
    this.framework = null;
    this.elementTypeCounts = [];

    if (!file.name.endsWith('.json')) {
      this.parseError = 'Only JSON files are supported.';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = JSON.parse(e.target.result);
        this.processJson(data);
      } catch (err) {
        this.parseError = 'Invalid JSON file.';
      }
    };
    reader.readAsText(file);
  }

  private processJson(data: any): void {
    const docs = data.documents || data.response?.elements?.documents || [];
    const doc = docs[0] || {};

    const elements = data.elements || data.response?.elements?.elements || [];
    if (elements.length === 0) {
      this.parseError = 'No elements found in JSON file.';
      return;
    }

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const el of elements) {
      const t = el.element_type || 'unknown';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    this.elementTypeCounts = Object.entries(typeCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, count]) => ({ type, count }));

    const competencyElements: CompetencyElement[] = elements
      .filter((el: any) => !this.skippedTypes.includes(el.element_type))
      .map((el: any) => ({
        elementIdentifier: el.element_identifier || '',
        elementType: el.element_type || '',
        name: el.title || '',
        description: el.text || '',
      }));

    this.totalElements = competencyElements.length;

    this.framework = {
      name: doc.name || 'Imported Framework',
      version: doc.version || '',
      source: doc.doc_identifier || '',
      description: `Imported from ${this.fileName}`,
      competencyElements: competencyElements,
    };
  }

  handleImport(): void {
    this.importComplete.emit(this.framework);
  }

  handleCancel(): void {
    this.importComplete.emit(null);
  }
}
