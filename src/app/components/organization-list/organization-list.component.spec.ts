// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Msel, MselRole, Organization, OrganizationService } from 'src/app/generated/blueprint.api';
import { MselStore } from 'src/app/data/msel/msel.store';
import { OrganizationStore } from 'src/app/data/organization/organization.store';
import { OrganizationListComponent } from './organization-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';

const ME = 'user-me';
const TEMPLATE: Organization = { id: 'org-t', name: 'Template Agency', shortName: 'TA', summary: 'A template', isTemplate: true, mselId: null };
const MSEL_ORG: Organization = { id: 'org-1', name: 'City Police', shortName: 'CPD', summary: 'Local police', mselId: 'msel-1' };

function msel(overrides: Partial<Msel> = {}): Msel {
  return { id: 'msel-1', name: 'Exercise Alpha', createdBy: 'someone-else', userMselRoles: [], ...overrides };
}

async function renderOrganizations(
  overrides: { canEdit?: boolean; showTemplates?: boolean; activeMsel?: Msel | null } = {},
) {
  const { canEdit = true, showTemplates = false, activeMsel = msel() } = overrides;
  const organizationApi = {
    getOrganizationTemplates: vi.fn(() => of([structuredClone(TEMPLATE)])),
    deleteOrganization: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<OrganizationService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(OrganizationListComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatMenuModule,
      MatPaginatorModule,
      MatSortModule,
      MatTableModule,
    ],
    declarations: [OrganizationListComponent],
    providers: [
      { provide: OrganizationService, useValue: organizationApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
      // The MSEL page loads the MSEL and its organizations; the stores are
      // seeded instead.
      {
        provide: MselStore,
        useFactory: () => {
          const store = new MselStore();
          if (activeMsel) {
            store.set([activeMsel]);
            store.setActive(activeMsel.id);
          }
          return store;
        },
      },
      {
        provide: OrganizationStore,
        useFactory: () => {
          const store = new OrganizationStore();
          store.set([structuredClone(MSEL_ORG)]);
          return store;
        },
      },
    ],
    inputs: { canEdit, showTemplates, loggedInUserId: ME },
  });
  return { ...rendered, organizationApi, confirm };
}

const table = () => screen.getByRole('table');
const TEMPLATE_HEADER = [
  'Add a template organization',
  'Upload Organization templates from JSON',
  'Download Organization templates as JSON',
];
const MSEL_ROW = ['Edit City Police', 'Delete City Police', 'Make City Police a template'];

describe('OrganizationListComponent', () => {
  describe('templates (admin)', () => {
    /**
     * Verifies: with canEdit the template list loads the templates and offers add, upload, download, edit and delete.
     * Interacts with: OrganizationService.getOrganizationTemplates (stub), real OrganizationDataService and OrganizationQuery.
     * Data: showTemplates true; canEdit true; no active MSEL.
     */
    it('offers template actions with canEdit', async () => {
      const { organizationApi } = await renderOrganizations({ showTemplates: true, canEdit: true, activeMsel: null });

      expect(organizationApi.getOrganizationTemplates).toHaveBeenCalledTimes(1);
      for (const title of TEMPLATE_HEADER) {
        expect(within(table()).getByTitle(title)).toBeInTheDocument();
      }
      expect(within(table()).getByRole('button', { name: 'Edit Template Agency' })).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Delete Template Agency' })).toBeInTheDocument();
      expect(within(table()).queryByText('City Police')).not.toBeInTheDocument();
    });

    /**
     * Verifies: without canEdit the template list is read-only, even for the owner of the active MSEL.
     * Interacts with: MselPlus.hasRole, OrganizationListComponent template.
     * Data: showTemplates true; canEdit false; the active MSEL was created by the user (near miss: owner of a MSEL, not a template manager).
     */
    it('hides template actions without canEdit, even for an MSEL owner', async () => {
      await renderOrganizations({ showTemplates: true, canEdit: false, activeMsel: msel({ createdBy: ME }) });

      expect(within(table()).getByText('Template Agency')).toBeInTheDocument();
      for (const title of TEMPLATE_HEADER) {
        expect(within(table()).queryByTitle(title)).not.toBeInTheDocument();
      }
      expect(within(table()).queryByRole('button', { name: 'Edit Template Agency' })).not.toBeInTheDocument();
      expect(within(table()).queryByRole('button', { name: 'Delete Template Agency' })).not.toBeInTheDocument();
    });
  });

  describe('MSEL organizations', () => {
    /**
     * Verifies: with canEdit the MSEL's organizations can be added, edited, deleted and made into templates.
     * Interacts with: real MselStore/MselQuery (active MSEL), real OrganizationStore/OrganizationQuery (seeded).
     * Data: showTemplates false; canEdit true; the user holds no MSEL role.
     */
    it('offers organization buttons with canEdit', async () => {
      await renderOrganizations({ canEdit: true });

      expect(within(table()).getByTitle('Add organization')).toBeInTheDocument();
      for (const name of MSEL_ROW) {
        expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
      }
    });

    /**
     * Verifies: the MSEL owner may add, edit and delete organizations without canEdit, but not make templates.
     * Interacts with: MselPlus.hasRole (owner by role), OrganizationListComponent template.
     * Data: showTemplates false; canEdit false; the user holds the MSEL Owner role.
     */
    it('lets the MSEL owner edit organizations without canEdit, but not make templates', async () => {
      await renderOrganizations({
        canEdit: false,
        activeMsel: msel({ userMselRoles: [{ id: 'umr-1', userId: ME, mselId: 'msel-1', role: MselRole.Owner }] }),
      });

      expect(within(table()).getByTitle('Add organization')).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Edit City Police' })).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Delete City Police' })).toBeInTheDocument();
      expect(within(table()).queryByRole('button', { name: 'Make City Police a template' })).not.toBeInTheDocument();
    });

    /**
     * Verifies: a non-owner without canEdit sees the organizations but no button, even as an MSEL Editor.
     * Interacts with: MselPlus.hasRole, OrganizationListComponent template.
     * Data: showTemplates false; canEdit false; the user is an MSEL Editor (near miss: not Owner).
     */
    it('hides organization buttons without canEdit for a non-owner', async () => {
      await renderOrganizations({
        canEdit: false,
        activeMsel: msel({ userMselRoles: [{ id: 'umr-1', userId: ME, mselId: 'msel-1', role: MselRole.Editor }] }),
      });

      expect(within(table()).getByText('City Police')).toBeInTheDocument();
      expect(within(table()).queryByTitle('Add organization')).not.toBeInTheDocument();
      for (const name of MSEL_ROW) {
        expect(within(table()).queryByRole('button', { name })).not.toBeInTheDocument();
      }
    });

    /**
     * Verifies: confirming Delete removes the organization through the API and from the list.
     * Interacts with: CrucibleDialogService.confirm (stub, confirms), OrganizationService.deleteOrganization (stub), real OrganizationStore.
     * Data: showTemplates false; canEdit true.
     */
    it('deletes an organization after confirmation', async () => {
      const { organizationApi, confirm } = await renderOrganizations({ canEdit: true });
      const user = userEvent.setup();

      await user.click(within(table()).getByRole('button', { name: 'Delete City Police' }));

      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Organization' }));
      expect(organizationApi.deleteOrganization).toHaveBeenCalledWith('org-1');
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });
});
