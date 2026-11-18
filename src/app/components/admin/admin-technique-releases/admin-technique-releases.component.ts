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
import { MatDialog } from '@angular/material/dialog';
import { TechniqueFramework, TechniqueRelease, TechniqueReleaseNotice } from 'src/app/generated/blueprint.api';
import { TechniqueReleaseDataService } from 'src/app/data/technique-release/technique-release-data.service';
import { TechniqueReleaseQuery } from 'src/app/data/technique-release/technique-release.query';
import { SystemMessageService } from 'src/app/services/system-message/system-message.service';
import { TechniqueFrameworkQuery } from 'src/app/data/technique-framework/technique-framework.query';
import { MatSelect, MatOption } from '@angular/material/select';
import { AdminTechniqueFrameworksComponent } from '../admin-technique-frameworks/admin-technique-frameworks.component';
import { AdminTechniqueReleaseNoticeDialogComponent } from '../admin-technique-release-notice-dialog/admin-technique-release-notice-dialog.component';
import { TechniqueNoticeComponent, hasTechniqueNotice } from '../../technique-notice/technique-notice.component';

/**
 * The technique frameworks and the releases planners pick techniques from. An administrator defines the
 * frameworks, then imports release files, which are read as the framework they match. A release whose framework
 * defines mappings also takes a mappings file. A release shows the notice its file carried, which an
 * administrator can edit along with its framework.
 */
@Component({
  selector: 'app-admin-technique-releases',
  templateUrl: './admin-technique-releases.component.html',
  styleUrls: ['./admin-technique-releases.component.scss'],
  imports: [MatIcon, MatFormField, MatLabel, MatHint, MatInput, ReactiveFormsModule, MatIconButton, MatSuffix, MatProgressSpinner, MatTable, MatSort, MatSortHeader, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatTooltip, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow, NgStyle, AsyncPipe, DatePipe, TechniqueNoticeComponent, MatSelect, MatOption, AdminTechniqueFrameworksComponent]
})
export class AdminTechniqueReleasesComponent implements OnInit, AfterViewInit, OnDestroy {
  private techniqueReleaseDataService = inject(TechniqueReleaseDataService);
  private techniqueReleaseQuery = inject(TechniqueReleaseQuery);
  private techniqueFrameworkQuery = inject(TechniqueFrameworkQuery);
  private messageService = inject(SystemMessageService);
  dialogService = inject(CrucibleDialogService);
  private dialog = inject(MatDialog);

  readonly loggedInUserId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly sort = viewChild(MatSort);
  readonly stixInput = viewChild<ElementRef<HTMLInputElement>>('stixInput');
  readonly mappingsInput = viewChild<ElementRef<HTMLInputElement>>('mappingsInput');
  /** The release the mappings file picker was opened for. */
  private mappingsRelease: TechniqueRelease;
  dataSource = new MatTableDataSource<TechniqueRelease>([]);
  // the release whose notice is open under its row
  expandedId = '';
  displayedColumns: string[] = ['action', 'name', 'framework', 'domain', 'version', 'releaseDate', 'tacticCount', 'techniqueCount'];
  versionControl = new UntypedFormControl('');
  /** The framework to read the next file as; empty to match it automatically. */
  frameworkControl = new UntypedFormControl('');
  frameworks: TechniqueFramework[] = [];
  filterControl = new UntypedFormControl('');
  filterString = '';
  isLoading$: Observable<boolean>;
  private unsubscribe$ = new Subject();

  constructor() {
    this.isLoading$ = this.techniqueReleaseQuery.selectLoading();
  }

  hasNotice = hasTechniqueNotice;

  /** Opens or closes the notice under a row; a click on a button or link in it does neither. */
  rowClicked(release: TechniqueRelease, event: Event) {
    if ((event.target as HTMLElement)?.closest('button, a')) {
      return;
    }
    this.expandedId = this.expandedId === release.id ? '' : release.id;
  }

  ngOnInit() {
    this.techniqueReleaseQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(releases => {
      this.dataSource.data = releases;
    });
    this.techniqueFrameworkQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(frameworks => {
      this.frameworks = [...frameworks].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });
    this.filterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(term => {
      this.filterString = term;
      this.dataSource.filter = (term || '').trim().toLowerCase();
    });
    this.techniqueReleaseDataService.load();
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort();
  }

  /** The frameworks whose download hints the empty state lists. */
  get frameworksWithDownloads(): TechniqueFramework[] {
    return this.frameworks.filter(f => f.settings?.downloadHint || f.settings?.downloadUrl);
  }

  /** Opens the framework, source, notice and terms of a release for editing. */
  editNotice(release: TechniqueRelease) {
    const notice: TechniqueReleaseNotice = {
      techniqueFrameworkId: release.techniqueFrameworkId ?? null,
      source: release.source ?? '',
      sourceUrl: release.sourceUrl ?? '',
      notice: release.notice ?? '',
      termsUrl: release.termsUrl ?? '',
    };
    const dialogRef = this.dialog.open(AdminTechniqueReleaseNoticeDialogComponent, {
      minWidth: '500px',
      maxWidth: '90vw',
      width: '700px',
      data: { release, notice, frameworks: this.frameworks },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.notice) {
        this.techniqueReleaseDataService.updateNotice(release.id, result.notice).subscribe();
      }
      dialogRef.close();
    });
  }

  /** A release whose framework defines mappings takes a mappings file. */
  takesMappings(release: TechniqueRelease): boolean {
    return !!release.mappingRelation;
  }

  /** The releases that take mappings but have none yet, for the hint. */
  get releasesWithoutMappings(): TechniqueRelease[] {
    return this.dataSource.data.filter(r => this.takesMappings(r) && !r.countermeasureCount);
  }

  selectFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    this.techniqueReleaseDataService.import(file, (this.versionControl.value || '').trim(), this.frameworkControl.value || undefined)
      .subscribe(() => {
        this.versionControl.setValue('');
        this.frameworkControl.setValue('');
      });
    this.stixInput().nativeElement.value = null;
  }

  chooseMappingsFile(release: TechniqueRelease) {
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
    this.techniqueReleaseDataService.importCountermeasures(release.id, file).subscribe(result => {
      this.messageService.displayMessage(
        'Mappings Imported',
        `${result.rowsRead} rows read. ${result.pairsStored} mappings for ${result.offensiveTechniqueCount} ` +
          `techniques stored on ${release.name} ${release.version}` +
          (result.pairsSkipped > 0 ? `; ${result.pairsSkipped} skipped because their technique is not in this release.` : '.')
      );
    });
    input.value = null;
  }

  deleteRelease(release: TechniqueRelease) {
    this.dialogService
      .confirm({
        title: 'Delete Release',
        message: 'Are you sure you want to delete ' + release.name + ' ' + release.version + '? ' +
          'A release that any MSEL still uses cannot be deleted.'
      })
      .afterClosed()
      .subscribe(result => {
        if (result) {
          this.techniqueReleaseDataService.delete(release.id);
        }
      });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
