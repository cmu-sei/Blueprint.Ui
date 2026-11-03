// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { ElementRef } from '@angular/core';
import { FitWidthDirective, fitScale } from './fit-width.directive';

describe('fitScale', () => {
  /**
   * Verifies: content shrinks to the room it has, never grows, and stays whole when the room is not known yet.
   * Data: a 720-pixel article in 360, 1000 and 0 pixels of room.
   */
  it('shrinks to fit but never enlarges', () => {
    expect(fitScale(360, 720)).toBe(0.5);
    expect(fitScale(1000, 720)).toBe(1);
    expect(fitScale(0, 720)).toBe(1);
  });
});

describe('FitWidthDirective', () => {
  /**
   * Verifies: the content is zoomed to its parent's width inside the padding, so a 720-pixel article fits half the dialog.
   * Interacts with: the parent's clientWidth and padding, the host's style.zoom.
   * Data: a parent 400 pixels wide with 20 pixels of padding each side, leaving 360 for a 720-pixel article.
   */
  it('zooms its content to the width of its parent', () => {
    const parent = document.createElement('div');
    parent.style.padding = '0 20px';
    Object.defineProperty(parent, 'clientWidth', { value: 400 });
    const host = document.createElement('div');
    parent.appendChild(host);
    document.body.appendChild(parent);

    const directive = new FitWidthDirective(new ElementRef(host));
    directive.fit(parent);

    expect(host.style.zoom).toBe('0.5');
    parent.remove();
  });
});
