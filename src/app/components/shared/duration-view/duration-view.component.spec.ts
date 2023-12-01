/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DurationViewComponent } from './duration-view.component';

describe('DurationViewComponent', () => {
  let component: DurationViewComponent;
  let fixture: ComponentFixture<DurationViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DurationViewComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DurationViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
