// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, of, throwError } from 'rxjs';
import { TopologyMapService } from 'src/app/generated/blueprint.api/api/topologyMap.service';
import { TopologyMapPreview } from 'src/app/generated/blueprint.api/model/topologyMapPreview';
import { TopologyMapResult } from 'src/app/generated/blueprint.api/model/topologyMapResult';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { TopologyMapMsel, TopologyMapPanelComponent } from './topology-map-panel.component';

const CASTER_URL = 'http://caster.example/projects/proj-1?workspace=ws-1';

function preview(overrides: Partial<TopologyMapPreview> = {}): TopologyMapPreview {
  return {
    mselId: 'msel-1',
    casterWorkspaceId: 'ws-1',
    imageUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    clickPoints: [{ nodeId: 'vm.dc', xPosition: 50, yPosition: 50, radius: 3, label: '', urls: ['Domain Controller'] }],
    machineCount: 2,
    networkCount: 1,
    machinesWithoutConsole: ['router'],
    ...overrides,
  };
}

async function renderPanel({
  msel = { id: 'msel-1', usePlayer: true, useCaster: true, playerViewId: 'view-1', casterWorkspaceId: 'ws-1' } as TopologyMapMsel,
  canUpdate = true,
  casterWorkspaceUrl = CASTER_URL,
  previewAnswer = (): Observable<TopologyMapPreview> => of(preview()),
  updateAnswer = (): Observable<TopologyMapResult> =>
    of<TopologyMapResult>({ created: true, applicationAdded: true, map: preview({ imageUrl: 'data:image/svg+xml;base64,dXBkYXRlZA==' }) }),
} = {}) {
  const api = {
    previewTopologyMap: vi.fn(() => previewAnswer()),
    updateTopologyMap: vi.fn(() => updateAnswer()),
  } satisfies ApiStub<TopologyMapService>;
  const rendered = await renderComponent(TopologyMapPanelComponent, {
    declarations: [TopologyMapPanelComponent],
    providers: [{ provide: TopologyMapService, useValue: api }],
    inputs: { msel, canUpdate, casterWorkspaceUrl },
  });
  return { ...rendered, api };
}

describe('TopologyMapPanelComponent', () => {
  /**
   * Verifies: before the push makes the workspace there is nothing to draw: a note says the push makes the map, and Caster is not asked.
   * Interacts with: TopologyMapService (stub).
   * Data: a MSEL with no Caster workspace.
   */
  it('says the push makes the map when there is no workspace yet', async () => {
    const { api } = await renderPanel({ msel: { id: 'msel-1', usePlayer: true, useCaster: true } });

    expect(screen.getByText(/The push draws the map from the Caster workspace/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update map' })).not.toBeInTheDocument();
    expect(api.previewTopologyMap).not.toHaveBeenCalled();
  });

  /**
   * Verifies: the preview is drawn on load, with what it maps, the machines without a console, the link to edit the layout in
   * Caster, and the note that Player's map editor changes are overwritten.
   * Interacts with: TopologyMapService.previewTopologyMap (stub).
   * Data: a deployed MSEL; a preview of two machines on one network, one without a Player record.
   */
  it('shows the preview, the Caster link and the overwrite note', async () => {
    const { api } = await renderPanel();

    expect(api.previewTopologyMap).toHaveBeenCalledWith('msel-1');
    expect(screen.getByAltText('Network map of the Caster workspace')).toHaveAttribute('src', 'data:image/svg+xml;base64,PHN2Zy8+');
    expect(screen.getByText(/2 machines on\s+1 network,\s+1 with a Player console/)).toBeInTheDocument();
    expect(screen.getByText(/not clickable: router/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit layout in Caster/ })).toHaveAttribute('href', CASTER_URL);
    expect(screen.getByText(/Changes made in Player's map editor are overwritten/)).toBeInTheDocument();
  });

  /**
   * Verifies: Update map writes the map to Player, says what it did, and shows the drawing it sent.
   * Interacts with: TopologyMapService.updateTopologyMap (stub).
   * Data: an update that created the map and added the Network Map application.
   */
  it('updates the map in Player', async () => {
    const { api } = await renderPanel();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Update map' }));

    expect(api.updateTopologyMap).toHaveBeenCalledWith('msel-1');
    expect(screen.getByText('Map created in Player and the Network Map application added.')).toBeInTheDocument();
    expect(screen.getByAltText('Network map of the Caster workspace')).toHaveAttribute('src', 'data:image/svg+xml;base64,dXBkYXRlZA==');
  });

  /**
   * Verifies: a refused update shows Blueprint's reason.
   * Interacts with: TopologyMapService.updateTopologyMap (stub, 409).
   * Data: a 409 titled with the reason.
   */
  it('shows why an update failed', async () => {
    await renderPanel({
      updateAnswer: () => throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'The MSEL has no Player view yet.' } })),
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Update map' }));

    expect(screen.getByText('The MSEL has no Player view yet.')).toBeInTheDocument();
  });

  /**
   * Verifies: a preview Caster refuses shows the reason, and Refresh preview asks again.
   * Interacts with: TopologyMapService.previewTopologyMap (stub, 403 then a preview).
   * Data: a 403 titled with the reason.
   */
  it('shows why the preview failed and refreshes it', async () => {
    let calls = 0;
    const { api } = await renderPanel({
      previewAnswer: () => (calls++ === 0
        ? throwError(() => new HttpErrorResponse({ status: 403, error: { title: 'You cannot view it in Caster.' } }))
        : of(preview())),
    });
    const user = userEvent.setup();

    expect(screen.getByText('You cannot view it in Caster.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refresh preview' }));

    expect(api.previewTopologyMap).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('You cannot view it in Caster.')).not.toBeInTheDocument();
    expect(screen.getByAltText('Network map of the Caster workspace')).toBeInTheDocument();
  });

  /**
   * Verifies: someone who may not push sees the Caster link but neither the preview nor Update map, which need the push's permission.
   * Interacts with: TopologyMapService (stub).
   * Data: canUpdate false.
   */
  it('offers only the Caster link to someone who may not push', async () => {
    const { api } = await renderPanel({ canUpdate: false });

    expect(api.previewTopologyMap).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Update map' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit layout in Caster/ })).toBeInTheDocument();
  });

  /**
   * Verifies: with no Player view, Update map is off and says why.
   * Interacts with: TopologyMapService.previewTopologyMap (stub).
   * Data: a MSEL with a workspace and no view.
   */
  it('turns Update map off with no view', async () => {
    await renderPanel({ msel: { id: 'msel-1', usePlayer: true, useCaster: true, casterWorkspaceId: 'ws-1' } });

    expect(screen.getByRole('button', { name: 'Update map' })).toBeDisabled();
    expect(screen.getByText('Update map needs the Player view the push creates.')).toBeInTheDocument();
  });

  /**
   * Verifies: with no machines to map, the panel says so and Update map is off.
   * Interacts with: TopologyMapService.previewTopologyMap (stub).
   * Data: a preview with no machines.
   */
  it('turns Update map off with no machines', async () => {
    await renderPanel({ previewAnswer: () => of(preview({ machineCount: 0, clickPoints: [], machinesWithoutConsole: [] })) });

    expect(screen.getByText(/has no machines yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update map' })).toBeDisabled();
  });
});
