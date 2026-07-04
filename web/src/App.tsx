import { useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import GuestNav from './components/GuestNav';
import { storeBarPassword } from './lib/barPassword';
import { getAppTheme } from './themes';
import { useAppConfig } from './hooks/useAppConfig';
import ThemeDecorations from './components/ThemeDecorations';
import UpdateToast from './components/UpdateToast';
import Menu from './routes/Menu';
import DrinkDetail from './routes/DrinkDetail';
import OrderStatus from './routes/OrderStatus';
import Recommend from './routes/Recommend';
import History from './routes/History';
import SignIn from './routes/SignIn';
import BartenderClaim from './routes/BartenderClaim';
import AdminQueue from './routes/admin/Queue';
import MenuAdmin from './routes/admin/MenuAdmin';
import DrinkEdit from './routes/admin/DrinkEdit';
import SeedMenu from './routes/admin/SeedMenu';

// Every guest page keeps the app bar; admin pages have AdminNav instead
function GuestLayout() {
  const [searchParams, setSearchParams] = useSearchParams();

  // The bar's QR code links here with ?pw=… — pocket the door password and
  // clean the URL so it isn't shared around in screenshots
  useEffect(() => {
    const pw = searchParams.get('pw');
    if (pw) {
      storeBarPassword(pw);
      const next = new URLSearchParams(searchParams);
      next.delete('pw');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <>
      <GuestNav />
      <Outlet />
    </>
  );
}

export default function App() {
  const { config } = useAppConfig();
  const theme = useMemo(() => getAppTheme(config?.theme), [config?.theme]);

  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme.custom.metaThemeColor);
  }, [theme]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <UpdateToast />
      <BrowserRouter>
        <ThemeDecorations />
        <Routes>
          <Route element={<GuestLayout />}>
            <Route path="/" element={<Menu />} />
            <Route path="/drink/:id" element={<DrinkDetail />} />
            <Route path="/orders/:id" element={<OrderStatus />} />
            <Route path="/recommend" element={<Recommend />} />
            <Route path="/me" element={<History />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/bartender" element={<BartenderClaim />} />
          </Route>
          <Route path="/admin" element={<AdminQueue />} />
          <Route path="/admin/menu" element={<MenuAdmin />} />
          <Route path="/admin/menu/:id" element={<DrinkEdit />} />
          <Route path="/admin/seed" element={<SeedMenu />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
