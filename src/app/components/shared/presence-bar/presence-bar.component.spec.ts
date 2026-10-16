// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MatIconModule } from '@angular/material/icon';
import { screen } from '@testing-library/angular';
import { BehaviorSubject } from 'rxjs';
import { PresenceActor, SignalRService } from 'src/app/services/signalr.service';
import { PresenceBarComponent } from './presence-bar.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderPresenceBar(actors: PresenceActor[] = []) {
  const signalR = { actors$: new BehaviorSubject<PresenceActor[]>(actors) } satisfies Pick<SignalRService, 'actors$'>;
  const rendered = await renderComponent(PresenceBarComponent, {
    imports: [MatIconModule],
    declarations: [PresenceBarComponent],
    providers: [{ provide: SignalRService, useValue: signalR }],
  });
  return { ...rendered, signalR };
}

describe('PresenceBarComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows nothing while nobody is present.
   * Interacts with: getDefaultProviders (placeholders and stubs only), SignalRService.actors$ (stub).
   * Data: no actors.
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderPresenceBar();

    expect(fixture.componentInstance).toBeInstanceOf(PresenceBarComponent);
    expect(fixture.nativeElement.querySelector('.presence-container')).toBeNull();
  });

  /**
   * Verifies: each present actor is shown by name, offline ones dimmed and nameless ones as Anonymous, and the bar follows updates.
   * Interacts with: SignalRService.actors$ (stub).
   * Data: Alice online, a nameless offline actor; then Bob alone.
   */
  it('shows the present actors', async () => {
    const { signalR } = await renderPresenceBar([
      { id: 'a', name: 'Alice', online: true, color: 'primary' },
      { id: 'b', name: '', online: false, color: 'accent' },
    ]);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Anonymous').closest('.presence-chip')).toHaveClass('presence-offline');

    signalR.actors$.next([{ id: 'c', name: 'Bob', online: true, color: 'green' }]);

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });
});
