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
  frameworks: CompetencyFramework[] = [];
  selectedFramework: CompetencyFramework | null = null;
  competencies: Competency[] = [];
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
    this.competencyFrameworkService.getCompetencyFramework(fw.id)
      .pipe(take(1))
      .subscribe({
        next: (framework) => {
          this.competencies = framework.competencies || [];
          this.loading = false;
        },
        error: () => {
          this.competencies = [];
          this.loading = false;
        }
      });
  }

  get filteredCompetencies(): Competency[] {
    let results = this.competencies;
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
    for (const c of this.competencies) {
      this.selected.add(c.idNumber);
    }
  }

  deselectAll(): void {
    this.selected.clear();
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
        newOptions.push({ ...existing, displayOrder: order++ });
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
          });
        }
      }
    }
    this.dialogRef.close(newOptions);
  }
}
