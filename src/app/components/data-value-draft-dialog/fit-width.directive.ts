// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnDestroy,
} from '@angular/core';

/** How far to shrink content of the given width to fit the room: never larger than it is, and 1 when the room is unknown */
export function fitScale(room: number, width: number): number {
  return room > 0 && width > 0 ? Math.min(1, room / width) : 1;
}

/**
 * Shrinks its content to fit the width of its parent, as a thumbnail of the same page: a Gallery article is laid out
 * with tables 720 pixels wide, which only overflow when squeezed, so it is zoomed down whole instead.
 */
@Directive({ selector: '[appFitWidth]' })
export class FitWidthDirective implements AfterViewInit, OnDestroy {
  // the width the content is laid out at
  @Input() appFitWidth = 720;
  private observer: ResizeObserver;

  constructor(private element: ElementRef<HTMLElement>) {}

  ngAfterViewInit() {
    const parent = this.element.nativeElement.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.observer = new ResizeObserver(() => this.fit(parent));
    this.observer.observe(parent);
  }

  // the parent's width inside its padding
  fit(parent: HTMLElement) {
    const style = getComputedStyle(parent);
    const room =
      parent.clientWidth -
      parseFloat(style.paddingLeft || '0') -
      parseFloat(style.paddingRight || '0');
    this.element.nativeElement.style.zoom = String(
      fitScale(room, this.appFitWidth),
    );
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
