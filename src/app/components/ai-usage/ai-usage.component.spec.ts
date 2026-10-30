// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import { of, throwError } from 'rxjs';
import { AiUsageService, AiUsageSummary } from 'src/app/generated/blueprint.api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AiUsageComponent } from './ai-usage.component';

const USAGE: AiUsageSummary = {
  mselId: 'msel-1',
  calls: 4,
  refused: 1,
  inputTokens: 48565,
  outputTokens: 43573,
  images: 1,
  estimatedCostMicros: 572860,
  unpriced: [],
  byOperation: [
    { name: 'article', calls: 2, refused: 1, inputTokens: 3000, outputTokens: 4000, images: 0, estimatedCostMicros: 46000 },
    { name: 'draft', calls: 1, inputTokens: 45565, outputTokens: 39573, images: 0, estimatedCostMicros: 486860 },
    { name: 'photo', calls: 1, inputTokens: 0, outputTokens: 0, images: 1, estimatedCostMicros: 40000 },
  ],
};

async function renderUsage(answer: () => any) {
  const getMselAiUsage = vi.fn(answer);
  const rendered = await renderComponent(AiUsageComponent, {
    providers: [{ provide: AiUsageService, useValue: { getMselAiUsage } }],
    inputs: { mselId: 'msel-1' },
  });
  return { ...rendered, getMselAiUsage };
}

describe('AiUsageComponent', () => {
  /**
   * Verifies: the MSEL's AI calls show by step in planner's words, with tokens, photos and each step's cost in dollars, and the total and refusals in a line above.
   * Interacts with: AiUsageService.getMselAiUsage.
   * Data: a draft, two article calls (one refused) and a photo, $0.57 in all.
   */
  it('shows what building the MSEL with AI used, by step', async () => {
    const { getMselAiUsage } = await renderUsage(() => of(USAGE));

    expect(getMselAiUsage).toHaveBeenCalledWith('msel-1');
    expect(screen.getByRole('heading', { name: 'AI usage' })).toBeInTheDocument();
    expect(screen.getByText(/4 calls to AI models drafted and changed this MSEL\s*, about \$0\.57 at list prices/)).toBeInTheDocument();
    expect(screen.getByText(/1 was declined by the model's safety checks/)).toBeInTheDocument();
    const draft = screen.getByRole('row', { name: /Draft MSEL with AI/ });
    expect(within(draft).getByText('45,565')).toBeInTheDocument();
    expect(within(draft).getByText('$0.49')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Gallery articles/ })).toHaveTextContent('$0.05');
    expect(screen.getByRole('row', { name: /News photos/ })).toHaveTextContent('$0.04');
    expect(screen.getByRole('row', { name: /Total/ })).toHaveTextContent('$0.57');
  });

  /**
   * Verifies: a model with no price leaves the total without an estimate and says which one to price.
   * Interacts with: AiUsageService.getMselAiUsage.
   * Data: one call on other-model, which has no price.
   */
  it('names the models that have no price', async () => {
    await renderUsage(() => of({ ...USAGE, estimatedCostMicros: null, unpriced: ['other-model'], refused: 0 }));

    expect(screen.queryByText(/at list prices/)).not.toBeInTheDocument();
    expect(screen.getByText(/No price is set for other-model/)).toBeInTheDocument();
  });

  /**
   * Verifies: a MSEL built without AI, or one the user may not see the usage of, shows nothing.
   * Interacts with: AiUsageService.getMselAiUsage answering no calls, then a 403.
   * Data: zero calls; a refused request.
   */
  it.each([
    { label: 'built without AI', answer: () => of({ calls: 0, byOperation: [] }) },
    { label: 'not visible to the user', answer: () => throwError(() => ({ status: 403 })) },
  ])('shows nothing for a MSEL $label', async ({ answer }) => {
    await renderUsage(answer);

    expect(screen.queryByRole('heading', { name: 'AI usage' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: the panel asks for nothing until the Info page's MSEL has loaded, then asks for that MSEL's usage.
   * Interacts with: AiUsageService.getMselAiUsage.
   * Data: no MSEL id at first, then msel-1.
   */
  it('waits for the MSEL to load', async () => {
    const getMselAiUsage = vi.fn(() => of(USAGE));
    const { fixture } = await renderComponent(AiUsageComponent, {
      providers: [{ provide: AiUsageService, useValue: { getMselAiUsage } }],
      inputs: { mselId: undefined },
    });
    expect(getMselAiUsage).not.toHaveBeenCalled();

    fixture.componentRef.setInput('mselId', 'msel-1');
    fixture.detectChanges();

    expect(getMselAiUsage).toHaveBeenCalledWith('msel-1');
  });
});
