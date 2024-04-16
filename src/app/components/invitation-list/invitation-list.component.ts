// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  Invitation,
  Team
} from 'src/app/generated/blueprint.api';
import { MselDataService, MselPlus } from 'src/app/data/msel/msel-data.service';
import { MselQuery } from 'src/app/data/msel/msel.query';
import { Sort } from '@angular/material/sort';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { InvitationDataService } from 'src/app/data/invitation/invitation-data.service';
import { InvitationQuery } from 'src/app/data/invitation/invitation.query';
import { TeamQuery } from 'src/app/data/team/team.query';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { DialogService } from 'src/app/services/dialog/dialog.service';
import { InvitationEditDialogComponent } from '../invitation-edit-dialog/invitation-edit-dialog.component';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-invitation-list',
  templateUrl: './invitation-list.component.html',
  styleUrls: ['./invitation-list.component.scss'],
})
export class InvitationListComponent implements OnDestroy {
  @Input() loggedInUserId: string;
  @Input() isContentDeveloper: boolean;
  @Input() hideSearch: boolean;
  // context menu
  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };
  msel = new MselPlus();
  invitationList: Invitation[] = [];
  changedInvitation: Invitation = {};
  filteredInvitationList: Invitation[] = [];
  filterControl = new UntypedFormControl();
  filterString = '';
  sort: Sort = {active: 'name', direction: 'asc'};
  sortedInvitations: Invitation[] = [];
  templateInvitations: Invitation[] = [];
  editingId = '';
  invitationDataSource = new MatTableDataSource<Invitation>(new Array<Invitation>());
  displayedColumns: string[] = ['action', 'teamId', 'emailDomain', 'expirationDateTime', 'maxUsersAllowed', 'userCount', 'isTeamLeader'];
  teamList: Team[] = [];
  private unsubscribe$ = new Subject();

  constructor(
    private mselQuery: MselQuery,
    private invitationDataService: InvitationDataService,
    private invitationQuery: InvitationQuery,
    private teamQuery: TeamQuery,
    public dialog: MatDialog,
    public dialogService: DialogService
  ) {
    // subscribe to invitations
    this.invitationQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(invitations => {
      this.invitationList = invitations;
      this.sortChanged(this.sort);
    });
    // subscribe to the active MSEL
    (this.mselQuery.selectActive() as Observable<MselPlus>).pipe(takeUntil(this.unsubscribe$)).subscribe(msel => {
      if (msel && this.msel.id !== msel.id) {
        Object.assign(this.msel, msel);
        this.sortChanged(this.sort);
      }
    });
    // subscribe to the MSEL teams
    this.teamQuery.selectAll().pipe(takeUntil(this.unsubscribe$)).subscribe(teams => {
      this.teamList = teams;
    });
    // subscribe to filter control changes
    this.filterControl.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((term) => {
        this.filterString = term;
        this.sortChanged(this.sort);
      });
  }

  getSortedInvitations(invitations: Invitation[]) {
    if (invitations) {
      invitations.sort((a, b) => this.sortInvitations(a, b, this.sort.active, this.sort.direction));
    }
    return invitations;
  }

  addOrEditInvitation(invitation: Invitation, makeTemplate: boolean) {
    if (!invitation) {
      const dateTime = new Date();
      dateTime.setMinutes(dateTime.getMinutes() + 30);
      invitation = {
        mselId: this.msel.id,
        expirationDateTime: dateTime,
        maxUsersAllowed: 1,
        userCount: 0,
        isTeamLeader: false,
        wasDeactivated: false
      };
    }
    const dialogRef = this.dialog.open(InvitationEditDialogComponent, {
      width: '800px',
      data: {
        invitation: invitation,
        teamList: this.teamList
      },
    });
    dialogRef.componentInstance.editComplete.subscribe((result) => {
      if (result.saveChanges && result.invitation) {
        this.saveInvitation(result.invitation);
      }
      dialogRef.close();
    });
  }

  saveInvitation(invitation: Invitation) {
    if (invitation.id) {
      this.invitationDataService.update(invitation);
    } else {
      invitation.id = uuidv4();
      this.invitationDataService.add(invitation);
    }
  }

  deleteInvitation(invitation: Invitation): void {
    this.dialogService
      .confirm(
        'Delete Invitation',
        'Are you sure that you want to delete ' + invitation + '?'
      )
      .subscribe((result) => {
        if (result['confirm']) {
          this.invitationDataService.delete(invitation.id);
          this.editingId = '';
        }
      });
  }

  sortChanged(sort: Sort) {
    this.sort = sort;
    this.invitationDataSource.data = this.getSortedInvitations(this.getFilteredInvitations(this.msel.id, this.invitationList));
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  getFilteredInvitations(mselId: string, invitations: Invitation[]): Invitation[] {
    let filteredInvitations: Invitation[] = [];
    if (invitations) {
      invitations.forEach(se => {
        if (se.mselId === mselId) {
          filteredInvitations.push({... se});
        }
      });
      if (filteredInvitations && filteredInvitations.length > 0 && this.filterString) {
        const filterString = this.filterString?.toLowerCase();
        filteredInvitations = filteredInvitations.filter(invitation => {
          const teamName = this.getTeamName(invitation.teamId)?.toLowerCase() || ''; // Ensuring it's always a string
          return teamName.includes(filterString) ||
                 invitation.emailDomain.toLowerCase().includes(filterString) ||
                 (invitation.teamId && invitation.teamId.toString().includes(filterString));
        });
      }
    }
    return filteredInvitations;
  }

  private sortInvitations(
    a: Invitation,
    b: Invitation,
    column: string,
    direction: string
  ) {
    const isAsc = direction !== 'desc';
    switch (column) {
      // case 'name':
      //   return ( (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
      //   break;
      // case 'shortname':
      //   return ( (a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
      //   break;
      // case 'summary':
      //   return ( (a.summary.toLowerCase() < b.summary.toLowerCase() ? -1 : 1) * (isAsc ? 1 : -1) );
      //   break;
      default:
        return 0;
    }
  }

  getTeamName(teamId: string) {
    const teamName = this.teamList.find(t => t.id === teamId)?.shortName;
    return teamName;
  }

}
