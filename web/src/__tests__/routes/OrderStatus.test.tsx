import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { DocumentData, DocumentSnapshot, FirestoreError } from 'firebase/firestore';

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
  messaging: null,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
}));

vi.mock('react-firebase-hooks/firestore', () => ({
  useDocumentData: vi.fn(),
}));

import { useDocumentData } from 'react-firebase-hooks/firestore';
import OrderStatus from '../../routes/OrderStatus';
import type { Order } from '../../lib/schema';

const mockUseDocumentData = vi.mocked(useDocumentData);

function renderOrderStatus(orderId = 'order-1') {
  return render(
    <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
      <Routes>
        <Route path="/orders/:id" element={<OrderStatus />} />
      </Routes>
    </MemoryRouter>,
  );
}

const baseOrder: Omit<Order, 'id'> = {
  drinkId: 'drink-1',
  drinkName: 'Negroni',
  guestUid: 'guest-uid',
  guestName: 'Alice',
  status: 'received',
  partyMode: false,
};

type UseDocumentDataReturn = [DocumentData | undefined, boolean, FirestoreError | undefined, DocumentSnapshot | undefined];

describe('OrderStatus', () => {
  beforeEach(() => {
    mockUseDocumentData.mockReset();
  });

  it('shows spinner while loading', () => {
    mockUseDocumentData.mockReturnValue([undefined, true, undefined, undefined] as UseDocumentDataReturn);
    renderOrderStatus();
    expect(screen.queryByText('Negroni')).not.toBeInTheDocument();
  });

  it('shows "Order not found" when data is undefined', () => {
    mockUseDocumentData.mockReturnValue([undefined, false, undefined, undefined] as UseDocumentDataReturn);
    renderOrderStatus();
    expect(screen.getByText(/order not found/i)).toBeInTheDocument();
  });

  it('renders drink name and guest name', () => {
    mockUseDocumentData.mockReturnValue([baseOrder, false, undefined, undefined] as UseDocumentDataReturn);
    renderOrderStatus();
    expect(screen.getByText('Negroni')).toBeInTheDocument();
    expect(screen.getByText(/for Alice/i)).toBeInTheDocument();
  });

  it('shows 2-step stepper in simple mode (partyMode false)', () => {
    mockUseDocumentData.mockReturnValue([{ ...baseOrder, partyMode: false }, false, undefined, undefined] as UseDocumentDataReturn);
    renderOrderStatus();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Seen')).toBeInTheDocument();
    expect(screen.queryByText('Making')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready!')).not.toBeInTheDocument();
  });

  it('shows 4-step stepper in party mode', () => {
    mockUseDocumentData.mockReturnValue([
      { ...baseOrder, partyMode: true, status: 'making' },
      false, undefined, undefined,
    ] as UseDocumentDataReturn);
    renderOrderStatus();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Seen')).toBeInTheDocument();
    expect(screen.getByText('Making')).toBeInTheDocument();
    expect(screen.getByText('Ready!')).toBeInTheDocument();
  });

  it('shows "Your drink is ready!" when status is ready', () => {
    mockUseDocumentData.mockReturnValue([
      { ...baseOrder, status: 'ready', partyMode: true },
      false, undefined, undefined,
    ] as UseDocumentDataReturn);
    renderOrderStatus();
    expect(screen.getByText(/your drink is ready/i)).toBeInTheDocument();
  });

  it('shows cheers UI when status is delivered', () => {
    mockUseDocumentData.mockReturnValue([
      { ...baseOrder, status: 'delivered' },
      false, undefined, undefined,
    ] as UseDocumentDataReturn);
    renderOrderStatus();
    expect(screen.getByText(/Enjoy!/i)).toBeInTheDocument();
    expect(screen.getByText(/Cheers/i)).toBeInTheDocument();
  });
});
