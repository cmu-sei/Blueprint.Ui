// Copyright 2023 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DurationEditComponent } from './duration-edit.component';

describe('DurationEditComponent', () => {
  let component: DurationEditComponent;
  let fixture: ComponentFixture<DurationEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DurationEditComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DurationEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
