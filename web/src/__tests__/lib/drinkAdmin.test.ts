import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRef, mockDeleteObject, mockDeleteDoc, mockDoc } = vi.hoisted(() => ({
  mockRef: vi.fn((_storage: unknown, path: string) => ({ path })),
  mockDeleteObject: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockDoc: vi.fn((_db: unknown, coll: string, id: string) => ({ coll, id })),
}));

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  deleteDoc: mockDeleteDoc,
}));

vi.mock('firebase/storage', () => ({
  ref: mockRef,
  deleteObject: mockDeleteObject,
}));

import { storageRefFromUrl, deleteDrink } from '../../lib/drinkAdmin';

describe('storageRefFromUrl', () => {
  beforeEach(() => {
    mockRef.mockClear();
  });

  it('passes firebasestorage.googleapis.com download URLs straight to ref()', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/demo/o/drinks%2Ffoo.jpg?alt=media&token=abc';
    storageRefFromUrl(url);
    expect(mockRef).toHaveBeenCalledWith({}, url);
  });

  it('extracts the object path from storage.googleapis.com public URLs', () => {
    storageRefFromUrl('https://storage.googleapis.com/the-speakeasy-e3533.firebasestorage.app/drinks/old-fashioned.png');
    expect(mockRef).toHaveBeenCalledWith({}, 'drinks/old-fashioned.png');
  });

  it('decodes URL-encoded object paths', () => {
    storageRefFromUrl('https://storage.googleapis.com/bucket/drinks/tommy%27s-margarita.png');
    expect(mockRef).toHaveBeenCalledWith({}, "drinks/tommy's-margarita.png");
  });
});

describe('deleteDrink', () => {
  beforeEach(() => {
    mockDeleteObject.mockReset().mockResolvedValue(undefined);
    mockDeleteDoc.mockReset().mockResolvedValue(undefined);
  });

  it('deletes the photo then the document', async () => {
    await deleteDrink({ id: 'drink-1', photoPath: 'https://storage.googleapis.com/bucket/drinks/a.png' });
    expect(mockDeleteObject).toHaveBeenCalled();
    expect(mockDeleteDoc).toHaveBeenCalledWith({ coll: 'drinks', id: 'drink-1' });
  });

  it('skips storage when there is no photo', async () => {
    await deleteDrink({ id: 'drink-2', photoPath: null });
    expect(mockDeleteObject).not.toHaveBeenCalled();
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('still deletes the document when the photo delete fails', async () => {
    mockDeleteObject.mockRejectedValue(new Error('object not found'));
    await deleteDrink({ id: 'drink-3', photoPath: 'https://storage.googleapis.com/bucket/drinks/gone.png' });
    expect(mockDeleteDoc).toHaveBeenCalledWith({ coll: 'drinks', id: 'drink-3' });
  });
});
