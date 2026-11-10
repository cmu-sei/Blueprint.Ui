// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Msel, MselItemStatus, MselRole } from 'src/app/generated/blueprint.api';
import { assessableMsels, canAssess, canViewAssessor } from './assessable-msels';

const ME = 'user-me';
const msel = (id: string, roles: MselRole[], extra: Partial<Msel> = {}): Msel => ({
  id,
  name: id,
  status: MselItemStatus.Deployed,
  userMselRoles: roles.map((role) => ({ userId: ME, mselId: id, role })),
  ...extra,
});

describe('canAssess', () => {
  /**
   * Verifies: Owner and Evaluator can assess; every other MSEL role cannot.
   * Data: one MSEL per role, each held by the user alone.
   */
  it.each(Object.values(MselRole).map((role) => ({ role, expected: role === MselRole.Owner || role === MselRole.Evaluator })))(
    '$role can assess: $expected',
    ({ role, expected }) => {
      expect(canAssess(msel('m', [role]), ME, false)).toBe(expected);
    },
  );

  /**
   * Verifies: every role row the user holds counts, not only the first.
   * Data: the user is Viewer first, then Evaluator, on the same MSEL.
   */
  it('checks every role the user holds on the MSEL', () => {
    expect(canAssess(msel('m', [MselRole.Viewer, MselRole.Evaluator]), ME, false)).toBe(true);
  });

  /**
   * Verifies: another user's Evaluator row grants nothing.
   * Data: Evaluator row for user-other (near miss on userId).
   */
  it("ignores another user's role", () => {
    const other = msel('m', [], { userMselRoles: [{ userId: 'user-other', mselId: 'm', role: MselRole.Evaluator }] });
    expect(canAssess(other, ME, false)).toBe(false);
  });

  /**
   * Verifies: a system admin can assess any MSEL but a template.
   * Data: no role rows; isSystemAdmin true; a template with an Owner row.
   */
  it('lets a system admin assess anything but a template', () => {
    expect(canAssess(msel('m', []), ME, true)).toBe(true);
    expect(canAssess(msel('t', [MselRole.Owner], { isTemplate: true }), ME, true)).toBe(false);
  });
});

describe('the MSEL creator', () => {
  /**
   * Verifies: a MSEL's creator is its Owner without a role row, for assessing and for viewing, as the API counts them.
   * Data: no role rows; createdBy the user; createdBy someone else (near miss).
   */
  it('counts the creator as Owner', () => {
    expect(canAssess(msel('m', [], { createdBy: ME }), ME, false)).toBe(true);
    expect(canViewAssessor(msel('m', [], { createdBy: ME }), ME, false)).toBe(true);
    expect(canAssess(msel('m', [], { createdBy: 'user-other' }), ME, false)).toBe(false);
  });
});

describe('canViewAssessor', () => {
  /**
   * Verifies: Owner, Editor, Approver and Evaluator can open the assessor view; Viewer and Move Editor cannot.
   * Data: one MSEL per role, each held by the user alone.
   */
  it.each(Object.values(MselRole).map((role) => ({
    role,
    expected: ([MselRole.Owner, MselRole.Editor, MselRole.Approver, MselRole.Evaluator] as MselRole[]).includes(role),
  })))('$role can view: $expected', ({ role, expected }) => {
    expect(canViewAssessor(msel('m', [role]), ME, false)).toBe(expected);
  });

  /**
   * Verifies: a template can be viewed but not assessed, so its checkboxes are never editable.
   * Data: a template with an Owner row.
   */
  it('lets a template be viewed but not assessed', () => {
    const template = msel('t', [MselRole.Owner], { isTemplate: true });
    expect(canViewAssessor(template, ME, false)).toBe(true);
    expect(canAssess(template, ME, false)).toBe(false);
  });
});

describe('assessableMsels', () => {
  /**
   * Verifies: only Deployed MSELs the user can assess are listed, in their original order.
   * Data: Deployed Owner, Approved Owner (near miss on status), Deployed Viewer, Deployed Evaluator.
   */
  it('lists the deployed MSELs the user can assess', () => {
    const list = [
      msel('deployed-owner', [MselRole.Owner]),
      msel('approved-owner', [MselRole.Owner], { status: MselItemStatus.Approved }),
      msel('deployed-viewer', [MselRole.Viewer]),
      msel('deployed-evaluator', [MselRole.Evaluator]),
    ];

    expect(assessableMsels(list, ME, false).map((m) => m.id)).toEqual(['deployed-owner', 'deployed-evaluator']);
  });

  /**
   * Verifies: a missing list is treated as empty.
   * Data: undefined.
   */
  it('answers an empty list for no MSELs', () => {
    expect(assessableMsels(undefined, ME, false)).toEqual([]);
  });
});
