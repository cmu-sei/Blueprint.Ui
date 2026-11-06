// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * A MSEL's marking: none, a generic exercise banner, a TLP marking, or a classification banner in the planner's words.
 * The API puts it on the Gallery articles it pushes (ArticleMarkings in Blueprint.Api); the MSEL's pages draw it here,
 * in the same words and colours.
 */
export const MSEL_MARKINGS = [
  { value: 'None', label: 'None' },
  { value: 'Exercise', label: 'Exercise banner' },
  { value: 'Tlp', label: 'TLP' },
  { value: 'Classification', label: 'Classification banner' },
];

/** The TLP 2.0 levels */
export const TLP_LEVELS = ['CLEAR', 'GREEN', 'AMBER', 'AMBER+STRICT', 'RED'];

/** The longest classification banner the API keeps */
export const CLASSIFICATION_MAX_LENGTH = 120;

export interface MarkingBanner {
  text: string;
  background: string;
  color: string;
  /** a second, smaller line, as the exercise banner has */
  subtext?: string;
  align: 'left' | 'center';
}

/** The banner for a MSEL's marking, or null for none: a marking not set or not known is none, as in the API. */
export function markingBanner(marking: string | null | undefined, text: string | null | undefined, exerciseName?: string): MarkingBanner | null {
  const kind = MSEL_MARKINGS.find((m) => m.value.toLowerCase() === (marking ?? '').trim().toLowerCase())?.value ?? 'None';
  const value = text?.trim() || null;
  switch (kind) {
    case 'Exercise':
      return {
        text: 'EXERCISE · EXERCISE · EXERCISE',
        background: '#FDB516',
        color: '#000000',
        subtext: (exerciseName?.trim() ? exerciseName.trim() + ' · ' : '') + 'FICTIONAL SCENARIO',
        align: 'center',
      };
    case 'Tlp': {
      const asked = value?.replace(/TLP:/i, '').trim().toUpperCase();
      const level = TLP_LEVELS.find((l) => l === asked) ?? 'CLEAR';
      return { text: 'TLP:' + level, background: '#000000', color: tlpColor(level), align: 'left' };
    }
    case 'Classification': {
      if (!value) {
        return null;
      }
      const words = value.slice(0, CLASSIFICATION_MAX_LENGTH).toUpperCase();
      return { text: words, ...classificationColors(words), align: 'center' };
    }
    default:
      return null;
  }
}

function tlpColor(level: string): string {
  switch (level) {
    case 'RED':
      return '#FF2B2B';
    case 'AMBER':
    case 'AMBER+STRICT':
      return '#FFC000';
    case 'GREEN':
      return '#33FF00';
    default:
      return '#FFFFFF';
  }
}

// the colours used on US classification banners, by the level the text names
function classificationColors(upper: string): { background: string; color: string } {
  if (upper.includes('TOP SECRET')) {
    return { background: upper.includes('SCI') ? '#FCE83A' : '#FF8C00', color: '#000000' };
  }
  if (/\bSECRET\b/.test(upper)) {
    return { background: '#C8102E', color: '#FFFFFF' };
  }
  if (upper.includes('CONFIDENTIAL')) {
    return { background: '#0033A0', color: '#FFFFFF' };
  }
  if (/\bCUI\b|CONTROLLED UNCLASSIFIED/.test(upper)) {
    return { background: '#502B85', color: '#FFFFFF' };
  }
  return { background: '#007A33', color: '#FFFFFF' };
}
