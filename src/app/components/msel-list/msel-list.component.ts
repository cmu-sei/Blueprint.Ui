// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, Input, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenav } from '@angular/material/sidenav';
import { Sort } from '@angular/material/sort';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
  Theme,
  ComnAuthQuery,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { TopbarView } from './../shared/top-bar/topbar.models';
import {
  ItemStatus,
  Msel
} from 'src/app/generated/blueprint.api';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-msel-list',
  templateUrl: './msel-list.component.html',
  styleUrls: ['./msel-list.component.scss'],
})
export class MselListComponent implements OnDestroy, OnInit {
  mselList: Msel[] = [];
  private unsubscribe$ = new Subject();
  isReady = false;
  uploadProgress = 0;
  uploading = false;
  uploadMselId = '';
  uploadTeamId = '';
  @ViewChild('fileInput') fileInput: ElementRef<HTMLInputElement>;
  filteredMselList: Msel[] = [];
  filterControl = new FormControl();
  filterString = '';
  sort: Sort = {active: 'dateCreated', direction: 'desc'};
  sortedMselList: Msel[] = [];

  constructor(
    activatedRoute: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    public dialogService: DialogService,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private authQuery: ComnAuthQuery,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery
  ) {
    // subscribe to MSELs loading
    this.mselQuery.selectLoading().pipe(takeUntil(this.unsubscribe$)).subscribe((isLoading) => {
      this.isReady = !isLoading;
    });
    this.mselQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe((msels) => {
      this.mselList = msels;
      this.getFilteredMsels();
    });
    this.filterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe((term) => {
      this.filterString = term;
      this.getFilteredMsels();
    });
  }

  ngOnInit() {
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
   selectFile(file: File) {
    if (!file) return;
    this.uploadProgress = 0;
    this.uploading = true;
    this.mselDataService
      .uploadXlsx(this.uploadMselId, this.uploadTeamId, file, 'events', true)
      .subscribe((event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress = Math.round((100 * event.loaded) / event.total);
          console.log(this.uploadProgress);
        } else if (event instanceof HttpResponse) {
          this.uploading = false;
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
   downloadFile(msel: Msel) {
    this.mselDataService.downloadXlsx(msel.id).subscribe(
      (data) => {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = msel.description.endsWith('.xlsx') ? msel.description : msel.description + '.xlsx';
        link.click();
      },
      (err) => {
        window.alert('Error downloading file');
      },
      () => {
        console.log('Got a next value');
      }
    );
  }

  addMsel() {
    const current = new Date();
    this.mselDataService.add({
      description: 'A new MSEL ' + current.toLocaleString(),
      status: 'Pending'
    });
  }

  copyMsel(msel: Msel): void {
    // not implemented
  }

  delete(msel: Msel): void {
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
    let filteredMsels: Msel[] = [];
    if (this.mselList) {
      this.mselList.forEach(m => {
        filteredMsels.push({... m});
      });
      if (filteredMsels && filteredMsels.length > 0 && this.filterString) {
        var filterString = this.filterString.toLowerCase();
        filteredMsels = filteredMsels
          .filter((a) =>
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

  private sortMsels(
    a: Msel,
    b: Msel
  ) {
    const isAsc = this.sort.direction !== 'desc';
    switch (this.sort.active) {
      case 'dateCreated':
        return ( (a.dateCreated < b.dateCreated ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      case "description":
        return ( (a.description < b.description ? -1 : 1) * (isAsc ? 1 : -1) );
        break;
      default:
        return 0;
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
