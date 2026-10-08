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
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { CiteAction, CiteActionService, Msel, MselRole } from 'src/app/generated/blueprint.api';
import { CiteActionStore } from 'src/app/data/cite-action/cite-action.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { CiteActionListComponent } from './cite-action-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';

const ME = 'user-me';
const TEMPLATE: CiteAction = { id: 'ca-t', description: 'Template action', isTemplate: true, mselId: null, moveNumber: 0, actionNumber: 0 };
const MSEL_ACTION: CiteAction = { id: 'ca-1', description: 'Isolate the host', mselId: 'msel-1', moveNumber: 1, actionNumber: 1, teamId: '' };

function msel(overrides: Partial<Msel> = {}): Msel {
  return { id: 'msel-1', name: 'Exercise Alpha', createdBy: 'someone-else', userMselRoles: [], ...overrides };
}

async function renderCiteActions(
  overrides: { canEdit?: boolean; showTemplates?: boolean; activeMsel?: Msel | null } = {},
) {
  const { canEdit = true, showTemplates = false, activeMsel = msel() } = overrides;
  const citeActionApi = {
    getCiteActionTemplates: vi.fn(() => of([structuredClone(TEMPLATE)])),
    deleteCiteAction: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<CiteActionService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(CiteActionListComponent, {
    imports: [
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatMenuModule,
      MatPaginatorModule,
      MatSelectModule,
      MatSortModule,
      MatTableModule,
    ],
    declarations: [CiteActionListComponent],
    providers: [
      { provide: CiteActionService, useValue: citeActionApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
      // The MSEL page loads the MSEL and its actions; the stores are seeded
      // instead. The admin page has no active MSEL.
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
        provide: CiteActionStore,
        useFactory: () => {
          const store = new CiteActionStore();
          store.set([structuredClone(MSEL_ACTION)]);
          return store;
        },
      },
    ],
    inputs: { canEdit, showTemplates, loggedInUserId: ME },
  });
  return { ...rendered, citeActionApi, confirm };
}

const table = () => screen.getByRole('table');
const TEMPLATE_HEADER = [
  'Add a template CITE Action',
  'Upload CITE Action templates from JSON',
  'Download CITE Action templates as JSON',
];
const MSEL_ROW = ['Edit Isolate the host', 'Delete Isolate the host', 'Make Isolate the host a template'];

describe('CiteActionListComponent', () => {
  describe('templates (admin)', () => {
    /**
     * Verifies: with canEdit the template list offers add, upload, download, edit and delete.
     * Interacts with: CiteActionService.getCiteActionTemplates (stub), real CiteActionDataService and CiteActionQuery.
     * Data: showTemplates true; canEdit true; no active MSEL; one template and one MSEL action.
     */
    it('offers template actions with canEdit', async () => {
      const { citeActionApi } = await renderCiteActions({ showTemplates: true, canEdit: true, activeMsel: null });

      expect(citeActionApi.getCiteActionTemplates).toHaveBeenCalledTimes(1);
      for (const title of TEMPLATE_HEADER) {
        expect(within(table()).getByTitle(title)).toBeInTheDocument();
      }
      expect(within(table()).getByRole('button', { name: 'Edit Template action' })).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Delete Template action' })).toBeInTheDocument();
      expect(within(table()).queryByText('Isolate the host')).not.toBeInTheDocument();
    });

    /**
     * Verifies: without canEdit the template list is read-only.
     * Interacts with: CiteActionService.getCiteActionTemplates (stub), CiteActionListComponent template.
     * Data: showTemplates true; canEdit false; no active MSEL.
     */
    it('hides template actions without canEdit', async () => {
      await renderCiteActions({ showTemplates: true, canEdit: false, activeMsel: null });

      expect(within(table()).getByText('Template action')).toBeInTheDocument();
      for (const title of TEMPLATE_HEADER) {
        expect(within(table()).queryByTitle(title)).not.toBeInTheDocument();
      }
      expect(within(table()).queryByRole('button', { name: 'Edit Template action' })).not.toBeInTheDocument();
      expect(within(table()).queryByRole('button', { name: 'Delete Template action' })).not.toBeInTheDocument();
    });
  });

  describe('MSEL actions', () => {
    /**
     * Verifies: with canEdit the MSEL's actions can be added, edited, deleted and made into templates.
     * Interacts with: real MselStore/MselQuery (active MSEL), real CiteActionStore/CiteActionQuery (seeded).
     * Data: showTemplates false; canEdit true; the user holds no MSEL role.
     */
    it('offers action buttons with canEdit', async () => {
      await renderCiteActions({ canEdit: true });

      expect(within(table()).getByTitle('Add CITE Action')).toBeInTheDocument();
      for (const name of MSEL_ROW) {
        expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
      }
    });

    /**
     * Verifies: the MSEL owner may add, edit and delete actions without canEdit, but not make templates.
     * Interacts with: MselPlus.hasRole (owner by role), CiteActionListComponent template.
     * Data: showTemplates false; canEdit false; the user holds the MSEL Owner role.
     */
    it('lets the MSEL owner edit actions without canEdit, but not make templates', async () => {
      await renderCiteActions({
        canEdit: false,
        activeMsel: msel({ userMselRoles: [{ id: 'umr-1', userId: ME, mselId: 'msel-1', role: MselRole.Owner }] }),
      });

      expect(within(table()).getByTitle('Add CITE Action')).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Edit Isolate the host' })).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Delete Isolate the host' })).toBeInTheDocument();
      expect(within(table()).queryByRole('button', { name: 'Make Isolate the host a template' })).not.toBeInTheDocument();
    });

    /**
     * Verifies: a non-owner without canEdit sees the actions but no action button, even as an MSEL Approver.
     * Interacts with: MselPlus.hasRole, CiteActionListComponent template.
     * Data: showTemplates false; canEdit false; the user is an MSEL Approver (near miss: not Owner).
     */
    it('hides action buttons without canEdit for a non-owner', async () => {
      await renderCiteActions({
        canEdit: false,
        activeMsel: msel({ userMselRoles: [{ id: 'umr-1', userId: ME, mselId: 'msel-1', role: MselRole.Approver }] }),
      });

      expect(within(table()).getByText('Isolate the host')).toBeInTheDocument();
      expect(within(table()).queryByTitle('Add CITE Action')).not.toBeInTheDocument();
      for (const name of MSEL_ROW) {
        expect(within(table()).queryByRole('button', { name })).not.toBeInTheDocument();
      }
    });

    /**
     * Verifies: confirming Delete removes the action through the API and from the list.
     * Interacts with: CrucibleDialogService.confirm (stub, confirms), CiteActionService.deleteCiteAction (stub), real CiteActionStore.
     * Data: showTemplates false; canEdit true.
     */
    it('deletes an action after confirmation', async () => {
      const { citeActionApi, confirm } = await renderCiteActions({ canEdit: true });
      const user = userEvent.setup();

      await user.click(within(table()).getByRole('button', { name: 'Delete Isolate the host' }));

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(citeActionApi.deleteCiteAction).toHaveBeenCalledWith('ca-1');
      expect(within(table()).queryByText('Isolate the host')).not.toBeInTheDocument();
    });
  });
});
