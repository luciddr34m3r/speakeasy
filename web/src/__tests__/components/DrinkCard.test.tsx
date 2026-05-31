import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DrinkCard from '../../components/DrinkCard';
import type { Drink } from '../../lib/schema';

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
  messaging: null,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const baseDrink: Drink = {
  id: 'drink-1',
  name: 'Old Fashioned',
  description: 'A classic.',
  ingredients: ['bourbon', 'bitters', 'sugar', 'orange peel'],
  category: 'Whiskey',
  available: true,
};

function renderCard(drink: Drink = baseDrink) {
  return render(
    <MemoryRouter>
      <DrinkCard drink={drink} />
    </MemoryRouter>,
  );
}

describe('DrinkCard', () => {
  beforeEach(() => mockNavigate.mockReset());

  it('renders the drink name and category', () => {
    renderCard();
    expect(screen.getByText('Old Fashioned')).toBeInTheDocument();
    expect(screen.getByText('Whiskey')).toBeInTheDocument();
  });

  it('renders description when present', () => {
    renderCard();
    expect(screen.getByText('A classic.')).toBeInTheDocument();
  });

  it('truncates ingredients to first 3 with ellipsis', () => {
    renderCard();
    expect(screen.getByText(/bourbon · bitters · sugar/)).toBeInTheDocument();
    expect(screen.getByText(/···/)).toBeInTheDocument();
  });

  it('shows no ellipsis when 3 or fewer ingredients', () => {
    renderCard({ ...baseDrink, ingredients: ['gin', 'vermouth', 'campari'] });
    expect(screen.queryByText(/···/)).not.toBeInTheDocument();
    expect(screen.getByText(/gin · vermouth · campari/)).toBeInTheDocument();
  });

  it('renders placeholder box when no photoPath', () => {
    renderCard({ ...baseDrink, photoPath: undefined });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders an img when photoPath is set', () => {
    renderCard({ ...baseDrink, photoPath: 'https://example.com/img.jpg' });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/img.jpg');
  });

  it('navigates to drink detail on click', async () => {
    renderCard();
    await userEvent.click(screen.getByText('Old Fashioned'));
    expect(mockNavigate).toHaveBeenCalledWith('/drink/drink-1');
  });
});
