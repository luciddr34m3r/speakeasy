import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import Menu from './routes/Menu';
import DrinkDetail from './routes/DrinkDetail';
import OrderStatus from './routes/OrderStatus';
import Recommend from './routes/Recommend';
import History from './routes/History';
import SignIn from './routes/SignIn';
import AdminQueue from './routes/admin/Queue';
import MenuAdmin from './routes/admin/MenuAdmin';
import DrinkEdit from './routes/admin/DrinkEdit';
import SeedMenu from './routes/admin/SeedMenu';
import GuestFcmRegistrar from './components/GuestFcmRegistrar';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <GuestFcmRegistrar />
        <Routes>
          <Route path="/" element={<Menu />} />
          <Route path="/drink/:id" element={<DrinkDetail />} />
          <Route path="/orders/:id" element={<OrderStatus />} />
          <Route path="/recommend" element={<Recommend />} />
          <Route path="/me" element={<History />} />
          <Route path="/signin" element={<SignIn />} />
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
