// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import {
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { LegacyPageEvent as PageEvent, MatLegacyPaginator as MatPaginator } from '@angular/material/legacy-paginator';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { User } from 'src/app/generated/blueprint.api';
import { TeamUserDataService } from 'src/app/data/user/team-user-data.service';
import { UserTeamRoleQuery } from 'src/app/data/user-team-role/user-team-role.query';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UntypedFormControl } from '@angular/forms';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';

@Component({
  selector: 'app-user-add-dialog',
  templateUrl: './user-add-dialog.component.html',
  styleUrls: ['./user-add-dialog.component.scss'],
})

export class UserAddDialogComponent implements OnDestroy, OnInit {
  @Output() editComplete = new EventEmitter<any>();
  displayedUserColumns: string[] = ['name', 'id'];
  displayedTeamColumns: string[] = ['name', 'user'];
  userDataSource = new MatTableDataSource<User>(new Array<User>());
  teamUserDataSource = new MatTableDataSource<User>(new Array<User>());
  filterControl = new UntypedFormControl();
  filterString = '';
  teamUsers: User[] = [];
  availableUsers: User[] = [];
  private unsubscribe$ = new Subject();

  @ViewChild('usersInput') usersInput: ElementRef<HTMLInputElement>;


  constructor(
    public teamUserDataService: TeamUserDataService,
    public dialogService: DialogService,
    dialogRef: MatDialogRef<UserAddDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    dialogRef.disableClose = true;
    this.teamUserDataService.teamUsers.pipe(takeUntil(this.unsubscribe$)).subscribe(teamUsers => {
      this.teamUsers = teamUsers;
      this.teamUserDataSource.data = this.teamUsers.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        if (aName < bName) {
          return -1;
        } else if (aName > bName) {
          return 1;
        } else {
          return 0;
        }
      });
    });
  }

  ngOnInit() {
    this.teamUserDataService.getTeamUsersFromApi(this.data.team.id);
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.userDataSource.filter = filterValue;
  }

  clearFilter() {
    this.applyFilter('');
  }

  getUserName(id: string) {
    const user = this.data.availableUsers.find(u => u.id === id);
    return user ? user.name : '?';
  }

  getUserDataSource() {
    const availableUsers = !this.data.availableUsers ? new Array<User>() : this.data.availableUsers.slice(0);
    this.teamUserDataSource.data.forEach((tu) => {
      const index = availableUsers.findIndex((u) => u.id === tu.id);
      if (index >= 0) {
        availableUsers.splice(index, 1);
      }
    });
    this.userDataSource = new MatTableDataSource(availableUsers.filter(
      u => u.name.toLowerCase().indexOf(this.filterString.toLowerCase()) > -1
    ));
    return this.userDataSource;
  }

  addUserToTeam(user: User): void {
    const index = this.teamUserDataSource.data.findIndex(
      (tu) => tu.id === user.id
    );
    if (index === -1) {
      this.teamUserDataService.addUserToTeam(this.data.team.id, user);
    }
  }

  /**
   * Removes a user from the current team
   * @param user The user to remove from team
   */
  removeUserFromTeam(user: User): void {
    const index = this.teamUserDataSource.data.findIndex(
      (tu) => tu.id === user.id
    );
    if (index !== -1) {
      this.teamUserDataService.removeTeamUser(this.data.team.id, user.id);
    }
  }

  compare(a: string, b: string, isAsc: boolean) {
    if (a === null || b === null) {
      return 0;
    } else {
      return (a.toLowerCase() < b.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1);
    }
  }

  /**
   * Closes the edit screen
   */
  handleEditComplete(saveChanges: boolean): void {
    this.editComplete.emit(true);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

}
