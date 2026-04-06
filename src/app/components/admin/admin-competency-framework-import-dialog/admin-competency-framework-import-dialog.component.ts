// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, EventEmitter, Output } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CompetencyFramework, Competency } from 'src/app/generated/blueprint.api';
import * as XLSX from 'xlsx';

interface ElementTypeCount {
  type: string;
  count: number;
}

export interface ImportResult {
  type: 'csv' | 'json' | 'parsed';
  file?: File;
  source: string;
  version: string;
  framework?: CompetencyFramework;
}

@Component({
    selector: 'app-admin-competency-framework-import-dialog',
    templateUrl: './admin-competency-framework-import-dialog.component.html',
    styleUrls: ['./admin-competency-framework-import-dialog.component.scss'],
    standalone: false
})
export class AdminCompetencyFrameworkImportDialogComponent {
  @Output() importComplete = new EventEmitter<ImportResult | null>();
  fileName = '';
  parseError = '';
  source = '';
  version = '';
  selectedFile: File | null = null;
  fileType: 'csv' | 'json' | 'xlsx' | null = null;
  framework: CompetencyFramework | null = null;
  elementTypeCounts: ElementTypeCount[] = [];
  totalElements = 0;
  skippedTypes = ['sort', 'opm_code'];
  totalRelationships = 0;
  jsonPreviewName = '';

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
    this.totalElements = 0;
    this.selectedFile = file;

    if (file.name.endsWith('.csv')) {
      this.fileType = 'csv';
      // CSV files are uploaded directly to the server for parsing
      const versionMatch = file.name.match(/_v([\d.]+)/i);
      if (versionMatch && !this.version) {
        this.version = versionMatch[1];
      }
      const sourceMatch = file.name.match(/^([A-Z]+)/i);
      if (sourceMatch && !this.source) {
        this.source = sourceMatch[1].toUpperCase();
      }
    } else if (file.name.endsWith('.json')) {
      this.fileType = 'json';
      // JSON files are uploaded directly to the server for parsing (like CSV)
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = JSON.parse(e.target.result);
          this.previewJson(data);
        } catch (err) {
          this.parseError = 'Invalid JSON file.';
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      this.fileType = 'xlsx';
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
    } else {
      this.parseError = 'Supported formats: .csv (Moodle), .json (NICE), .xlsx (DCWF)';
      this.selectedFile = null;
      this.fileType = null;
    }
  }

  private previewJson(data: any): void {
    const docs = data.documents || data.response?.elements?.documents || [];
    const doc = docs[0] || {};

    const elements = data.elements || data.response?.elements?.elements || [];
    if (elements.length === 0) {
      this.parseError = 'No elements found in JSON file.';
      return;
    }

    // Count by type for preview
    const typeCounts: Record<string, number> = {};
    for (const el of elements) {
      const t = el.element_type || 'unknown';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    this.elementTypeCounts = Object.entries(typeCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, count]) => ({ type, count }));

    const relationships = data.relationships || data.response?.elements?.relationships || [];
    this.totalElements = elements.filter((el: any) => !this.skippedTypes.includes(el.element_type)).length;
    this.totalRelationships = relationships.length;
    this.source = doc.doc_identifier || '';
    this.version = doc.version || '';
    this.jsonPreviewName = doc.name || 'Imported Framework';
  }

  private processXlsx(workbook: XLSX.WorkBook): void {
    const masterSheet = workbook.Sheets['Master Task & KSA List'];
    if (!masterSheet) {
      this.parseError = 'Sheet "Master Task & KSA List" not found in workbook.';
      return;
    }

    const typeCounts: Record<string, number> = {};
    const competencies: Competency[] = [];

    // Parse work roles from "DCWF Roles" sheet
    const rolesSheet = workbook.Sheets['DCWF Roles'];
    if (rolesSheet) {
      const roleRows: any[][] = XLSX.utils.sheet_to_json(rolesSheet, { header: 1, defval: '' });
      for (let i = 2; i < roleRows.length; i++) {
        const row = roleRows[i];
        const roleName = String(row[3] || '').trim();
        const dcwfCode = String(row[4] || '').trim();
        const description = String(row[6] || '').trim();
        if (!roleName || !dcwfCode) continue;
        typeCounts['work_role'] = (typeCounts['work_role'] || 0) + 1;
        competencies.push({
          idNumber: 'WRL-' + dcwfCode,
          shortName: 'WRL-' + dcwfCode + ' - ' + roleName,
          description: description,
        });
      }
    }

    // Parse tasks and KSAs from Master Task & KSA List
    const masterRows: any[][] = XLSX.utils.sheet_to_json(masterSheet, { header: 1, defval: '' });
    const prefixMap: Record<string, string> = { task: 'T', knowledge: 'K', skill: 'S', ability: 'A' };
    const seenIds = new Set<string>(competencies.map(c => c.idNumber));
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
        else elementType = 'knowledge'; // default KSA to knowledge
      }
      typeCounts[elementType] = (typeCounts[elementType] || 0) + 1;
      const prefix = prefixMap[elementType] || 'T';
      const idNumber = `${prefix}-${dcwfNum}`;
      if (seenIds.has(idNumber)) continue; // skip duplicates
      seenIds.add(idNumber);
      competencies.push({
        idNumber: idNumber,
        shortName: `${idNumber} - ${description}`,
        description: description,
      });
    }

    // Parse per-role sheets to build work role → TKSA relationships
    const roleIdByCode = new Map<string, string>();
    for (const c of competencies) {
      if (c.idNumber.startsWith('WRL-')) {
        roleIdByCode.set(c.idNumber.replace('WRL-', ''), c.idNumber);
      }
    }
    const tksaIdSet = new Set(competencies.filter(c => !c.idNumber.startsWith('WRL-')).map(c => c.idNumber));

    for (const sheetName of workbook.SheetNames) {
      const codeMatch = sheetName.match(/\([\w]+-(\d+)\)/);
      if (!codeMatch) continue;
      const roleCode = codeMatch[1];
      const roleIdNumber = roleIdByCode.get(roleCode);
      if (!roleIdNumber) continue;

      const roleComp = competencies.find(c => c.idNumber === roleIdNumber);
      if (!roleComp) continue;

      const ws = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const relatedIds: string[] = [];
      for (let i = 5; i < rows.length; i++) {
        const dcwfNum = String(rows[i][0] || '').trim();
        if (!dcwfNum) continue;
        // Find the matching TKSA competency by checking all prefixes
        for (const p of ['T', 'K', 'S', 'A']) {
          const candidate = `${p}-${dcwfNum}`;
          if (tksaIdSet.has(candidate)) {
            relatedIds.push(candidate);
            break;
          }
        }
      }
      const uniqueRelated = [...new Set(relatedIds)];
      if (uniqueRelated.length > 0) {
        roleComp.relatedIdNumbers = uniqueRelated;
      }
    }

    if (competencies.length === 0) {
      this.parseError = 'No elements found in XLSX file.';
      return;
    }

    const totalRels = competencies.reduce((sum, c) => sum + (c.relatedIdNumbers?.length || 0), 0);
    this.elementTypeCounts = Object.entries(typeCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, count]) => ({ type, count }));
    this.totalElements = competencies.length;
    this.totalRelationships = totalRels;

    const versionMatch = this.fileName.match(/_v([\d.]+)\./i);
    this.source = 'DCWF';
    this.version = versionMatch ? versionMatch[1] : '';

    this.framework = {
      name: 'DoD Cyber Workforce Framework (DCWF)',
      version: this.version,
      source: this.source,
      description: `Imported from ${this.fileName}`,
      competencies: competencies,
    };
  }

  get ready(): boolean {
    if (this.fileType === 'csv') return !!this.selectedFile;
    if (this.fileType === 'json') return !!this.selectedFile && this.totalElements > 0;
    return !!this.framework;
  }

  handleImport(): void {
    if (this.fileType === 'csv' && this.selectedFile) {
      this.importComplete.emit({
        type: 'csv',
        file: this.selectedFile,
        source: this.source,
        version: this.version,
      });
    } else if (this.fileType === 'json' && this.selectedFile) {
      this.importComplete.emit({
        type: 'json',
        file: this.selectedFile,
        source: this.source,
        version: this.version,
      });
    } else if (this.framework) {
      this.framework.source = this.source;
      this.framework.version = this.version;
      this.importComplete.emit({
        type: 'parsed',
        source: this.source,
        version: this.version,
        framework: this.framework,
      });
    }
  }

  handleCancel(): void {
    this.importComplete.emit(null);
  }
}
