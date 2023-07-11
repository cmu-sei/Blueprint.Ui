// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild, ElementRef, OnInit } from '@angular/core';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { UntypedFormControl } from '@angular/forms';
import { MatSort, MatSortable, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { SignalRService } from 'src/app/services/signalr.service';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { UIDataService } from 'src/app/data/ui/ui-data.service';

@Component({
  selector: 'app-msel-list',
  templateUrl: './msel-list.component.html',
  styleUrls: ['./msel-list.component.scss'],
})
export class MselListComponent implements OnDestroy, OnInit  {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @ViewChild('fileInput') fileInput: ElementRef<HTMLInputElement>;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  mselList: MselPlus[] = [];
  isReady = false;
  uploadProgress = 0;
  uploadMselId = '';
  uploadTeamId = '';
  filteredMselList: MselPlus[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sortedMselList: MselPlus[] = [];
  defaultTab = 'Info';
  isLoading = true;
  areButtonsDisabled = false;
  mselDataSource: MatTableDataSource<MselPlus>;
  displayedColumns: string[] = ['action', 'name', 'status', 'dateModified', 'description'];
  imageFilePath = '';
  private unsubscribe$ = new Subject();

  constructor(
    public dialogService: DialogService,
    private router: Router,
    private userDataService: UserDataService,
    private settingsService: ComnSettingsService,
    private mselDataService: MselDataService,
    private mselQuery: MselQuery,
    private signalRService: SignalRService,
    private uiDataService: UIDataService
  ) {
    // load the MSELs
    this.mselDataService.loadMine();
  }

  ngOnInit() {
    // Initial datasource
    this.mselDataSource = new MatTableDataSource<MselPlus>(
      new Array<MselPlus>()
    );
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.mselDataSource.sort = this.sort;
    // subscribe to MSELs loading
    this.mselQuery.selectLoading().pipe(takeUntil(this.unsubscribe$)).subscribe((isLoading) => {
      this.isReady = !isLoading;
    });
    // subscribe to MSELs
    (this.mselQuery.selectAll() as Observable<MselPlus[]>).pipe(takeUntil(this.unsubscribe$)).subscribe((msels) => {
      this.mselDataSource.data = msels;
      this.filterMsels();
      this.isLoading = false;
      this.areButtonsDisabled = false;
    });
    // subscribe to filter control changes
    this.filterControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe((term) => {
      this.filterString = term;
      this.filterMsels();
    });
    // set image
    this.imageFilePath = this.settingsService.settings.AppTopBarImage.replace('white', 'blue');
    console.log(this.imageFilePath);
  }

  openMsel(mselId) {
    // join signalR for this MSEL
    this.signalRService.selectMsel(mselId);
    this.uiDataService.setMselTab(this.defaultTab);
  }

  uploadFile(mselId: string, teamId: string) {
    this.areButtonsDisabled = true;
    this.uploadMselId = mselId ? mselId : '';
    this.uploadTeamId = teamId ? teamId : '';
  }

  /**
   * Selects the file(s) to be uploaded. Called when file selection is changed
   */
  selectFile(e) {
    const file = e.target.files[0];
    if (!file) {
      this.areButtonsDisabled = false;
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
          this.areButtonsDisabled = false;
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
        link.download = msel.name.endsWith('.xlsx') ? msel.name : msel.name + '.xlsx';
        link.click();
        this.isReady = true;
      },
      (err) => {
        this.isReady = true;
        window.alert('Error downloading file');
      },
      () => {
        this.isReady = true;
      }
    );
  }

  addMsel() {
    this.areButtonsDisabled = true;
    this.mselDataService.add({
      name: 'New MSEL',
      description: 'Created from Default Settings by ' + this.userDataService.loggedInUser.value.profile.name,
      status: 'Pending',
      dataFields: this.settingsService.settings.DefaultDataFields
    });
    this.sort.sort(<MatSortable>{ id: 'dateCreated', start: 'desc' });
    this.mselDataSource.sort = this.sort;
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

  filterMsels() {
    const filterValue = this.filterString.toLowerCase().trim(); //  Remove whitespace and MatTableDataSource defaults to lowercase matches
    this.mselDataSource.filter = filterValue;
  }

  goToUrl(url): void {
    this.uiDataService.setMselTab('');
    this.router.navigate([url]);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
