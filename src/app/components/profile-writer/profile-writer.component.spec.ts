// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MselDataService } from 'src/app/data/msel/msel-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProfileWriterComponent } from './profile-writer.component';

async function renderWriter(answer: () => any = () => of({ html: '<h2>CERT</h2><img src="data:image/svg+xml;base64,LOGO" alt="CERT logo">', notes: ['Assumed six staff.'] })) {
  const draftProfile = vi.fn(answer);
  const used: string[] = [];
  const rendered = await renderComponent(ProfileWriterComponent, {
    inputs: { kind: 'team', mselId: 'msel-1', shortName: 'CERT', name: 'National CERT', description: '<p>Runs the response.</p>' },
    providers: [{ provide: MselDataService, useValue: { draftProfile } as Partial<MselDataService> }],
  });
  rendered.fixture.componentInstance.useProfile.subscribe((html) => used.push(html));
  rendered.fixture.componentInstance.toPng = async (html: string) => html.replace('image/svg+xml', 'image/png');
  return { ...rendered, draftProfile, used, user: userEvent.setup() };
}

describe('ProfileWriterComponent', () => {
  /**
   * Verifies: the planner opens the writer, adds an instruction, sees the profile and its notes, and Use this hands it on with its logo as PNG.
   * Interacts with: MselDataService.draftProfile, the useProfile output, the PNG conversion (replaced, as jsdom cannot draw).
   * Data: team CERT "National CERT" with a one-line description; instruction "Add a duty officer".
   */
  it('writes the profile and hands it on when used', async () => {
    const { draftProfile, used, user } = await renderWriter();

    await user.click(screen.getByRole('button', { name: "Write the team's profile with AI" }));
    await user.type(screen.getByRole('textbox', { name: 'Instruction (optional)' }), 'Add a duty officer');
    await user.click(screen.getByRole('button', { name: 'Write' }));

    expect(draftProfile).toHaveBeenCalledWith({
      mselId: 'msel-1', kind: 'team', shortName: 'CERT', name: 'National CERT', summary: '', description: '<p>Runs the response.</p>', instruction: 'Add a duty officer',
    });
    expect(screen.getByLabelText('Profile preview')).toHaveTextContent('CERT');
    expect(screen.getByText('Assumed six staff.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use this' }));

    await vi.waitFor(() => expect(used).toEqual(['<h2>CERT</h2><img src="data:image/png;base64,LOGO" alt="CERT logo">']));
    expect(screen.getByRole('button', { name: "Write the team's profile with AI" })).toBeInTheDocument();
  });

  /**
   * Verifies: Discard closes the writer without handing anything on.
   * Interacts with: the useProfile output.
   * Data: a written profile, discarded.
   */
  it('hands nothing on when discarded', async () => {
    const { used, user } = await renderWriter();

    await user.click(screen.getByRole('button', { name: "Write the team's profile with AI" }));
    await user.click(screen.getByRole('button', { name: 'Write' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(used).toEqual([]);
    expect(screen.queryByLabelText('Profile preview')).not.toBeInTheDocument();
  });

  /**
   * Verifies: a failure shows in the API's words and the planner can try again.
   * Interacts with: MselDataService.draftProfile erroring.
   * Data: a 403 titled "Forbidden".
   */
  it('shows why the profile could not be written', async () => {
    const { user } = await renderWriter(() => throwError(() => new HttpErrorResponse({ status: 403, error: { title: 'Forbidden' } })));

    await user.click(screen.getByRole('button', { name: "Write the team's profile with AI" }));
    await user.click(screen.getByRole('button', { name: 'Write' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Forbidden');
    expect(screen.getByRole('button', { name: 'Write' })).toBeEnabled();
  });
});
