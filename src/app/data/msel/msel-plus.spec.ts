// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import {
  DataFieldType,
  Msel,
  MselRole,
  UserMselRole,
} from 'src/app/generated/blueprint.api';
import { MselPlus } from './msel-data.service';

const ME = 'user-me';
const OTHER = 'user-other';
const TEAM_FIELD_ID = 'df-team';
const EVENT_ID = 'se-1';

function role(userId: string, mselRole: MselRole): UserMselRole {
  return { id: `${userId}-${mselRole}`, userId, mselId: 'msel-1', role: mselRole };
}

// MselPlus is the class the components wrap MSELs in (Object.assign(new
// MselPlus(), msel)) so templates can call hasRole().
function mselPlus(overrides: Partial<Msel> = {}): MselPlus {
  return Object.assign(new MselPlus(), {
    id: 'msel-1',
    name: 'Exercise Alpha',
    createdBy: 'user-creator',
    userMselRoles: [],
    ...overrides,
  });
}

// An MSEL whose se-1 event is assigned (through its Team data field) to the
// "RED" unit, which ME may or may not belong to.
function mselWithAssignedEvent(
  myRoles: MselRole[],
  { inUnit, assignedTo = 'RED' }: { inUnit: boolean; assignedTo?: string },
): MselPlus {
  return mselPlus({
    userMselRoles: myRoles.map((r) => role(ME, r)),
    dataFields: [
      { id: 'df-text', name: 'Title', dataType: DataFieldType.String },
      { id: TEAM_FIELD_ID, name: 'Assigned To', dataType: DataFieldType.Team },
    ],
    scenarioEvents: [
      {
        id: EVENT_ID,
        mselId: 'msel-1',
        dataValues: [
          { id: 'dv-1', dataFieldId: 'df-text', value: 'Phishing email' },
          { id: 'dv-2', dataFieldId: TEAM_FIELD_ID, value: assignedTo },
        ],
      },
      { id: 'se-2', mselId: 'msel-1', dataValues: [] },
    ],
    units: [
      {
        id: 'unit-red',
        shortName: 'RED',
        users: inUnit ? [{ id: ME, name: 'Me' }] : [{ id: OTHER, name: 'Other' }],
      },
    ],
  });
}

const NO_ROLES = {
  owner: false,
  moveEditor: false,
  approver: false,
  editor: false,
  evaluator: false,
  viewer: false,
};
const ALL_ROLES = {
  owner: true,
  moveEditor: true,
  approver: true,
  editor: true,
  evaluator: true,
  viewer: true,
};

describe('MselPlus.hasRole', () => {
  describe('owners', () => {
    /**
     * Verifies: the user who created the MSEL is its owner and holds every role.
     * Interacts with: MselPlus.hasRole.
     * Data: createdBy is ME; no explicit role assignments.
     */
    it('treats the creator as owner with every role', () => {
      const msel = mselPlus({ createdBy: ME });

      expect(msel.hasRole(ME, null)).toEqual(ALL_ROLES);
    });

    /**
     * Verifies: an explicit Owner assignment grants every role, even for a specific scenario event the owner is not assigned to.
     * Interacts with: MselPlus.hasRole.
     * Data: ME holds Owner; se-1 is assigned to a unit ME is not in.
     */
    it('treats an assigned Owner as owner with every role, for any event', () => {
      const msel = mselWithAssignedEvent([MselRole.Owner], { inUnit: false });

      expect(msel.hasRole(ME, null)).toEqual(ALL_ROLES);
      expect(msel.hasRole(ME, EVENT_ID)).toEqual(ALL_ROLES);
    });

    /**
     * Verifies: another user's Owner assignment grants nothing to the caller.
     * Interacts with: MselPlus.hasRole.
     * Data: OTHER holds Owner; ME holds nothing.
     */
    it('does not grant roles assigned to another user', () => {
      const msel = mselPlus({ userMselRoles: [role(OTHER, MselRole.Owner)] });

      expect(msel.hasRole(ME, null)).toEqual(NO_ROLES);
    });
  });

  describe('MSEL-wide roles (no scenario event)', () => {
    /**
     * Verifies: each MSEL role maps to the expected flags when no scenario event is given.
     * Interacts with: MselPlus.hasRole.
     * Data: ME holding exactly one role in each case.
     */
    it.each([
      [MselRole.Approver, { approver: true, editor: true, viewer: true }],
      [MselRole.Editor, { editor: true, viewer: true }],
      [MselRole.Evaluator, { evaluator: true, viewer: true }],
      [MselRole.MoveEditor, { moveEditor: true, viewer: true }],
      [MselRole.Viewer, { viewer: true }],
    ])('maps %s to its flags', (mselRole, granted) => {
      const msel = mselPlus({ userMselRoles: [role(ME, mselRole)] });

      expect(msel.hasRole(ME, null)).toEqual({ ...NO_ROLES, ...granted });
    });

    /**
     * Verifies: an empty-string event id is treated like no event (the form the list components use).
     * Interacts with: MselPlus.hasRole.
     * Data: ME holds Editor; scenario events exist; scenarioEventId ''.
     */
    it('treats an empty event id as the MSEL-wide check', () => {
      const msel = mselWithAssignedEvent([MselRole.Editor], { inUnit: false });

      expect(msel.hasRole(ME, '').editor).toBe(true);
    });

    /**
     * Verifies: a user with no assignments holds no roles.
     * Interacts with: MselPlus.hasRole.
     * Data: an empty role list.
     */
    it('grants nothing to an unassigned user', () => {
      expect(mselPlus().hasRole(ME, null)).toEqual(NO_ROLES);
    });

    /**
     * Verifies: an MSEL without a role list grants nothing, with owner reported as undefined rather than false.
     * Interacts with: MselPlus.hasRole.
     * Data: userMselRoles undefined.
     */
    it('grants nothing when the MSEL has no role list', () => {
      const roles = mselPlus({ userMselRoles: undefined }).hasRole(ME, null);

      // owner short-circuits on the missing list, so it is undefined (falsy)
      // rather than false; every template treats it as a boolean.
      expect(roles.owner).toBeUndefined();
      expect({ ...roles, owner: false }).toEqual(NO_ROLES);
    });
  });

  describe('scenario-event roles', () => {
    /**
     * Verifies: for a specific event, a non-owner gets their MSEL roles only if they belong to the unit the event is assigned to.
     * Interacts with: MselPlus.hasRole (Team data field → data value → unit membership).
     * Data: ME holds Editor and Approver; se-1 assigned to RED; ME in RED.
     */
    it('grants MSEL roles on an event assigned to the user\'s unit', () => {
      const msel = mselWithAssignedEvent([MselRole.Editor, MselRole.Approver], {
        inUnit: true,
      });

      expect(msel.hasRole(ME, EVENT_ID)).toEqual({
        ...NO_ROLES,
        approver: true,
        editor: true,
        viewer: true,
      });
    });

    /**
     * Verifies: an Editor outside the assigned unit gets no event-level roles, although the MSEL-wide check still says editor.
     * Interacts with: MselPlus.hasRole.
     * Data: ME holds Editor; se-1 assigned to RED; ME not in RED.
     */
    it('withholds event roles from an editor outside the assigned unit', () => {
      const msel = mselWithAssignedEvent([MselRole.Editor], { inUnit: false });

      expect(msel.hasRole(ME, EVENT_ID)).toEqual(NO_ROLES);
      expect(msel.hasRole(ME, null).editor).toBe(true);
    });

    /**
     * Verifies: the MoveEditor flag is set from the role list before the event check, so it survives an event outside the user's unit.
     * Interacts with: MselPlus.hasRole.
     * Data: ME holds MoveEditor; se-1 assigned to RED; ME not in RED.
     */
    it('keeps moveEditor on events outside the user\'s unit', () => {
      const msel = mselWithAssignedEvent([MselRole.MoveEditor], {
        inUnit: false,
      });

      expect(msel.hasRole(ME, EVENT_ID)).toEqual({
        ...NO_ROLES,
        moveEditor: true,
      });
    });

    /**
     * Verifies: an event with no team assignment, or assigned to a unit the MSEL does not have, grants a non-owner no roles.
     * Interacts with: MselPlus.hasRole.
     * Data: ME holds Editor and is in RED; se-2 has no data values; se-1 assigned to "BLUE", which is not a unit.
     */
    it.each([
      { label: 'an unassigned event', assignedTo: 'RED', eventId: 'se-2' },
      { label: 'an event assigned to an unknown unit', assignedTo: 'BLUE', eventId: EVENT_ID },
    ])('grants nothing on $label', ({ assignedTo, eventId }) => {
      const msel = mselWithAssignedEvent([MselRole.Editor], { inUnit: true, assignedTo });

      expect(msel.hasRole(ME, eventId)).toEqual(NO_ROLES);
    });

    /**
     * Verifies: an event id that does not belong to the MSEL grants a non-owner no roles.
     * Interacts with: MselPlus.hasRole.
     * Data: ME holds Editor and is in RED; event id se-404.
     */
    it('grants nothing for an event the MSEL does not contain', () => {
      const msel = mselWithAssignedEvent([MselRole.Editor], { inUnit: true });

      expect(msel.hasRole(ME, 'se-404')).toEqual(NO_ROLES);
    });

    /**
     * Verifies: the event-level check throws when the MSEL has scenario events but no dataFields list.
     * Interacts with: MselPlus.hasRole.
     * Data: ME holds Editor; scenarioEvents present; dataFields undefined.
     */
    it('throws when the MSEL has events but no data fields', () => {
      const msel = mselPlus({
        userMselRoles: [role(ME, MselRole.Editor)],
        scenarioEvents: [{ id: EVENT_ID, mselId: 'msel-1', dataValues: [] }],
      });

      expect(() => msel.hasRole(ME, EVENT_ID)).toThrow(TypeError);
    });
  });
});
