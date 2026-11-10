// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// The CSS value for the optional AppLandingBackgroundImage setting, so a site
// can brand the main pages without shipping the image in this repo. Used with
// the global landing-background class.
export function landingBackground(settings: { AppLandingBackgroundImage?: string }): string | null {
  return settings?.AppLandingBackgroundImage ? `url("${settings.AppLandingBackgroundImage}")` : null;
}
