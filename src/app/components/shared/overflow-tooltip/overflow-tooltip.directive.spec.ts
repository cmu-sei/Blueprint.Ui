// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';
import { fireEvent, screen } from '@testing-library/angular';
import { OverflowTooltipDirective } from './overflow-tooltip.directive';
import { renderComponent } from 'src/app/test-utils/render-component';

@Component({
  template: '<p data-testid="text" [appOverflowTooltip]="text">{{ text }}</p>',
  imports: [OverflowTooltipDirective],
})
class HostComponent {
  text = 'A description long enough to be clipped by a five-line clamp on a narrow card.';
}

// jsdom lays nothing out, so the element's sizes are set by hand.
function sized(element: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight });
}

async function renderHost() {
  const rendered = await renderComponent(HostComponent, {});
  const tooltip = rendered.fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
  return { ...rendered, tooltip, text: screen.getByTestId('text') };
}

describe('OverflowTooltipDirective', () => {
  /**
   * Verifies: clipped text gets the full text as an enabled tooltip, and a tab stop so keyboard users can reach it.
   * Interacts with: MatTooltip (real, as a host directive), mouseenter.
   * Data: an element whose content is taller than its box.
   */
  it('offers the full text of clipped text', async () => {
    const { tooltip, text } = await renderHost();
    sized(text, 120, 80);

    fireEvent.mouseEnter(text);

    expect(tooltip.disabled).toBe(false);
    expect(tooltip.message).toBe('A description long enough to be clipped by a five-line clamp on a narrow card.');
    expect(text).toHaveAttribute('tabindex', '0');
    // a deliberate pause, not a pass of the pointer
    expect(tooltip.showDelay).toBe(800);
  });

  /**
   * Verifies: text that fits shows no tooltip and takes no tab stop, so short descriptions are not repeated.
   * Interacts with: MatTooltip (real, as a host directive), mouseenter.
   * Data: an element whose content fits its box.
   */
  it('offers nothing for text that fits', async () => {
    const { tooltip, text } = await renderHost();
    sized(text, 80, 80);

    fireEvent.mouseEnter(text);

    expect(tooltip.disabled).toBe(true);
    expect(text).not.toHaveAttribute('tabindex');
  });
});
