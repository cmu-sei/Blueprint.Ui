// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OffsetDateTimeComponent } from './offset-date-time.component';

describe('OffsetDateTimeComponent', () => {
  let component: OffsetDateTimeComponent;
  let fixture: ComponentFixture<OffsetDateTimeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OffsetDateTimeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OffsetDateTimeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
