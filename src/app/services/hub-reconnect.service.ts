// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject } from 'rxjs';

/**
 * Tells pages when the hub connection has been replaced by a new one, so that anything broadcast in
 * between was missed and what they show may be out of date.
 *
 * SignalR's automatic reconnect opens a new connection, which the server treats as a new client: it
 * replays nothing sent while the old one was down. Stateful reconnect replays what was missed after a
 * short network drop, but only on the same connection; it gives up once the server's reconnect window
 * closes, its replay buffer fills, or the server restarts, and then the client reconnects as new.
 * The same goes for the restart SignalRService makes when the signed-in user's token changes. A
 * stateful resume that succeeds does not emit here, because nothing was missed.
 *
 * Kept apart from SignalRService so that a page can listen without depending on the hub.
 */
@Injectable({
  providedIn: 'root',
})
export class HubReconnectService {
  private readonly reconnectedSubject = new Subject<void>();

  /** Emits once a new connection has rejoined its groups. */
  readonly reconnected$: Observable<void> = this.reconnectedSubject.asObservable();

  /** Called by SignalRService once a replacement connection has rejoined its groups. */
  announceReconnected() {
    this.reconnectedSubject.next();
  }
}

/**
 * Calls `load` each time the hub connection is replaced, for as long as the calling component lives.
 * Call it from a constructor or field initializer, next to the load it repeats, so the page reloads
 * what it shows with the same queries it first used.
 */
export function reloadOnReconnect(load: () => void): void {
  inject(HubReconnectService)
    .reconnected$.pipe(takeUntilDestroyed())
    .subscribe(() => load());
}
