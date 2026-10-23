// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { DataField, DataFieldType, Injectm } from 'src/app/generated/blueprint.api';
import { InjectEditDialogComponent } from './inject-edit-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

@Component({ selector: 'app-data-value', template: '', standalone: false })
class DataValueStub {
  @Input() value: string;
  @Output() valueChange = new EventEmitter<string>();
  @Input() dataField: DataField;
  @Input() canEdit: boolean;
  @Input() canApprove: boolean;
  @Input() isOwner: boolean;
  @Input() showValueOnly: boolean;
  @Input() organizationOptions: unknown[];
  @Input() teamOptions: unknown[];
  @Input() unitOptions: unknown[];
  @Input() cardOptions: unknown[];
  @Input() moveOptions: unknown[];
  @Input() gallerySourceTypeOptions: unknown[];
  @Input() galleryItemStatusOptions: string[];
  @Input() userOptions: unknown[];
}

const SUBJECT: DataField = { id: 'df-subject', name: 'Subject', dataType: DataFieldType.String };
const WHEN: DataField = { id: 'df-when', name: 'When', dataType: DataFieldType.DateTime };

function injectData(overrides: { isEditMode?: boolean; inject?: Injectm; dataFieldList?: DataField[] } = {}) {
  const { isEditMode = true, inject = { id: 'inj-1', name: 'Phish', description: 'Phishing email', dataValues: [{ id: 'dv-1', dataFieldId: 'df-subject', value: 'Urgent' }] }, dataFieldList = [SUBJECT] } = overrides;
  return {
    inject,
    dataFieldList,
    isEditMode,
    isNewInject: false,
    unitList: [],
    userList: [],
    injectList: [inject, { id: 'inj-2', name: 'Ransom note', description: 'Ransom' }],
  };
}

async function renderInjectEdit(data = injectData()) {
  const rendered = await renderComponent(InjectEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, MatFormFieldModule, MatInputModule, MatSelectModule],
    declarations: [InjectEditDialogComponent, DataValueStub],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const results: unknown[] = [];
  rendered.fixture.componentInstance.editComplete.subscribe((r) => results.push(r));
  return { ...rendered, data, results };
}

describe('InjectEditDialogComponent', () => {
  /**
   * Verifies: in edit mode each data field's value is editable, not approvable, and not shown as a plain value.
   * Interacts with: DataValueStub inputs.
   * Data: isEditMode true; data field Subject with value Urgent.
   */
  it('lets data values be edited in edit mode', async () => {
    const { fixture } = await renderInjectEdit(injectData({ isEditMode: true }));

    const value = fixture.debugElement.query(By.directive(DataValueStub)).componentInstance as DataValueStub;
    expect(value.dataField).toEqual(SUBJECT);
    expect(value.value).toBe('Urgent');
    expect(value.canEdit).toBe(true);
    expect(value.showValueOnly).toBe(false);
    expect(value.canApprove).toBe(false);
  });

  /**
   * Verifies: outside edit mode each data field is shown read-only (canEdit false, value only).
   * Interacts with: DataValueStub inputs.
   * Data: isEditMode false.
   */
  it('shows data values read-only outside edit mode', async () => {
    const { fixture } = await renderInjectEdit(injectData({ isEditMode: false }));

    const value = fixture.debugElement.query(By.directive(DataValueStub)).componentInstance as DataValueStub;
    expect(value.canEdit).toBe(false);
    expect(value.showValueOnly).toBe(true);
    expect(value.canApprove).toBe(false);
  });

  /**
   * Verifies: Save emits the edited inject, and Cancel emits no inject.
   * Interacts with: crucible-dialog submit / cancel, editComplete output.
   * Data: inject Phish renamed to Phish v2.
   */
  it('emits the edited inject on Save and nothing on Cancel', async () => {
    const { data, results } = await renderInjectEdit();
    const user = userEvent.setup();

    await user.clear(screen.getByTitle('The Name of the Inject'));
    await user.type(screen.getByTitle('The Name of the Inject'), 'Phish v2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(results).toEqual([
      { saveChanges: true, inject: data.inject },
      { saveChanges: false, inject: null },
    ]);
    expect(data.inject.name).toBe('Phish v2');
  });

  /**
   * Verifies: Save is disabled while the name or description is empty.
   * Interacts with: errorFree, crucible-dialog submitDisabled.
   * Data: an inject with no description.
   */
  it('disables Save without a description', async () => {
    await renderInjectEdit(injectData({ inject: { id: 'inj-1', name: 'Phish', description: '', dataValues: [] } }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: a DateTime value that is not a date disables Save while it can be edited, and doesn't once the values are read-only, since it can't be fixed there.
   * Interacts with: errorFree, hasInvalidDataValue, crucible-dialog submitDisabled.
   * Data: When (DateTime) = "Team 2"; isEditMode true or false.
   */
  it.each([
    { isEditMode: true, disabled: true },
    { isEditMode: false, disabled: false },
  ])('sets Save disabled $disabled for a value that is not a date with isEditMode $isEditMode', async ({ isEditMode, disabled }) => {
    const inject = { id: 'inj-1', name: 'Phish', description: 'Phishing email', dataValues: [{ id: 'dv-1', dataFieldId: 'df-when', value: 'Team 2' }] };
    await renderInjectEdit(injectData({ isEditMode, inject, dataFieldList: [WHEN] }));

    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(disabled);
  });

  /**
   * Verifies: choosing another inject as the prerequisite sets requiresInjectId to the edited inject's own id (current behavior).
   * Interacts with: mat-select options, ngModel on requiresInjectId.
   * Data: editing Phish (inj-1); Ransom note (inj-2) chosen as prerequisite.
   */
  it('sets the inject as its own prerequisite when another inject is chosen', async () => {
    const { data } = await renderInjectEdit();
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Ransom note' }));

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(data.inject.requiresInjectId).toBe('inj-1');
  });

  /**
   * Verifies: handleEditComplete(true) emits the save for an inject with no description (current behavior).
   * Interacts with: handleEditComplete, editComplete output.
   * Data: an inject with no description.
   */
  it('saves an incomplete inject when handleEditComplete is called', async () => {
    const { fixture, data, results } = await renderInjectEdit(injectData({ inject: { id: 'inj-1', name: 'Phish', description: '', dataValues: [] } }));

    fixture.componentInstance.handleEditComplete(true);

    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(results).toEqual([{ saveChanges: true, inject: data.inject }]);
  });

});
