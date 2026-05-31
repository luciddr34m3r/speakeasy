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

vi.mock('../../components/GuestNav', () => ({
  default: () => <nav data-testid="guest-nav" />,
}));

vi.mock('../../components/DrinkCard', () => ({
  default: ({ drink }: { drink: Drink }) => <div data-testid="drink-card">{drink.name}</div>,
}));

import { useAuth } from '../../hooks/useAuth';
import { useDrinks } from '../../hooks/useDrinks';
import Menu from '../../routes/Menu';

const mockUseAuth = vi.mocked(useAuth);
const mockUseDrinks = vi.mocked(useDrinks);

function renderMenu() {
  return render(
    <MemoryRouter>
      <Menu />
    </MemoryRouter>,
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
  });

  it('shows skeleton grid while loading', () => {
    mockUseDrinks.mockReturnValue({ drinks: [], loading: true, error: undefined });
    renderMenu();
    expect(screen.queryByTestId('drink-card')).not.toBeInTheDocument();
    expect(screen.queryByText(/closed/i)).not.toBeInTheDocument();
  });

  it('shows "bar is closed" when no drinks and not loading', () => {
    mockUseDrinks.mockReturnValue({ drinks: [], loading: false, error: undefined });
    renderMenu();
    expect(screen.getByText(/bar is closed/i)).toBeInTheDocument();
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
});
