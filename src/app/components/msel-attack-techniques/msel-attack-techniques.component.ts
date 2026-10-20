// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { AfterViewInit, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { Observable, Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  AttackRelease,
  AttackReleaseService,
  AttackTactic,
  AttackTechnique,
  DataField,
  DataFieldType,
  DataValue,
  MselAttackTechnique,
  SystemPermission,
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MselAttackTechniqueDataService } from 'src/app/data/msel-attack-technique/msel-attack-technique-data.service';
import { compareAttackIds, MselAttackTechniqueQuery } from 'src/app/data/msel-attack-technique/msel-attack-technique.query';
import { AttackReleaseDataService } from 'src/app/data/attack-release/attack-release-data.service';
import { AttackReleaseQuery } from 'src/app/data/attack-release/attack-release.query';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { SystemMessageService } from 'src/app/services/system-message/system-message.service';

/**
 * A MSEL's ATT&CK technique pool: the techniques its ATT&CK Technique data fields offer. The pool is
 * pinned to one release; picking another release shows its techniques and offers to upgrade the pool to it.
 */
@Component({
  selector: 'app-msel-attack-techniques',
  templateUrl: './msel-attack-techniques.component.html',
  styleUrls: ['./msel-attack-techniques.component.scss'],
  standalone: false
})
export class MselAttackTechniquesComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() loggedInUserId: string;
  @ViewChild('browserPaginator') browserPaginator: MatPaginator;
  msel = new MselPlus();
  releases: AttackRelease[] = [];
  selectedReleaseId = '';
  pinnedReleaseId = '';
  tactics: AttackTactic[] = [];
  private techniques: AttackTechnique[] = [];
  isLoadingRelease = false;
  addPanelExpanded = false;
  private userChoseRelease = false;
  private panelInitialized = false;

  // --- Panel 1: Add Techniques (browser) ---
  tacticFilter = '';
  searchControl = new UntypedFormControl('');
  searchString = '';
  showSubTechniques = true;
  browserDataSource = new MatTableDataSource<AttackTechnique>([]);
  browserColumns: string[] = ['check', 'externalId', 'name', 'tactics', 'platforms'];

  // --- Panel 2: MSEL Techniques (pool) ---
  pool: MselAttackTechnique[] = [];
  private poolByTechniqueId = new Map<string, MselAttackTechnique>();
  poolDataSource = new MatTableDataSource<MselAttackTechnique>([]);
  poolColumns: string[] = ['action', 'externalId', 'name', 'tactics', 'events'];
  private allDataFields: DataField[] = [];
  private allDataValues: DataValue[] = [];
  private tacticNames = new Map<string, string>();
  private unsubscribe$ = new Subject();

  constructor(
    private mselQuery: MselQuery,
    private mselAttackTechniqueDataService: MselAttackTechniqueDataService,
    private mselAttackTechniqueQuery: MselAttackTechniqueQuery,
    private attackReleaseDataService: AttackReleaseDataService,
    private attackReleaseQuery: AttackReleaseQuery,
    private attackReleaseService: AttackReleaseService,
    private permissionDataService: PermissionDataService,
    private dataFieldQuery: DataFieldQuery,
    private dataValueQuery: DataValueQuery,
    private messageService: SystemMessageService,
    public dialogService: CrucibleDialogService
  ) {
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        const isNewMsel = this.msel.id !== msel.id;
        Object.assign(this.msel, msel);
        if (isNewMsel) {
          this.userChoseRelease = false;
          this.panelInitialized = false;
          this.mselAttackTechniqueDataService.loadByMsel(msel.id);
        }
      }
    });
    this.mselAttackTechniqueQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(pool => {
      this.pool = [...pool].sort((a, b) => compareAttackIds(a.attackTechnique?.externalId, b.attackTechnique?.externalId));
      this.poolByTechniqueId = new Map(pool.map(m => [m.attackTechniqueId, m]));
      this.poolDataSource.data = this.pool;
      this.pinnedReleaseId = pool.find(m => m.attackTechnique)?.attackTechnique.attackReleaseId || '';
      // open Add Techniques once the pool has loaded empty, but never close it while techniques are being added
      if (!this.panelInitialized && !this.mselAttackTechniqueQuery.getValue().loading) {
        this.panelInitialized = true;
        this.addPanelExpanded = pool.length === 0;
      }
      this.chooseDefaultRelease();
    });
    this.attackReleaseQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(releases => {
      this.releases = releases;
      this.chooseDefaultRelease();
    });
    this.dataFieldQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(fields => {
      this.allDataFields = fields;
    });
    this.dataValueQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(values => {
      this.allDataValues = values;
    });
    this.searchControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(term => {
      this.searchString = term || '';
      this.applyBrowserFilter();
    });
    this.browserDataSource.filterPredicate = (t: AttackTechnique, filter: string) => this.matchesBrowserFilter(t, filter);
  }

  ngOnInit() {
    this.permissionDataService.load().pipe(takeUntil(this.unsubscribe$)).subscribe();
    this.attackReleaseDataService.load();
  }

  ngAfterViewInit() {
    this.browserDataSource.paginator = this.browserPaginator;
  }

  canEditMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.ManageMsels) ||
      this.msel.hasRole(this.loggedInUserId, '').owner;
  }

  get selectedRelease(): AttackRelease {
    return this.releases.find(r => r.id === this.selectedReleaseId);
  }

  get pinnedRelease(): AttackRelease {
    return this.releases.find(r => r.id === this.pinnedReleaseId);
  }

  /** The browsed release is not the one the pool is pinned to, so its techniques can't be added yet. */
  get needsUpgrade(): boolean {
    return !!this.pinnedReleaseId && !!this.selectedReleaseId && this.pinnedReleaseId !== this.selectedReleaseId;
  }

  // =============================================
  // Release selection
  // =============================================

  /** Browses the pool's release, or with an empty pool the newest Enterprise release, until the planner picks one. */
  private chooseDefaultRelease() {
    if (this.userChoseRelease && this.releases.some(r => r.id === this.selectedReleaseId)) {
      return;
    }
    const pinned = this.releases.find(r => r.id === this.pinnedReleaseId);
    const newest = [...this.releases]
      .sort((a, b) => (b.releaseDate ? new Date(b.releaseDate).getTime() : 0) - (a.releaseDate ? new Date(a.releaseDate).getTime() : 0))
      .sort((a, b) => (a.domain === 'enterprise-attack' ? 0 : 1) - (b.domain === 'enterprise-attack' ? 0 : 1))[0];
    const release = pinned || newest;
    if (release && release.id !== this.selectedReleaseId) {
      this.loadRelease(release.id);
    }
  }

  onReleaseChange(releaseId: string) {
    this.userChoseRelease = true;
    this.loadRelease(releaseId);
  }

  private loadRelease(releaseId: string) {
    this.selectedReleaseId = releaseId;
    this.tacticFilter = '';
    this.tactics = [];
    this.techniques = [];
    this.browserDataSource.data = [];
    if (!releaseId) {
      return;
    }
    this.isLoadingRelease = true;
    this.attackReleaseService.getAttackTactics(releaseId).pipe(take(1)).subscribe(tactics => {
      if (releaseId !== this.selectedReleaseId) return;
      this.tactics = tactics;
      this.tacticNames = new Map(tactics.map(t => [t.shortName, t.name]));
    });
    this.attackReleaseService.getAttackTechniques(releaseId).pipe(take(1)).subscribe({
      next: techniques => {
        if (releaseId !== this.selectedReleaseId) return;
        this.techniques = [...techniques].sort((a, b) => compareAttackIds(a.externalId, b.externalId));
        this.browserDataSource.data = this.techniques;
        this.isLoadingRelease = false;
        this.applyBrowserFilter();
      },
      error: () => (this.isLoadingRelease = false),
    });
  }

  upgradePool() {
    const from = this.pinnedRelease;
    const to = this.selectedRelease;
    if (!to) return;
    this.dialogService
      .confirm({
        title: 'Upgrade ATT&CK Techniques',
        message: `Move this MSEL's ${this.pool.length} ATT&CK technique${this.pool.length === 1 ? '' : 's'} ` +
          `from ${from ? from.version : 'their release'} to ${to.name} ${to.version}? ` +
          'Techniques are matched by their ATT&CK id. Any the new release no longer has are removed from the pool; ' +
          'scenario events that name them keep the id.'
      })
      .afterClosed()
      .subscribe(result => {
        if (!result) return;
        // after the upgrade the pool is pinned to the browsed release, so stop treating it as the planner's pick
        this.userChoseRelease = false;
        this.mselAttackTechniqueDataService.upgrade(this.msel.id, to.id).subscribe(upgrade => {
          const dropped = upgrade.dropped || [];
          this.messageService.displayMessage(
            'ATT&CK Techniques Upgraded',
            `${upgrade.kept} technique${upgrade.kept === 1 ? '' : 's'} moved to ${to.version}.` +
              (dropped.length > 0
                ? `\n\n${dropped.length} not in ${to.version} and removed: ${dropped.join(', ')}`
                : '')
          );
        });
      });
  }

  // =============================================
  // Browser
  // =============================================

  onTacticChange(tactic: string) {
    this.tacticFilter = tactic;
    this.applyBrowserFilter();
  }

  toggleSubTechniques() {
    this.showSubTechniques = !this.showSubTechniques;
    this.applyBrowserFilter();
  }

  private applyBrowserFilter() {
    // the predicate reads the component's filters; the filter string only has to change to rerun it
    this.browserDataSource.filter = [this.tacticFilter, this.searchString, this.showSubTechniques].join('|') || ' ';
    if (this.browserDataSource.paginator) {
      this.browserDataSource.paginator.firstPage();
    }
  }

  private matchesBrowserFilter(t: AttackTechnique, filter: string): boolean {
    if (!this.showSubTechniques && t.isSubTechnique) return false;
    if (this.tacticFilter && !(t.tactics || []).includes(this.tacticFilter)) return false;
    const s = this.searchString.trim().toLowerCase();
    if (!s) return true;
    return t.externalId?.toLowerCase().includes(s) ||
      t.name?.toLowerCase().includes(s) ||
      t.description?.toLowerCase().includes(s);
  }

  isInPool(technique: AttackTechnique): boolean {
    return this.poolByTechniqueId.has(technique.id);
  }

  togglePoolItem(technique: AttackTechnique) {
    const existing = this.poolByTechniqueId.get(technique.id);
    if (existing) {
      this.removeFromPool(existing);
    } else {
      this.mselAttackTechniqueDataService.add(this.msel.id, technique.id);
    }
  }

  // =============================================
  // Pool
  // =============================================

  removeFromPool(item: MselAttackTechnique) {
    const t = item.attackTechnique;
    const count = this.getEventCount(item);
    const message = count > 0
      ? `${t.externalId} ${t.name} is named by ${count} scenario event${count === 1 ? '' : 's'}. ` +
        'Those events keep the id, but it will no longer be offered. Remove it from this MSEL?'
      : `Remove ${t.externalId} ${t.name} from this MSEL?`;
    this.dialogService
      .confirm({ title: 'Remove ATT&CK Technique', message })
      .afterClosed()
      .subscribe(result => {
        if (result) {
          this.mselAttackTechniqueDataService.delete(item.id);
        }
      });
  }

  getTacticNames(technique: AttackTechnique): string {
    return (technique?.tactics || []).map(t => this.tacticNames.get(t) || t).join(', ');
  }

  /** How many of this MSEL's scenario events name the technique in an ATT&CK Technique field. */
  getEventCount(item: MselAttackTechnique): number {
    const externalId = item.attackTechnique?.externalId;
    if (!externalId) return 0;
    const fieldIds = new Set(
      this.allDataFields
        .filter(df => df.mselId === this.msel.id && df.dataType === DataFieldType.AttackTechnique)
        .map(df => df.id)
    );
    if (fieldIds.size === 0) return 0;
    const events = new Set<string>();
    for (const dv of this.allDataValues) {
      if (fieldIds.has(dv.dataFieldId) && dv.value && dv.scenarioEventId &&
        dv.value.split(',').map(s => s.trim()).includes(externalId)) {
        events.add(dv.scenarioEventId);
      }
    }
    return events.size;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
