// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
/// Released unde^Ca MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { TestBed, inject } from '@angular/core/testing';

import { SystemMessageService } from './system-message.service';

describe('SystemMessageService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SystemMessageService]
    });
  });

  it('should be created', inject([SystemMessageService], (service: SystemMessageService) => {
    expect(service).toBeTruthy();
  }));
});

