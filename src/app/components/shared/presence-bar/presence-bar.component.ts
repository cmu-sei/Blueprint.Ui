// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PresenceActor, SignalRService } from 'src/app/services/signalr.service';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'app-presence-bar',
    templateUrl: './presence-bar.component.html',
    styleUrls: ['./presence-bar.component.scss'],
    imports: [MatIcon],
})
export class PresenceBarComponent implements OnInit, OnDestroy {
  private signalRService = inject(SignalRService);
  private changeDetectorRef = inject(ChangeDetectorRef);

  actors: PresenceActor[] = [];
  private unsubscribe$ = new Subject<null>();

  ngOnInit(): void {
    this.signalRService.actors$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((actors) => {
        this.actors = actors;
        this.changeDetectorRef.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
