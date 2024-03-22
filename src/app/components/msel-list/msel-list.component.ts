// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild, ElementRef, OnInit } from '@angular/core';
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
import { User } from 'src/app/generated/blueprint.api';
import { ItemStatus } from 'src/app/generated/blueprint.api';

@Component({
  selector: 'app-msel-list',
  templateUrl: './msel-list.component.html',
  styleUrls: ['./msel-list.component.scss'],
})
export class MselListComponent implements OnDestroy, OnInit  {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() isSystemAdmin: boolean;
  @ViewChild('jsonInput') jsonInput: ElementRef<HTMLInputElement>;
  @ViewChild('xlsxInput') xlsxInput: ElementRef<HTMLInputElement>;
  @ViewChild(MatSort, { static: true }) sort: MatSort;
  mselList: MselPlus[] = [];
  isReady = false;
  uploadProgress = 0;
  uploadMselId = '';
  uploadTeamId = '';
  fileType = '';
  filteredMselList: MselPlus[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sortedMselList: MselPlus[] = [];
  defaultTab = 'Info';
  isLoading = true;
  areButtonsDisabled = false;
  mselDataSource: MatTableDataSource<MselPlus>;
  displayedColumns: string[] = ['action', 'name', 'isTemplate', 'status', 'createdBy', 'dateModified', 'description'];
  imageFilePath = '';
  userList: User[] = [];
  selectedMselType = 'all';
  selectedMselStatus = 'all';
  itemStatus = [ItemStatus.Pending, ItemStatus.Entered, ItemStatus.Approved, ItemStatus.Complete, ItemStatus.Deployed, ItemStatus.Archived];
  allMselsAreLoaded = false;
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
    // Initial datasource
    this.mselDataSource = new MatTableDataSource<MselPlus>(
      new Array<MselPlus>()
    );
    // load the MSELs
    this.mselDataService.loadMine();
    // subscribe to users
    this.userDataService.users.pipe(takeUntil(this.unsubscribe$)).subscribe(users => {
      this.userList = users;
    });
    // load the users
    this.userDataService.getUsersFromApi();
  }

  ngOnInit() {
    this.sort.sort(<MatSortable>{ id: 'name', start: 'asc' });
    this.mselDataSource.sort = this.sort;
    // subscribe to MSELs loading
    this.mselQuery.selectLoading().pipe(takeUntil(this.unsubscribe$)).subscribe((isLoading) => {
      this.isReady = !isLoading;
      this.areButtonsDisabled = isLoading;
    });
    // subscribe to MSELs loading progress
    this.mselDataService.uploadProgress.pipe(takeUntil(this.unsubscribe$)).subscribe((uploadProgress) => {
      this.uploadProgress = uploadProgress;
    });
    // subscribe to MSELs
    (this.mselQuery.selectAll() as Observable<MselPlus[]>).pipe(takeUntil(this.unsubscribe$)).subscribe((msels) => {
      const mselPlusList: MselPlus[] = [];
      msels.forEach(msel => {
        const mselPlus = new MselPlus();
        Object.assign(mselPlus, msel);
        mselPlusList.push(mselPlus);
      });
      this.mselList = mselPlusList;
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
    // remove case sensitivity from mat-table sort
    this.mselDataSource.sortingDataAccessor = (data: any, sortHeaderId: string): string => {
      if (typeof data[sortHeaderId] === 'string') {
        return data[sortHeaderId].toLocaleLowerCase();
      }
      return data[sortHeaderId];
    };
  }

  openMsel(mselId) {
    // join signalR for this MSEL
    this.signalRService.selectMsel(mselId);
    this.uiDataService.setMselTab(this.defaultTab);
  }

  uploadFile(fileType: string, mselId: string, teamId: string) {
    this.areButtonsDisabled = true;
    this.uploadMselId = mselId ? mselId : '';
    this.uploadTeamId = teamId ? teamId : '';
    this.fileType = fileType;
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
    if (this.fileType === 'xlsx') {
      this.mselDataService.uploadXlsx(this.uploadMselId, this.uploadTeamId, file, 'events', true);
    } else {
      this.mselDataService.uploadJson(file, 'events', true);
    }
    this.jsonInput.nativeElement.value = null;
    this.xlsxInput.nativeElement.value = null;
  }

  /**
   * Trigger a download for a file. This will open the file in the broswer if it is an image or pdf
   *
   * @param mselId: The GUID of the file to download
   * @param name: The name to use when triggering the download
   */
  downloadXlsxFile(msel: MselPlus) {
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

  /**
   * Trigger a download for a file. This will open the file in the broswer if it is an image or pdf
   *
   * @param mselId: The GUID of the file to download
   * @param name: The name to use when triggering the download
   */
  downloadJsonFile(msel: MselPlus) {
    this.isReady = false;
    this.mselDataService.downloadJson(msel.id).subscribe(
      (data) => {
        const url = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = msel.name.endsWith('.json') ? msel.name : msel.name + '.json';
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
        'Are you sure that you want to delete ' + msel.name + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.mselDataService.delete(msel.id);
        }
      });
  }

  filterMsels() {
    let filteredMselList = this.mselList;
    switch (this.selectedMselType) {
      case 'is':
        filteredMselList = filteredMselList.filter(m => m.isTemplate);
        break;
      case 'is not':
        filteredMselList = filteredMselList.filter(m => !m.isTemplate);
        break;
      default:
        filteredMselList = filteredMselList;
        break;
    }
    switch (this.selectedMselStatus) {
      case 'Pending':
        filteredMselList = filteredMselList.filter(m => m.status.toString() === 'Pending');
        break;
      case 'Entered':
        filteredMselList = filteredMselList.filter(m => m.status.toString() === 'Entered');
        break;
      case 'Approved':
        filteredMselList = filteredMselList.filter(m => m.status.toString() === 'Approved');
        break;
      case 'Completed':
        filteredMselList = filteredMselList.filter(m => m.status.toString() === 'Completed');
        break;
      default:
        filteredMselList = filteredMselList;
        break;
    }
    this.mselDataSource.data = filteredMselList;
    const filterValue = this.filterString.toLowerCase().trim(); //  Remove whitespace and MatTableDataSource defaults to lowercase matches
    this.mselDataSource.filter = filterValue;
  }

  goToUrl(url): void {
    this.router.navigate([url], {
      queryParamsHandling: 'merge',
    });
  }

  getUserName(userId: string) {
    const user = this.userList.find(u => u.id === userId);
    return user ? user.name : 'System';
  }

  adminLoadAllMsels() {
    // load the MSELs
    this.mselDataService.load();
    this.allMselsAreLoaded = true;
  }

  adminLoadMyMsels() {
    this.mselDataService.loadMine();
    this.allMselsAreLoaded = false;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
