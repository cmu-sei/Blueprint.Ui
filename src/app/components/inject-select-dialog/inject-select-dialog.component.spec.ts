// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, EventEmitter, Output, input } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS, CrucibleDialogComponent, CrucibleDialogContentDirective } from '@cmusei/crucible-common';
import { Catalog, InjectType, Injectm } from 'src/app/generated/blueprint.api';
import { InjectSelectDialogComponent } from './inject-select-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

@Component({ selector: 'app-inject-list', template: '' })
class InjectListStub {
  readonly catalog = input<Catalog>(undefined);
  readonly injectType = input<InjectType>(undefined);
  readonly injectList = input<Injectm[]>(undefined);
  readonly isContentDeveloper = input<boolean>(undefined);
  readonly loggedInUserId = input<string>(undefined);
  @Output() selectedInjectIdList = new EventEmitter<string[]>();
}

const CATALOG: Catalog = { id: 'cat-1', name: 'Ransomware Catalog', injectTypeId: 'it-email' };

async function renderInjectSelect() {
  const data = { catalog: CATALOG, injectType: { id: 'it-email', name: 'Email' }, injectList: [], loggedInUserId: 'user-1' };
  const rendered = await renderComponent(InjectSelectDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS],
    // The component imports InjectListComponent through forwardRef, which
    // childStubs cannot match by class, so the imports list is set whole.
    configureTestBed: (testBed) => {
      testBed.overrideComponent(InjectSelectDialogComponent, {
        set: { imports: [CrucibleDialogComponent, CrucibleDialogContentDirective, InjectListStub] },
      });
    },
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, results };
}

function list(fixture: ComponentFixture<unknown>): InjectListStub {
  return fixture.debugElement.query(By.directive(InjectListStub)).componentInstance;
}

describe('InjectSelectDialogComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and lists the catalog's injects for selection.
   * Interacts with: getDefaultProviders (placeholders and stubs only), crucible-dialog, InjectListStub inputs.
   * Data: catalog Ransomware Catalog.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderInjectSelect();

    expect(fixture.componentInstance).toBeInstanceOf(InjectSelectDialogComponent);
    expect(screen.getByRole('heading', { name: 'Select Injects to Add' })).toBeInTheDocument();
    expect(list(fixture).catalog()).toEqual(CATALOG);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  /**
   * Verifies: once injects are selected Add emits their ids, and Cancel emits none.
   * Interacts with: InjectListStub selectedInjectIdList output, crucible-dialog submit and cancel.
   * Data: injects inj-1 and inj-2 selected.
   */
  it('emits the selected injects on Add and none on Cancel', async () => {
    const { fixture, results } = await renderInjectSelect();
    const user = userEvent.setup();

    list(fixture).selectedInjectIdList.emit(['inj-1', 'inj-2']);
    fixture.detectChanges();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, selectedInjectIdList: ['inj-1', 'inj-2'] },
      { saveChanges: false, inject: null },
    ]);
  });

  /**
   * Verifies: handleEditComplete(true) emits the save with nothing selected (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: no inject selected.
   */
  it('saves an empty selection when handleEditComplete is called', async () => {
    const { fixture, results } = await renderInjectSelect();

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, selectedInjectIdList: [] }]);
  });
});
