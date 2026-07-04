import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Drink } from '../../lib/schema';

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
  messaging: null,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useDrinks', () => ({
  useDrinks: vi.fn(),
}));

vi.mock('../../hooks/useAppConfig', () => ({
  useAppConfig: vi.fn(),
}));

vi.mock('../../hooks/useActiveOrder', () => ({
  useActiveOrder: vi.fn(),
}));

vi.mock('../../components/GuestNav', () => ({
  default: () => <nav data-testid="guest-nav" />,
}));

vi.mock('../../components/DrinkCard', () => ({
  default: ({ drink }: { drink: Drink }) => <div data-testid="drink-card">{drink.name}</div>,
}));

import { ThemeProvider } from '@mui/material/styles';
import { useAuth } from '../../hooks/useAuth';
import { useDrinks } from '../../hooks/useDrinks';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useActiveOrder } from '../../hooks/useActiveOrder';
import { getAppTheme } from '../../themes';
import Menu from '../../routes/Menu';

const mockUseAuth = vi.mocked(useAuth);
const mockUseDrinks = vi.mocked(useDrinks);
const mockUseAppConfig = vi.mocked(useAppConfig);
const mockUseActiveOrder = vi.mocked(useActiveOrder);

function renderMenu() {
  return render(
    <ThemeProvider theme={getAppTheme('speakeasy')}>
      <MemoryRouter>
        <Menu />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const sampleDrinks: Drink[] = [
  { id: '1', name: 'Negroni', category: 'Cocktails', ingredients: [], available: true, description: '' },
  { id: '2', name: 'Spritz', category: 'Bubbles', ingredients: [], available: true, description: '' },
  { id: '3', name: 'Manhattan', category: 'Cocktails', ingredients: [], available: true, description: '' },
];

describe('Menu', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, error: undefined });
    mockUseAppConfig.mockReturnValue({
      config: { barOpen: true, adminUid: 'admin' },
      loading: false,
      error: undefined,
    } as ReturnType<typeof useAppConfig>);
    mockUseActiveOrder.mockReturnValue({ activeOrder: null, loading: false });
  });

  it('shows skeleton grid while loading', () => {
    mockUseDrinks.mockReturnValue({ drinks: [], loading: true, error: undefined });
    renderMenu();
    expect(screen.queryByTestId('drink-card')).not.toBeInTheDocument();
    expect(screen.queryByText(/closed/i)).not.toBeInTheDocument();
  });

  it('shows "menu is empty" when no drinks and not loading', () => {
    mockUseDrinks.mockReturnValue({ drinks: [], loading: false, error: undefined });
    renderMenu();
    expect(screen.getByText(/menu is empty/i)).toBeInTheDocument();
  });

  it('shows an active-order chip that links to the order', () => {
    mockUseDrinks.mockReturnValue({ drinks: sampleDrinks, loading: false, error: undefined });
    mockUseActiveOrder.mockReturnValue({
      activeOrder: {
        id: 'order-1', drinkId: 'd', drinkName: 'Old Fashioned', guestUid: 'u', guestName: 'A',
        status: 'received', partyMode: false,
      },
      loading: false,
    });
    renderMenu();
    expect(screen.getByText(/old fashioned — received/i)).toBeInTheDocument();
  });

  it('orders categories with Classics first, not alphabetically', () => {
    mockUseDrinks.mockReturnValue({
      drinks: [
        { id: '1', name: 'A-Drink', category: 'After Dinner', ingredients: [], available: true, description: '' },
        { id: '2', name: 'B-Drink', category: 'Classics', ingredients: [], available: true, description: '' },
        { id: '3', name: 'C-Drink', category: 'Modern Classics', ingredients: [], available: true, description: '' },
      ],
      loading: false,
      error: undefined,
    });
    renderMenu();
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Classics', 'Modern Classics', 'After Dinner']);
  });

  it('renders drink cards when drinks are available', () => {
    mockUseDrinks.mockReturnValue({ drinks: sampleDrinks, loading: false, error: undefined });
    renderMenu();
    expect(screen.getAllByTestId('drink-card')).toHaveLength(3);
    expect(screen.getByText('Negroni')).toBeInTheDocument();
    expect(screen.getByText('Spritz')).toBeInTheDocument();
  });

  it('renders category tabs when multiple categories exist', () => {
    mockUseDrinks.mockReturnValue({ drinks: sampleDrinks, loading: false, error: undefined });
    renderMenu();
    expect(screen.getByRole('tab', { name: 'Cocktails' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bubbles' })).toBeInTheDocument();
  });

  it('does not render tabs with only one category', () => {
    const oneCat = sampleDrinks.filter((d) => d.category === 'Cocktails');
    mockUseDrinks.mockReturnValue({ drinks: oneCat, loading: false, error: undefined });
    renderMenu();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows the closed banner when the bar is closed', () => {
    mockUseAppConfig.mockReturnValue({
      config: { barOpen: false, adminUid: 'admin' },
      loading: false,
      error: undefined,
    } as ReturnType<typeof useAppConfig>);
    mockUseDrinks.mockReturnValue({ drinks: sampleDrinks, loading: false, error: undefined });
    renderMenu();
    expect(screen.getByText(/currently closed/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('drink-card')).toHaveLength(3);
  });

  it('hides the closed banner while config is loading', () => {
    mockUseAppConfig.mockReturnValue({
      config: undefined,
      loading: true,
      error: undefined,
    } as ReturnType<typeof useAppConfig>);
    mockUseDrinks.mockReturnValue({ drinks: sampleDrinks, loading: false, error: undefined });
    renderMenu();
    expect(screen.queryByText(/currently closed/i)).not.toBeInTheDocument();
  });
});
