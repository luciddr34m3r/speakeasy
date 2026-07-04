import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockUseRegisterSW, mockUpdateServiceWorker, mockSetNeedRefresh } = vi.hoisted(() => ({
  mockUseRegisterSW: vi.fn(),
  mockUpdateServiceWorker: vi.fn(),
  mockSetNeedRefresh: vi.fn(),
}));

// vitest can't resolve the plugin's virtual module — mock it outright
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: mockUseRegisterSW,
}));

import UpdateToast from '../../components/UpdateToast';

describe('UpdateToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setNeedRefresh(value: boolean) {
    mockUseRegisterSW.mockReturnValue({
      needRefresh: [value, mockSetNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateServiceWorker,
    });
  }

  it('renders nothing while no update is waiting', () => {
    setNeedRefresh(false);
    render(<UpdateToast />);
    expect(screen.queryByText(/new version/i)).not.toBeInTheDocument();
  });

  it('shows the toast when an update is waiting and applies it on click', async () => {
    setNeedRefresh(true);
    const user = userEvent.setup();
    render(<UpdateToast />);

    expect(screen.getByText(/a new version is ready/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /update/i }));
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('can be dismissed with Later', async () => {
    setNeedRefresh(true);
    const user = userEvent.setup();
    render(<UpdateToast />);

    await user.click(screen.getByRole('button', { name: /later/i }));
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
  });
});
