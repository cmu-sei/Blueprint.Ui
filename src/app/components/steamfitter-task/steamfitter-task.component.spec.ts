// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { screen } from '@testing-library/angular';
import { AngularEditorModule } from '@kolkov/angular-editor';
import { ScenarioEvent, SteamfitterIntegrationType } from 'src/app/generated/blueprint.api';
import { SteamfitterTaskComponent } from './steamfitter-task.component';
import { renderComponent } from 'src/app/test-utils/render-component';

function scenarioEvent(taskType: SteamfitterIntegrationType): ScenarioEvent {
  return {
    id: 'se-1',
    steamfitterTask: {
      id: 'task-1',
      name: 'Send phish',
      description: 'Phishing email',
      taskType,
      actionParameters: { EmailFrom: 'red@example.com', EmailTo: 'blue@example.com', situationDescription: '<p>Situation</p>' },
    },
  };
}

async function renderTask(overrides: { canEdit?: boolean; taskType?: SteamfitterIntegrationType } = {}) {
  const { canEdit = true, taskType = SteamfitterIntegrationType.Email } = overrides;
  const rendered = await renderComponent(SteamfitterTaskComponent, {
    imports: [AngularEditorModule, MatFormFieldModule, MatInputModule, MatSelectModule],
    declarations: [SteamfitterTaskComponent],
    // angular-editor injects HttpClient for its image upload.
    providers: [provideHttpClient(), provideHttpClientTesting()],
    inputs: { canEdit, scenarioEvent: scenarioEvent(taskType) },
  });
  // ngModel applies [disabled] in a microtask.
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return rendered;
}

const EMAIL_FIELDS = ['Name', 'Description', 'From', 'To', 'cc', 'Subject', 'Message', 'Account', 'Mime Type'];

describe('SteamfitterTaskComponent', () => {
  /**
   * Verifies: an Email task shows its email fields, editable with canEdit.
   * Interacts with: SteamfitterTaskComponent template, ngModel.
   * Data: canEdit true; Email task from red@example.com to blue@example.com.
   */
  it('edits an email task with canEdit', async () => {
    await renderTask({ canEdit: true });

    for (const placeholder of EMAIL_FIELDS) {
      expect(screen.getByPlaceholderText(placeholder)).toBeEnabled();
    }
    expect(screen.getByPlaceholderText('From')).toHaveValue('red@example.com');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'false');
  });

  /**
   * Verifies: without canEdit every task field and the task type select are disabled.
   * Interacts with: SteamfitterTaskComponent template, ngModel.
   * Data: canEdit false; Email task.
   */
  it('disables the task fields without canEdit', async () => {
    await renderTask({ canEdit: false });

    for (const placeholder of EMAIL_FIELDS) {
      expect(screen.getByPlaceholderText(placeholder)).toBeDisabled();
    }
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
  });

  /**
   * Verifies: a Situation Update's description editor is editable with canEdit and read-only without it.
   * Interacts with: angular-editor [config] (EDITOR_CONFIG vs VIEW_CONFIG_AUTO_SIZE).
   * Data: canEdit true and false; Situation Update task.
   */
  it.each([
    { canEdit: true, editable: 'true' },
    { canEdit: false, editable: 'false' },
  ])('makes the situation description editable: $editable with canEdit $canEdit', async ({ canEdit, editable }) => {
    const { container } = await renderTask({ canEdit, taskType: SteamfitterIntegrationType.SituationUpdate });

    const editor = container.querySelector('.angular-editor-textarea') as HTMLElement;
    expect(editor).toHaveAttribute('contenteditable', editable);
    expect(screen.getByPlaceholderText('Situation Date / Time').hasAttribute('disabled')).toBe(!canEdit);
  });
});
