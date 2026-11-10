// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, OnDestroy } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, take, tap } from 'rxjs/operators';
import { Msel, MselImageService } from 'src/app/generated/blueprint.api';
import { MselDataService } from './msel-data.service';

// The image endpoint needs the bearer token, so an <img src> can't load it.
// The image is fetched through the API client and shown from an object URL,
// kept per MSEL and per ImageDateModified, so a new upload gets a new URL.
@Injectable({
  providedIn: 'root',
})
export class MselImageDataService implements OnDestroy {
  private urls = new Map<string, { key: string; url$: Observable<string | null>; url?: string }>();

  constructor(
    private mselImageService: MselImageService,
    private mselDataService: MselDataService
  ) {}

  imageUrl(msel: Msel): Observable<string | null> {
    if (!msel?.imageDateModified) {
      return of(null);
    }
    const key = new Date(msel.imageDateModified).toISOString();
    const cached = this.urls.get(msel.id);
    if (cached?.key === key) {
      return cached.url$;
    }
    this.revoke(msel.id);
    const entry: { key: string; url$: Observable<string | null>; url?: string } = { key, url$: null };
    entry.url$ = this.mselImageService.getMselImage(msel.id).pipe(
      map((blob: Blob) => (entry.url = URL.createObjectURL(blob))),
      // A missing or unreadable image leaves the card on its generated pattern.
      catchError(() => of(null)),
      shareReplay(1)
    );
    this.urls.set(msel.id, entry);
    return entry.url$;
  }

  setImage(mselId: string, file: File): Observable<Msel> {
    return this.mselImageService.setMselImage(mselId, file).pipe(
      take(1),
      tap((msel) => this.updateStore(msel))
    );
  }

  deleteImage(mselId: string): Observable<Msel> {
    return this.mselImageService.deleteMselImage(mselId).pipe(
      take(1),
      tap((msel: Msel) => {
        this.revoke(mselId);
        this.updateStore(msel);
      })
    );
  }

  ngOnDestroy() {
    [...this.urls.keys()].forEach((id) => this.revoke(id));
  }

  // Only the image marker changes, so the rest of the stored MSEL, such as
  // its roles, is left as it is.
  private updateStore(msel: Msel) {
    this.mselDataService.updateImageDateModified(msel.id, msel.imageDateModified ?? null);
  }

  private revoke(mselId: string) {
    const cached = this.urls.get(mselId);
    if (cached?.url) {
      URL.revokeObjectURL(cached.url);
    }
    this.urls.delete(mselId);
  }
}
