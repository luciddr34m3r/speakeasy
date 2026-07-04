// Vitest stand-in for vite-plugin-pwa's virtual module (the plugin isn't
// loaded in vitest's pipeline, so the real virtual module can't resolve).
// Tests replace this via vi.mock('virtual:pwa-register/react', ...).
export function useRegisterSW(): {
  needRefresh: [boolean, (v: boolean) => void];
  offlineReady: [boolean, (v: boolean) => void];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
} {
  return {
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  };
}
