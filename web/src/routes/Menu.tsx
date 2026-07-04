import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import { alpha, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppConfig } from '../hooks/useAppConfig';
import { useDrinks } from '../hooks/useDrinks';
import { useActiveOrder } from '../hooks/useActiveOrder';
import DrinkCard from '../components/DrinkCard';

function categoryId(cat: string) {
  return `cat-${cat.toLowerCase().replace(/\s+/g, '-')}`;
}

// Lead with the crowd-pleasers instead of alphabetical accidents
const CATEGORY_PRIORITY = ['Classics', 'Modern Classics'];

function sortCategories(categories: string[]): string[] {
  return [...categories].sort((a, b) => {
    const pa = CATEGORY_PRIORITY.indexOf(a);
    const pb = CATEGORY_PRIORITY.indexOf(b);
    if (pa !== -1 || pb !== -1) {
      return (pa === -1 ? CATEGORY_PRIORITY.length : pa) - (pb === -1 ? CATEGORY_PRIORITY.length : pb);
    }
    return a.localeCompare(b);
  });
}

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  viewed: 'Seen',
  making: 'Being made',
  ready: 'Ready!',
};

export default function Menu() {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const { config, loading: configLoading } = useAppConfig();
  const { drinks, loading: drinksLoading } = useDrinks();
  const { activeOrder } = useActiveOrder();
  const { custom } = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const barClosed = !configLoading && !(config?.barOpen ?? false);
  const isJuly4 = custom.name === 'july4';

  const loading = authLoading || drinksLoading;

  const categories = sortCategories([...new Set(drinks.map((d) => d.category))]);

  function scrollToCategory(index: number) {
    setActiveTab(index);
    const el = document.getElementById(categoryId(categories[index]));
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <Container maxWidth="md" sx={{ py: 6, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 6, position: 'relative' }}>
        {isJuly4 && (
          <Box
            component="img"
            src="/july4/eagle.png"
            alt="Bald eagle"
            sx={{
              height: { xs: 150, sm: 190 },
              display: 'block',
              mx: 'auto',
              mb: -2,
              filter: 'drop-shadow(0 0 18px rgba(255,215,0,0.45))',
            }}
          />
        )}
        <Typography
          variant="h2"
          sx={{ color: 'primary.main', mb: 0.5, fontSize: { xs: '2.5rem', sm: '3.5rem' } }}
        >
          The Speakeasy
        </Typography>
        {isJuly4 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, my: 1.5 }}>
            <Typography sx={{ color: 'secondary.main', fontSize: '0.8rem', letterSpacing: '0.3em' }}>
              ★ ★ ★
            </Typography>
            <Box
              sx={{
                width: 120,
                height: 4,
                background: 'repeating-linear-gradient(90deg, #B22234 0 12px, #f5f5f5 12px 24px, #3C3B6E 24px 36px)',
              }}
            />
            <Typography sx={{ color: 'secondary.main', fontSize: '0.8rem', letterSpacing: '0.3em' }}>
              ★ ★ ★
            </Typography>
          </Box>
        ) : (
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
        )}
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontSize: '0.65rem',
          }}
        >
          {isJuly4 ? 'House Cocktails ★ Est. 1776' : 'House Cocktails'}
        </Typography>

        {activeOrder && (
          <Chip
            label={`🍸 ${activeOrder.drinkName} — ${STATUS_LABELS[activeOrder.status] ?? activeOrder.status} · tap to view`}
            onClick={() => navigate(`/orders/${activeOrder.id}`)}
            color="primary"
            variant="outlined"
            sx={{ mt: 2.5, fontSize: '0.75rem' }}
          />
        )}

        {barClosed && (
          <Box
            sx={(t) => ({
              mt: 3,
              py: 1,
              px: 2,
              display: 'inline-block',
              border: `1px solid ${alpha(t.palette.primary.main, 0.25)}`,
              borderRadius: 1,
            })}
          >
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
              The bar is currently closed. Browse the menu — ordering opens when the bartender&apos;s behind the bar.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Category tabs */}
      {!loading && categories.length > 1 && (
        <Box
          sx={(t) => ({
            position: 'sticky',
            top: 48,
            zIndex: 10,
            bgcolor: 'background.default',
            borderBottom: `1px solid ${alpha(t.palette.primary.main, 0.1)}`,
            mx: { xs: -2, sm: -3 },
            px: { xs: 2, sm: 3 },
            mb: 4,
          })}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v) => scrollToCategory(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 40,
              '& .MuiTabs-indicator': { bgcolor: 'primary.main' },
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
              <Skeleton
                variant="rectangular"
                height={280}
                sx={(t) => ({ borderRadius: 1, bgcolor: alpha(t.palette.primary.main, 0.08) })}
              />
            </Grid>
          ))}
        </Grid>
      ) : drinks.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 12 }}>
          <Typography variant="h5" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            The menu is empty.
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
  );
}
