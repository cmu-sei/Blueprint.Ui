// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { AfterViewInit, Component, OnDestroy, OnInit, inject, input, output, viewChild } from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';
import { NgStyle } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel, MatInput, MatSuffix, MatHint } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription } from '@angular/material/expansion';
import { MatIconButton, MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatTooltip } from '@angular/material/tooltip';
import { Observable, Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  TechniqueRelease,
  TechniqueReleaseService,
  TechniqueTactic,
  Technique,
  DataField,
  DataFieldType,
  DataValue,
  MselTechnique,
  MselCountermeasures,
  MselTechniqueCountermeasures,
  SystemPermission,
} from 'src/app/generated/blueprint.api';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MselTechniqueDataService } from 'src/app/data/msel-technique/msel-technique-data.service';
import { compareAttackIds, MselTechniqueQuery } from 'src/app/data/msel-technique/msel-technique.query';
import { MselCountermeasureDataService } from 'src/app/data/msel-technique/msel-countermeasure-data.service';
import { TechniqueReleaseDataService } from 'src/app/data/technique-release/technique-release-data.service';
import { TechniqueReleaseQuery } from 'src/app/data/technique-release/technique-release.query';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { SystemMessageService } from 'src/app/services/system-message/system-message.service';
import { TechniqueFamily, techniqueFamily } from 'src/app/utilities/technique-family';
import { TechniqueCountermeasuresComponent } from '../technique-countermeasures/technique-countermeasures.component';

/** Whose content the section has on screen, for the notice MITRE's terms of use ask for. */
export interface TechniqueContentShown {
  mitre: boolean;
  atlas: boolean;
  capec: boolean;
  d3fend: boolean;
}

/**
 * One family of a MSEL's technique pool: the attack techniques (ATT&CK, ATLAS) its Attack Technique data fields
 * offer, or the defensive techniques (D3FEND) its Defensive Technique fields offer. The family is pinned to one
 * release; picking another release shows its techniques and offers to upgrade the family to it. Under each pooled
 * attack technique a "Countered by" row lists the D3FEND techniques MITRE maps against it.
 */
@Component({
  selector: 'app-technique-pool',
  templateUrl: './technique-pool.component.html',
  styleUrls: ['./technique-pool.component.scss'],
  imports: [MatIcon, MatFormField, MatLabel, MatHint, MatSelect, MatOption, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatInput, ReactiveFormsModule, MatIconButton, MatSuffix, MatPaginator, MatProgressSpinner, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCheckbox, MatCellDef, MatCell, MatTooltip, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, MatButton, NgStyle, TechniqueCountermeasuresComponent]
})
export class TechniquePoolComponent implements OnInit, AfterViewInit, OnDestroy {
  private mselQuery = inject(MselQuery);
  private mselTechniqueDataService = inject(MselTechniqueDataService);
  private mselTechniqueQuery = inject(MselTechniqueQuery);
  private mselCountermeasureDataService = inject(MselCountermeasureDataService);
  private techniqueReleaseDataService = inject(TechniqueReleaseDataService);
  private techniqueReleaseQuery = inject(TechniqueReleaseQuery);
  private techniqueReleaseService = inject(TechniqueReleaseService);
  private permissionDataService = inject(PermissionDataService);
  private dataFieldQuery = inject(DataFieldQuery);
  private dataValueQuery = inject(DataValueQuery);
  private messageService = inject(SystemMessageService);
  dialogService = inject(CrucibleDialogService);

  readonly family = input<TechniqueFamily>('attack');
  readonly loggedInUserId = input<string>(undefined);
  readonly contentShown = output<TechniqueContentShown>();
  readonly browserPaginator = viewChild<MatPaginator>('browserPaginator');
  msel = new MselPlus();
  releases: TechniqueRelease[] = [];
  private allReleases: TechniqueRelease[] = [];
  selectedReleaseId = '';
  pinnedReleaseId = '';
  tactics: TechniqueTactic[] = [];
  private techniques: Technique[] = [];
  isLoadingRelease = false;
  addPanelExpanded = false;
  private userChoseRelease = false;
  private panelInitialized = false;

  // --- Panel 1: Add Techniques (browser) ---
  tacticFilter = '';
  searchControl = new UntypedFormControl('');
  searchString = '';
  showSubTechniques = true;
  browserDataSource = new MatTableDataSource<Technique>([]);
  /**
   * D3FEND techniques have no platforms, so the defensive table does without the column. A CAPEC release adds the
   * weaknesses its patterns exploit and its links to OWASP and WASC.
   */
  get browserColumns(): string[] {
    if (this.isDefensive) {
      return ['check', 'externalId', 'name', 'tactics'];
    }
    return this.browsesCapec
      ? ['check', 'externalId', 'name', 'tactics', 'platforms', 'weaknesses', 'seeAlso']
      : ['check', 'externalId', 'name', 'tactics', 'platforms'];
  }

  // --- Panel 2: MSEL Techniques (pool) ---
  pool: MselTechnique[] = [];
  private poolByTechniqueId = new Map<string, MselTechnique>();
  poolDataSource = new MatTableDataSource<MselTechnique>([]);
  poolColumns: string[] = ['action', 'externalId', 'name', 'tactics', 'events'];
  private allDataFields: DataField[] = [];
  private allDataValues: DataValue[] = [];
  private tacticNames = new Map<string, string>();
  // the Countered by rows of the attack family
  countermeasures: MselCountermeasures;
  private countermeasuresByTechniqueId = new Map<string, MselTechniqueCountermeasures>();
  /** The attack family's pool table has a Countered by row under each technique; the defensive family's does not. */
  readonly showsCountermeasures = () => !this.isDefensive;
  private unsubscribe$ = new Subject();

  constructor() {
    this.searchControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(term => {
      this.searchString = term || '';
      this.applyBrowserFilter();
    });
    this.browserDataSource.filterPredicate = (t: Technique, filter: string) => this.matchesBrowserFilter(t, filter);
  }

  // the subscriptions wait for ngOnInit, which is when the family input is known
  ngOnInit() {
    // the Techniques tab loads the MSEL's pool once for both families; this section only reads its own half
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel) {
        const isNewMsel = this.msel.id !== msel.id;
        Object.assign(this.msel, msel);
        if (isNewMsel) {
          this.userChoseRelease = false;
          this.panelInitialized = false;
        }
        if (!this.isDefensive) {
          this.mselCountermeasureDataService.ensureLoaded(msel.id);
        }
      }
    });
    if (!this.isDefensive) {
      this.mselCountermeasureDataService.countermeasures$.pipe(takeUntil(this.unsubscribe$)).subscribe(countermeasures => {
        this.countermeasures = countermeasures;
        this.countermeasuresByTechniqueId = new Map((countermeasures?.techniques || []).map(t => [t.techniqueId, t]));
      });
    }
    this.mselTechniqueQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(wholePool => {
      const pool = wholePool.filter(m => techniqueFamily(m.technique) === this.family());
      this.pool = [...pool].sort((a, b) => compareAttackIds(a.technique?.externalId, b.technique?.externalId));
      this.poolByTechniqueId = new Map(pool.map(m => [m.techniqueId, m]));
      this.poolDataSource.data = this.pool;
      this.pinnedReleaseId = pool.find(m => m.technique)?.technique.techniqueReleaseId || '';
      // open Add Techniques once the pool has loaded empty, but never close it while techniques are being added
      if (!this.panelInitialized && !this.mselTechniqueQuery.getValue().loading) {
        this.panelInitialized = true;
        this.addPanelExpanded = pool.length === 0;
      }
      this.chooseDefaultRelease();
      this.emitContentShown();
    });
    this.techniqueReleaseQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(releases => {
      this.allReleases = releases;
      this.releases = releases.filter(r => techniqueFamily(r) === this.family());
      this.chooseDefaultRelease();
    });
    this.dataFieldQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(fields => {
      this.allDataFields = fields;
    });
    this.dataValueQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(values => {
      this.allDataValues = values;
    });
    this.permissionDataService.load().pipe(takeUntil(this.unsubscribe$)).subscribe();
    this.techniqueReleaseDataService.load();
  }

  ngAfterViewInit() {
    this.browserDataSource.paginator = this.browserPaginator();
  }

  get isDefensive(): boolean {
    return this.family() === 'defensive';
  }

  get title(): string {
    return this.isDefensive ? 'Defensive Techniques' : 'Attack Techniques';
  }

  /** The data field type whose cells pick from this family, as the Data Fields tab names it. */
  get fieldTypeName(): string {
    return this.isDefensive ? 'Defensive Technique' : 'Attack Technique';
  }

  get icon(): string {
    return this.isDefensive ? 'mdi-shield-check-outline' : 'mdi-shield-bug-outline';
  }

  canEditMsel(): boolean {
    return this.permissionDataService.hasPermission(SystemPermission.ManageMsels) ||
      this.msel.hasRole(this.loggedInUserId(), '').owner;
  }

  get selectedRelease(): TechniqueRelease {
    return this.releases.find(r => r.id === this.selectedReleaseId);
  }

  get pinnedRelease(): TechniqueRelease {
    return this.releases.find(r => r.id === this.pinnedReleaseId);
  }

  /** The browsed release is not the one the family is pinned to, so its techniques can't be added yet. */
  get needsUpgrade(): boolean {
    return !!this.pinnedReleaseId && !!this.selectedReleaseId && this.pinnedReleaseId !== this.selectedReleaseId;
  }

  /** Either table shows MITRE's technique content, which its terms of use say must carry their notice. */
  get showsMitreContent(): boolean {
    return this.pool.length > 0 || this.techniques.length > 0;
  }

  /** Either table shows techniques of the given domain, whose mark (ATLAS, D3FEND) MITRE asks to be named. */
  showsDomain(domain: string): boolean {
    return this.pool.some(m => m.technique?.domain === domain) ||
      (this.techniques.length > 0 && this.selectedRelease?.domain === domain);
  }

  private emitContentShown() {
    this.contentShown.emit({
      mitre: this.showsMitreContent,
      atlas: this.showsDomain('ATLAS'),
      capec: this.showsDomain('capec'),
      d3fend: this.showsDomain('d3fend'),
    });
  }

  // =============================================
  // Release selection
  // =============================================

  /** Browses the family's pinned release, or with an empty pool the newest (Enterprise first), until the planner picks one. */
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
    this.emitContentShown();
    if (!releaseId) {
      return;
    }
    this.isLoadingRelease = true;
    this.techniqueReleaseService.getTechniqueTactics(releaseId).pipe(take(1)).subscribe(tactics => {
      if (releaseId !== this.selectedReleaseId) return;
      this.tactics = tactics;
      this.tacticNames = new Map(tactics.map(t => [t.shortName, t.name]));
    });
    this.techniqueReleaseService.getTechniques(releaseId).pipe(take(1)).subscribe({
      next: techniques => {
        if (releaseId !== this.selectedReleaseId) return;
        this.techniques = [...techniques].sort((a, b) => compareAttackIds(a.externalId, b.externalId));
        this.browserDataSource.data = this.techniques;
        this.isLoadingRelease = false;
        this.applyBrowserFilter();
        this.emitContentShown();
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
        title: 'Upgrade Techniques',
        message: `Move this MSEL's ${this.pool.length} ${this.isDefensive ? 'defensive' : 'attack'} technique${this.pool.length === 1 ? '' : 's'} ` +
          `from ${from ? from.version : 'their release'} to ${to.name} ${to.version}? ` +
          'Techniques are matched by their id. Any the new release no longer has are removed from the pool; ' +
          'scenario events that name them keep the id.'
      })
      .afterClosed()
      .subscribe(result => {
        if (!result) return;
        // after the upgrade the family is pinned to the browsed release, so stop treating it as the planner's pick
        this.userChoseRelease = false;
        this.mselTechniqueDataService.upgrade(this.msel.id, to.id).subscribe(upgrade => {
          const dropped = upgrade.dropped || [];
          this.messageService.displayMessage(
            'Techniques Upgraded',
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

  private matchesBrowserFilter(t: Technique, filter: string): boolean {
    if (!this.showSubTechniques && t.isSubTechnique) return false;
    if (this.tacticFilter && !(t.tactics || []).includes(this.tacticFilter)) return false;
    const s = this.searchString.trim().toLowerCase();
    if (!s) return true;
    return t.externalId?.toLowerCase().includes(s) ||
      t.name?.toLowerCase().includes(s) ||
      t.description?.toLowerCase().includes(s) ||
      (t.weaknesses || []).some(w => w.toLowerCase().includes(s));
  }

  isInPool(technique: Technique): boolean {
    return this.poolByTechniqueId.has(technique.id);
  }

  togglePoolItem(technique: Technique) {
    const existing = this.poolByTechniqueId.get(technique.id);
    if (existing) {
      this.removeFromPool(existing);
    } else {
      this.mselTechniqueDataService.add(this.msel.id, technique.id);
    }
  }

  // =============================================
  // Pool
  // =============================================

  removeFromPool(item: MselTechnique) {
    const t = item.technique;
    const count = this.getEventCount(item);
    const message = count > 0
      ? `${t.externalId} ${t.name} is named by ${count} scenario event${count === 1 ? '' : 's'}. ` +
        'Those events keep the id, but it will no longer be offered. Remove it from this MSEL?'
      : `Remove ${t.externalId} ${t.name} from this MSEL?`;
    this.dialogService
      .confirm({ title: 'Remove Technique', message })
      .afterClosed()
      .subscribe(result => {
        if (result) {
          this.mselTechniqueDataService.delete(item.id);
        }
      });
  }

  /** Whether any defensive release is imported, which tells the Countered by row's empty states apart. */
  get hasDefensiveRelease(): boolean {
    return this.allReleases.some(r => techniqueFamily(r) === 'defensive');
  }

  countermeasuresFor(item: MselTechnique): MselTechniqueCountermeasures {
    return this.countermeasuresByTechniqueId.get(item.techniqueId);
  }

  /** D3FEND tactics have no id of their own (the class id stands in), so only ATT&CK's are worth showing. */
  tacticLabel(tactic: TechniqueTactic): string {
    return this.isDefensive ? tactic.name : `${tactic.externalId} ${tactic.name}`;
  }

  /** The browsed release is CAPEC, whose groups are its Meta patterns, not tactics, and whose techniques cite weaknesses. */
  get browsesCapec(): boolean {
    return this.selectedRelease?.domain === 'capec';
  }

  /** CAPEC groups its patterns under categories where ATT&CK has tactics; the pinned release names the pool's. */
  get groupLabel(): string {
    return this.browsesCapec ? 'Category' : 'Tactic';
  }

  get poolGroupsLabel(): string {
    return (this.pinnedRelease ?? this.selectedRelease)?.domain === 'capec' ? 'Categories' : 'Tactics';
  }

  /** CAPEC names the domains of attack (Software, Hardware) where ATT&CK names platforms. */
  get platformsLabel(): string {
    return this.browsesCapec ? 'Domains' : 'Platforms';
  }

  /** The page MITRE's CWE list keeps for a weakness such as CWE-89. */
  weaknessUrl(weakness: string): string {
    return `https://cwe.mitre.org/data/definitions/${(weakness || '').replace(/^CWE-/i, '')}.html`;
  }

  getTacticNames(technique: Technique): string {
    return (technique?.tactics || []).map(t => this.tacticNames.get(t) || t).join(', ');
  }

  /** The site a technique's link opens (attack.mitre.org, atlas.mitre.org, d3fend.mitre.org), for its link title. */
  linkHost(technique: Technique): string {
    const url = technique?.url || '';
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  /** How many of this MSEL's scenario events name the technique in a field of this family's type. */
  getEventCount(item: MselTechnique): number {
    const externalId = item.technique?.externalId;
    if (!externalId) return 0;
    const fieldType = this.isDefensive ? DataFieldType.DefensiveTechnique : DataFieldType.AttackTechnique;
    const fieldIds = new Set(
      this.allDataFields
        .filter(df => df.mselId === this.msel.id && df.dataType === fieldType)
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
