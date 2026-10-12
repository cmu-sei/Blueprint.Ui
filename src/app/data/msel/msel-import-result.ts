// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

// Hand-written until the client is regenerated against
// POST api/msels/json/import; replace with the generated MselImportResult.

import { Msel } from 'src/app/generated/blueprint.api';

export interface MselImportCounts {
  moves: number;
  scenarioEvents: number;
  cards: number;
  teams: number;
  dataFields: number;
  pages: number;
}

export interface MselImportChange {
  field: string;
  message: string;
}

export interface MselImportFailure {
  step: string;
  message: string;
}

export interface MselImportResult {
  msel: Msel;
  imported: MselImportCounts;
  changes: MselImportChange[];
  failures: MselImportFailure[];
}
