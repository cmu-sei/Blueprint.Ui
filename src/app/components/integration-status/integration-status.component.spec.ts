// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Msel, MselItemStatus, MselService } from 'src/app/generated/blueprint.api';
import { MselPlus } from 'src/app/data/msel/msel-data.service';
import { IntegrationStatusComponent } from './integration-status.component';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';

function msel(integrationStatus: string, status: MselItemStatus): MselPlus {
  return Object.assign(new MselPlus(), { id: 'msel-1', name: 'Exercise Alpha', integrationStatus, status });
}

async function renderStatus(
  integrationStatus: string,
  casterWorkspaceUrl = '',
  status: MselItemStatus = MselItemStatus.Pushing,
  retryAnswer: Observable<Msel> = of<Msel>({ id: 'msel-1', name: 'Exercise Alpha', integrationStatus: 'Retrying Caster' })
) {
  const mselApi = {
    cancelIntegrations: vi.fn(() => of<unknown>(null)),
    pullIntegrations: vi.fn(() => of<Msel>({ id: 'msel-1', name: 'Exercise Alpha' })),
    retryCasterIntegration: vi.fn(() => retryAnswer),
  } satisfies ApiStub<MselService>;
  // The user confirms every dialog.
  const confirm = vi.fn(() => dialogRefStub<unknown, boolean>(true).dialogRef);
  const dialog = { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>;
  const rendered = await renderComponent(IntegrationStatusComponent, {
    imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
    declarations: [IntegrationStatusComponent],
    providers: [
      { provide: MselService, useValue: mselApi },
      { provide: CrucibleDialogService, useValue: dialog },
    ],
    inputs: { msel: msel(integrationStatus, status), casterWorkspaceUrl },
  });
  let closed = 0;
  rendered.fixture.componentInstance.closed.subscribe(() => closed++);
  return { ...rendered, mselApi, confirm, closedCount: () => closed };
}

describe('IntegrationStatusComponent', () => {
  /**
   * Verifies: the component mounts with the default test providers and shows a push in progress with Cancel Push.
   * Interacts with: getDefaultProviders (placeholders and stubs only).
   * Data: status "Pushing to Gallery".
   */
  it('renders with the default test providers', async () => {
    const { fixture } = await renderStatus('Pushing to Gallery');

    expect(fixture.componentInstance).toBeInstanceOf(IntegrationStatusComponent);
    expect(screen.getByRole('heading', { name: 'Processing integrations ...' })).toBeInTheDocument();
    expect(screen.getByText('Pushing to Gallery ...')).toBeInTheDocument();
  });

  /**
   * Verifies: Cancel Push asks the API to cancel and shows that it is cancelling.
   * Interacts with: MselService.cancelIntegrations (stub), real MselDataService.
   * Data: status "Pushing to Gallery".
   */
  it('cancels a push', async () => {
    const { mselApi } = await renderStatus('Pushing to Gallery');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Cancel Push' }));

    expect(mselApi.cancelIntegrations).toHaveBeenCalledWith('msel-1');
    expect(screen.getByText('Cancelling...')).toBeInTheDocument();
  });

  /**
   * Verifies: a failed push shows the error, and Pull Integrations removes the partial integrations after confirmation and closes.
   * Interacts with: CrucibleDialogService.confirm (stub, confirms), MselService.pullIntegrations (stub), closed output.
   * Data: status "ERROR: Gallery is unreachable".
   */
  it('pulls the partial integrations after a failure', async () => {
    const { mselApi, confirm, closedCount } = await renderStatus('ERROR: Gallery is unreachable');
    const user = userEvent.setup();

    expect(screen.getByRole('heading', { name: 'Integration Failed' })).toBeInTheDocument();
    expect(screen.getByText('Gallery is unreachable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pull Integrations' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Remove Integrations',
      message: 'Are you sure that you want to remove partial integrations from the associated applications?',
    }));
    expect(mselApi.pullIntegrations).toHaveBeenCalledWith('msel-1');
    expect(closedCount()).toBe(1);
  });

  /**
   * Verifies: a failed push links to the MSEL's Caster workspace when it has one, and not otherwise.
   * Interacts with: the casterWorkspaceUrl input.
   * Data: a failed Caster plan, with and without a workspace URL.
   */
  it.each([
    ['with a workspace', 'http://caster.example/projects/proj-1?workspace=ws-1'],
    ['without a workspace', ''],
  ])('links a failed push to its Caster workspace, %s', async (_label, url) => {
    await renderStatus('ERROR: Caster - planning failed - Caster run run-1 plan ended Failed.', url);

    const link = screen.queryByRole('link', { name: 'Open Workspace in Caster' });
    if (url) {
      expect(link).toHaveAttribute('href', url);
    } else {
      expect(link).not.toBeInTheDocument();
    }
  });

  /**
   * Verifies: a push that failed at its Caster step offers Retry Caster, which asks the API to retry and leaves the status open.
   * Interacts with: MselService.retryCasterIntegration (stub), real MselDataService, closed output.
   * Data: a Pushing MSEL with status "ERROR: Caster - planning failed - ...".
   */
  it('retries Caster after a push failed at Caster', async () => {
    const { mselApi, confirm, closedCount } = await renderStatus('ERROR: Caster - planning failed - Caster run run-1 plan ended Failed.');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Retry Caster' }));

    expect(mselApi.retryCasterIntegration).toHaveBeenCalledWith('msel-1');
    expect(confirm).not.toHaveBeenCalled();
    expect(closedCount()).toBe(0);
  });

  /**
   * Verifies: Retry Caster is disabled until its request answers, so a double-click sends one retry, and is offered again when the request fails.
   * Interacts with: MselService.retryCasterIntegration (stub that answers when the test says), real MselDataService.
   * Data: a Pushing MSEL with status "ERROR: Caster - planning failed - ..."; the retry is answered with a 409.
   */
  it('sends one retry until the request answers', async () => {
    const answer = new Subject<Msel>();
    const { mselApi, fixture } = await renderStatus(
      'ERROR: Caster - planning failed - Caster run run-1 plan ended Failed.', '', MselItemStatus.Pushing, answer);
    const user = userEvent.setup();
    const retry = screen.getByRole('button', { name: 'Retry Caster' });

    await user.click(retry);

    expect(retry).toBeDisabled();

    answer.error(new HttpErrorResponse({ status: 409 }));
    fixture.detectChanges();

    expect(mselApi.retryCasterIntegration).toHaveBeenCalledTimes(1);
    expect(retry).toBeEnabled();
  });

  /**
   * Verifies: Retry Caster is offered only for a push that failed at its Caster step.
   * Interacts with: IntegrationStatusComponent.canRetryCaster.
   * Data: a push that failed at Gallery, and a pull of a deployed MSEL that failed at Caster.
   */
  it.each([
    ['a push that failed at Gallery', 'ERROR: Gallery - create collection failed - boom', MselItemStatus.Pushing],
    ['a pull that failed at Caster', 'ERROR: Caster - pull workspace failed - boom', MselItemStatus.Deployed],
  ])('offers no Retry Caster for %s', async (_label, integrationStatus, status) => {
    await renderStatus(integrationStatus, '', status);

    expect(screen.getByRole('heading', { name: 'Integration Failed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry Caster' })).not.toBeInTheDocument();
  });
});
