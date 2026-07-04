import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { DocumentData, DocumentSnapshot, FirestoreError } from 'firebase/firestore';

const { mockCall, mockNavigate, mockSaveName } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  mockNavigate: vi.fn(),
  mockSaveName: vi.fn(),
}));

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

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCall),
}));

vi.mock('firebase/app', () => ({
  FirebaseError: class FirebaseError extends Error {
    code: string;
    constructor(code: string, message?: string) {
      super(message ?? code);
      this.code = code;
      this.name = 'FirebaseError';
    }
  },
}));

vi.mock('react-firebase-hooks/firestore', () => ({
  useDocumentData: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useAppConfig', () => ({
  useAppConfig: vi.fn(),
}));

vi.mock('../../hooks/useGuestName', () => ({
  useGuestName: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

import { ThemeProvider } from '@mui/material/styles';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { useAuth } from '../../hooks/useAuth';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useGuestName } from '../../hooks/useGuestName';
import { FirebaseError } from 'firebase/app';
import { getAppTheme } from '../../themes';
import DrinkDetail from '../../routes/DrinkDetail';

const mockUseDocumentData = vi.mocked(useDocumentData);
const mockUseAuth = vi.mocked(useAuth);
const mockUseAppConfig = vi.mocked(useAppConfig);
const mockUseGuestName = vi.mocked(useGuestName);

type UseDocumentDataReturn = [DocumentData | undefined, boolean, FirestoreError | undefined, DocumentSnapshot | undefined];

const drink = {
  name: 'Negroni',
  description: 'Bitter and bold.',
  ingredients: ['1 oz gin', '1 oz Campari', '1 oz sweet vermouth'],
  category: 'Classics',
  available: true,
};

function renderDrinkDetail() {
  return render(
    <ThemeProvider theme={getAppTheme('speakeasy')}>
      <MemoryRouter initialEntries={['/drink/drink-1']}>
        <Routes>
          <Route path="/drink/:id" element={<DrinkDetail />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('DrinkDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDocumentData.mockReturnValue([drink, false, undefined, undefined] as UseDocumentDataReturn);
    mockUseAuth.mockReturnValue({ user: { uid: 'guest-uid', isAnonymous: true }, loading: false, error: undefined } as ReturnType<typeof useAuth>);
    mockUseAppConfig.mockReturnValue({ config: { barOpen: true, adminUid: 'admin' }, loading: false } as ReturnType<typeof useAppConfig>);
    mockUseGuestName.mockReturnValue({ savedName: '', saveName: mockSaveName });
    localStorage.clear();
    mockCall.mockResolvedValue({ data: { orderId: 'order-123' } });
    mockSaveName.mockResolvedValue(undefined);
  });

  it('requires a name before the order button enables', () => {
    renderDrinkDetail();
    expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled();
  });

  it('places an order via the createOrder callable with name and location', async () => {
    const user = userEvent.setup();
    renderDrinkDetail();

    await user.type(screen.getByPlaceholderText(/so the bartender/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(mockCall).toHaveBeenCalledWith({
      drinkId: 'drink-1',
      guestName: 'Alice',
    });
    expect(mockSaveName).toHaveBeenCalledWith('Alice');
    expect(mockNavigate).toHaveBeenCalledWith('/orders/order-123');
  });

  it('includes a trimmed special request in the payload when provided', async () => {
    const user = userEvent.setup();
    renderDrinkDetail();

    await user.type(screen.getByPlaceholderText(/so the bartender/i), 'Alice');
    await user.type(screen.getByPlaceholderText(/special request/i), '  no egg white  ');
    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(mockCall).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'no egg white' }),
    );
  });

  it('shows "Ordering as" with the saved name and orders in one tap', async () => {
    mockUseGuestName.mockReturnValue({ savedName: 'Alice', saveName: mockSaveName });
    const user = userEvent.setup();
    renderDrinkDetail();

    expect(screen.getByText(/ordering as/i)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/so the bartender/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(mockCall).toHaveBeenCalledWith(expect.objectContaining({ guestName: 'Alice' }));
  });

  it('re-expands the name field when Change is clicked', async () => {
    mockUseGuestName.mockReturnValue({ savedName: 'Alice', saveName: mockSaveName });
    const user = userEvent.setup();
    renderDrinkDetail();

    await user.click(screen.getByRole('button', { name: /change/i }));
    expect(screen.getByPlaceholderText(/so the bartender/i)).toHaveValue('Alice');
  });

  it('reveals the password field when the server wants the door password', async () => {
    mockCall.mockRejectedValue(new FirebaseError('functions/permission-denied', 'password'));
    const user = userEvent.setup();
    renderDrinkDetail();

    await user.type(screen.getByPlaceholderText(/so the bartender/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText(/door password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what's the password/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    // Enter it and retry — the password rides along
    mockCall.mockResolvedValue({ data: { orderId: 'order-123' } });
    await user.click(screen.getByLabelText(/what's the password/i));
    await user.paste('VELVET EAGLE');
    await user.click(screen.getByRole('button', { name: /place order/i }));
    expect(mockCall).toHaveBeenLastCalledWith(
      expect.objectContaining({ password: 'VELVET EAGLE' }),
    );
    expect(localStorage.getItem('speakeasy.barPassword')).toBe('VELVET EAGLE');
  });

  it('sends a stored password automatically', async () => {
    localStorage.setItem('speakeasy.barPassword', 'SASSY WALRUS');
    const user = userEvent.setup();
    renderDrinkDetail();

    await user.type(screen.getByPlaceholderText(/so the bartender/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(mockCall).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'SASSY WALRUS' }),
    );
  });

  it('shows the bar-closed message on failed-precondition', async () => {
    mockCall.mockRejectedValue(new FirebaseError('functions/failed-precondition', 'closed'));
    const user = userEvent.setup();
    renderDrinkDetail();

    await user.type(screen.getByPlaceholderText(/so the bartender/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText(/the bar is closed right now/i)).toBeInTheDocument();
  });

  it('disables ordering and explains when the bar is closed', async () => {
    mockUseAppConfig.mockReturnValue({ config: { barOpen: false, adminUid: 'admin' }, loading: false } as ReturnType<typeof useAppConfig>);
    const user = userEvent.setup();
    renderDrinkDetail();

    await user.type(screen.getByPlaceholderText(/so the bartender/i), 'Alice');
    expect(screen.getByRole('button', { name: /place order/i })).toBeDisabled();
    expect(screen.getByText(/ordering opens when the bartender/i)).toBeInTheDocument();
  });

  it('offers Google sign-in to anonymous users without blocking ordering', () => {
    renderDrinkDetail();
    expect(screen.getByRole('link', { name: /sign in with google/i })).toHaveAttribute('href', '/signin');
  });

  it('hides the sign-in offer for signed-in users', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'g-uid', isAnonymous: false, displayName: 'Alice' }, loading: false, error: undefined } as ReturnType<typeof useAuth>);
    renderDrinkDetail();
    expect(screen.queryByRole('link', { name: /sign in with google/i })).not.toBeInTheDocument();
  });
});
