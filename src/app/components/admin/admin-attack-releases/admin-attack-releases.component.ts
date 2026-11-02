// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, inject, input, viewChild } from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';
import { AsyncPipe, DatePipe, NgStyle } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel, MatInput, MatSuffix, MatHint } from '@angular/material/input';
import { MatIconButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { AttackRelease } from 'src/app/generated/blueprint.api';
import { AttackReleaseDataService } from 'src/app/data/attack-release/attack-release-data.service';
import { AttackReleaseQuery } from 'src/app/data/attack-release/attack-release.query';
import { SystemMessageService } from 'src/app/services/system-message/system-message.service';

/** Where MITRE serves a release's d3fend-full-mappings.json; the unversioned "latest" path is not served. */
export function d3fendMappingsUrl(version: string): string {
  return `https://d3fend.mitre.org/ontologies/d3fend/${version || '<version>'}/d3fend-full-mappings.json`;
}

/**
 * The technique framework releases planners pick techniques from. An administrator uploads a STIX bundle
 * (enterprise-attack.json, ics-attack.json, mobile-attack.json) from mitre-attack/attack-stix-data, or
 * stix-atlas.json from mitre-atlas/atlas-data, which imports as a release of the ATLAS domain, or the MITRE
 * D3FEND ontology (d3fend.json), which imports as a release of the d3fend domain whose techniques are defensive.
 * A D3FEND release also takes its d3fend-full-mappings.json, the "countered by" mappings from ATT&CK techniques to
 * its own.
 */
@Component({
  selector: 'app-admin-attack-releases',
  templateUrl: './admin-attack-releases.component.html',
  styleUrls: ['./admin-attack-releases.component.scss'],
  imports: [MatIcon, MatFormField, MatLabel, MatHint, MatInput, ReactiveFormsModule, MatIconButton, MatSuffix, MatProgressSpinner, MatTable, MatSort, MatSortHeader, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatTooltip, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, NgStyle, AsyncPipe, DatePipe]
})
export class AdminAttackReleasesComponent implements OnInit, AfterViewInit, OnDestroy {
  private attackReleaseDataService = inject(AttackReleaseDataService);
  private attackReleaseQuery = inject(AttackReleaseQuery);
  private messageService = inject(SystemMessageService);
  dialogService = inject(CrucibleDialogService);

  readonly loggedInUserId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly sort = viewChild(MatSort);
  readonly stixInput = viewChild<ElementRef<HTMLInputElement>>('stixInput');
  readonly mappingsInput = viewChild<ElementRef<HTMLInputElement>>('mappingsInput');
  /** The D3FEND release the mappings file picker was opened for. */
  private mappingsRelease: AttackRelease;
  dataSource = new MatTableDataSource<AttackRelease>([]);
  displayedColumns: string[] = ['action', 'name', 'domain', 'version', 'releaseDate', 'tacticCount', 'techniqueCount'];
  versionControl = new UntypedFormControl('');
  filterControl = new UntypedFormControl('');
  filterString = '';
  isLoading$: Observable<boolean>;
  private unsubscribe$ = new Subject();

  constructor() {
    this.isLoading$ = this.attackReleaseQuery.selectLoading();
  }

  ngOnInit() {
    this.attackReleaseQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(releases => {
      this.dataSource.data = releases;
    });
    this.filterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(term => {
      this.filterString = term;
      this.dataSource.filter = (term || '').trim().toLowerCase();
    });
    this.attackReleaseDataService.load();
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort();
  }

  /** ATLAS is a separate MITRE mark, so its notice is only due once an ATLAS release is listed. */
  get hasAtlasRelease(): boolean {
    return this.dataSource.data.some(r => r.domain === 'ATLAS');
  }

  /** D3FEND is a separate MITRE mark with terms of use of its own, due once a D3FEND release is listed. */
  get hasD3fendRelease(): boolean {
    return this.dataSource.data.some(r => r.domain === 'd3fend');
  }

  /** A defensive release takes the "countered by" mappings; the API flags it, whatever its domain. */
  isDefensive(release: AttackRelease): boolean {
    return !!release.isDefensive;
  }

  /** The defensive releases still without their "countered by" mappings, for the hint that says where to get them. */
  get defensiveReleasesWithoutMappings(): AttackRelease[] {
    return this.dataSource.data.filter(r => this.isDefensive(r) && !r.countermeasureCount);
  }

  mappingsUrl(release: AttackRelease): string {
    return d3fendMappingsUrl(release?.version);
  }

  selectFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    this.attackReleaseDataService.import(file, (this.versionControl.value || '').trim())
      .subscribe(() => this.versionControl.setValue(''));
    this.stixInput().nativeElement.value = null;
  }

  chooseMappingsFile(release: AttackRelease) {
    this.mappingsRelease = release;
    this.mappingsInput().nativeElement.click();
  }

  selectMappingsFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files && input.files[0];
    const release = this.mappingsRelease;
    if (!file || !release) {
      return;
    }
    this.attackReleaseDataService.importCountermeasures(release.id, file).subscribe(result => {
      this.messageService.displayMessage(
        'Mappings Imported',
        `${result.rowsRead} rows read. ${result.pairsStored} countermeasure mappings for ${result.offensiveTechniqueCount} ` +
          `techniques stored on ${release.name} ${release.version}` +
          (result.pairsSkipped > 0 ? `; ${result.pairsSkipped} skipped because their D3FEND technique is not in this release.` : '.')
      );
    });
    input.value = null;
  }

  deleteRelease(release: AttackRelease) {
    this.dialogService
      .confirm({
        title: 'Delete Release',
        message: 'Are you sure you want to delete ' + release.name + ' ' + release.version + '? ' +
          'A release that any MSEL still uses cannot be deleted.'
      })
      .afterClosed()
      .subscribe(result => {
        if (result) {
          this.attackReleaseDataService.delete(release.id);
        }
      });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
