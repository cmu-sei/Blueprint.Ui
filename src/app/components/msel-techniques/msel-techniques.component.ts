// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, inject, input } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MselTechniqueDataService } from 'src/app/data/msel-technique/msel-technique-data.service';
import { TechniquePoolComponent } from './technique-pool/technique-pool.component';

/**
 * A MSEL's Techniques tab: its attack techniques (ATT&CK, ATLAS, CAPEC) and its defensive techniques (D3FEND), each a
 * pool of its own with every domain pinned to its own release, each release's own notice shown under its pinned row.
 */
@Component({
  selector: 'app-msel-techniques',
  templateUrl: './msel-techniques.component.html',
  styleUrls: ['./msel-techniques.component.scss'],
  imports: [TechniquePoolComponent]
})
export class MselTechniquesComponent implements OnDestroy {
  private mselQuery = inject(MselQuery);
  private mselTechniqueDataService = inject(MselTechniqueDataService);

  readonly loggedInUserId = input<string>(undefined);
  private mselId = '';
  private unsubscribe$ = new Subject();

  constructor() {
    // the pool holds both families, so it is loaded once here rather than by each section
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && msel.id !== this.mselId) {
        this.mselId = msel.id;
        this.mselTechniqueDataService.loadByMsel(msel.id);
      }
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
