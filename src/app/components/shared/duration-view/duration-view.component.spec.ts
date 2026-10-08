// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { DurationViewComponent } from './duration-view.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderDurationView(inputs: { durationSeconds: number; showRealTime: boolean }) {
  return renderComponent(DurationViewComponent, {
    declarations: [DurationViewComponent],
    inputs: { startTime: new Date(2026, 0, 1, 12, 0, 0), ...inputs },
  });
}

describe('DurationViewComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers.
   * Interacts with: getDefaultProviders (placeholders and stubs only).
   * Data: a 90-second offset, delta time.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderDurationView({ durationSeconds: 90, showRealTime: false });

    expect(fixture.componentInstance).toBeInstanceOf(DurationViewComponent);
    expect(fixture.nativeElement).toBeInTheDocument();
  });

  /**
   * Verifies: delta time is shown as a signed days hh:mm:ss offset.
   * Interacts with: DurationViewComponent.getDeltaTime.
   * Data: offsets of 1 day 1 hour 1 minute 1 second, and of minus 90 seconds.
   */
  it.each([
    { durationSeconds: 90061, text: '+ 1 01:01:01' },
    { durationSeconds: -90, text: '- 00:01:30' },
  ])('shows $durationSeconds seconds as $text', async ({ durationSeconds, text }) => {
    await renderDurationView({ durationSeconds, showRealTime: false });

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  /**
   * Verifies: real time is the start time plus the offset, in the browser's timezone.
   * Interacts with: DurationViewComponent.getDate.
   * Data: start 1 Jan 2026 12:00 local, offset one hour.
   */
  it('shows the real time of the offset', async () => {
    await renderDurationView({ durationSeconds: 3600, showRealTime: true });

    expect(screen.getByTitle('Time shown in your browser timezone')).toHaveTextContent(/^01 Jan 2026 13:00/);
  });
});
