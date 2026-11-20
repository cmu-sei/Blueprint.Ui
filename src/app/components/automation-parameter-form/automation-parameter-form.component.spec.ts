// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  AutomationAction,
  AutomationActionDefinition,
} from 'src/app/generated/blueprint.api';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  AutomationTaskDraft,
  newDraft,
} from 'src/app/utilities/automation-tasks';
import { AutomationParameterFormComponent } from './automation-parameter-form.component';

const SSH: AutomationActionDefinition = {
  action: AutomationAction.CoreRemote,
  display: 'Run a remote command',
  parameters: [
    {
      key: 'Hosts',
      display: 'Hosts',
      inputType: 'text',
      required: true,
      hint: 'Comma separated',
    },
    { key: 'Port', display: 'Port', inputType: 'number', default: '22' },
    { key: 'Sudo', display: 'Use sudo', inputType: 'checkbox' },
    {
      key: 'Shell',
      display: 'Shell',
      inputType: 'select',
      choices: [
        { key: 'bash', display: 'Bash' },
        { key: 'sh', display: 'POSIX sh' },
      ],
    },
    {
      key: 'Password',
      display: 'Password',
      inputType: 'password',
      secret: true,
    },
    {
      key: 'PrivateKey',
      display: 'Private key',
      inputType: 'textArea',
      secret: true,
    },
  ],
};

async function renderForm(
  draft: AutomationTaskDraft = newDraft(SSH),
  canEdit = true,
) {
  const rendered = await renderComponent(AutomationParameterFormComponent, {
    inputs: { definition: SSH, draft, canEdit },
  });
  const changes = { count: 0 };
  rendered.fixture.componentInstance.changed.subscribe(() => changes.count++);
  return { ...rendered, draft, changes };
}

describe('AutomationParameterFormComponent', () => {
  /**
   * Verifies: each parameter is a field of its catalog type, and editing one writes it into the draft's parameters as text and announces the change.
   * Interacts with: setValue, the changed output.
   * Data: the SSH action; Hosts typed, Use sudo ticked, Shell chosen; Port's default 22.
   */
  it('edits the parameters by their type', async () => {
    const { draft, changes } = await renderForm();
    const user = userEvent.setup();

    expect(screen.getByRole('spinbutton', { name: 'Port' })).toHaveValue(22);
    expect(screen.getByText('Comma separated')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Hosts' }), 'web-01');
    await user.click(screen.getByRole('checkbox', { name: 'Use sudo' }));
    await user.click(screen.getByRole('combobox', { name: 'Shell' }));
    await user.click(await screen.findByRole('option', { name: 'POSIX sh' }));

    expect(draft.actionParameters).toEqual({
      Port: '22',
      Hosts: 'web-01',
      Sudo: 'true',
      Shell: 'sh',
    });
    expect(changes.count).toBeGreaterThan(0);
  });

  /**
   * Verifies: a secret the task holds reads "stored" and is never shown; Clear marks it to be removed, Undo keeps it, and Replace takes a new value into the secret changes alone.
   * Interacts with: isStored, clear, keep, replace, setSecret.
   * Data: a task holding a Password.
   */
  it('replaces or clears a stored secret without showing it', async () => {
    const draft = { ...newDraft(SSH), storedSecretKeys: ['Password'] };
    await renderForm(draft);
    const user = userEvent.setup();

    expect(screen.getByText('•••• stored')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear Password' }));
    expect(draft.secretChanges).toEqual({ Password: '' });
    expect(
      screen.getByText('Cleared when the event is saved'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep Password' }));
    expect(draft.secretChanges).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Replace Password' }));
    await user.type(screen.getByLabelText('Password'), 's3cret');
    expect(draft.secretChanges).toEqual({ Password: 's3cret' });
    expect(draft.actionParameters).not.toHaveProperty('Password');
  });

  /**
   * Verifies: emptying a field that replaces a stored secret changes nothing: only Clear removes it.
   * Interacts with: setSecret, the secret changes.
   * Data: a task holding a Password; Replace, a character typed, then deleted.
   */
  it('keeps a stored secret when its new value is emptied', async () => {
    const draft = { ...newDraft(SSH), storedSecretKeys: ['Password'] };
    await renderForm(draft);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Replace Password' }));
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.clear(screen.getByLabelText('Password'));

    expect(draft.secretChanges).toEqual({});
    expect(
      screen.queryByText('Cleared when the event is saved'),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: a secret that runs over several lines, a private key, is taken in a text area and kept as pasted, line breaks and all.
   * Interacts with: the secret's text area, setSecret.
   * Data: a two-line key.
   */
  it('takes a multi-line secret as it is pasted', async () => {
    const draft = newDraft(SSH);
    await renderForm(draft);
    const key =
      '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----';

    const field = screen.getByLabelText('Private key');
    expect(field.tagName).toBe('TEXTAREA');
    await userEvent.setup().click(field);
    await userEvent.setup().paste(key);

    expect(draft.secretChanges).toEqual({ PrivateKey: key });
  });

  /**
   * Verifies: read-only, the fields are disabled and a stored secret offers neither Replace nor Clear.
   * Interacts with: canEdit.
   * Data: canEdit false; a task holding a Password.
   */
  it('is read-only without the right to edit', async () => {
    await renderForm(
      { ...newDraft(SSH), storedSecretKeys: ['Password'] },
      false,
    );

    expect(screen.getByRole('textbox', { name: 'Hosts' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Use sudo' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Replace Password' }),
    ).not.toBeInTheDocument();
  });
});
