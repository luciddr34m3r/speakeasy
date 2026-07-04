import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import type { Drink } from '../../lib/schema';

const { mockDeleteDrink, mockNavigate } = vi.hoisted(() => ({
  mockDeleteDrink: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('../../hooks/useDrinks', () => ({
  useDrinks: vi.fn(),
}));

vi.mock('../../lib/drinkAdmin', () => ({
  deleteDrink: mockDeleteDrink,
}));

vi.mock('../../components/AdminGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/AdminNav', () => ({
  default: () => <nav data-testid="admin-nav" />,
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

import { useDrinks } from '../../hooks/useDrinks';
import { getAppTheme } from '../../themes';
import MenuAdmin from '../../routes/admin/MenuAdmin';

const mockUseDrinks = vi.mocked(useDrinks);

const drinks: Drink[] = [
  { id: 'd1', name: 'Negroni', category: 'Classics', ingredients: ['gin', 'Campari'], available: true, description: '', photoPath: 'https://x/y.png' },
  { id: 'd2', name: 'Spritz', category: 'Bubbles', ingredients: ['prosecco'], available: false, description: '' },
];

function renderMenuAdmin() {
  return render(
    <ThemeProvider theme={getAppTheme('speakeasy')}>
      <MemoryRouter>
        <MenuAdmin />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('MenuAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDrinks.mockReturnValue({ drinks, loading: false, error: undefined });
    mockDeleteDrink.mockResolvedValue(undefined);
  });

  it('renders a row per drink', () => {
    renderMenuAdmin();
    expect(screen.getByText('Negroni')).toBeInTheDocument();
    expect(screen.getByText('Spritz')).toBeInTheDocument();
  });

  it('opens a confirmation naming the drink when the trash icon is clicked', async () => {
    const user = userEvent.setup();
    renderMenuAdmin();

    await user.click(screen.getByRole('button', { name: /delete negroni/i }));
    expect(screen.getByText('Delete "Negroni"?')).toBeInTheDocument();
    expect(mockDeleteDrink).not.toHaveBeenCalled();
  });

  it('deletes the drink on confirm', async () => {
    const user = userEvent.setup();
    renderMenuAdmin();

    await user.click(screen.getByRole('button', { name: /delete negroni/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(mockDeleteDrink).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
  });

  it('does not delete on cancel', async () => {
    const user = userEvent.setup();
    renderMenuAdmin();

    await user.click(screen.getByRole('button', { name: /delete spritz/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockDeleteDrink).not.toHaveBeenCalled();
  });
});
