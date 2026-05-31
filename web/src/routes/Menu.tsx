import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import GuestNav from '../components/GuestNav';
import { useAuth } from '../hooks/useAuth';
import { useDrinks } from '../hooks/useDrinks';
import DrinkCard from '../components/DrinkCard';

function categoryId(cat: string) {
  return `cat-${cat.toLowerCase().replace(/\s+/g, '-')}`;
}

export default function Menu() {
  const { loading: authLoading } = useAuth();
  const { drinks, loading: drinksLoading } = useDrinks();
  const [activeTab, setActiveTab] = useState(0);

  const loading = authLoading || drinksLoading;

  const categories = [...new Set(drinks.map((d) => d.category))].sort();

  function scrollToCategory(index: number) {
    setActiveTab(index);
    const el = document.getElementById(categoryId(categories[index]));
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
    <GuestNav />
    <Container maxWidth="md" sx={{ py: 6, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 6, position: 'relative' }}>
        <Typography
          variant="h2"
          sx={{ color: 'primary.main', mb: 0.5, fontSize: { xs: '2.5rem', sm: '3.5rem' } }}
        >
          The Speakeasy
        </Typography>
        <Box
          sx={{
            width: 60,
            height: 1,
            bgcolor: 'primary.main',
            mx: 'auto',
            my: 1.5,
            opacity: 0.6,
          }}
        />
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontSize: '0.65rem',
          }}
        >
          House Cocktails
        </Typography>

      </Box>

      {/* Category tabs */}
      {!loading && categories.length > 1 && (
        <Box
          sx={{
            position: 'sticky',
            top: 48,
            zIndex: 10,
            bgcolor: '#0a0a0a',
            borderBottom: '1px solid rgba(201,169,110,0.10)',
            mx: { xs: -2, sm: -3 },
            px: { xs: 2, sm: 3 },
            mb: 4,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v) => scrollToCategory(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            slotProps={{ indicator: { style: { backgroundColor: '#c9a96e' } } }}
            sx={{
              minHeight: 40,
              '& .MuiTab-root': {
                color: 'text.secondary',
                minHeight: 40,
                fontSize: '0.65rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                '&.Mui-selected': { color: 'primary.main' },
              },
            }}
          >
            {categories.map((cat) => (
              <Tab key={cat} label={cat} disableRipple />
            ))}
          </Tabs>
        </Box>
      )}

      {/* Drink grid */}
      {loading ? (
        <Grid container spacing={3}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1, bgcolor: 'rgba(201,169,110,0.08)' }} />
            </Grid>
          ))}
        </Grid>
      ) : drinks.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 12 }}>
          <Typography variant="h5" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            The bar is closed tonight.
          </Typography>
        </Box>
      ) : (
        <>
          {categories.map((cat) => {
            const catDrinks = drinks.filter((d) => d.category === cat);
            return (
              <Box key={cat} id={categoryId(cat)} sx={{ mb: 5, scrollMarginTop: '100px' }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: 'primary.main',
                    letterSpacing: '0.2em',
                    fontSize: '0.65rem',
                    display: 'block',
                    mb: 2,
                  }}
                >
                  {cat}
                </Typography>
                <Grid container spacing={3}>
                  {catDrinks.map((drink) => (
                    <Grid key={drink.id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <DrinkCard drink={drink} />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            );
          })}
        </>
      )}
    </Container>
    </>
  );
}
