// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { Invitation, InvitationService } from 'src/app/generated/blueprint.api';
import { InvitationStore } from './invitation.store';
import { InvitationDataService } from './invitation-data.service';
import { InvitationQuery } from './invitation.query';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { recordEmissions } from 'src/app/test-utils/record-emissions';
import { captureUnhandledRxErrors, flush } from 'src/app/test-utils/unhandled-rx-errors';

function invitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    mselId: 'msel-1',
    teamId: 'team-red',
    emailDomain: 'example.org',
    expirationDateTime: '2026-06-30T23:59:00Z' as unknown as Date,
    maxUsersAllowed: 10,
    userCount: 0,
    isTeamLeader: false,
    wasDeactivated: false,
    ...overrides,
  };
}

function setup(queryParams: Record<string, string> = {}) {
  const invitationApi = {
    getInvitations: vi.fn(() => of<Invitation[]>([])),
    getInvitation: vi.fn(() => of(invitation())),
    createInvitation: vi.fn(() => of(invitation())),
    updateInvitation: vi.fn(() => of(invitation())),
    deleteInvitation: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<InvitationService>;
  const route = activatedRouteStub(queryParams);
  TestBed.configureTestingModule({
    providers: [
      { provide: InvitationService, useValue: invitationApi },
      { provide: Router, useValue: { navigate: vi.fn() } satisfies Pick<Router, 'navigate'> },
      { provide: ActivatedRoute, useValue: route.route },
    ],
  });
  return {
    service: TestBed.inject(InvitationDataService),
    query: TestBed.inject(InvitationQuery),
    invitationApi,
  };
}

const domains = (list: Invitation[]) => list.map((i) => i.emailDomain);

describe('InvitationDataService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: loadByMsel replaces the store with the MSEL's invitations, parsing the expiration, and empties it on failure.
   * Interacts with: InvitationService.getInvitations (stub), real InvitationStore and InvitationQuery.
   * Data: two invitations, then a failure.
   */
  it('loadByMsel replaces the invitations, or empties them on failure', () => {
    const { service, query, invitationApi } = setup();
    invitationApi.getInvitations.mockReturnValueOnce(
      of([invitation(), invitation({ id: 'inv-2', emailDomain: 'example.com' })]),
    );
    invitationApi.getInvitations.mockReturnValueOnce(throwError(() => new Error('boom')));

    service.loadByMsel('msel-1');
    expect(invitationApi.getInvitations).toHaveBeenCalledWith('msel-1');
    expect(domains(query.getAll())).toEqual(['example.org', 'example.com']);
    expect(query.getEntity('inv-1').expirationDateTime).toEqual(new Date('2026-06-30T23:59:00Z'));

    service.loadByMsel('msel-1');
    expect(query.getAll()).toEqual([]);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: loadById, add and update store the API result with a parsed expiration; delete removes after confirmation; unload clears.
   * Interacts with: InvitationService get / create / update / delete (stubs), real InvitationQuery.
   * Data: inv-2 fetched, inv-3 created, inv-2 deactivated by the API, inv-3 deleted.
   */
  it('single-invitation calls keep the store in step with the API', () => {
    const { service, query, invitationApi } = setup();
    invitationApi.getInvitation.mockReturnValue(of(invitation({ id: 'inv-2' })));
    invitationApi.createInvitation.mockReturnValue(of(invitation({ id: 'inv-3', emailDomain: 'gov.test' })));
    invitationApi.updateInvitation.mockReturnValue(of(invitation({ id: 'inv-2', wasDeactivated: true })));
    invitationApi.deleteInvitation.mockReturnValue(of(null));

    service.loadById('inv-2');
    service.add(invitation({ id: undefined, emailDomain: 'gov.test' }));
    service.update(invitation({ id: 'inv-2', wasDeactivated: true }));
    expect(invitationApi.updateInvitation).toHaveBeenCalledWith(
      'inv-2',
      expect.objectContaining({ wasDeactivated: true }),
    );
    expect(query.getEntity('inv-2').wasDeactivated).toBe(true);
    expect(query.getEntity('inv-3').expirationDateTime).toBeInstanceOf(Date);

    service.delete('inv-3');
    expect(query.getAll().map((i) => i.id)).toEqual(['inv-2']);

    service.unload();
    expect(query.getAll()).toEqual([]);
  });

  /**
   * Verifies: updateStore/deleteFromStore and setActive drive the queries; InvitationList filters on the id.
   * Interacts with: real InvitationStore through the service, InvitationQuery.selectAll / selectActive, ActivatedRoute (stub).
   * Data: two invitations; one activated, the other deleted.
   */
  it('updateStore, deleteFromStore and setActive drive the queries', async () => {
    const { service, query } = setup({ invitationmask: 'inv-2' });
    const emissions = recordEmissions(query.selectAll());

    service.updateStore(invitation());
    service.updateStore(invitation({ id: 'inv-2', emailDomain: 'example.com' }));
    expect(domains(recordEmissions(service.InvitationList).at(-1))).toEqual(['example.com']);

    service.setActive('inv-2');
    service.deleteFromStore('inv-1');

    expect(emissions.map(domains)).toEqual([
      [],
      ['example.org'],
      ['example.org', 'example.com'],
      ['example.com'],
    ]);
    const active$ = query.selectActive() as Observable<Invitation>;
    expect((await firstValueFrom(active$)).id).toBe('inv-2');
  });

  /**
   * Verifies: a failed request leaves loading set for every method that sets it first (current behavior), and the ones with no error callback let the error escape.
   * Interacts with: InvitationService endpoints (stubs failing), real InvitationStore and InvitationQuery, captureUnhandledRxErrors.
   * Data: loading cleared first; each endpoint fails with "request failed".
   */
  it.each([
    { method: 'loadById', endpoint: 'getInvitation', escapes: true, call: (s: InvitationDataService) => s.loadById('x-1') },
    { method: 'add', endpoint: 'createInvitation', escapes: true, call: (s: InvitationDataService) => s.add({ id: 'x-1' }) },
    { method: 'update', endpoint: 'updateInvitation', escapes: true, call: (s: InvitationDataService) => s.update({ id: 'x-1' }) },
  ] as const)('$method leaves loading stuck when its request fails', async ({ endpoint, escapes, call }) => {
    const { service, invitationApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    TestBed.inject(InvitationStore).setLoading(false);
    invitationApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    expect(TestBed.inject(InvitationQuery).getValue().loading).toBe(true);
    // With no error callback the error escapes to ErrorService, the ErrorHandler
    // app.module.ts provides, which shows it.
    expect(errors).toEqual(escapes ? [failure] : []);
  });

  /**
   * Verifies: a failed request from delete escapes to the app's global ErrorHandler.
   * Interacts with: InvitationService endpoints (stubs failing), captureUnhandledRxErrors.
   * Data: each endpoint fails with "request failed".
   */
  it.each([
    { method: 'delete', endpoint: 'deleteInvitation', call: (s: InvitationDataService) => s.delete('x-1') },
  ] as const)('$method lets a failed request reach the global ErrorHandler', async ({ endpoint, call }) => {
    const { service, invitationApi } = setup();
    const errors = captureUnhandledRxErrors();
    const failure = new Error('request failed');
    invitationApi[endpoint].mockReturnValue(throwError(() => failure));

    call(service);
    await flush();

    // These methods subscribe with no error callback and set no loading flag,
    // so the error escapes to ErrorService, the ErrorHandler app.module.ts
    // provides, which shows it to the user. Not a defect on its own.
    expect(errors).toEqual([failure]);
  });
});
