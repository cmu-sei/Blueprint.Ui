// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { DataFieldType } from 'src/app/generated/blueprint.api';
import { DataFieldTypeNamePipe, dataFieldTypeName } from './data-field-type-name';

describe('dataFieldTypeName', () => {
  /**
   * Verifies: the two technique types read as two words; every other type keeps the key the API uses.
   * Interacts with: dataFieldTypeName, DataFieldTypeNamePipe.
   * Data: AttackTechnique, DefensiveTechnique, DateTime, IpAddress, Competency, a retired key, empty.
   */
  it.each([
    { key: DataFieldType.AttackTechnique, name: 'Attack Technique' },
    { key: DataFieldType.DefensiveTechnique, name: 'Defensive Technique' },
    { key: DataFieldType.DateTime, name: 'DateTime' },
    { key: DataFieldType.IpAddress, name: 'IpAddress' },
    { key: DataFieldType.Competency, name: 'Competency' },
    { key: 'IntegrationTarget', name: 'IntegrationTarget' },
    { key: '', name: '' },
    { key: undefined as string, name: '' },
  ])('shows $key as "$name"', ({ key, name }) => {
    expect(dataFieldTypeName(key)).toBe(name);
    expect(new DataFieldTypeNamePipe().transform(key)).toBe(name);
  });
});
