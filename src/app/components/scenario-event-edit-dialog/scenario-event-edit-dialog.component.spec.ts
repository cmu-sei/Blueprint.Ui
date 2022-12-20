// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ScenarioEventEditDialogComponent } from './msel.component';

describe('ScenarioEventEditDialogComponent', () => {
  let component: ScenarioEventEditDialogComponent;
  let fixture: ComponentFixture<ScenarioEventEditDialogComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ ScenarioEventEditDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ScenarioEventEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

