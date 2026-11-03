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
import { CiteDuty, CiteDutyService, Msel, MselRole } from 'src/app/generated/blueprint.api';
import { CiteDutyStore } from 'src/app/data/cite-duty/cite-duty.store';
import { MselStore } from 'src/app/data/msel/msel.store';
import { CiteDutyListComponent } from './cite-duty-list.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';

const ME = 'user-me';
const TEMPLATE: CiteDuty = { id: 'cd-t', name: 'Template duty', isTemplate: true, mselId: null };
const MSEL_DUTY: CiteDuty = { id: 'cd-1', name: 'Incident commander', mselId: 'msel-1', teamId: '' };

function msel(overrides: Partial<Msel> = {}): Msel {
  return { id: 'msel-1', name: 'Exercise Alpha', createdBy: 'someone-else', userMselRoles: [], ...overrides };
}

async function renderCiteDuties(
  overrides: { canEdit?: boolean; showTemplates?: boolean; activeMsel?: Msel | null } = {},
) {
  const { canEdit = true, showTemplates = false, activeMsel = msel() } = overrides;
  const citeDutyApi = {
    getCiteDutyTemplates: vi.fn(() => of([structuredClone(TEMPLATE)])),
    deleteCiteDuty: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<CiteDutyService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(CiteDutyListComponent, {
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
    declarations: [CiteDutyListComponent],
    providers: [
      { provide: CiteDutyService, useValue: citeDutyApi },
      { provide: CrucibleDialogService, useValue: dialog },
      unstubbed(MatDialog),
      // The MSEL page loads the MSEL and its duties; the stores are seeded
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
        provide: CiteDutyStore,
        useFactory: () => {
          const store = new CiteDutyStore();
          store.set([structuredClone(MSEL_DUTY)]);
          return store;
        },
      },
    ],
    inputs: { canEdit, showTemplates, loggedInUserId: ME },
  });
  return { ...rendered, citeDutyApi, confirm };
}

const table = () => screen.getByRole('table');
const TEMPLATE_HEADER = [
  'Add a template CITE Duty',
  'Upload CITE Duty templates from JSON',
  'Download CITE Duty templates as JSON',
];
const MSEL_ROW = ['Edit this duty', 'Delete Incident commander', 'Make Incident commander a template'];

describe('CiteDutyListComponent', () => {
  describe('templates (admin)', () => {
    /**
     * Verifies: with canEdit the template list offers add, upload, download, edit and delete.
     * Interacts with: CiteDutyService.getCiteDutyTemplates (stub), real CiteDutyDataService and CiteDutyQuery.
     * Data: showTemplates true; canEdit true; no active MSEL; one template and one MSEL duty.
     */
    it('offers template actions with canEdit', async () => {
      const { citeDutyApi } = await renderCiteDuties({ showTemplates: true, canEdit: true, activeMsel: null });

      expect(citeDutyApi.getCiteDutyTemplates).toHaveBeenCalledTimes(1);
      for (const title of TEMPLATE_HEADER) {
        expect(within(table()).getByTitle(title)).toBeInTheDocument();
      }
      expect(within(table()).getByRole('button', { name: 'Edit this duty' })).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Delete Template duty' })).toBeInTheDocument();
      expect(within(table()).queryByText('Incident commander')).not.toBeInTheDocument();
    });

    /**
     * Verifies: without canEdit the template list is read-only.
     * Interacts with: CiteDutyService.getCiteDutyTemplates (stub), CiteDutyListComponent template.
     * Data: showTemplates true; canEdit false; no active MSEL.
     */
    it('hides template actions without canEdit', async () => {
      await renderCiteDuties({ showTemplates: true, canEdit: false, activeMsel: null });

      expect(within(table()).getByText('Template duty')).toBeInTheDocument();
      for (const title of TEMPLATE_HEADER) {
        expect(within(table()).queryByTitle(title)).not.toBeInTheDocument();
      }
      expect(within(table()).queryByRole('button', { name: 'Edit this duty' })).not.toBeInTheDocument();
      expect(within(table()).queryByRole('button', { name: 'Delete Template duty' })).not.toBeInTheDocument();
    });
  });

  describe('MSEL duties', () => {
    /**
     * Verifies: with canEdit the MSEL's duties can be added, edited, deleted and made into templates.
     * Interacts with: real MselStore/MselQuery (active MSEL), real CiteDutyStore/CiteDutyQuery (seeded).
     * Data: showTemplates false; canEdit true; the user holds no MSEL role.
     */
    it('offers duty buttons with canEdit', async () => {
      await renderCiteDuties({ canEdit: true });

      expect(within(table()).getByTitle('Add CITE Duty')).toBeInTheDocument();
      for (const name of MSEL_ROW) {
        expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
      }
    });

    /**
     * Verifies: the MSEL owner may add, edit and delete duties without canEdit, but not make templates.
     * Interacts with: MselPlus.hasRole (owner by createdBy), CiteDutyListComponent template.
     * Data: showTemplates false; canEdit false; the MSEL was created by the user.
     */
    it('lets the MSEL owner edit duties without canEdit, but not make templates', async () => {
      await renderCiteDuties({ canEdit: false, activeMsel: msel({ createdBy: ME }) });

      expect(within(table()).getByTitle('Add CITE Duty')).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Edit this duty' })).toBeInTheDocument();
      expect(within(table()).getByRole('button', { name: 'Delete Incident commander' })).toBeInTheDocument();
      expect(within(table()).queryByRole('button', { name: 'Make Incident commander a template' })).not.toBeInTheDocument();
    });

    /**
     * Verifies: a non-owner without canEdit sees the duties but no duty button, even as an MSEL Editor.
     * Interacts with: MselPlus.hasRole, CiteDutyListComponent template.
     * Data: showTemplates false; canEdit false; the user is an MSEL Editor (near miss: not Owner).
     */
    it('hides duty buttons without canEdit for a non-owner', async () => {
      await renderCiteDuties({
        canEdit: false,
        activeMsel: msel({ userMselRoles: [{ id: 'umr-1', userId: ME, mselId: 'msel-1', role: MselRole.Editor }] }),
      });

      expect(within(table()).getByText('Incident commander')).toBeInTheDocument();
      expect(within(table()).queryByTitle('Add CITE Duty')).not.toBeInTheDocument();
      for (const name of MSEL_ROW) {
        expect(within(table()).queryByRole('button', { name })).not.toBeInTheDocument();
      }
    });

    /**
     * Verifies: confirming Delete removes the duty through the API and from the list.
     * Interacts with: CrucibleDialogService.confirm (stub, confirms), CiteDutyService.deleteCiteDuty (stub), real CiteDutyStore.
     * Data: showTemplates false; canEdit true.
     */
    it('deletes a duty after confirmation', async () => {
      const { citeDutyApi, confirm } = await renderCiteDuties({ canEdit: true });
      const user = userEvent.setup();

      await user.click(within(table()).getByRole('button', { name: 'Delete Incident commander' }));

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm).toHaveBeenCalledWith({
        title: 'Delete CITE Duty',
        message: 'Are you sure that you want to delete Incident commander?',
        confirmText: 'Delete',
      });
      expect(citeDutyApi.deleteCiteDuty).toHaveBeenCalledWith('cd-1');
      expect(within(table()).queryByText('Incident commander')).not.toBeInTheDocument();
    });
  });
});
