import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';

const { mockCallables, mockHttpsCallable, mockNavigate, mockToJpeg, mockUseParams } = vi.hoisted(() => {
  const mockCallables: Record<string, ReturnType<typeof vi.fn>> = {};
  return {
    mockCallables,
    mockHttpsCallable: vi.fn((_fns: unknown, name: string) => {
      mockCallables[name] ??= vi.fn();
      return mockCallables[name];
    }),
    mockNavigate: vi.fn(),
    mockToJpeg: vi.fn(),
    mockUseParams: vi.fn(),
  };
});

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => undefined })),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: mockHttpsCallable,
}));

vi.mock('../../lib/drinkAdmin', () => ({
  deleteDrink: vi.fn(),
}));

vi.mock('../../lib/image', () => ({
  base64PngToJpegFile: mockToJpeg,
}));

vi.mock('../../hooks/useSpeechInput', () => ({
  useSpeechInput: () => ({
    supported: false,
    listening: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}));

vi.mock('../../components/AdminGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/AdminNav', () => ({
  default: () => <nav data-testid="admin-nav" />,
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useParams: mockUseParams,
  useNavigate: () => mockNavigate,
}));

import { getAppTheme } from '../../themes';
import DrinkEdit from '../../routes/admin/DrinkEdit';

const recipe = {
  name: 'Smoke Signal',
  description: 'Mezcal and grapefruit in a haze of campfire romance.',
  ingredients: ['2 oz mezcal', '1 oz grapefruit juice'],
  category: 'Modern Classics',
};

function renderDrinkEdit() {
  return render(
    <ThemeProvider theme={getAppTheme('speakeasy')}>
      <MemoryRouter>
        <DrinkEdit />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('DrinkEdit — Create with AI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: 'new' });
    mockCallables['generateDrinkRecipe'] = vi.fn().mockResolvedValue({ data: recipe });
    mockCallables['generateDrinkImage'] = vi.fn().mockResolvedValue({ data: { imageBase64: 'abc123' } });
    mockToJpeg.mockResolvedValue(new File(['x'], 'smoke-signal.jpg', { type: 'image/jpeg' }));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview-url');
  });

  it('shows the AI panel only for new drinks', () => {
    renderDrinkEdit();
    expect(screen.getByText(/create with ai/i)).toBeInTheDocument();
  });

  it('hides the AI panel when editing an existing drink', () => {
    mockUseParams.mockReturnValue({ id: 'existing-drink' });
    renderDrinkEdit();
    expect(screen.queryByText(/create with ai/i)).not.toBeInTheDocument();
  });

  it('generates a recipe, fills the form, and chains into the photo', async () => {
    const user = userEvent.setup();
    renderDrinkEdit();

    await user.click(screen.getByPlaceholderText(/smoky mezcal drink/i));
    await user.paste('a smoky mezcal drink with grapefruit');
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('Smoke Signal');
    });
    expect(screen.getByLabelText(/category/i)).toHaveValue('Modern Classics');
    expect(screen.getByLabelText(/ingredients/i)).toHaveValue('2 oz mezcal\n1 oz grapefruit juice');

    expect(mockCallables['generateDrinkRecipe']).toHaveBeenCalledWith({
      prompt: 'a smoky mezcal drink with grapefruit',
    });
    expect(mockCallables['generateDrinkImage']).toHaveBeenCalledWith({
      name: 'Smoke Signal',
      ingredients: recipe.ingredients,
      prompt: expect.stringContaining('Professional cocktail photography of a Smoke Signal'),
    });

    await waitFor(() => {
      expect(screen.getByAltText('preview')).toHaveAttribute('src', 'blob:preview-url');
    });
  });

  it('surfaces recipe failures in the error alert', async () => {
    mockCallables['generateDrinkRecipe'] = vi.fn().mockRejectedValue(new Error('permission-denied'));
    const user = userEvent.setup();
    renderDrinkEdit();

    await user.click(screen.getByPlaceholderText(/smoky mezcal drink/i));
    await user.paste('anything');
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(await screen.findByText(/permission-denied/i)).toBeInTheDocument();
    expect(mockCallables['generateDrinkImage']).not.toHaveBeenCalled();
  });

  it('keeps the Generate button disabled until a prompt is typed', () => {
    renderDrinkEdit();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
  });
});
