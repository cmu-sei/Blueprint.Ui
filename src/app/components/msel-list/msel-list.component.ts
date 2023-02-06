// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { UntypedFormControl } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { Sort } from '@angular/material/sort';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';

import { DataFieldDataService } from 'src/app/data/data-field/data-field-data.service';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-msel-list',
  templateUrl: './msel-list.component.html',
  styleUrls: ['./msel-list.component.scss'],
})
export class MselListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @ViewChild('fileInput') fileInput: ElementRef<HTMLInputElement>;
  mselList: MselPlus[] = [];
  isReady = false;
  uploadProgress = 0;
  uploadMselId = '';
  uploadTeamId = '';
  filteredMselList: MselPlus[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = {active: 'dateCreated', direction: 'desc'};
  sortedMselList: MselPlus[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    public dialogService: DialogService,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    private dataFieldDataService: DataFieldDataService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery
  ) {
    // subscribe to MSELs loading
    this.mselQuery.selectLoading().pipe(takeUntil(this.unsubscribe$)).subscribe((isLoading) => {
      this.isReady = !isLoading;
    });
    (this.mselQuery.selectAll() as Observable<MselPlus[]>).pipe(takeUntil(this.unsubscribe$)).subscribe((msels) => {
      this.mselList.length = 0;
      if (msels) {
        this.mselList = msels;
        this.getFilteredMsels();
      }
    });
    this.filterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe((term) => {
      this.filterString = term;
      this.getFilteredMsels();
    });
  }

  openMsel(mselId, section) {
    this.router.navigate([], {
      queryParams: { msel: mselId, section: section },
      queryParamsHandling: 'merge',
    });
  }

  uploadFile(mselId: string, teamId: string) {
    this.uploadMselId = mselId ? mselId : '';
    this.uploadTeamId = teamId ? teamId : '';
  }

  /**
   * Selects the file(s) to be uploaded. Called when file selection is changed
   */
  selectFile(e) {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    this.uploadProgress = 0;
    this.isReady = false;
    this.mselDataService
      .uploadXlsx(this.uploadMselId, this.uploadTeamId, file, 'events', true)
      .subscribe((event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress = Math.round((100 * event.loaded) / event.total);
          console.log(this.uploadProgress);
        } else if (event instanceof HttpResponse) {
          this.isReady = true;
          if (event.status === 200) {
            this.mselDataService.loadById(event.body);
          } else {
            alert('Error uploading files: ' + event.status);
          }
        }
      });
    this.fileInput.nativeElement.value = null;
  }

  /**
   * Trigger a download for a file. This will open the file in the broswer if it is an image or pdf
   *
   * @param mselId: The GUID of the file to download
   * @param name: The name to use when triggering the download
   */
  downloadFile(msel: MselPlus) {
    this.isReady = false;
    this.mselDataService.downloadXlsx(msel.id).subscribe(
      (data) => {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = msel.description.endsWith('.xlsx') ? msel.description : msel.description + '.xlsx';
        link.click();
        this.isReady = true;
      },
      (err) => {
        this.isReady = true;
        window.alert('Error downloading file');
      },
      () => {
        this.isReady = true;
        console.log('Got a next value');
      }
    );
  }

  addMsel() {
    const current = new Date();
    this.mselDataService.add({
      description: 'A new MSEL ' + current.toLocaleString(),
      status: 'Pending',
      dataFields: this.settingsService.settings.DefaultDataFields
    });
  }

  copyMsel(id: string): void {
    this.mselDataService.copy(id);
  }

  delete(msel: MselPlus): void {
    this.dialogService
      .confirm(
        'Delete MSEL',
        'Are you sure that you want to delete ' + msel.description + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselDataService.delete(msel.id);
        }
      });
  }

  getFilteredMsels() {
    let filteredMsels: MselPlus[] = [];
    if (this.mselList) {
      this.mselList.forEach(m => {
        const mselPlus = new MselPlus();
        Object.assign(mselPlus, m);
        filteredMsels.push(mselPlus);
      });
      if (filteredMsels && filteredMsels.length > 0 && this.filterString) {
        const filterString = this.filterString.toLowerCase();
        filteredMsels = filteredMsels
          .filter((a) =>
            a.name.toLowerCase().includes(filterString) ||
                a.description.toLowerCase().includes(filterString) ||
                a.status.toLowerCase().includes(filterString)
          );
      }
    }
    this.filteredMselList = filteredMsels;
    this.getSortedMsels();
  }

  sortChanged(sort: Sort) {
    if (!sort.direction) {
      this.sort = {active: 'dateCreated', direction: 'desc'};
    } else {
      this.sort = sort;
    }
    this.getSortedMsels();
  }

  getSortedMsels() {
    this.sortedMselList = this.filteredMselList.sort((a, b) => this.sortMsels(a, b));
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  private sortMsels(
    a: MselPlus,
    b: MselPlus
  ) {
    const isAsc = this.sort.direction !== 'desc';
    switch (this.sort.active) {
      case 'dateCreated':
        return ( (a.dateCreated < b.dateCreated ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case 'dateModified':
        return ( (a.dateModified < b.dateModified ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case 'name':
        return ( (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      default:
        return 0;
    }
  }

}
