// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, inject, input } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MselAttackTechniqueDataService } from 'src/app/data/msel-attack-technique/msel-attack-technique-data.service';
import { TechniqueContentShown, TechniquePoolComponent } from './technique-pool/technique-pool.component';

/**
 * A MSEL's Techniques tab: its attack techniques (ATT&CK, ATLAS) and its defensive techniques (D3FEND), each a
 * pool of its own pinned to its own release, with one MITRE notice under both.
 */
@Component({
  selector: 'app-msel-attack-techniques',
  templateUrl: './msel-attack-techniques.component.html',
  styleUrls: ['./msel-attack-techniques.component.scss'],
  imports: [TechniquePoolComponent]
})
export class MselAttackTechniquesComponent implements OnDestroy {
  private mselQuery = inject(MselQuery);
  private mselAttackTechniqueDataService = inject(MselAttackTechniqueDataService);

  readonly loggedInUserId = input<string>(undefined);
  private mselId = '';
  shown: Record<'attack' | 'defensive', TechniqueContentShown> = {
    attack: { mitre: false, atlas: false, d3fend: false },
    defensive: { mitre: false, atlas: false, d3fend: false },
  };
  private unsubscribe$ = new Subject();

  constructor() {
    // the pool holds both families, so it is loaded once here rather than by each section
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && msel.id !== this.mselId) {
        this.mselId = msel.id;
        this.mselAttackTechniqueDataService.loadByMsel(msel.id);
      }
    });
  }

  /** Either section shows MITRE's technique content, which its terms of use say must carry their notice. */
  get showsMitreContent(): boolean {
    return this.shown.attack.mitre || this.shown.defensive.mitre;
  }

  /** Techniques of an ATLAS release are on screen, which carry MITRE's separate ATLAS mark. */
  get showsAtlasContent(): boolean {
    return this.shown.attack.atlas || this.shown.defensive.atlas;
  }

  /** Techniques of a D3FEND release are on screen, which carry MITRE's D3FEND mark and its own terms of use. */
  get showsD3fendContent(): boolean {
    return this.shown.attack.d3fend || this.shown.defensive.d3fend;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
