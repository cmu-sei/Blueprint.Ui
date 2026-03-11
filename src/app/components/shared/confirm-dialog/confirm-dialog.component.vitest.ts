// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderConfirmDialog(
  overrides: {
    title?: string;
    message?: string;
    data?: any;
    closeFn?: () => void;
  } = {},
) {
  const {
    title = 'Confirm Action',
    message = 'Are you sure?',
    data = {},
    closeFn = vi.fn(),
  } = overrides;

  const result = await renderComponent(ConfirmDialogComponent, {
    declarations: [ConfirmDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: closeFn, disableClose: false } },
    ],
    componentProperties: {
      title,
      message,
    },
  });

  return { ...result, closeFn };
}

describe('ConfirmDialogComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderConfirmDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the title', async () => {
    await renderConfirmDialog({ title: 'Delete Item?' });
    expect(screen.getByText('Delete Item?')).toBeInTheDocument();
  });

  it('should display the message', async () => {
    await renderConfirmDialog({ message: 'This cannot be undone.' });
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('should show YES and NO buttons', async () => {
    await renderConfirmDialog();
    expect(screen.getByText('YES')).toBeInTheDocument();
    expect(screen.getByText('NO')).toBeInTheDocument();
  });

  it('should close dialog with confirm true when YES is clicked', async () => {
    const data = {};
    const closeFn = vi.fn();
    await renderConfirmDialog({ data, closeFn });
    const user = userEvent.setup();
    await user.click(screen.getByText('YES'));
    expect(data['confirm']).toBe(true);
    expect(closeFn).toHaveBeenCalledWith(data);
  });

  it('should close dialog with confirm false when NO is clicked', async () => {
    const data = {};
    const closeFn = vi.fn();
    await renderConfirmDialog({ data, closeFn });
    const user = userEvent.setup();
    await user.click(screen.getByText('NO'));
    expect(data['confirm']).toBe(false);
    expect(closeFn).toHaveBeenCalledWith(data);
  });
});
