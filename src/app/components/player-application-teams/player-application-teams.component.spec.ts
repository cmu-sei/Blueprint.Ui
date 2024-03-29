// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerApplicationTeamsDialogComponent } from './player-application-teams.component';

describe('PlayerApplicationTeamsComponent', () => {
  let component: PlayerApplicationTeamsDialogComponent;
  let fixture: ComponentFixture<PlayerApplicationTeamsDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [PlayerApplicationTeamsDialogComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlayerApplicationTeamsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
