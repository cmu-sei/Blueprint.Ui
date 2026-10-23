// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { playerAppIconUrl } from './player-app-icon';

const SETTINGS = {
  PlayerUrl: 'http://player.example/',
  CiteUrl: 'http://cite.example/',
  GalleryUrl: 'http://gallery.example',
  SteamfitterUrl: 'http://steamfitter.example//',
  CasterUrl: 'http://caster.example/',
  VmUrl: 'http://vm.example/',
};

describe('playerAppIconUrl', () => {
  /**
   * Verifies: no image URL for a missing icon or a Material Design icon name, which the list draws as a font icon.
   * Interacts with: playerAppIconUrl.
   * Data: '', undefined, null and 'mdi-email'.
   */
  it.each([
    { label: 'an empty icon', icon: '' },
    { label: 'an undefined icon', icon: undefined as string },
    { label: 'a null icon', icon: null as string },
    { label: 'an mdi- icon', icon: 'mdi-email' },
  ])('gives no URL for $label', ({ icon }) => {
    expect(playerAppIconUrl(icon, SETTINGS)).toBe('');
  });

  /**
   * Verifies: an absolute http or https icon URL is used as it is.
   * Interacts with: playerAppIconUrl.
   * Data: https://cdn.example/mail.png and http://cdn.example/mail.png.
   */
  it.each(['https://cdn.example/mail.png', 'http://cdn.example/mail.png'])('keeps the absolute URL %s', (icon) => {
    expect(playerAppIconUrl(icon, SETTINGS)).toBe(icon);
  });

  /**
   * Verifies: each app URL placeholder is replaced with its setting, trailing slashes trimmed, and {blueprintUrl} with this page's origin.
   * Interacts with: playerAppIconUrl, window.location.origin.
   * Data: SETTINGS, whose URLs end in zero, one or two slashes; icons '<placeholder>/assets/icon.png'.
   */
  it.each([
    { placeholder: '{playerUrl}', base: 'http://player.example' },
    { placeholder: '{citeUrl}', base: 'http://cite.example' },
    { placeholder: '{galleryUrl}', base: 'http://gallery.example' },
    { placeholder: '{steamfitterUrl}', base: 'http://steamfitter.example' },
    { placeholder: '{casterUrl}', base: 'http://caster.example' },
    { placeholder: '{vmUrl}', base: 'http://vm.example' },
    { placeholder: '{blueprintUrl}', base: window.location.origin },
  ])('resolves $placeholder', ({ placeholder, base }) => {
    expect(playerAppIconUrl(`${placeholder}/assets/icon.png`, SETTINGS)).toBe(`${base}/assets/icon.png`);
  });

  /**
   * Verifies: a relative icon path is taken as relative to the Player UI, with its leading slashes dropped.
   * Interacts with: playerAppIconUrl.
   * Data: PlayerUrl http://player.example/; 'assets/img/mail.png', '/assets/img/mail.png' and '//assets/img/mail.png'.
   */
  it.each(['assets/img/mail.png', '/assets/img/mail.png', '//assets/img/mail.png'])('resolves the relative path %s under the Player UI', (icon) => {
    expect(playerAppIconUrl(icon, SETTINGS)).toBe('http://player.example/assets/img/mail.png');
  });

  /**
   * Verifies: a placeholder whose setting is missing resolves to a path, which is then taken as relative to the Player UI.
   * Interacts with: playerAppIconUrl.
   * Data: settings with only PlayerUrl; icon '{citeUrl}/assets/icon.png'.
   */
  it('resolves a placeholder with no setting under the Player UI', () => {
    expect(playerAppIconUrl('{citeUrl}/assets/icon.png', { PlayerUrl: 'http://player.example' })).toBe(
      'http://player.example/assets/icon.png',
    );
  });

  /**
   * Verifies: only the first occurrence of a placeholder is replaced (current behavior).
   * Interacts with: playerAppIconUrl (String.prototype.replace with a string pattern).
   * Data: icon '{playerUrl}/icon.png?fallback={playerUrl}/default.png'.
   */
  it('replaces only the first occurrence of a placeholder', () => {
    // Current behavior; see agent-docs/ui-test-bugs/blueprint.ui.md.
    expect(playerAppIconUrl('{playerUrl}/icon.png?fallback={playerUrl}/default.png', SETTINGS)).toBe(
      'http://player.example/icon.png?fallback={playerUrl}/default.png',
    );
  });
});
