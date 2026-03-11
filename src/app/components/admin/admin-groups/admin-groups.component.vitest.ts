// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { of, BehaviorSubject } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { AdminGroupsComponent } from './admin-groups.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { GroupDataService } from 'src/app/data/group/group-data.service';
import { PermissionDataService } from 'src/app/data/permission/permission-data.service';
import { UserDataService } from 'src/app/data/user/user-data.service';
import { Group } from 'src/app/generated/blueprint.api';

function createMockGroups(names: string[]): Group[] {
  return names.map((name, i) => ({
    id: `group-${i}`,
    name,
  }));
}

async function renderAdminGroups(
  overrides: {
    canEdit?: boolean;
    groups?: Group[];
  } = {},
) {
  const { canEdit = false, groups = [] } = overrides;
  const groupsSubject = new BehaviorSubject<Group[]>(groups);

  return renderComponent(AdminGroupsComponent, {
    declarations: [AdminGroupsComponent],
    imports: [MatTableModule, MatSortModule],
    providers: [
      {
        provide: GroupDataService,
        useValue: {
          groups$: groupsSubject.asObservable(),
          load: () => of(groups),
          create: () => of({}),
          edit: () => of({}),
          delete: () => of({}),
        },
      },
      {
        provide: PermissionDataService,
        useValue: {
          permissions: [],
          load: () => of([]),
          hasPermission: () => canEdit,
          canViewAdministration: () => false,
        },
      },
      {
        provide: UserDataService,
        useValue: {
          setCurrentUser: () => {},
          load: () => of([]),
          setUserTheme: () => {},
        },
      },
    ],
  });
}

describe('AdminGroupsComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderAdminGroups();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show search input', async () => {
    await renderAdminGroups();
    expect(screen.getByPlaceholderText('Search Groups')).toBeInTheDocument();
  });

  it('should display group names in the table', async () => {
    const groups = createMockGroups(['Alpha Team', 'Beta Team']);
    await renderAdminGroups({ groups });
    expect(screen.getByText('Alpha Team')).toBeInTheDocument();
    expect(screen.getByText('Beta Team')).toBeInTheDocument();
  });

  it('should show Group Name column header', async () => {
    await renderAdminGroups();
    expect(screen.getByText('Group Name')).toBeInTheDocument();
  });

  it('should set canEdit to true when user has ManageGroups permission', async () => {
    const { fixture } = await renderAdminGroups({ canEdit: true });
    expect(fixture.componentInstance.canEdit).toBe(true);
  });

  it('should set canEdit to false when user lacks ManageGroups permission', async () => {
    const { fixture } = await renderAdminGroups({ canEdit: false });
    expect(fixture.componentInstance.canEdit).toBe(false);
  });

  it('should disable delete buttons when canEdit is false', async () => {
    const groups = createMockGroups(['Test Group']);
    const { fixture } = await renderAdminGroups({ canEdit: false, groups });
    fixture.detectChanges();
    // Query buttons by their disabled state and icon content
    const allButtons = fixture.nativeElement.querySelectorAll(
      'td button[mat-icon-button]',
    );
    // All action buttons in rows should be disabled
    allButtons.forEach((btn: HTMLButtonElement) => {
      expect(btn.disabled).toBe(true);
    });
  });

  it('should enable action buttons when canEdit is true', async () => {
    const groups = createMockGroups(['Test Group']);
    const { fixture } = await renderAdminGroups({ canEdit: true, groups });
    fixture.detectChanges();
    const allButtons = fixture.nativeElement.querySelectorAll(
      'td button[mat-icon-button]',
    );
    expect(allButtons.length).toBeGreaterThan(0);
    allButtons.forEach((btn: HTMLButtonElement) => {
      expect(btn.disabled).toBe(false);
    });
  });

  it('should toggle expansion when toggleExpand is called', async () => {
    const groups = createMockGroups(['Expand Me']);
    const { fixture } = await renderAdminGroups({ groups });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.expandedGroupId).toBeNull();
    component.toggleExpand('group-0');
    expect(component.expandedGroupId).toBe('group-0');
    component.toggleExpand('group-0');
    expect(component.expandedGroupId).toBeNull();
  });

  it('should apply and clear filter', async () => {
    const groups = createMockGroups(['Alpha', 'Beta']);
    const { fixture } = await renderAdminGroups({ groups });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.applyFilter('Alpha');
    expect(component.filterString).toBe('Alpha');
    expect(component.dataSource.filter).toBe('alpha');
    component.clearFilter();
    expect(component.filterString).toBe('');
    expect(component.dataSource.filter).toBe('');
  });
});
