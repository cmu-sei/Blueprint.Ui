/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MselPlaybookComponent } from './msel-playbook.component';

describe('MselPlaybookComponent', () => {
  let component: MselPlaybookComponent;
  let fixture: ComponentFixture<MselPlaybookComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MselPlaybookComponent ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MselPlaybookComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
