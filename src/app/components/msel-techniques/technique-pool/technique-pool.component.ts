// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { TechniqueNoticeComponent } from '../../technique-notice/technique-notice.component';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import {
  MatTableDataSource,
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow,
} from '@angular/material/table';
import { NgStyle } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import {
  MatFormField,
  MatLabel,
  MatInput,
  MatSuffix,
  MatHint,
} from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/autocomplete';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
  MatExpansionPanelDescription,
} from '@angular/material/expansion';
import { MatIconButton, MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  TechniqueDetailDialogComponent,
  TechniqueDetailDialogData,
} from '../technique-detail-dialog/technique-detail-dialog.component';
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
import {
  compareAttackIds,
  MselTechniqueQuery,
} from 'src/app/data/msel-technique/msel-technique.query';
import { MselCountermeasureDataService } from 'src/app/data/msel-technique/msel-countermeasure-data.service';
import { TechniqueReleaseDataService } from 'src/app/data/technique-release/technique-release-data.service';
import { TechniqueReleaseQuery } from 'src/app/data/technique-release/technique-release.query';
import { DataFieldQuery } from 'src/app/data/data-field/data-field.query';
import { DataValueQuery } from 'src/app/data/data-value/data-value.query';
import { SystemMessageService } from 'src/app/services/system-message/system-message.service';
import {
  TechniqueFamily,
  techniqueFamily,
} from 'src/app/utilities/technique-family';
import {
  compareReleases,
  groupLabel,
  weaknessLink,
} from 'src/app/utilities/technique-notices';
import { TechniqueCountermeasuresComponent } from '../technique-countermeasures/technique-countermeasures.component';

/** One domain a MSEL's pool holds techniques of, and the release it is pinned to. */
export interface PinnedDomain {
  domain: string;
  release: TechniqueRelease;
  count: number;
  /** The browsed release is another release of this domain. */
  upgradeTo: TechniqueRelease | null;
}

/**
 * One family (attack or defensive) of a MSEL's technique pool. Each domain in the pool is pinned to one release;
 * picking another release of a domain offers to upgrade it. Each pooled attack technique has a row of the mappings
 * imported onto a defensive release.
 */
@Component({
  selector: 'app-technique-pool',
  templateUrl: './technique-pool.component.html',
  styleUrls: ['./technique-pool.component.scss'],
  imports: [
    TechniqueNoticeComponent,
    MatIcon,
    MatFormField,
    MatLabel,
    MatHint,
    MatSelect,
    MatOption,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatExpansionPanelDescription,
    MatInput,
    ReactiveFormsModule,
    MatIconButton,
    MatSuffix,
    MatPaginator,
    MatProgressSpinner,
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCheckbox,
    MatCellDef,
    MatCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatButton,
    NgStyle,
    TechniqueCountermeasuresComponent,
  ],
})
export class TechniquePoolComponent
  implements OnInit, AfterViewInit, OnDestroy
{
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
  private dialog = inject(MatDialog);

  readonly family = input<TechniqueFamily>('attack');
  readonly loggedInUserId = input<string>(undefined);
  /** The releases whose content the section shows, for their notices. */
  readonly browserPaginator = viewChild<MatPaginator>('browserPaginator');
  msel = new MselPlus();
  releases: TechniqueRelease[] = [];
  private allReleases: TechniqueRelease[] = [];
  selectedReleaseId = '';
  /** The release each of the pool's domains is pinned to, by domain. */
  private pinnedByDomain = new Map<string, string>();
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
   * The defensive table has no platforms column. A release whose techniques cite weaknesses adds them and their
   * links.
   */
  get browserColumns(): string[] {
    if (this.isDefensive) {
      return ['check', 'externalId', 'name', 'tactics'];
    }
    return this.browsesWeaknesses
      ? [
          'check',
          'externalId',
          'name',
          'tactics',
          'platforms',
          'weaknesses',
          'seeAlso',
        ]
      : ['check', 'externalId', 'name', 'tactics', 'platforms'];
  }

  // --- Panel 2: MSEL Techniques (pool) ---
  pool: MselTechnique[] = [];
  private poolByTechniqueId = new Map<string, MselTechnique>();
  poolDataSource = new MatTableDataSource<MselTechnique>([]);
  poolColumns: string[] = ['action', 'externalId', 'name', 'tactics', 'events'];
  private allDataFields: DataField[] = [];
  private allDataValues: DataValue[] = [];
  /** Each release's group names by short name, for the browser and for every release in the pool. */
  private tacticNamesByRelease = new Map<string, Map<string, string>>();
  // the mapping rows of the attack family
  countermeasures: MselCountermeasures;
  private countermeasuresByTechniqueId = new Map<
    string,
    MselTechniqueCountermeasures
  >();
  /** The attack family's pool table has a mappings row under each technique; the defensive family's does not. */
  readonly showsCountermeasures = () => !this.isDefensive;
  private unsubscribe$ = new Subject();

  constructor() {
    this.searchControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.searchString = term || '';
        this.applyBrowserFilter();
      });
    this.browserDataSource.filterPredicate = (t: Technique, filter: string) =>
      this.matchesBrowserFilter(t, filter);
  }

  // subscribed in ngOnInit, when the family input is known
  ngOnInit() {
    // the tab loads the pool; this section reads its half
    (this.mselQuery.selectActive() as Observable<MselPlus>)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((msel) => {
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
      this.mselCountermeasureDataService.countermeasures$
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe((countermeasures) => {
          this.countermeasures = countermeasures;
          this.countermeasuresByTechniqueId = new Map(
            (countermeasures?.techniques || []).map((t) => [t.techniqueId, t]),
          );
        });
    }
    this.mselTechniqueQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((wholePool) => {
        const pool = wholePool.filter(
          (m) => techniqueFamily(m.technique) === this.family(),
        );
        this.pool = [...pool].sort((a, b) =>
          compareAttackIds(a.technique?.externalId, b.technique?.externalId),
        );
        this.poolByTechniqueId = new Map(pool.map((m) => [m.techniqueId, m]));
        this.poolDataSource.data = this.pool;
        new Set(pool.map((m) => m.technique?.techniqueReleaseId)).forEach(
          (id) => this.loadTacticNames(id),
        );
        this.pinnedByDomain = new Map();
        for (const m of pool) {
          if (
            m.technique?.domain &&
            !this.pinnedByDomain.has(m.technique.domain)
          ) {
            this.pinnedByDomain.set(
              m.technique.domain,
              m.technique.techniqueReleaseId,
            );
          }
        }
        // open Add Techniques once the pool loads empty, but never close it while adding
        if (
          !this.panelInitialized &&
          !this.mselTechniqueQuery.getValue().loading
        ) {
          this.panelInitialized = true;
          this.addPanelExpanded = pool.length === 0;
        }
        this.chooseDefaultRelease();
      });
    this.techniqueReleaseQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((releases) => {
        this.allReleases = releases;
        this.releases = releases.filter(
          (r) => techniqueFamily(r) === this.family(),
        );
        this.chooseDefaultRelease();
      });
    this.dataFieldQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((fields) => {
        this.allDataFields = fields;
      });
    this.dataValueQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((values) => {
        this.allDataValues = values;
      });
    this.permissionDataService
      .load()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe();
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
    return this.isDefensive
      ? 'mdi-shield-check-outline'
      : 'mdi-shield-bug-outline';
  }

  canEditMsel(): boolean {
    return (
      this.permissionDataService.hasPermission(SystemPermission.ManageMsels) ||
      this.msel.hasRole(this.loggedInUserId(), '').owner
    );
  }

  get selectedRelease(): TechniqueRelease {
    return this.releases.find((r) => r.id === this.selectedReleaseId);
  }

  /** The release the browsed release's domain is pinned to, if the pool holds techniques of that domain. */
  get pinnedRelease(): TechniqueRelease {
    return this.pinnedReleaseOfDomain(this.selectedRelease?.domain);
  }

  private pinnedReleaseOfDomain(domain: string): TechniqueRelease {
    const id = this.pinnedByDomain.get(domain);
    return id ? this.releases.find((r) => r.id === id) : undefined;
  }

  /** Whether a release is the one its domain is pinned to in this MSEL. */
  isPinned(release: TechniqueRelease): boolean {
    return this.pinnedByDomain.get(release.domain) === release.id;
  }

  /** The browsed release is another release of a domain the pool holds, so its techniques can't be added yet. */
  get needsUpgrade(): boolean {
    const pinnedId = this.pinnedByDomain.get(this.selectedRelease?.domain);
    return !!pinnedId && pinnedId !== this.selectedReleaseId;
  }

  /** One row per domain in the pool: its pinned release, technique count and upgrade. */
  get pinnedDomains(): PinnedDomain[] {
    const counts = new Map<string, number>();
    for (const m of this.pool) {
      counts.set(
        m.technique?.domain,
        (counts.get(m.technique?.domain) || 0) + 1,
      );
    }
    return [...this.pinnedByDomain.entries()]
      .map(([domain, releaseId]) => {
        const release = this.releases.find((r) => r.id === releaseId);
        const selected = this.selectedRelease;
        return {
          domain,
          release,
          count: counts.get(domain) || 0,
          upgradeTo:
            selected && selected.domain === domain && selected.id !== releaseId
              ? selected
              : null,
        };
      })
      .filter((p) => !!p.release)
      .sort((a, b) => a.domain.localeCompare(b.domain));
  }

  /** The pool holds several domains, so an id alone doesn't say which release a technique is from. */
  get showsDomainLabels(): boolean {
    return this.pinnedByDomain.size > 1;
  }

  /** The browsed release when the pool is not pinned to it, whose notice shows with its techniques. */
  get browsedUnpinnedRelease(): TechniqueRelease | null {
    const browsed = this.selectedRelease;
    return browsed && this.techniques.length > 0 && !this.isPinned(browsed)
      ? browsed
      : null;
  }

  // =============================================
  // Release selection
  // =============================================

  /** Browses a pinned release, or with an empty pool the newest one, until the planner picks one. */
  private chooseDefaultRelease() {
    if (
      this.userChoseRelease &&
      this.releases.some((r) => r.id === this.selectedReleaseId)
    ) {
      return;
    }
    const sorted = [...this.releases].sort(compareReleases);
    const pinned = sorted.find((r) => this.isPinned(r));
    const release = pinned || sorted[0];
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
    this.techniqueReleaseService
      .getTechniqueTactics(releaseId)
      .pipe(take(1))
      .subscribe((tactics) => {
        if (releaseId !== this.selectedReleaseId) return;
        this.tactics = tactics;
        this.tacticNamesByRelease.set(
          releaseId,
          new Map(tactics.map((t) => [t.shortName, t.name])),
        );
      });
    this.techniqueReleaseService
      .getTechniques(releaseId)
      .pipe(take(1))
      .subscribe({
        next: (techniques) => {
          if (releaseId !== this.selectedReleaseId) return;
          this.techniques = [...techniques].sort((a, b) =>
            compareAttackIds(a.externalId, b.externalId),
          );
          this.browserDataSource.data = this.techniques;
          this.isLoadingRelease = false;
          this.applyBrowserFilter();
        },
        error: () => (this.isLoadingRelease = false),
      });
  }

  /** Moves one domain of the pool to the browsed release. */
  upgradePool(domain: PinnedDomain) {
    const from = domain.release;
    const to = domain.upgradeTo;
    if (!to) return;
    this.dialogService
      .confirm({
        title: 'Upgrade Techniques',
        message:
          `Move this MSEL's ${domain.count} ${domain.domain} technique${domain.count === 1 ? '' : 's'} ` +
          `from ${from ? from.version : 'their release'} to ${to.name} ${to.version}? ` +
          'Techniques are matched by their id. Any the new release no longer has are removed from the pool; ' +
          'scenario events that name them keep the id.',
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        // the domain is now pinned to the browsed release, so it is no longer a pick
        this.userChoseRelease = false;
        this.mselTechniqueDataService
          .upgrade(this.msel.id, to.id)
          .subscribe((upgrade) => {
            const dropped = upgrade.dropped || [];
            this.messageService.displayMessage(
              'Techniques Upgraded',
              `${upgrade.kept} technique${upgrade.kept === 1 ? '' : 's'} moved to ${to.version}.` +
                (dropped.length > 0
                  ? `\n\n${dropped.length} not in ${to.version} and removed: ${dropped.join(', ')}`
                  : ''),
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
    this.browserDataSource.filter =
      [this.tacticFilter, this.searchString, this.showSubTechniques].join(
        '|',
      ) || ' ';
    if (this.browserDataSource.paginator) {
      this.browserDataSource.paginator.firstPage();
    }
  }

  private matchesBrowserFilter(t: Technique, filter: string): boolean {
    if (!this.showSubTechniques && t.isSubTechnique) return false;
    if (this.tacticFilter && !(t.tactics || []).includes(this.tacticFilter))
      return false;
    const s = this.searchString.trim().toLowerCase();
    if (!s) return true;
    return (
      t.externalId?.toLowerCase().includes(s) ||
      t.name?.toLowerCase().includes(s) ||
      t.description?.toLowerCase().includes(s) ||
      (t.weaknesses || []).some((w) => w.toLowerCase().includes(s))
    );
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
    const message =
      count > 0
        ? `${t.externalId} ${t.name} is named by ${count} scenario event${count === 1 ? '' : 's'}. ` +
          'Those events keep the id, but it will no longer be offered. Remove it from this MSEL?'
        : `Remove ${t.externalId} ${t.name} from this MSEL?`;
    this.dialogService
      .confirm({ title: 'Remove Technique', message })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.mselTechniqueDataService.delete(item.id);
        }
      });
  }

  /** Whether any defensive release is imported, for the mappings row's empty states. */
  get hasDefensiveRelease(): boolean {
    return this.allReleases.some((r) => techniqueFamily(r) === 'defensive');
  }

  countermeasuresFor(item: MselTechnique): MselTechniqueCountermeasures {
    return this.countermeasuresByTechniqueId.get(item.techniqueId);
  }

  /** Defensive tactics have no useful id, so only the attack ones show it. */
  tacticLabel(tactic: TechniqueTactic): string {
    return this.isDefensive
      ? tactic.name
      : `${tactic.externalId} ${tactic.name}`;
  }

  /**
   * The browsed release's techniques cite weaknesses: the table adds Weaknesses and links columns and calls
   * platforms domains.
   */
  get browsesWeaknesses(): boolean {
    return this.techniques.some((t) => (t.weaknesses || []).length > 0);
  }

  /** One group's name in the browsed release: Tactic or Category. */
  get groupLabel(): string {
    return singular(groupLabel(this.selectedRelease));
  }

  /** The browsed release's name for its groups. */
  get browserGroupsLabel(): string {
    return groupLabel(this.selectedRelease);
  }

  /** The pool's groups column name: the one the pinned releases share, else "Groups". */
  get poolGroupsLabel(): string {
    const labels = new Set(
      this.pinnedDomains.map((p) => groupLabel(p.release)),
    );
    if (labels.size === 1) return [...labels][0];
    return labels.size === 0 ? groupLabel(this.selectedRelease) : 'Groups';
  }

  /** A release whose techniques cite weaknesses calls platforms domains. */
  get platformsLabel(): string {
    return this.browsesWeaknesses ? 'Domains' : 'Platforms';
  }

  /** A weakness's page, from the browsed release's framework; null when it gives no template. */
  /** How many of a technique's weaknesses show before "+n more". */
  readonly weaknessesShown = 4;
  /** The techniques whose full weakness list is open. */
  readonly openWeaknesses = new Set<string>();

  shownWeaknesses(t: Technique): string[] {
    const all = t.weaknesses || [];
    return this.openWeaknesses.has(t.id)
      ? all
      : all.slice(0, this.weaknessesShown);
  }

  toggleWeaknesses(t: Technique, event: Event) {
    event.stopPropagation();
    if (!this.openWeaknesses.delete(t.id)) {
      this.openWeaknesses.add(t.id);
    }
  }

  weaknessUrl(weakness: string): string | null {
    return weaknessLink(this.selectedRelease?.weaknessUrlTemplate, weakness);
  }

  hostOf(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  /** Loads a pool release's group names once, so its techniques show names even when another release is browsed. */
  private loadTacticNames(releaseId: string | undefined) {
    if (!releaseId || this.tacticNamesByRelease.has(releaseId)) return;
    this.tacticNamesByRelease.set(releaseId, new Map());
    this.techniqueReleaseService
      .getTechniqueTactics(releaseId)
      .pipe(take(1))
      .subscribe({
        next: (tactics) =>
          this.tacticNamesByRelease.set(
            releaseId,
            new Map(tactics.map((t) => [t.shortName, t.name])),
          ),
        error: () => this.tacticNamesByRelease.delete(releaseId),
      });
  }

  getTacticNames(technique: Technique): string {
    const names = this.tacticNamesByRelease.get(technique?.techniqueReleaseId);
    return (technique?.tactics || []).map((t) => names?.get(t) || t).join(', ');
  }

  /** Opens a technique's full description, which is too long for a tooltip. */
  showDetail(technique: Technique) {
    if (!technique) return;
    this.dialog.open(TechniqueDetailDialogComponent, {
      minWidth: '400px',
      maxWidth: '90vw',
      width: '700px',
      data: {
        technique,
        groupsLabel: this.browserGroupsLabel,
        groupNames: this.getTacticNames(technique),
      } satisfies TechniqueDetailDialogData,
    });
  }

  /** The site a technique's link opens, for its link title. */
  linkHost(technique: Technique): string {
    const url = technique?.url || '';
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  /** How many of this MSEL's scenario events name the technique. */
  getEventCount(item: MselTechnique): number {
    const externalId = item.technique?.externalId;
    if (!externalId) return 0;
    const fieldType = this.isDefensive
      ? DataFieldType.DefensiveTechnique
      : DataFieldType.AttackTechnique;
    const fieldIds = new Set(
      this.allDataFields
        .filter((df) => df.mselId === this.msel.id && df.dataType === fieldType)
        .map((df) => df.id),
    );
    if (fieldIds.size === 0) return 0;
    const events = new Set<string>();
    for (const dv of this.allDataValues) {
      if (
        fieldIds.has(dv.dataFieldId) &&
        dv.value &&
        dv.scenarioEventId &&
        dv.value
          .split(',')
          .map((s) => s.trim())
          .includes(externalId)
      ) {
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

/** One group's name from the plural a release gives: Tactics becomes Tactic, Categories becomes Category. */
export function singular(label: string): string {
  return label.endsWith('ies')
    ? label.slice(0, -3) + 'y'
    : label.replace(/s$/, '');
}
