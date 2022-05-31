// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.
import { Component, Input, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenav } from '@angular/material/sidenav';
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
import { MoveDataService } from 'src/app/data/move/move-data.service';
import { MatDialog } from '@angular/material/dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-msel-list',
  templateUrl: './msel-list.component.html',
  styleUrls: ['./msel-list.component.scss'],
})
export class MselListComponent implements OnDestroy, OnInit {
  @Input() mselList: Msel[];
  private unsubscribe$ = new Subject();
  isReady = false;
  uploadProgress = 0;
  uploading = false;
  uploadMselId = '';
  uploadTeamId = '';
  @ViewChild('fileInput') fileInput: ElementRef<HTMLInputElement>;

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
    this.mselQuery.selectLoading()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((isLoading) => {
        this.isReady = !isLoading;
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

  copy(msel: Msel): void {
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

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
