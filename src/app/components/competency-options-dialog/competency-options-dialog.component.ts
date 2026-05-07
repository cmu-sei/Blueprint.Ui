// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Component, Inject, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CompetencyFramework,
  DataOption,
  MselCompetency,
} from 'src/app/generated/blueprint.api';
import { MselCompetencyQuery } from 'src/app/data/msel-competency/msel-competency.query';
import { CompetencyFrameworkService } from 'src/app/generated/blueprint.api/api/api';
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
  frameworkFilter = '';
  pageIndex = 0;
  pageSize = 50;
  mselCompetencies: MselCompetency[] = [];
  competencyTypes: string[] = [];
  private competencyTypeMap = new Map<string, string>();
  private competencyFrameworkMap = new Map<string, string>();
  frameworks: CompetencyFramework[] = [];
  frameworkNames: string[] = [];
  selected = new Set<string>(); // tracks by idNumber
  private unsubscribe$ = new Subject();

  constructor(
    public dialogRef: MatDialogRef<CompetencyOptionsDialogComponent>,
    private mselCompetencyQuery: MselCompetencyQuery,
    private competencyFrameworkService: CompetencyFrameworkService,
    @Inject(MAT_DIALOG_DATA) public data: {
      dataFieldId: string;
      dataOptions: DataOption[];
      canEdit: boolean;
    }
  ) {
    dialogRef.disableClose = true;
    // Load frameworks
    this.competencyFrameworkService.getCompetencyFrameworks().subscribe(frameworks => {
      this.frameworks = frameworks;
      this.buildFrameworkMap();
    });
    // Subscribe to MSEL competency pool
    this.mselCompetencyQuery.selectAll().pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe(mselCompetencies => {
      this.mselCompetencies = mselCompetencies;
      this.buildTypeMap();
      this.buildFrameworkMap();
    });
    // Initialize selected set — only include options still in the pool
    const poolIdNumbers = new Set(
      this.mselCompetencies.map(mc => mc.competency?.idNumber).filter(n => n)
    );
    for (const opt of this.data.dataOptions) {
      if (poolIdNumbers.has(opt.optionName)) {
        this.selected.add(opt.optionName);
      }
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  private buildTypeMap() {
    this.competencyTypeMap.clear();
    for (const mc of this.mselCompetencies) {
      const c = mc.competency;
      if (!c) continue;
      const t = this.deriveTypeFromId(c.idNumber);
      this.competencyTypeMap.set(c.id, t);
    }
    this.competencyTypes = [...new Set(this.competencyTypeMap.values())]
      .filter(t => t !== 'Other')
      .sort();
  }

  private buildFrameworkMap() {
    this.competencyFrameworkMap.clear();
    const frameworkMap = new Map(this.frameworks.map(f => [f.id, f.name]));
    const frameworkNamesSet = new Set<string>();
    for (const mc of this.mselCompetencies) {
      const c = mc.competency;
      if (!c || !c.competencyFrameworkId) continue;
      const frameworkName = frameworkMap.get(c.competencyFrameworkId) || 'Unknown';
      this.competencyFrameworkMap.set(c.id, frameworkName);
      frameworkNamesSet.add(frameworkName);
    }
    this.frameworkNames = [...frameworkNamesSet].sort();
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

  get filteredCompetencies(): MselCompetency[] {
    let results = this.mselCompetencies;
    if (this.frameworkFilter) {
      results = results.filter(mc => this.competencyFrameworkMap.get(mc.competencyId) === this.frameworkFilter);
    }
    if (this.typeFilter) {
      results = results.filter(mc => this.competencyTypeMap.get(mc.competencyId) === this.typeFilter);
    }
    if (this.searchText) {
      const s = this.searchText.toLowerCase();
      results = results.filter(mc =>
        mc.competency?.idNumber?.toLowerCase().includes(s) ||
        mc.competency?.shortName?.toLowerCase().includes(s) ||
        mc.competency?.description?.toLowerCase().includes(s)
      );
    }
    return results;
  }

  get paginatedCompetencies(): MselCompetency[] {
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

  getType(mc: MselCompetency): string {
    return this.competencyTypeMap.get(mc.competencyId) || 'Other';
  }

  getFramework(mc: MselCompetency): string {
    return this.competencyFrameworkMap.get(mc.competencyId) || '';
  }

  get selectedCount(): number {
    return this.selected.size;
  }

  get allFilteredSelected(): boolean {
    const filtered = this.filteredCompetencies;
    return filtered.length > 0 && filtered.every(mc => this.selected.has(mc.competency?.idNumber));
  }

  get someFilteredSelected(): boolean {
    const filtered = this.filteredCompetencies;
    const some = filtered.some(mc => this.selected.has(mc.competency?.idNumber));
    const all = filtered.every(mc => this.selected.has(mc.competency?.idNumber));
    return some && !all;
  }

  isSelected(mc: MselCompetency): boolean {
    return this.selected.has(mc.competency?.idNumber);
  }

  toggleAll(): void {
    if (this.allFilteredSelected) {
      for (const mc of this.filteredCompetencies) {
        this.selected.delete(mc.competency?.idNumber);
      }
    } else {
      for (const mc of this.filteredCompetencies) {
        if (mc.competency?.idNumber) {
          this.selected.add(mc.competency.idNumber);
        }
      }
    }
  }

  toggleCompetency(mc: MselCompetency): void {
    const idNumber = mc.competency?.idNumber;
    if (!idNumber) return;
    if (this.selected.has(idNumber)) {
      this.selected.delete(idNumber);
    } else {
      this.selected.add(idNumber);
    }
  }

  handleClose() {
    const competencyMap = new Map<string, MselCompetency>();
    for (const mc of this.mselCompetencies) {
      if (mc.competency?.idNumber) {
        competencyMap.set(mc.competency.idNumber, mc);
      }
    }
    const existingMap = new Map<string, DataOption>();
    for (const opt of this.data.dataOptions) {
      existingMap.set(opt.optionName, opt);
    }
    const newOptions: DataOption[] = [];
    let order = 1;
    for (const idNumber of this.selected) {
      // Skip stale options for competencies no longer in the pool
      if (!competencyMap.has(idNumber)) continue;
      const existing = existingMap.get(idNumber);
      if (existing) {
        const mc = competencyMap.get(idNumber);
        newOptions.push({ ...existing, displayOrder: order++, competencyId: mc?.competency?.id || (existing as any).competencyId } as any);
      } else {
        const mc = competencyMap.get(idNumber);
        if (mc?.competency) {
          newOptions.push({
            id: uuidv4(),
            dataFieldId: this.data.dataFieldId,
            optionName: mc.competency.idNumber,
            optionValue: mc.competency.shortName,
            optionDescription: mc.competency.description,
            displayOrder: order++,
            competencyId: mc.competency.id,
          } as any);
        }
      }
    }
    this.dialogRef.close(newOptions);
  }
}
