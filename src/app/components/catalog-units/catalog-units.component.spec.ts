// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CatalogUnitsComponent } from './catalog-units.component';

describe('CatalogRolesComponent', () => {
  let component: CatalogUnitsComponent;
  let fixture: ComponentFixture<CatalogUnitsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ CatalogUnitsComponent ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CatalogUnitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
