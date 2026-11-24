// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

// This file deliberately uses nothing from Blueprint's state, so that it can move to a shared
// library unchanged: the signed-in user is passed in, not looked up.
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** A user present in a scope, as the hub sends them. */
export interface PresentUser {
  id: string;
  name: string;
}

/** Everyone present in a scope as of a version, as the hub sends it. Versions only increase. */
export interface PresenceState {
  mselId: string;
  version: number;
  users: PresentUser[];
}

/** A present user, with the colour their chip is drawn in. */
export interface PresenceActor {
  id: string;
  name: string;
  online: boolean;
  color: string;
}

const COLORS = ['primary', 'accent', 'green', 'orange', 'purple'];

/**
 * The other users present on the open MSEL. The hub sends the whole list each time it changes, with a
 * version, and answers selecting a MSEL with the current one. SignalR can deliver those in any order, so
 * a list is applied only when it is for the open MSEL and newer than the last one applied. The list holds
 * each user once and never the signed-in user, and a user keeps their colour while they stay.
 */
@Injectable({ providedIn: 'root' })
export class PresenceStore {
  private actorsSubject = new BehaviorSubject<PresenceActor[]>([]);
  readonly actors$ = this.actorsSubject.asObservable();

  private version = -1;
  private colors = new Map<string, string>();
  private users: PresentUser[] = [];
  private me = '';

  /** Shows `state`, unless it is for another MSEL than `openMselId` or no newer than what is shown. */
  apply(state: PresenceState, openMselId: string, myUserId: string) {
    // An older API answers with nothing.
    if (!state) {
      return;
    }

    if (state.mselId !== openMselId || state.version <= this.version) {
      return;
    }

    this.version = state.version;
    this.users = state.users ?? [];
    this.me = myUserId;
    this.publish();
  }

  /** Changes who the signed-in user is, which can become known after the first state arrives. */
  setMyUserId(myUserId: string) {
    if (myUserId !== this.me) {
      this.me = myUserId;
      this.publish();
    }
  }

  clear() {
    this.version = -1;
    this.users = [];
    this.colors.clear();

    if (this.actorsSubject.getValue().length > 0) {
      this.actorsSubject.next([]);
    }
  }

  private publish() {
    const others = this.users.filter(
      (user, index, all) =>
        user.id !== this.me && all.findIndex((x) => x.id === user.id) === index,
    );
    const present = new Set(others.map((x) => x.id));

    for (const id of this.colors.keys()) {
      if (!present.has(id)) {
        this.colors.delete(id);
      }
    }

    if (others.length === 0 && this.actorsSubject.getValue().length === 0) {
      return;
    }

    this.actorsSubject.next(
      others.map((user) => ({
        id: user.id,
        name: user.name,
        online: true,
        color: this.colorFor(user.id),
      })),
    );
  }

  private colorFor(id: string): string {
    let color = this.colors.get(id);

    if (!color) {
      const used = new Set(this.colors.values());
      color =
        COLORS.find((x) => !used.has(x)) ??
        COLORS[this.colors.size % COLORS.length];
      this.colors.set(id, color);
    }

    return color;
  }
}
