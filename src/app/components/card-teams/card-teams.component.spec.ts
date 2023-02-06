// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CardTeamsDialogComponent } from './card-teams.component';

describe('CardTeamsComponent', () => {
  let component: CardTeamsDialogComponent;
  let fixture: ComponentFixture<CardTeamsDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CardTeamsDialogComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CardTeamsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
