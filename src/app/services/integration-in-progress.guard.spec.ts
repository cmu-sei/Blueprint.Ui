// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MselStore } from '../data/msel/msel.store';
import { IntegrationInProgressGuard } from './integration-in-progress.guard';

function setup(integrationStatus?: string) {
  const store = TestBed.inject(MselStore);
  if (integrationStatus !== undefined) {
    store.set([{ id: 'msel-1', name: 'Exercise Alpha', integrationStatus }]);
    store.setActive('msel-1');
  }
  return TestBed.inject(IntegrationInProgressGuard);
}

describe('IntegrationInProgressGuard', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: leaving is allowed without asking when no MSEL is active, the active one has no integration status, or its last push ended in an error.
   * Interacts with: real MselStore/MselQuery (active MSEL), window.confirm (spy).
   * Data: no active MSEL; an active MSEL with an empty status; one with status "ERROR: Gallery unreachable".
   */
  it.each([
    { label: 'no MSEL is active', status: undefined },
    { label: 'the active MSEL has no integration status', status: '' },
    { label: 'the last push failed', status: 'ERROR: Gallery unreachable' },
  ])('allows leaving without asking when $label', ({ status }) => {
    const confirm = vi.spyOn(window, 'confirm');

    expect(setup(status).canDeactivate()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  /**
   * Verifies: while a push is in progress the user is asked, and their answer decides.
   * Interacts with: real MselQuery, window.confirm (spy answering no or yes).
   * Data: active MSEL with status "Pushing to CITE".
   */
  it.each([
    { answer: false, label: 'stays' },
    { answer: true, label: 'leaves' },
  ])('asks before leaving a push in progress and $label when the answer is $answer', ({ answer }) => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(answer);

    expect(setup('Pushing to CITE').canDeactivate()).toBe(answer);
    expect(confirm).toHaveBeenCalledWith('An integration push is in progress. Are you sure you want to leave?');
  });
});
