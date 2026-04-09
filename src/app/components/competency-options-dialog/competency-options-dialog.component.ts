// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';
import {
  DataOption,
  CompetencyFramework,
  Competency,
  CompetencyFrameworkService,
} from 'src/app/generated/blueprint.api';
import { CompetencyFrameworkQuery } from 'src/app/data/competency-framework/competency-framework.query';
import { CompetencyFrameworkDataService } from 'src/app/data/competency-framework/competency-framework-data.service';
import { v4 as uuidv4 } from 'uuid';

@Component({
    selector: 'app-competency-options-dialog',
    templateUrl: './competency-options-dialog.component.html',
    styleUrls: ['./competency-options-dialog.component.scss'],
    standalone: false
})
export class CompetencyOptionsDialogComponent implements OnDestroy {
  searchText = '';
  typeFilter = '';
  pageIndex = 0;
  pageSize = 50;
  frameworks: CompetencyFramework[] = [];
  selectedFramework: CompetencyFramework | null = null;
  competencies: Competency[] = [];
  competencyTypes: string[] = [];
  private competencyTypeMap = new Map<string, string>();
  private taxonomyLevels: string[] = [];
  selected = new Set<string>(); // tracks by idNumber
  loading = false;
  private unsubscribe$ = new Subject();

  constructor(
    public dialogRef: MatDialogRef<CompetencyOptionsDialogComponent>,
    private competencyFrameworkQuery: CompetencyFrameworkQuery,
    private competencyFrameworkDataService: CompetencyFrameworkDataService,
    private competencyFrameworkService: CompetencyFrameworkService,
    @Inject(MAT_DIALOG_DATA) public data: {
      dataFieldId: string;
      dataOptions: DataOption[];
      canEdit: boolean;
    }
  ) {
    dialogRef.disableClose = true;
    // Initialize selected set from existing data options
    for (const opt of this.data.dataOptions) {
      this.selected.add(opt.optionName);
    }
    // Load frameworks
    this.competencyFrameworkDataService.load();
    this.competencyFrameworkQuery.selectAll().pipe(
      filter(fw => fw.length > 0),
      take(1)
    ).subscribe(fw => {
      this.frameworks = fw;
      if (fw.length === 1) {
        this.selectFramework(fw[0]);
      }
    });
    this.competencyFrameworkQuery.selectAll().pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe(fw => {
      this.frameworks = fw;
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  getFrameworkById(id: string): CompetencyFramework {
    return this.frameworks.find(fw => fw.id === id);
  }

  selectFramework(fw: CompetencyFramework) {
    this.selectedFramework = fw;
    this.loading = true;
    this.searchText = '';
    this.typeFilter = '';
    this.competencyFrameworkService.getCompetencyFramework(fw.id)
      .pipe(take(1))
      .subscribe({
        next: (framework) => {
          this.competencies = framework.competencies || [];
          this.buildTypeMap(framework);
          this.loading = false;
        },
        error: () => {
          this.competencies = [];
          this.competencyTypes = [];
          this.competencyTypeMap.clear();
          this.loading = false;
        }
      });
  }

  get filteredCompetencies(): Competency[] {
    let results = this.competencies;
    if (this.typeFilter) {
      results = results.filter(c => this.competencyTypeMap.get(c.id) === this.typeFilter);
    }
    if (this.searchText) {
      const s = this.searchText.toLowerCase();
      results = results.filter(c =>
        c.idNumber?.toLowerCase().includes(s) ||
        c.shortName?.toLowerCase().includes(s) ||
        c.description?.toLowerCase().includes(s)
      );
    }
    return results;
  }

  get paginatedCompetencies(): Competency[] {
    const start = this.pageIndex * this.pageSize;
    return this.filteredCompetencies.slice(start, start + this.pageSize);
  }

  onPageChanged(event: any): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  onFilterChanged(): void {
    this.pageIndex = 0;
  }

  getType(c: Competency): string {
    return this.competencyTypeMap.get(c.id) || 'Other';
  }

  get selectedCount(): number {
    return this.selected.size;
  }

  get allFilteredSelected(): boolean {
    const filtered = this.filteredCompetencies;
    return filtered.length > 0 && filtered.every(c => this.selected.has(c.idNumber));
  }

  get someFilteredSelected(): boolean {
    const filtered = this.filteredCompetencies;
    const some = filtered.some(c => this.selected.has(c.idNumber));
    const all = filtered.every(c => this.selected.has(c.idNumber));
    return some && !all;
  }

  isSelected(c: Competency): boolean {
    return this.selected.has(c.idNumber);
  }

  toggleAll(): void {
    if (this.allFilteredSelected) {
      for (const c of this.filteredCompetencies) {
        this.selected.delete(c.idNumber);
      }
    } else {
      for (const c of this.filteredCompetencies) {
        this.selected.add(c.idNumber);
      }
    }
  }

  toggleCompetency(c: Competency): void {
    if (this.selected.has(c.idNumber)) {
      this.selected.delete(c.idNumber);
    } else {
      this.selected.add(c.idNumber);
    }
  }

  selectAll(): void {
    for (const c of this.filteredCompetencies) {
      this.selected.add(c.idNumber);
    }
  }

  deselectAll(): void {
    if (this.typeFilter || this.searchText) {
      for (const c of this.filteredCompetencies) {
        this.selected.delete(c.idNumber);
      }
    } else {
      this.selected.clear();
    }
  }

  private buildTypeMap(fw: CompetencyFramework) {
    this.competencyTypeMap.clear();
    const comps = fw.competencies || [];
    const byId = new Map<string, Competency>();
    comps.forEach(c => byId.set(c.id, c));

    const hasHierarchy = comps.some(c => c.parentId && byId.has(c.parentId));

    this.taxonomyLevels = (fw.taxonomies || '')
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    for (const c of comps) {
      const idType = this.deriveTypeFromId(c.idNumber);
      if (idType !== 'Other') {
        this.competencyTypeMap.set(c.id, idType);
      } else if (hasHierarchy && this.taxonomyLevels.length > 0) {
        const depth = this.getDepth(c, byId);
        this.competencyTypeMap.set(c.id, this.taxonomyLevels[Math.min(depth, this.taxonomyLevels.length - 1)]);
      } else if (hasHierarchy) {
        const isRoot = !c.parentId || !byId.has(c.parentId);
        this.competencyTypeMap.set(c.id, isRoot ? 'Category' : 'Other');
      } else {
        this.competencyTypeMap.set(c.id, 'Other');
      }
    }

    this.competencyTypes = [...new Set(this.competencyTypeMap.values())].sort();
  }

  private deriveTypeFromId(idNumber: string): string {
    if (!idNumber) return 'Other';
    if (idNumber.includes('WRL')) return 'Work Role';
    if (/^[TKSA][\d-]/.test(idNumber)) {
      const prefixMap: Record<string, string> = {
        'T': 'Task', 'K': 'Knowledge', 'S': 'Skill', 'A': 'Ability',
      };
      return prefixMap[idNumber.charAt(0)] || 'Other';
    }
    if (/^[A-Z]{2}-[A-Z]{3}-\d+$/.test(idNumber)) return 'Work Role';
    if (/^[A-Z]{3}$/.test(idNumber)) return 'Specialty Area';
    if (/^[A-Z]{2}$/.test(idNumber)) return 'Category';
    return 'Other';
  }

  private getDepth(comp: Competency, byId: Map<string, Competency>): number {
    let depth = 0;
    let current = comp;
    while (current.parentId && byId.has(current.parentId)) {
      depth++;
      current = byId.get(current.parentId);
    }
    return depth;
  }

  handleClose() {
    const competencyMap = new Map<string, Competency>();
    for (const c of this.competencies) {
      competencyMap.set(c.idNumber, c);
    }
    const existingMap = new Map<string, DataOption>();
    for (const opt of this.data.dataOptions) {
      existingMap.set(opt.optionName, opt);
    }
    const newOptions: DataOption[] = [];
    let order = 1;
    for (const idNumber of this.selected) {
      const existing = existingMap.get(idNumber);
      if (existing) {
        const c = competencyMap.get(idNumber);
        newOptions.push({ ...existing, displayOrder: order++, competencyId: c?.id || (existing as any).competencyId } as any);
      } else {
        const c = competencyMap.get(idNumber);
        if (c) {
          newOptions.push({
            id: uuidv4(),
            dataFieldId: this.data.dataFieldId,
            optionName: c.idNumber,
            optionValue: c.shortName,
            optionDescription: c.description,
            displayOrder: order++,
            competencyId: c.id,
          } as any);
        }
      }
    }
    this.dialogRef.close(newOptions);
  }
}
