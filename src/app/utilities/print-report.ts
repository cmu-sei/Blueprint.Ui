// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// Helpers for the printed reports (the Assessor View's assessment report).
// The footer and duration follow the MSEL Playbook print (playbookFooterCss and
// formatPlaybookDuration on feature/playbook-print-cover); once that print is on
// main the two can share them.

/**
 * A print footer's MSEL name, as the bottom-left margin box of an @page named
 * page. Margin box content can't read the DOM, so the name is written into a
 * CSS string.
 */
export function printFooterCss(pageName: string, mselName: string): string {
  const name = (mselName ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
  return `@page ${pageName} { @bottom-left { content: "${name}"; } }`;
}

/** A duration as days, hours and minutes, e.g. "1 day 4 hours 30 minutes". */
export function formatPrintDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(+totalSeconds || 0));
  const parts: [number, string][] = [
    [Math.floor(seconds / 86400), 'day'],
    [Math.floor((seconds % 86400) / 3600), 'hour'],
    [Math.floor((seconds % 3600) / 60), 'minute'],
  ];
  const text = parts
    .filter(([n]) => n > 0)
    .map(([n, unit]) => `${n} ${unit}${n === 1 ? '' : 's'}`)
    .join(' ');
  return text || `${seconds} second${seconds === 1 ? '' : 's'}`;
}

/** HTML as one line of plain text. A template's content is inert, so nothing in it loads. */
export function plainText(html: string | null | undefined): string {
  if (!html) {
    return '';
  }
  const template = document.createElement('template');
  template.innerHTML = html;
  return (template.content.textContent ?? '').replace(/\s+/g, ' ').trim();
}
