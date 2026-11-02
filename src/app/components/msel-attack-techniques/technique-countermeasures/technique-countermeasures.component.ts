// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, OnDestroy, inject, input } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AttackTechniqueCountermeasure, MselCountermeasures, MselTechniqueCountermeasures } from 'src/app/generated/blueprint.api';
import { AttackReleaseQuery } from 'src/app/data/attack-release/attack-release.query';
import { MselAttackTechniqueDataService } from 'src/app/data/msel-attack-technique/msel-attack-technique-data.service';
import { MselAttackTechniqueQuery } from 'src/app/data/msel-attack-technique/msel-attack-technique.query';
import { CountermeasureTacticGroup, groupByTactic } from 'src/app/utilities/countermeasure-tactics';

/** How many countermeasures a tactic shows before "Show all". */
export const TOP_COUNTERMEASURES = 3;

/**
 * The "Countered by" row under a pooled attack technique: the D3FEND techniques MITRE maps against it, grouped by
 * tactic in the matrix's order and ranked by weight, each addable to the MSEL's defensive techniques. Collapsed to
 * a one-line summary until opened.
 */
@Component({
  selector: 'app-technique-countermeasures',
  templateUrl: './technique-countermeasures.component.html',
  styleUrls: ['./technique-countermeasures.component.scss'],
  imports: [MatButton, MatCheckbox, MatIcon, MatTooltip]
})
export class TechniqueCountermeasuresComponent implements OnDestroy {
  private mselAttackTechniqueDataService = inject(MselAttackTechniqueDataService);
  private mselAttackTechniqueQuery = inject(MselAttackTechniqueQuery);
  private attackReleaseQuery = inject(AttackReleaseQuery);

  readonly mselId = input<string>('');
  /** The attack technique's id (T1003.005), for the per-technique empty state. */
  readonly externalId = input<string>('');
  /** The technique's group of the MSEL's countermeasures; undefined while they load or when the MSEL has none. */
  readonly group = input<MselTechniqueCountermeasures>(undefined);
  /** The whole MSEL answer, for the release it came from and whether it has mappings at all. */
  readonly countermeasures = input<MselCountermeasures>(undefined);
  readonly canEdit = input<boolean>(false);
  /** Whether any D3FEND release is imported, to tell "none imported" from "no mappings imported". */
  readonly hasD3fendRelease = input<boolean>(false);

  expanded = false;
  private showAll = new Set<string>();
  private defensivePoolIds = new Set<string>();
  private unsubscribe$ = new Subject();

  constructor() {
    this.mselAttackTechniqueQuery.selectTechniques('defensive').pipe(takeUntil(this.unsubscribe$)).subscribe(techniques => {
      this.defensivePoolIds = new Set(techniques.map(t => t.id));
    });
  }

  get groups(): CountermeasureTacticGroup[] {
    return groupByTactic(this.group()?.countermeasures);
  }

  get count(): number {
    return this.group()?.countermeasures?.length || 0;
  }

  /** The parent technique these were inherited from, when the technique has no mappings of its own. */
  get inheritedFrom(): string {
    return this.group()?.inheritedFrom || '';
  }

  /** Why there is nothing to list, or empty when there is. */
  get emptyMessage(): string {
    const all = this.countermeasures();
    if (!all) {
      return 'Loading countermeasures...';
    }
    if (!all.attackReleaseId) {
      return this.hasD3fendRelease()
        ? 'No ATT&CK mappings have been imported. Import ATT&CK mappings on the Technique Frameworks page.'
        : 'No MITRE D3FEND release has been imported. An administrator imports one on the Technique Frameworks page.';
    }
    if (!all.hasMappings) {
      return `${this.releaseName(all.attackReleaseId)} has no ATT&CK mappings. Import ATT&CK mappings on the Technique Frameworks page.`;
    }
    if (this.count === 0) {
      return `No D3FEND technique is mapped to ${this.externalId()}.`;
    }
    return '';
  }

  /** The countermeasures a tactic shows: its top few, or all of them once asked. */
  visible(group: CountermeasureTacticGroup): AttackTechniqueCountermeasure[] {
    return this.showAll.has(group.tactic) ? group.countermeasures : group.countermeasures.slice(0, TOP_COUNTERMEASURES);
  }

  showsAll(group: CountermeasureTacticGroup): boolean {
    return this.showAll.has(group.tactic);
  }

  toggleAll(group: CountermeasureTacticGroup) {
    if (!this.showAll.delete(group.tactic)) {
      this.showAll.add(group.tactic);
    }
  }

  isPooled(c: AttackTechniqueCountermeasure): boolean {
    return this.defensivePoolIds.has(c.defensiveTechniqueId);
  }

  add(c: AttackTechniqueCountermeasure) {
    if (!this.isPooled(c)) {
      this.mselAttackTechniqueDataService.add(this.mselId(), c.defensiveTechniqueId);
    }
  }

  tooltip(c: AttackTechniqueCountermeasure): string {
    const paths = c.weight === 1 ? '1 artifact path' : `${c.weight} artifact paths`;
    return c.rationale ? `${c.rationale} (${paths})` : paths;
  }

  private releaseName(releaseId: string): string {
    const release = this.attackReleaseQuery.getEntity(releaseId);
    return release ? `${release.name} ${release.version}` : 'The MSEL\'s D3FEND release';
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
