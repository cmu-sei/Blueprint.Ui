// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

/** Draws an SVG data URI at the given size and answers it as a PNG data URI. */
export type Rasterize = (svgSrc: string, width: number, height: number) => Promise<string>;

const SVG_IMAGE = 'img[src^="data:image/svg+xml"]';

/**
 * Replaces each SVG data URI image in the HTML with a PNG of the same size. Gallery shows SVG images, but
 * Blueprint's own views and CITE's side panel show only PNG, so AI-written articles and profiles are saved
 * with PNG. An image that cannot be drawn keeps its SVG.
 */
export async function svgImagesToPng(html: string, rasterize: Rasterize = drawOnCanvas): Promise<string> {
  if (!html || !html.includes('data:image/svg+xml')) {
    return html;
  }
  const document = new DOMParser().parseFromString(html, 'text/html');
  const images = Array.from(document.querySelectorAll<HTMLImageElement>(SVG_IMAGE));
  await Promise.all(
    images.map(async (image) => {
      const width = Number(image.getAttribute('width')) || 120;
      const height = Number(image.getAttribute('height')) || 40;
      try {
        image.setAttribute('src', await rasterize(image.getAttribute('src'), width, height));
      } catch {
        // the SVG still shows in Gallery
      }
    })
  );
  return document.body.innerHTML;
}

/** The SVG images an HTML value holds, so a caller can tell whether it needs converting. */
export function hasSvgImages(html: string): boolean {
  return !!html && html.includes('data:image/svg+xml');
}

// twice the size, so the PNG stays sharp on high-density screens; the img keeps its width and height
const SCALE = 2;

function drawOnCanvas(svgSrc: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image(width, height);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * SCALE;
      canvas.height = height * SCALE;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('No canvas'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('The SVG could not be drawn'));
    image.src = svgSrc;
  });
}

/** Draws a photo data URI at most the given width and answers it as a JPEG data URI. */
export type Shrink = (src: string, maxWidth: number) => Promise<string>;

// photos are shown 720 pixels wide; half again keeps them sharp on high-density screens
const PHOTO_WIDTH = 1080;

/**
 * Redraws each JPEG photo in the HTML at most 1080 pixels wide. The image model makes photos about 2000 pixels
 * wide, several times what an article shows, and each one is stored in the article. A photo that cannot be
 * drawn is kept as it is.
 */
export async function shrinkPhotos(html: string, shrink: Shrink = shrinkOnCanvas): Promise<string> {
  if (!html || !html.includes('data:image/jpeg')) {
    return html;
  }
  const document = new DOMParser().parseFromString(html, 'text/html');
  const images = Array.from(document.querySelectorAll<HTMLImageElement>('img[src^="data:image/jpeg"]'));
  await Promise.all(
    images.map(async (image) => {
      try {
        image.setAttribute('src', await shrink(image.getAttribute('src'), PHOTO_WIDTH));
      } catch {
        // the full-size photo still shows
      }
    })
  );
  return document.body.innerHTML;
}

/** The images Blueprint keeps: SVG drawn as PNG, and photos at the size articles show them. */
export async function prepareImages(html: string): Promise<string> {
  return shrinkPhotos(await svgImagesToPng(html));
}

function shrinkOnCanvas(src: string, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth <= maxWidth) {
        resolve(src);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = Math.round((image.naturalHeight * maxWidth) / image.naturalWidth);
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('No canvas'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => reject(new Error('The photo could not be drawn'));
    image.src = src;
  });
}
