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
  CompetencyElement,
  CompetencyElementService,
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
  frameworks: CompetencyFramework[] = [];
  selectedFramework: CompetencyFramework | null = null;
  elements: CompetencyElement[] = [];
  selected = new Set<string>(); // tracks by elementIdentifier
  loading = false;
  private unsubscribe$ = new Subject();

  constructor(
    public dialogRef: MatDialogRef<CompetencyOptionsDialogComponent>,
    private competencyFrameworkQuery: CompetencyFrameworkQuery,
    private competencyFrameworkDataService: CompetencyFrameworkDataService,
    private competencyElementService: CompetencyElementService,
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
      // Auto-select if only one framework
      if (fw.length === 1) {
        this.selectFramework(fw[0]);
      }
    });
    // Keep frameworks list updated
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
    this.competencyElementService.getCompetencyElementsByFramework(fw.id)
      .pipe(take(1))
      .subscribe({
        next: (elements) => {
          this.elements = elements;
          this.loading = false;
        },
        error: () => {
          this.elements = [];
          this.loading = false;
        }
      });
  }

  get availableTypes(): string[] {
    const types = new Set<string>();
    for (const el of this.elements) {
      if (el.elementType) types.add(el.elementType);
    }
    return [...types].sort();
  }

  get filteredElements(): CompetencyElement[] {
    let results = this.elements;
    if (this.typeFilter) {
      results = results.filter(el => el.elementType === this.typeFilter);
    }
    if (this.searchText) {
      const s = this.searchText.toLowerCase();
      results = results.filter(el =>
        el.elementIdentifier?.toLowerCase().includes(s) ||
        el.elementType?.toLowerCase().includes(s) ||
        el.name?.toLowerCase().includes(s) ||
        el.description?.toLowerCase().includes(s)
      );
    }
    return results;
  }

  get selectedCount(): number {
    return this.selected.size;
  }

  get allFilteredSelected(): boolean {
    const filtered = this.filteredElements;
    return filtered.length > 0 && filtered.every(el => this.selected.has(el.elementIdentifier));
  }

  get someFilteredSelected(): boolean {
    const filtered = this.filteredElements;
    const some = filtered.some(el => this.selected.has(el.elementIdentifier));
    const all = filtered.every(el => this.selected.has(el.elementIdentifier));
    return some && !all;
  }

  isSelected(el: CompetencyElement): boolean {
    return this.selected.has(el.elementIdentifier);
  }

  toggleAll(): void {
    if (this.allFilteredSelected) {
      for (const el of this.filteredElements) {
        this.selected.delete(el.elementIdentifier);
      }
    } else {
      for (const el of this.filteredElements) {
        this.selected.add(el.elementIdentifier);
      }
    }
  }

  toggleElement(el: CompetencyElement): void {
    if (this.selected.has(el.elementIdentifier)) {
      this.selected.delete(el.elementIdentifier);
    } else {
      this.selected.add(el.elementIdentifier);
    }
  }

  selectAll(): void {
    for (const el of this.elements) {
      this.selected.add(el.elementIdentifier);
    }
  }

  deselectAll(): void {
    this.selected.clear();
  }

  handleClose() {
    // Build new dataOptions from selected elements
    const elementMap = new Map<string, CompetencyElement>();
    for (const el of this.elements) {
      elementMap.set(el.elementIdentifier, el);
    }
    // Also keep existing option data for elements we still have selected
    const existingMap = new Map<string, DataOption>();
    for (const opt of this.data.dataOptions) {
      existingMap.set(opt.optionName, opt);
    }
    const newOptions: DataOption[] = [];
    let order = 1;
    for (const identifier of this.selected) {
      const existing = existingMap.get(identifier);
      if (existing) {
        newOptions.push({ ...existing, displayOrder: order++ });
      } else {
        const el = elementMap.get(identifier);
        if (el) {
          newOptions.push({
            id: uuidv4(),
            dataFieldId: this.data.dataFieldId,
            optionName: el.elementIdentifier,
            optionValue: el.name,
            optionDescription: el.description,
            displayOrder: order++,
          });
        }
      }
    }
    this.dialogRef.close(newOptions);
  }
}
