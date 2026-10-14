/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

// Resolves a Player application icon the way Push does (IntegrationPlayerExtensions), so the
// list shows what Player will show. A relative path is relative to the Player UI.
export function playerAppIconUrl(icon: string, settings: any): string {
  if (!icon || icon.startsWith('mdi-')) return '';
  const trim = (url: string) => (url || '').replace(/\/+$/, '');
  const resolved = icon
    .replace('{playerUrl}', trim(settings.PlayerUrl))
    .replace('{citeUrl}', trim(settings.CiteUrl))
    .replace('{galleryUrl}', trim(settings.GalleryUrl))
    .replace('{steamfitterUrl}', trim(settings.SteamfitterUrl))
    .replace('{casterUrl}', trim(settings.CasterUrl))
    .replace('{vmUrl}', trim(settings.VmUrl))
    .replace('{blueprintUrl}', window.location.origin);
  if (/^https?:\/\//.test(resolved)) return resolved;
  return trim(settings.PlayerUrl) + '/' + resolved.replace(/^\/+/, '');
}
