// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Output } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CompetencyFramework, CompetencyElement } from 'src/app/generated/blueprint.api';
import * as XLSX from 'xlsx';

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

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          this.processXlsx(workbook);
        } catch (err) {
          this.parseError = 'Failed to parse XLSX file.';
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.name.endsWith('.json')) {
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
    } else {
      this.parseError = 'Supported formats: .json, .xlsx';
    }
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
        name: (el.title && el.title !== 'N/A') ? el.title : (el.element_identifier + ' - ' + (el.text || '')),
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

  private processXlsx(workbook: XLSX.WorkBook): void {
    const masterSheet = workbook.Sheets['Master Task & KSA List'];
    if (!masterSheet) {
      this.parseError = 'Sheet "Master Task & KSA List" not found in workbook.';
      return;
    }

    const typeCounts: Record<string, number> = {};
    const elements: CompetencyElement[] = [];

    // Parse work roles from "DCWF Roles" sheet
    const rolesSheet = workbook.Sheets['DCWF Roles'];
    if (rolesSheet) {
      const roleRows: any[][] = XLSX.utils.sheet_to_json(rolesSheet, { header: 1, defval: '' });
      // Data starts at row 2; col 3=name, col 4=code, col 5=NCWF ID, col 6=definition
      for (let i = 2; i < roleRows.length; i++) {
        const row = roleRows[i];
        const roleName = String(row[3] || '').trim();
        const dcwfCode = String(row[4] || '').trim();
        const description = String(row[6] || '').trim();
        if (!roleName || !dcwfCode) continue;
        typeCounts['work_role'] = (typeCounts['work_role'] || 0) + 1;
        elements.push({
          elementIdentifier: 'WRL-' + dcwfCode,
          elementType: 'work_role',
          name: 'WRL-' + dcwfCode + ' - ' + roleName,
          description: description,
        });
      }
    }

    // Parse tasks and KSAs from Master Task & KSA List
    // Row 0 is header: DCWF # | # | A | Task/KSA | description | ...
    const masterRows: any[][] = XLSX.utils.sheet_to_json(masterSheet, { header: 1, defval: '' });
    for (let i = 1; i < masterRows.length; i++) {
      const row = masterRows[i];
      const dcwfNum = String(row[0] || '').trim();
      const taskKsa = String(row[3] || '').trim().toLowerCase();
      const description = String(row[4] || '').trim();
      if (!dcwfNum || !taskKsa || !description) continue;
      let elementType = taskKsa;
      if (taskKsa === 'ksa') {
        const stripped = description.replace(/^\*\s*/, '');
        const firstWord = stripped.split(/\s/)[0].toLowerCase();
        if (firstWord === 'knowledge') elementType = 'knowledge';
        else if (firstWord === 'skill') elementType = 'skill';
        else if (firstWord === 'ability' || firstWord === 'abiltiy') elementType = 'ability';
      }
      typeCounts[elementType] = (typeCounts[elementType] || 0) + 1;
      elements.push({
        elementIdentifier: dcwfNum,
        elementType: elementType,
        name: dcwfNum + ' - ' + description,
        description: description,
      });
    }

    if (elements.length === 0) {
      this.parseError = 'No elements found in XLSX file.';
      return;
    }

    this.elementTypeCounts = Object.entries(typeCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, count]) => ({ type, count }));
    this.totalElements = elements.length;

    // Try to extract version from filename (e.g., "_v5.1.xlsx" -> "5.1")
    const versionMatch = this.fileName.match(/_v([\d.]+)\./i);

    this.framework = {
      name: 'DoD Cyber Workforce Framework (DCWF)',
      version: versionMatch ? versionMatch[1] : '',
      source: 'DCWF',
      description: `Imported from ${this.fileName}`,
      competencyElements: elements,
    };
  }

  handleImport(): void {
    this.importComplete.emit(this.framework);
  }

  handleCancel(): void {
    this.importComplete.emit(null);
  }
}
