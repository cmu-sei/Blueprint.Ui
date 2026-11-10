// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { InjectType, InjectTypeService } from 'src/app/generated/blueprint.api';
import { InjectTypeStore } from 'src/app/data/inject-type/inject-type.store';
import { AdminInjectTypesComponent } from './admin-inject-types.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { unstubbed } from 'src/app/test-utils/unstubbed';
import { DataFieldListComponent } from '../../data-field-list/data-field-list.component';
import { InjectListComponent } from '../../inject-list/inject-list.component';

@Component({ selector: 'app-data-field-list', template: '' })
class DataFieldListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly showTemplates = input<boolean>(undefined);
  readonly userTheme = input<unknown>(undefined);
  readonly injectTypeId = input<string>(undefined);
}
@Component({ selector: 'app-inject-list', template: '' })
class InjectListStub {
  readonly loggedInUserId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly isEditMode = input<boolean>(undefined);
  readonly catalog = input<unknown>(undefined);
  readonly injectType = input<InjectType>(undefined);
  readonly injectList = input<unknown>(undefined);
  readonly selectedInjectIdList = output<string[]>();
}

const EMAIL: InjectType = { id: 'it-email', name: 'Email', description: 'An email inject' };

async function renderInjectTypes(overrides: { canEdit?: boolean } = {}) {
  const { canEdit = true } = overrides;
  const injectTypeApi = {
    deleteInjectType: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<InjectTypeService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(AdminInjectTypesComponent, {
    imports: [
      MatButtonModule,
      MatExpansionModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatPaginatorModule,
      MatRippleModule,
      MatSortModule,
      MatTableModule,
    ],
    childStubs: [
      { replace: DataFieldListComponent, with: DataFieldListStub },
      { replace: InjectListComponent, with: InjectListStub },
    ],
    providers: [
      { provide: InjectTypeService, useValue: injectTypeApi },
      { provide: CrucibleDialogService, useValue: dialog },
      // The admin container loads the inject types; the store is seeded instead.
      {
        provide: InjectTypeStore,
        useFactory: () => {
          const store = new InjectTypeStore();
          store.set([structuredClone(EMAIL)]);
          return store;
        },
      },
      unstubbed(MatDialog),
    ],
    inputs: { canEdit, loggedInUserId: 'user-1' },
  });
  return { ...rendered, injectTypeApi, confirm };
}

const table = () => screen.getByRole('table');
const ROW_ACTIONS = ['Edit Email injectType', 'Copy Email', 'Delete Email injectType'];
const HEADER_ACTIONS = ['Add new inject type', 'Upload Inject Types from JSON', 'Download Inject Types as JSON'];

function injectList(fixture: ComponentFixture<unknown>): InjectListStub {
  return fixture.debugElement.query(By.directive(InjectListStub)).componentInstance;
}

describe('AdminInjectTypesComponent', () => {
  /**
   * Verifies: with canEdit the header actions and every row action are offered.
   * Interacts with: real InjectTypeStore/InjectTypeQuery (seeded), AdminInjectTypesComponent template.
   * Data: canEdit true; inject type Email.
   */
  it('offers header and row actions with canEdit', async () => {
    await renderInjectTypes({ canEdit: true });

    for (const title of HEADER_ACTIONS) {
      expect(within(table()).getByTitle(title)).toBeInTheDocument();
    }
    for (const name of ROW_ACTIONS) {
      expect(within(table()).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  /**
   * Verifies: without canEdit the inject type is listed but the header and row actions are absent.
   * Interacts with: real InjectTypeStore/InjectTypeQuery (seeded), AdminInjectTypesComponent template.
   * Data: canEdit false; inject type Email; loggedInUserId set (not the owner of the component's empty MSEL).
   */
  it('hides header and row actions without canEdit', async () => {
    await renderInjectTypes({ canEdit: false });

    expect(within(table()).getByText('Email')).toBeInTheDocument();
    for (const title of HEADER_ACTIONS) {
      expect(within(table()).queryByTitle(title)).not.toBeInTheDocument();
    }
    for (const name of ROW_ACTIONS) {
      expect(within(table()).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  /**
   * Verifies: expanding a row shows its data fields and injects, and passes canEdit to the inject list.
   * Interacts with: row click, child stubs' inputs.
   * Data: canEdit true and false; inject type Email.
   */
  it.each([true, false])('passes canEdit %s to the expanded inject list', async (canEdit) => {
    const { fixture } = await renderInjectTypes({ canEdit });
    const user = userEvent.setup();

    await user.click(within(table()).getByText('Email'));

    const list = injectList(fixture);
    expect(list.canEdit()).toBe(canEdit);
    expect(list.injectType()).toEqual(EMAIL);
    expect(fixture.debugElement.query(By.directive(DataFieldListStub)).componentInstance.injectTypeId()).toBe('it-email');
  });

  /**
   * Verifies: confirming Delete removes the inject type through the API and from the list.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), InjectTypeService.deleteInjectType (stub), real InjectTypeStore.
   * Data: canEdit true; inject type Email.
   */
  it('deletes an inject type after confirmation', async () => {
    const { injectTypeApi, confirm } = await renderInjectTypes({ canEdit: true });
    const user = userEvent.setup();

    await user.click(within(table()).getByRole('button', { name: 'Delete Email injectType' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete InjectType' }));
    expect(injectTypeApi.deleteInjectType).toHaveBeenCalledWith('it-email');
    expect(within(table()).queryByText('Email')).not.toBeInTheDocument();
  });
});
