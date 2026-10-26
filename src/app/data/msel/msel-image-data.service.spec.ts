// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { Msel, MselImageService } from 'src/app/generated/blueprint.api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { MselDataService } from './msel-data.service';
import { MselImageDataService } from './msel-image-data.service';

const MONDAY = new Date('2026-10-19T12:00:00Z');
const TUESDAY = new Date('2026-10-20T12:00:00Z');
const card = (imageDateModified?: Date | null): Msel => ({ id: 'msel-1', name: 'Exercise Alpha', imageDateModified });

function setup(getMselImage = vi.fn(() => of(new Blob(['image'], { type: 'image/png' })))) {
  const imageApi = {
    getMselImage,
    setMselImage: vi.fn(() => of<Msel>(card(TUESDAY))),
    deleteMselImage: vi.fn(() => of<Msel>(card(null))),
  } satisfies ApiStub<MselImageService>;
  const mselData = { updateImageDateModified: vi.fn() } satisfies Pick<MselDataService, 'updateImageDateModified'>;
  TestBed.configureTestingModule({
    providers: [
      { provide: MselImageService, useValue: imageApi },
      { provide: MselDataService, useValue: mselData },
    ],
  });
  return { service: TestBed.inject(MselImageDataService), imageApi, mselData };
}

describe('MselImageDataService', () => {
  let created: number;
  // jsdom has no object URLs.
  beforeEach(() => {
    created = 0;
    URL.createObjectURL = vi.fn(() => `blob:${++created}`);
    URL.revokeObjectURL = vi.fn();
  });

  /**
   * Verifies: an MSEL without ImageDateModified answers no URL and fetches nothing.
   * Interacts with: MselImageService.getMselImage (stub, not called).
   * Data: msel-1 with no image marker.
   */
  it('answers no URL for an MSEL without an image', async () => {
    const { service, imageApi } = setup();

    expect(await firstValueFrom(service.imageUrl(card()))).toBeNull();
    expect(imageApi.getMselImage).not.toHaveBeenCalled();
  });

  /**
   * Verifies: the image is fetched once per ImageDateModified; a new date fetches again and revokes the old URL.
   * Interacts with: MselImageService.getMselImage (stub), URL.createObjectURL / revokeObjectURL (stubs).
   * Data: msel-1 read twice with Monday's date, then once with Tuesday's.
   */
  it('caches the URL until the image changes', async () => {
    const { service, imageApi } = setup();

    expect(await firstValueFrom(service.imageUrl(card(MONDAY)))).toBe('blob:1');
    expect(await firstValueFrom(service.imageUrl(card(new Date(MONDAY))))).toBe('blob:1');
    expect(imageApi.getMselImage).toHaveBeenCalledTimes(1);

    expect(await firstValueFrom(service.imageUrl(card(TUESDAY)))).toBe('blob:2');
    expect(imageApi.getMselImage).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
  });

  /**
   * Verifies: a failed image read answers no URL, so the card keeps its generated pattern.
   * Interacts with: MselImageService.getMselImage (stub, answers 404).
   * Data: msel-1 with Monday's date.
   */
  it('answers no URL when the image cannot be read', async () => {
    const { service } = setup(vi.fn(() => throwError(() => new Error('404'))));

    expect(await firstValueFrom(service.imageUrl(card(MONDAY)))).toBeNull();
  });

  /**
   * Verifies: setting and deleting the image store only the new ImageDateModified, and deleting revokes the shown URL.
   * Interacts with: MselImageService.setMselImage / deleteMselImage (stubs), MselDataService.updateImageDateModified (spy).
   * Data: msel-1 shown with Monday's image, then a new upload (Tuesday), then a delete.
   */
  it('stores the image marker after an upload or a delete', async () => {
    const { service, imageApi, mselData } = setup();
    await firstValueFrom(service.imageUrl(card(MONDAY)));
    const file = new File(['x'], 'card.png', { type: 'image/png' });

    await firstValueFrom(service.setImage('msel-1', file));
    await firstValueFrom(service.deleteImage('msel-1'));

    expect(imageApi.setMselImage).toHaveBeenCalledWith('msel-1', file);
    expect(imageApi.deleteMselImage).toHaveBeenCalledWith('msel-1');
    expect(mselData.updateImageDateModified.mock.calls).toEqual([
      ['msel-1', TUESDAY],
      ['msel-1', null],
    ]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
  });
});
