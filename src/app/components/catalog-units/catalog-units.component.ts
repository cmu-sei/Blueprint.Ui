// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UnitQuery } from 'src/app/data/unit/unit.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import {
  DataField,
  Catalog,
  CatalogUnit,
  ScenarioEvent,
  Unit,
  User,
} from 'src/app/generated/blueprint.api';
import { CatalogDataService } from 'src/app/data/catalog/catalog-data.service';
import { CatalogQuery } from 'src/app/data/catalog/catalog.query';
import { CatalogUnitDataService } from 'src/app/data/catalog-unit/catalog-unit-data.service';
import { CatalogUnitQuery } from 'src/app/data/catalog-unit/catalog-unit.query';
import { MatMenuTrigger } from '@angular/material/menu';

@Component({
  selector: 'app-catalog-units',
  templateUrl: './catalog-units.component.html',
  styleUrls: ['./catalog-units.component.scss'],
})
export class CatalogUnitsComponent implements OnDestroy, OnInit {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() catalog: Catalog;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  expandedSectionIds: string[] = [];
  sortedScenarioEvents: ScenarioEvent[];
  sortedDataFields: DataField[];
  isEditEnabled = false;
  userList: User[] = [];
  catalogUnitList: CatalogUnit[] = [];
  private allUnits: Unit[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private unitQuery: UnitQuery,
    private userDataService: UserDataService,
    private catalogDataService: CatalogDataService,
    private catalogUnitDataService: CatalogUnitDataService,
    private catalogUnitQuery: CatalogUnitQuery,
  ) {
    // subscribe to users
    this.userDataService.users.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
    // subscribe to units
    this.unitQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(units => {
      if (units && units.length > 0) {
        this.allUnits = units.sort((a, b) => a.shortName?.toLowerCase() > b.shortName?.toLowerCase() ? 1 : -1);
      }
    });
    // subscribe to catalogUnits
    this.catalogUnitQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(catalogUnits => {
      this.catalogUnitList = [];
      catalogUnits.forEach(mt => {
        const catalogUnit = {} as CatalogUnit;
        if (mt) {
          this.catalogUnitList.push(Object.assign(catalogUnit, mt));
        }
      });
      if (this.catalogUnitList.length > 0) {
        this.catalogUnitList = this.catalogUnitList.sort((a, b) =>
          a.unit.shortName?.toLowerCase() > b.unit.shortName?.toLowerCase() ? 1 : -1);
      }
    });
  }

  ngOnInit() {
    // load the CatalogUnits
    this.catalogUnitDataService.loadByCatalog(this.catalog.id);
  }

  getSortedDataFields(dataFields: DataField[]): DataField[] {
    const sortedDataFields: DataField[] = [];
    if (dataFields) {
      dataFields.forEach(df => {
        sortedDataFields.push({ ...df });
      });
      sortedDataFields.sort((a, b) => +a.displayOrder > +b.displayOrder ? 1 : -1);
    }
    return sortedDataFields;
  }

  getUnitList() {
    let unitList = this.allUnits;
    if (this.catalog && this.catalogUnitList && this.catalogUnitList.length > 0 && unitList.length > 0) {
      const catalogUnitIds = new Set(this.catalogUnitList.map(mt => mt.unitId));
      unitList = this.allUnits.filter(t => !catalogUnitIds.has(t.id));
    }

    return unitList;
  }

  getUnit(id: string): Unit {
    const unit = this.allUnits.find(t => t.id === id);
    return unit ? unit : { shortName: 'unit' };
  }

  getCatalogUnitUsers(id: string) {
    const unit = this.catalogUnitList.find(mt => mt.unitId === id).unit;
    return unit ? unit.users : [];
  }

  addUnitToCatalog(unitId: string) {
    const catalogUnit: CatalogUnit = {
      catalogId: this.catalog.id,
      unitId: unitId
    };
    this.catalogUnitDataService.add(catalogUnit);
  }

  removeUnitFromCatalog(id: string) {
    this.catalogUnitDataService.delete(id);
  }

  saveCatalogUnit(catalogUnit: CatalogUnit) {
    this.catalogUnitDataService.updateCatalogUnit(catalogUnit);
  }

  saveChanges() {
    this.catalogDataService.update(this.catalog);
    this.isEditEnabled = false;
  }

  trackByFn(index, item) {
    return item.id;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
