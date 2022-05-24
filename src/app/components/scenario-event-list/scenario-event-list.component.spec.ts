// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ScenarioEventListComponent } from './msel.component';

describe('ScenarioEventListComponent', () => {
  let component: ScenarioEventListComponent;
  let fixture: ComponentFixture<ScenarioEventListComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ ScenarioEventListComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ScenarioEventListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

