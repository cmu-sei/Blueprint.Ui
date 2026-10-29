// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { hasSvgImages, shrinkPhotos, svgImagesToPng } from './svg-to-png';

const SVG = 'data:image/svg+xml;base64,PHN2Zy8+';

describe('svgImagesToPng', () => {
  /**
   * Verifies: each SVG data URI image is drawn at its own size and replaced by the PNG, keeping its size and alt text.
   * Interacts with: the rasterize function, called once per SVG image.
   * Data: a 300x60 masthead and an 80x80 logo; a PNG image already in the HTML is left alone.
   */
  it('replaces each SVG image with a PNG of the same size', async () => {
    const rasterize = vi.fn(async (_src: string, width: number, height: number) => `data:image/png;base64,${width}x${height}`);

    const html = await svgImagesToPng(
      `<table><tbody><tr><td><img src="${SVG}" width="300" height="60" alt="Masthead"></td></tr></tbody></table>` +
        `<img src="${SVG}" width="80" height="80" alt="Logo"><img src="data:image/png;base64,AAAA" alt="Photo">`,
      rasterize
    );

    expect(rasterize).toHaveBeenCalledTimes(2);
    expect(rasterize).toHaveBeenCalledWith(SVG, 300, 60);
    expect(html).toContain('<img src="data:image/png;base64,300x60" width="300" height="60" alt="Masthead">');
    expect(html).toContain('<img src="data:image/png;base64,80x80" width="80" height="80" alt="Logo">');
    expect(html).toContain('<img src="data:image/png;base64,AAAA" alt="Photo">');
    expect(hasSvgImages(html)).toBe(false);
  });

  /**
   * Verifies: an image that cannot be drawn keeps its SVG, and the others are still converted.
   * Interacts with: a rasterize function that fails for one image.
   * Data: two SVG images, the first failing.
   */
  it('keeps the SVG of an image that cannot be drawn', async () => {
    let calls = 0;
    const html = await svgImagesToPng(`<img src="${SVG}" alt="A"><img src="${SVG}" alt="B">`, async () => {
      calls++;
      if (calls === 1) {
        throw new Error('broken');
      }
      return 'data:image/png;base64,OK';
    });

    expect(html).toContain(`<img src="${SVG}" alt="A">`);
    expect(html).toContain('<img src="data:image/png;base64,OK" alt="B">');
  });

  /**
   * Verifies: HTML without SVG images comes back unchanged, without being reparsed.
   * Interacts with: svgImagesToPng and hasSvgImages.
   * Data: a paragraph; an empty value.
   */
  it('leaves HTML without SVG images alone', async () => {
    const rasterize = vi.fn();

    expect(await svgImagesToPng('<p>Port closed</p>', rasterize)).toBe('<p>Port closed</p>');
    expect(await svgImagesToPng('', rasterize)).toBe('');
    expect(rasterize).not.toHaveBeenCalled();
    expect(hasSvgImages('<p>x</p>')).toBe(false);
  });
});

describe('shrinkPhotos', () => {
  /**
   * Verifies: each JPEG photo is redrawn at most 1080 pixels wide, keeping its size attributes and alt text; other images are left alone.
   * Interacts with: the shrink function, called once per JPEG.
   * Data: one JPEG photo and one PNG logo.
   */
  it('redraws each photo at article size', async () => {
    const shrink = vi.fn(async (_src: string, maxWidth: number) => `data:image/jpeg;base64,${maxWidth}`);

    const html = await shrinkPhotos(
      '<img src="data:image/jpeg;base64,BIG" width="720" height="405" alt="Crews"><img src="data:image/png;base64,LOGO" alt="Logo">',
      shrink
    );

    expect(shrink).toHaveBeenCalledTimes(1);
    expect(shrink).toHaveBeenCalledWith('data:image/jpeg;base64,BIG', 1080);
    expect(html).toBe('<img src="data:image/jpeg;base64,1080" width="720" height="405" alt="Crews"><img src="data:image/png;base64,LOGO" alt="Logo">');
  });

  /**
   * Verifies: a photo that cannot be drawn keeps its original data.
   * Interacts with: a shrink function that fails.
   * Data: one JPEG photo.
   */
  it('keeps a photo that cannot be drawn', async () => {
    const html = await shrinkPhotos('<img src="data:image/jpeg;base64,BIG" alt="Crews">', async () => {
      throw new Error('no canvas');
    });

    expect(html).toBe('<img src="data:image/jpeg;base64,BIG" alt="Crews">');
  });
});
