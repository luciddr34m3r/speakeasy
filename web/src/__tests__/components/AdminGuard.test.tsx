import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { User } from 'firebase/auth';
import type { AppConfig } from '../../lib/schema';

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
  messaging: null,
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
  signInWithRedirect: vi.fn(),
  linkWithRedirect: vi.fn(),
  signInWithCredential: vi.fn(),
  getRedirectResult: vi.fn().mockResolvedValue(null),
}));

vi.mock('react-firebase-hooks/auth', () => ({
  useAuthState: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useAppConfig', () => ({
  useAppConfig: vi.fn(),
}));

import { useAuth } from '../../hooks/useAuth';
import { useAppConfig } from '../../hooks/useAppConfig';
import AdminGuard from '../../components/AdminGuard';

const mockUseAuth = vi.mocked(useAuth);
const mockUseAppConfig = vi.mocked(useAppConfig);

function renderGuard() {
  return render(
    <MemoryRouter>
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>
    </MemoryRouter>,
  );
}

describe('AdminGuard', () => {
  it('shows spinner while loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, error: undefined });
    mockUseAppConfig.mockReturnValue({ config: undefined, loading: true, error: undefined });
    renderGuard();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
  });

  it('offers a back-to-menu link on the staff-only screen', () => {
    const anonUser = { uid: 'anon-uid', isAnonymous: true } as User;
    mockUseAuth.mockReturnValue({ user: anonUser, loading: false, error: undefined });
    mockUseAppConfig.mockReturnValue({
      config: { adminUid: 'admin-uid', partyMode: false, adminFcmTokens: [], barOpen: false, geofenceRadiusM: 150, theme: 'speakeasy', bartenderUids: [], bartenderNames: {} } as AppConfig,
      loading: false,
      error: undefined,
    });
    renderGuard();
    expect(screen.getByRole('button', { name: /back to menu/i })).toBeInTheDocument();
  });

  it('shows sign-in prompt for anonymous user', () => {
    const anonUser = { uid: 'anon-uid', isAnonymous: true } as User;
    mockUseAuth.mockReturnValue({ user: anonUser, loading: false, error: undefined });
    mockUseAppConfig.mockReturnValue({
      config: { adminUid: 'admin-uid', partyMode: false, adminFcmTokens: [], barOpen: false, geofenceRadiusM: 150, theme: 'speakeasy', bartenderUids: [], bartenderNames: {} } as AppConfig,
      loading: false,
      error: undefined,
    });
    renderGuard();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated uid matches adminUid', () => {
    const adminUser = { uid: 'admin-uid', isAnonymous: false } as User;
    mockUseAuth.mockReturnValue({ user: adminUser, loading: false, error: undefined });
    mockUseAppConfig.mockReturnValue({
      config: { adminUid: 'admin-uid', partyMode: false, adminFcmTokens: [], barOpen: false, geofenceRadiusM: 150, theme: 'speakeasy', bartenderUids: [], bartenderNames: {} } as AppConfig,
      loading: false,
      error: undefined,
    });
    renderGuard();
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('shows UID hint when authenticated but uid does not match adminUid', () => {
    const otherUser = { uid: 'other-uid', isAnonymous: false, email: 'other@test.com' } as User;
    mockUseAuth.mockReturnValue({ user: otherUser, loading: false, error: undefined });
    mockUseAppConfig.mockReturnValue({
      config: { adminUid: 'admin-uid', partyMode: false, adminFcmTokens: [], barOpen: false, geofenceRadiusM: 150, theme: 'speakeasy', bartenderUids: [], bartenderNames: {} } as AppConfig,
      loading: false,
      error: undefined,
    });
    renderGuard();
    expect(screen.getByText(/other-uid/)).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
  });
});
