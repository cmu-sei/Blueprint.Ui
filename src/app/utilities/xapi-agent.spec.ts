// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { describe, it, expect } from 'vitest';
import { agentIdentityKey, agentName, isAnonymousActor, isAnonymousAgentObject } from './xapi-agent';

describe('agentIdentityKey', () => {
  /**
   * Verifies: an agent is keyed by its account when it has one, then by mbox, mbox_sha1sum, openid and name.
   * Interacts with: agentIdentityKey.
   * Data: one agent per identifier, the first also carrying a name and an mbox.
   */
  it('keys an agent by the first identifier it has', () => {
    expect(agentIdentityKey({ name: 'Ann', mbox: 'mailto:ann@x', account: { homePage: 'https://id', name: 'ann' } })).toBe('account:https://id|ann');
    expect(agentIdentityKey({ mbox: 'mailto:ann@x', name: 'Ann' })).toBe('mbox:mailto:ann@x');
    expect(agentIdentityKey({ mbox_sha1sum: 'abc' })).toBe('sha1:abc');
    expect(agentIdentityKey({ openid: 'https://openid/ann' })).toBe('openid:https://openid/ann');
    expect(agentIdentityKey({ name: 'Ann' })).toBe('name:Ann');
  });

  /**
   * Verifies: an account with no name says nothing about who, so it gives no key; nor does an agent with nothing.
   * Interacts with: agentIdentityKey.
   * Data: an agent with only account.homePage; an agent with only objectType; undefined.
   */
  it('gives no key for an account with no name, or for no identity', () => {
    expect(agentIdentityKey({ objectType: 'Agent', account: { homePage: 'https://lrs' } })).toBe('');
    expect(agentIdentityKey({ objectType: 'Agent' })).toBe('');
    expect(agentIdentityKey(undefined)).toBe('');
  });
});

describe('agentName', () => {
  /**
   * Verifies: an agent is called by its name, account name, email address without mailto:, or OpenID, in that order.
   * Interacts with: agentName.
   * Data: one agent per identifier; an agent with only mbox_sha1sum.
   */
  it('calls an agent by the most readable identifier it has', () => {
    expect(agentName({ name: 'Ann', account: { name: 'ann' } })).toBe('Ann');
    expect(agentName({ account: { homePage: 'https://id', name: 'ann' }, mbox: 'mailto:ann@x' })).toBe('ann');
    expect(agentName({ mbox: 'mailto:ann@example.com' })).toBe('ann@example.com');
    expect(agentName({ openid: 'https://openid/ann' })).toBe('https://openid/ann');
    expect(agentName({ mbox_sha1sum: 'abc' })).toBe('');
  });
});

describe('isAnonymousActor', () => {
  /**
   * Verifies: an actor that is an Agent, by objectType or by default, with no identity is anonymous; a Group or an identified agent is not.
   * Interacts with: isAnonymousActor.
   * Data: {} ; { objectType: Agent }; an Agent with only account.homePage; a Group with no name; an Agent with an mbox_sha1sum; undefined.
   */
  it('finds an actor anonymous only when it is a person with no identity', () => {
    expect(isAnonymousActor({})).toBe(true);
    expect(isAnonymousActor({ objectType: 'Agent' })).toBe(true);
    expect(isAnonymousActor({ objectType: 'Agent', account: { homePage: 'https://lrs' } })).toBe(true);
    expect(isAnonymousActor({ objectType: 'Group' })).toBe(false);
    expect(isAnonymousActor({ mbox_sha1sum: 'abc' })).toBe(false);
    expect(isAnonymousActor(undefined)).toBe(false);
  });
});

describe('isAnonymousAgentObject', () => {
  /**
   * Verifies: a statement's object is an anonymous person only when it says it is an Agent, since an object with no objectType is an Activity.
   * Interacts with: isAnonymousAgentObject.
   * Data: { objectType: Agent }; {}; a named Agent; undefined.
   */
  it('finds an object anonymous only when it is an Agent with no identity', () => {
    expect(isAnonymousAgentObject({ objectType: 'Agent' })).toBe(true);
    expect(isAnonymousAgentObject({})).toBe(false);
    expect(isAnonymousAgentObject({ objectType: 'Agent', name: 'Ann' })).toBe(false);
    expect(isAnonymousAgentObject(undefined)).toBe(false);
  });
});
