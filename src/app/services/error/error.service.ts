/*
 Copyright 2023 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

import { Injectable, Injector, ErrorHandler } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SystemMessageService } from '../system-message/system-message.service';

@Injectable({
  providedIn: 'root',
})
export class ErrorService implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(err: any) {
    const messageService = this.injector.get(SystemMessageService);
    // Http failure response for (unknown url): 0 Unknown Error
    if (err instanceof HttpErrorResponse) {
      if (
        err.message.startsWith('Http failure response for') &&
        err.message.endsWith('0 Unknown Error')
      ) {
        messageService.displayMessage(
          'API Error',
          'The API could not be reached.'
        );
        console.log('API Error', 'The API could not be reached.');
      } else if (err.error && err.error.title) {
        // Enhanced error handling: extract detailed message from error response
        let detailedMessage = err.error.title;

        // Check for additional detail in the error response
        if (err.error.detail) {
          detailedMessage += '\n\n' + err.error.detail;
        }

        // Check for validation errors (common in API responses)
        if (err.error.errors && typeof err.error.errors === 'object') {
          const validationErrors = Object.values(err.error.errors)
            .flat()
            .join('\n');
          if (validationErrors) {
            detailedMessage += '\n\nValidation errors:\n' + validationErrors;
          }
        }

        messageService.displayMessage(err.statusText || 'Error', detailedMessage);
        console.error(err.statusText + ' ==> ' + detailedMessage, err);
      } else if (err.error && typeof err.error === 'string') {
        // Handle case where error is a plain string (from CITE API improvements)
        messageService.displayMessage(err.statusText || 'Error', err.error);
        console.error(err.statusText + ' ==> ' + err.error, err);
      } else {
        messageService.displayMessage(err.statusText, err.message);
        console.error(err.statusText + ' ==> ' + err.message, err);
      }
    } else if (err.message && err.message.startsWith('Uncaught (in promise)')) {
      if (err.rejection && err.rejection.statusCode === 401) {
        // nothing to do here, the signalR reconnect handles the situation.
      } else if (err.rejection && err.rejection.message === 'Network Error') {
        messageService.displayMessage(
          'Identity Server Error',
          'The Identity Server could not be reached for user authentication.'
        );
        console.log(
          'Identity Server Error',
          'The Identity Server could not be reached for user authentication.'
        );
      } else if (err.rejection && err.rejection.message === 'Failed to fetch') {
        console.log('SignalR error reaching the Gallery API:  ' + err.rejection.message);
      } else {
        const rejectionMessage = err.rejection ? err.rejection.message : err.message;
        messageService.displayMessage('Error', rejectionMessage);
        console.error(rejectionMessage, err);
      }
    } else {
      messageService.displayMessage(err.name || 'Error', err.message || 'An unexpected error occurred');
      console.error((err.name || 'Error') + ' ==> ' + (err.message || 'Unknown error'), err);
    }
  }
}
