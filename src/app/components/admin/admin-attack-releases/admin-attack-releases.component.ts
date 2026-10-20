// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { AttackRelease } from 'src/app/generated/blueprint.api';
import { AttackReleaseDataService } from 'src/app/data/attack-release/attack-release-data.service';
import { AttackReleaseQuery } from 'src/app/data/attack-release/attack-release.query';

/**
 * The MITRE ATT&CK releases planners pick techniques from. An administrator uploads a STIX bundle
 * (enterprise-attack.json, ics-attack.json, mobile-attack.json) from mitre-attack/attack-stix-data.
 */
@Component({
  selector: 'app-admin-attack-releases',
  templateUrl: './admin-attack-releases.component.html',
  styleUrls: ['./admin-attack-releases.component.scss'],
  standalone: false
})
export class AdminAttackReleasesComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() loggedInUserId: string;
  @Input() canEdit: boolean;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild('stixInput') stixInput: ElementRef<HTMLInputElement>;
  dataSource = new MatTableDataSource<AttackRelease>([]);
  displayedColumns: string[] = ['action', 'name', 'domain', 'version', 'releaseDate', 'tacticCount', 'techniqueCount'];
  versionControl = new UntypedFormControl('');
  filterControl = new UntypedFormControl('');
  filterString = '';
  isLoading$: Observable<boolean>;
  private unsubscribe$ = new Subject();

  constructor(
    private attackReleaseDataService: AttackReleaseDataService,
    private attackReleaseQuery: AttackReleaseQuery,
    public dialogService: CrucibleDialogService
  ) {
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
    this.dataSource.sort = this.sort;
  }

  selectFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    this.attackReleaseDataService.import(file, (this.versionControl.value || '').trim())
      .subscribe(() => this.versionControl.setValue(''));
    this.stixInput.nativeElement.value = null;
  }

  deleteRelease(release: AttackRelease) {
    this.dialogService
      .confirm({
        title: 'Delete ATT&CK Release',
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
