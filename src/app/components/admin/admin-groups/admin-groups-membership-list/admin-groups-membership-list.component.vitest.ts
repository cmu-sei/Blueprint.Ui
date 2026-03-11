// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminGroupsMembershipListComponent } from './admin-groups-membership-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderMembershipList(
  overrides: {
    canEdit?: boolean;
    users?: any[];
  } = {},
) {
  const { canEdit = false, users = [] } = overrides;

  return renderComponent(AdminGroupsMembershipListComponent, {
    declarations: [AdminGroupsMembershipListComponent],
    imports: [MatTableModule, MatSortModule, MatPaginatorModule, MatSnackBarModule],
    componentProperties: {
      canEdit,
      users,
    },
  });
}

describe('AdminGroupsMembershipListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderMembershipList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display Users header', async () => {
    await renderMembershipList();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('should show actions column when canEdit is true', async () => {
    const users = [{ id: 'u1', name: 'Alice' }];
    const { fixture } = await renderMembershipList({
      canEdit: true,
      users,
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.displayedColumns).toContain('actions');
  });

  it('should hide actions column when canEdit is false', async () => {
    const { fixture } = await renderMembershipList({ canEdit: false });
    fixture.detectChanges();
    expect(fixture.componentInstance.displayedColumns).not.toContain('actions');
  });

  it('should display user names in the table', async () => {
    const users = [
      { id: 'u1', name: 'Alice Smith' },
      { id: 'u2', name: 'Bob Jones' },
    ];
    await renderMembershipList({ users });
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });
});
