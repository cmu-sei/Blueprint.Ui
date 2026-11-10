// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy, inject } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

// Shows the full text of a clipped element, such as a line-clamped description, in a tooltip on
// hover and keyboard focus. Text that fits shows no tooltip, and only clipped text takes a tab stop.
@Directive({
  selector: '[appOverflowTooltip]',
  hostDirectives: [{ directive: MatTooltip, inputs: ['matTooltip: appOverflowTooltip'] }],
})
export class OverflowTooltipDirective implements AfterViewInit, OnDestroy {
  private readonly tooltip = inject(MatTooltip, { self: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private resizeObserver?: ResizeObserver;

  constructor() {
    // wait for a deliberate pause, so passing the pointer over a card does not flash the full text
    this.tooltip.showDelay = 800;
  }

  ngAfterViewInit() {
    // The tooltip starts enabled: MatTooltip only listens for hover while enabled, and this
    // directive's own mouseenter runs first and turns it off when the text fits. The first check
    // comes from the observer, after the first render: checking during it changes the tooltip's
    // bindings after Angular has checked them (NG0100).
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.update());
      this.resizeObserver.observe(this.host.nativeElement);
    }
  }

  @HostListener('mouseenter')
  @HostListener('focusin')
  update() {
    const element = this.host.nativeElement;
    const isClipped = element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
    this.tooltip.disabled = !isClipped;
    if (isClipped) {
      element.setAttribute('tabindex', '0');
    } else {
      element.removeAttribute('tabindex');
    }
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }
}
