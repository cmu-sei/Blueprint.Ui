// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Directive, inject } from '@angular/core';
import {
  MAT_CHECKBOX_DEFAULT_OPTIONS,
  MatCheckboxDefaultOptions,
} from '@angular/material/checkbox';

// A checkbox that only ever shows what its [checked] binding says. A click does not tick it: the (click) handler
// changes the model, and the box follows once the change lands. A confirm that is cancelled, or a request that
// fails, leaves it as it was instead of out of step with the model.
@Directive({
  selector: 'mat-checkbox[appModelCheckbox]',
  providers: [
    {
      provide: MAT_CHECKBOX_DEFAULT_OPTIONS,
      useFactory: (): MatCheckboxDefaultOptions => ({
        ...inject(MAT_CHECKBOX_DEFAULT_OPTIONS, { skipSelf: true }),
        clickAction: 'noop',
      }),
    },
  ],
})
export class ModelCheckboxDirective {}
