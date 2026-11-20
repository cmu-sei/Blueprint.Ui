// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HubReconnectService, reloadOnReconnect } from './hub-reconnect.service';

const load = vi.fn();

@Component({ selector: 'app-reloading-page', template: '' })
class ReloadingPageComponent {
  constructor() {
    reloadOnReconnect(load);
  }
}

describe('reloadOnReconnect', () => {
  beforeEach(() => {
    load.mockClear();
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: a page's reload runs each time the hub connection is replaced, and not before.
   * Interacts with: HubReconnectService.announceReconnected, a component that registers a reload.
   * Data: two announcements.
   */
  it('runs the reload each time the connection is replaced', () => {
    TestBed.createComponent(ReloadingPageComponent);
    const hubReconnect = TestBed.inject(HubReconnectService);
    expect(load).not.toHaveBeenCalled();

    hubReconnect.announceReconnected();
    hubReconnect.announceReconnected();

    expect(load).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: a page that has been destroyed no longer reloads.
   * Interacts with: the component's DestroyRef, HubReconnectService.announceReconnected.
   * Data: one announcement after the component is destroyed.
   */
  it('stops when the page is destroyed', () => {
    const fixture = TestBed.createComponent(ReloadingPageComponent);
    fixture.destroy();

    TestBed.inject(HubReconnectService).announceReconnected();

    expect(load).not.toHaveBeenCalled();
  });
});
