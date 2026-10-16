// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { XApiService as GeneratedXApiService } from 'src/app/generated/blueprint.api';
import { XApiService } from './xapi.service';
import { ApiStub } from 'src/app/test-utils/api-stub';

function setup(XApiEnabled?: boolean) {
  const xApi = {
    viewedMsel: vi.fn(() => of<unknown>(null)),
    viewedJoinPage: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<GeneratedXApiService>;
  TestBed.configureTestingModule({
    providers: [
      { provide: GeneratedXApiService, useValue: xApi },
      { provide: ComnSettingsService, useValue: { settings: { XApiEnabled } } satisfies Pick<ComnSettingsService, 'settings'> },
    ],
  });
  return { service: TestBed.inject(XApiService), xApi };
}

describe('XApiService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: when xAPI is disabled (or unset) nothing is sent and both calls resolve to null.
   * Interacts with: generated XApiService (stub), ComnSettingsService.settings.XApiEnabled.
   * Data: XApiEnabled unset.
   */
  it('sends nothing when disabled', async () => {
    const { service, xApi } = setup();

    expect(await firstValueFrom(service.viewedMsel('msel-1'))).toBeNull();
    expect(await firstValueFrom(service.viewedJoinPage())).toBeNull();
    expect(xApi.viewedMsel).not.toHaveBeenCalled();
    expect(xApi.viewedJoinPage).not.toHaveBeenCalled();
  });

  /**
   * Verifies: when enabled each statement is sent and its result passed through.
   * Interacts with: generated XApiService (stub).
   * Data: XApiEnabled true; viewedMsel and viewedJoinPage succeed.
   */
  it('sends statements when enabled', async () => {
    const { service, xApi } = setup(true);
    xApi.viewedMsel.mockReturnValue(of({ ok: true }));
    xApi.viewedJoinPage.mockReturnValue(of({ ok: 'join' }));

    expect(await firstValueFrom(service.viewedMsel('msel-1'))).toEqual({ ok: true });
    expect(xApi.viewedMsel).toHaveBeenCalledWith('msel-1');
    expect(await firstValueFrom(service.viewedJoinPage())).toEqual({ ok: 'join' });
  });

  /**
   * Verifies: when enabled a tracking failure is logged and swallowed (the call resolves to null).
   * Interacts with: generated XApiService (stub failing), console.error (spy).
   * Data: XApiEnabled true; the endpoint fails with "LRS down".
   */
  it.each([
    { method: 'viewedMsel', endpoint: 'viewedMsel', call: (s: XApiService) => s.viewedMsel('msel-1') },
    { method: 'viewedJoinPage', endpoint: 'viewedJoinPage', call: (s: XApiService) => s.viewedJoinPage() },
  ] as const)('$method logs and swallows a tracking failure', async ({ endpoint, call }) => {
    const { service, xApi } = setup(true);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('LRS down');
    xApi[endpoint].mockReturnValue(throwError(() => failure));

    expect(await firstValueFrom(call(service))).toBeNull();
    expect(consoleError.mock.calls).toEqual([['xAPI tracking error:', failure]]);
  });
});
