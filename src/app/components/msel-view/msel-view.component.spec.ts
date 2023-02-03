// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { MselViewComponent } from './msel-view.component';

describe('MselViewComponent', () => {
  let component: MselViewComponent;
  let fixture: ComponentFixture<MselViewComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ MselViewComponent ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MselViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

