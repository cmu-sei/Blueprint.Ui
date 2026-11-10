// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/** An xAPI agent or group, as a statement's actor or object. */
export interface XApiAgent {
  objectType?: string;
  name?: string;
  mbox?: string;
  mbox_sha1sum?: string;
  openid?: string;
  account?: { homePage?: string; name?: string };
}

/**
 * Who an agent is, from the first identifier xAPI gives it; '' when it has none. An account counts only
 * with its name: xAPI requires both, and a homePage alone is the same for everyone on the LRS.
 */
export function agentIdentityKey(agent: XApiAgent | undefined): string {
  if (!agent) return '';
  if (agent.account?.name) return `account:${agent.account.homePage || ''}|${agent.account.name}`;
  if (agent.mbox) return `mbox:${agent.mbox}`;
  if (agent.mbox_sha1sum) return `sha1:${agent.mbox_sha1sum}`;
  if (agent.openid) return `openid:${agent.openid}`;
  if (agent.name) return `name:${agent.name}`;
  return '';
}

/** What to call an agent: its name, account name, email address or OpenID; '' when it has none of them. */
export function agentName(agent: XApiAgent | undefined): string {
  if (!agent) return '';
  return agent.name || agent.account?.name || agent.mbox?.replace(/^mailto:/i, '') || agent.openid || '';
}

/**
 * Whether a statement's actor is a person with nothing that says who: what the API leaves of an agent on
 * a MSEL that hides names (it removes name, mbox, mbox_sha1sum, openid and account). An actor with no
 * objectType is an Agent; a Group keeps its own name, so it is never anonymous.
 */
export function isAnonymousActor(actor: XApiAgent | undefined): boolean {
  return !!actor && (!actor.objectType || actor.objectType === 'Agent') && agentIdentityKey(actor) === '';
}

/** The same for a statement's object, which is an Agent only when it says so (its objectType defaults to Activity). */
export function isAnonymousAgentObject(object: XApiAgent | undefined): boolean {
  return object?.objectType === 'Agent' && agentIdentityKey(object) === '';
}
