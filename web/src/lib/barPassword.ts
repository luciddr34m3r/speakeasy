const KEY = 'speakeasy.barPassword';

export function getStoredBarPassword(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeBarPassword(password: string): void {
  try {
    localStorage.setItem(KEY, password);
  } catch {
    // Private browsing — guests will type it again next visit
  }
}
