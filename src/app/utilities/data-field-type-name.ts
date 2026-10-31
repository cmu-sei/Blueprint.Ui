// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { Pipe, PipeTransform } from '@angular/core';

// The types a planner would not read right as the API's enum key. Every other key is shown as it is.
const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  AttackTechnique: 'Attack Technique',
  DefensiveTechnique: 'Defensive Technique',
};

/** A data field type's name as the Data Fields tab shows it: "Attack Technique" for AttackTechnique, otherwise the key. */
export function dataFieldTypeName(key: string | null | undefined): string {
  return (key && DISPLAY_NAMES[key]) || key || '';
}

@Pipe({ name: 'dataFieldTypeName' })
export class DataFieldTypeNamePipe implements PipeTransform {
  transform(key: string | null | undefined): string {
    return dataFieldTypeName(key);
  }
}
