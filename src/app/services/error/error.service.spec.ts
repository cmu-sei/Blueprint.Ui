// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { SystemMessageService } from '../system-message/system-message.service';
import { ErrorService } from './error.service';

function setup() {
  const displayMessage = vi.fn();
  const messages: Pick<SystemMessageService, 'displayMessage'> = { displayMessage };
  TestBed.configureTestingModule({
    providers: [ErrorService, { provide: SystemMessageService, useValue: messages }],
  });
  // The service logs what it shows: console.log for the expected cases (not
  // asserted), console.error for the rest, asserted per case below.
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return { service: TestBed.inject(ErrorService), displayMessage, consoleError };
}

const rejection = (r: object) => ({ message: 'Uncaught (in promise): x', rejection: r });
const problem = new HttpErrorResponse({
  status: 400,
  statusText: 'Bad Request',
  url: 'https://api.test/msels',
  error: {
    title: 'Invalid MSEL',
    detail: 'The MSEL could not be saved.',
    errors: { Name: ['Name is required'], StartTime: ['Start time is invalid'] },
  },
});
const problemText =
  'Invalid MSEL\n\nThe MSEL could not be saved.\n\nValidation errors:\nName is required\nStart time is invalid';
const conflict = new HttpErrorResponse({
  status: 409,
  statusText: 'Conflict',
  url: 'https://api.test/x',
  error: 'Already exists',
});
const serverError = new HttpErrorResponse({ status: 500, statusText: 'Server Error', url: 'https://api.test/x' });
const unreachable = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
const odd = rejection({ message: 'Something odd' });
const typeError = new TypeError('x is undefined');
const empty = {};

describe('ErrorService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Verifies: each kind of error is shown with the right title and text, and logged to console.error when it is not an expected case.
   * Interacts with: SystemMessageService.displayMessage (spy), console.error (spy).
   * Data: HTTP errors (status 0, problem details with validation errors, a string body, a bare 500), unhandled promise rejections (401, failed fetch, identity-server network error, other), a TypeError and an empty object.
   */
  it.each([
    { label: 'an unreachable API', error: unreachable, shown: [['API Error', 'The API could not be reached.']], logged: [] },
    { label: 'problem details with validation errors', error: problem, shown: [['Bad Request', problemText]], logged: [[`Bad Request ==> ${problemText}`, problem]] },
    { label: 'a plain-string body', error: conflict, shown: [['Conflict', 'Already exists']], logged: [['Conflict ==> Already exists', conflict]] },
    { label: 'any other HTTP error', error: serverError, shown: [['Server Error', serverError.message]], logged: [[`Server Error ==> ${serverError.message}`, serverError]] },
    { label: 'a 401 rejection', error: rejection({ statusCode: 401 }), shown: [], logged: [] },
    { label: 'a failed-fetch rejection', error: rejection({ message: 'Failed to fetch' }), shown: [], logged: [] },
    {
      label: 'an identity-server network rejection',
      error: rejection({ message: 'Network Error' }),
      shown: [['Identity Server Error', 'The Identity Server could not be reached for user authentication.']],
      logged: [],
    },
    { label: 'any other rejection', error: odd, shown: [['Error', 'Something odd']], logged: [['Something odd', odd]] },
    { label: 'a TypeError', error: typeError, shown: [['TypeError', 'x is undefined']], logged: [['TypeError ==> x is undefined', typeError]] },
    { label: 'an error with no name or message', error: empty, shown: [['Error', 'An unexpected error occurred']], logged: [['Error ==> Unknown error', empty]] },
  ])('handles $label', ({ error, shown, logged }) => {
    const { service, displayMessage, consoleError } = setup();

    service.handleError(error);

    expect(displayMessage.mock.calls).toEqual(shown);
    expect(consoleError.mock.calls).toEqual(logged);
  });
});
