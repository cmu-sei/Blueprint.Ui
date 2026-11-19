// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import {
  Msel,
  MselItemStatus,
  MselRole,
} from 'src/app/generated/blueprint.api';
import {
  canFacilitate,
  canViewFacilitator,
  facilitatableMsels,
} from './facilitator-msels';

const ME = 'user-me';
const msel = (
  id: string,
  roles: MselRole[],
  extra: Partial<Msel> = {},
): Msel => ({
  id,
  name: id,
  status: MselItemStatus.Deployed,
  userMselRoles: roles.map((role) => ({ userId: ME, mselId: id, role })),
  ...extra,
});

describe('canFacilitate', () => {
  /**
   * Verifies: Owner and Facilitator can act on the Facilitator View; every other MSEL role cannot, Evaluator and Editor among them.
   * Data: one MSEL per role, each held by the user alone.
   */
  it.each(
    Object.values(MselRole).map((role) => ({
      role,
      expected: role === MselRole.Owner || role === MselRole.Facilitator,
    })),
  )('$role can facilitate: $expected', ({ role, expected }) => {
    expect(canFacilitate(msel('m', [role]), ME, false)).toBe(expected);
  });

  /**
   * Verifies: the creator counts as Owner, EditMsels grants it without a role, a template is never run, and another user's role grants nothing.
   * Data: a MSEL the user created; a roleless MSEL with EditMsels; a template the user facilitates; a MSEL whose Facilitator is someone else.
   */
  it('counts the creator and EditMsels, but never a template or another user', () => {
    expect(canFacilitate(msel('m', [], { createdBy: ME }), ME, false)).toBe(
      true,
    );
    expect(canFacilitate(msel('m', []), ME, true)).toBe(true);
    expect(
      canFacilitate(
        msel('m', [MselRole.Facilitator], { isTemplate: true }),
        ME,
        true,
      ),
    ).toBe(false);
    expect(
      canFacilitate(
        msel('m', [], {
          userMselRoles: [
            { userId: 'other', mselId: 'm', role: MselRole.Facilitator },
          ],
        }),
        ME,
        false,
      ),
    ).toBe(false);
  });
});

describe('canViewFacilitator', () => {
  /**
   * Verifies: Owner, Facilitator, Editor and Approver can open the Facilitator View; Evaluator, MoveEditor and Viewer cannot.
   * Data: one MSEL per role, each held by the user alone.
   */
  it.each(
    Object.values(MselRole).map((role) => ({
      role,
      expected: (
        [
          MselRole.Owner,
          MselRole.Facilitator,
          MselRole.Editor,
          MselRole.Approver,
        ] as MselRole[]
      ).includes(role),
    })),
  )('$role can view: $expected', ({ role, expected }) => {
    expect(canViewFacilitator(msel('m', [role]), ME, false)).toBe(expected);
  });

  /**
   * Verifies: ViewMsels opens it without a role, and an Evaluator who is also an Editor can open it.
   * Data: a roleless MSEL with ViewMsels; a MSEL where the user holds Evaluator and Editor.
   */
  it('counts ViewMsels and every role the user holds', () => {
    expect(canViewFacilitator(msel('m', []), ME, true)).toBe(true);
    expect(
      canViewFacilitator(
        msel('m', [MselRole.Evaluator, MselRole.Editor]),
        ME,
        false,
      ),
    ).toBe(true);
    expect(canViewFacilitator(undefined, ME, true)).toBe(false);
  });
});

describe('facilitatableMsels', () => {
  /**
   * Verifies: the Facilitate list is the deployed MSELs whose Facilitator View the user can open.
   * Data: deployed as Facilitator, deployed as Editor (read-only), approved as Facilitator, deployed as Evaluator.
   */
  it('lists the deployed MSELs the user can open the Facilitator View of', () => {
    const msels = [
      msel('run', [MselRole.Facilitator]),
      msel('watch', [MselRole.Editor]),
      msel('draft', [MselRole.Facilitator], {
        status: MselItemStatus.Approved,
      }),
      msel('assess', [MselRole.Evaluator]),
    ];

    expect(facilitatableMsels(msels, ME, false).map((m) => m.id)).toEqual([
      'run',
      'watch',
    ]);
    expect(facilitatableMsels(undefined, ME, false)).toEqual([]);
  });
});
