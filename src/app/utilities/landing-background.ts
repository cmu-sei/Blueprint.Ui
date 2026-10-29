// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Signal, signal } from '@angular/core';

// The CSS value for the optional AppLandingBackgroundImage setting, so a site
// can brand the main pages without shipping the image in this repo. Used with
// the global landing-background class. Applied only once the image loads, so
// a missing image leaves the normal page background.
export function landingBackground(settings: { AppLandingBackgroundImage?: string }): Signal<string | null> {
  const background = signal<string | null>(null);
  const url = settings?.AppLandingBackgroundImage;
  if (url) {
    const image = new Image();
    image.onload = () => background.set(`url("${url}")`);
    image.src = url;
  }
  return background.asReadonly();
}
