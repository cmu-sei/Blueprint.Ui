/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InjectPageComponent } from './inject-page.component';

describe('InjectPageComponent', () => {
  let component: InjectPageComponent;
  let fixture: ComponentFixture<InjectPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InjectPageComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InjectPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
