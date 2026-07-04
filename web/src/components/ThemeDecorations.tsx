import Box from '@mui/material/Box';
import { keyframes } from '@emotion/react';
import { useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';

const burst = keyframes`
  0% { transform: scale(0.1); opacity: 0; }
  35% { opacity: 0.9; }
  100% { transform: scale(1.4); opacity: 0; }
`;

const wave = keyframes`
  from { transform: rotate(-8deg); }
  to { transform: rotate(8deg); }
`;

const twinkle = keyframes`
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.8; }
`;

const soar = keyframes`
  0% { transform: translate(-140px, 0) rotate(2deg); }
  25% { transform: translate(28vw, -22px) rotate(-3deg); }
  50% { transform: translate(55vw, 8px) rotate(2deg); }
  75% { transform: translate(80vw, -18px) rotate(-2deg); }
  100% { transform: translate(110vw, 0) rotate(2deg); }
`;

const torchGlow = keyframes`
  from { opacity: 0.4; transform: scale(0.75); }
  to { opacity: 1; transform: scale(1.3); }
`;

const REDUCED_MOTION = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } };

const FIREWORKS: { left: string; top: string; src: string; size: number; delay: number }[] = [
  { left: '-6%', top: '2%', src: '/july4/firework-gold.webp', size: 300, delay: 0 },
  { left: '55%', top: '-4%', src: '/july4/firework-redblue.webp', size: 340, delay: 1.1 },
  { left: '25%', top: '10%', src: '/july4/firework-gold.webp', size: 240, delay: 2.0 },
  { left: '70%', top: '16%', src: '/july4/firework-gold.webp', size: 220, delay: 0.6 },
  { left: '5%', top: '26%', src: '/july4/firework-redblue.webp', size: 260, delay: 1.6 },
  { left: '45%', top: '30%', src: '/july4/firework-gold.webp', size: 200, delay: 2.6 },
];

// Deterministic star field — no randomness in render.
const STARS: { left: string; top: string; delay: number }[] = [
  { left: '5%', top: '30%', delay: 0 }, { left: '15%', top: '55%', delay: 0.7 },
  { left: '25%', top: '40%', delay: 1.4 }, { left: '35%', top: '70%', delay: 2.1 },
  { left: '45%', top: '35%', delay: 0.3 }, { left: '55%', top: '60%', delay: 1.0 },
  { left: '65%', top: '45%', delay: 1.7 }, { left: '75%', top: '75%', delay: 2.4 },
  { left: '85%', top: '38%', delay: 0.5 }, { left: '93%', top: '62%', delay: 1.2 },
  { left: '10%', top: '82%', delay: 1.9 }, { left: '50%', top: '88%', delay: 0.8 },
  { left: '70%', top: '90%', delay: 2.6 }, { left: '90%', top: '85%', delay: 1.5 },
];

/**
 * Full-viewport festive overlay for themes that opt in via
 * theme.custom.decorations. Purely decorative: pointer-events none,
 * aria-hidden, transform/opacity animations only, and skipped entirely on
 * admin pages so the bartender can actually work.
 */
export default function ThemeDecorations() {
  const theme = useTheme();
  const { pathname } = useLocation();

  if (!theme.custom.decorations || pathname.startsWith('/admin')) return null;

  // The menu shows content in opaque cards, so it can take the full show.
  // Text-on-background pages (order status, history, forms) only get the
  // subtle layer or they become unreadable.
  const fullShow = pathname === '/';

  return (
    <>
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        // Negative z-index: positioned elements at z 0 paint ABOVE the
        // (static) card backgrounds, putting fireworks between a card and its
        // text. At -1 the layer sits behind all in-flow content.
        zIndex: -1,
        overflow: 'hidden',
      }}
    >
      {fullShow && FIREWORKS.map((fw, i) => (
        <Box
          key={`fw-${i}`}
          component="img"
          fetchPriority="low"
          decoding="async"
          src={fw.src}
          alt=""
          sx={{
            position: 'absolute',
            left: fw.left,
            top: fw.top,
            width: fw.size,
            animation: `${burst} 3.2s ease-out infinite`,
            animationDelay: `${fw.delay}s`,
            ...REDUCED_MOTION,
          }}
        />
      ))}
      {STARS.map((star, i) => (
        <Box
          key={`star-${i}`}
          component="span"
          sx={{
            position: 'absolute',
            left: star.left,
            top: star.top,
            color: '#FFD700',
            fontSize: '0.9rem',
            animation: `${twinkle} 3s ease-in-out infinite`,
            animationDelay: `${star.delay}s`,
            ...REDUCED_MOTION,
          }}
        >
          ✦
        </Box>
      ))}
      {/* Patriotic bunting hanging just below the nav, coast to coast */}
      <Box
        sx={{
          position: 'absolute',
          top: 44,
          left: 0,
          right: 0,
          height: 52,
          backgroundImage: 'url(/july4/bunting.webp)',
          backgroundRepeat: 'repeat-x',
          backgroundSize: 'auto 52px',
        }}
      />
      {/* Old Glory waving in both corners */}
      <Box
        component="img"
        fetchPriority="low"
        loading="lazy"
        decoding="async"
        src="/july4/flag.webp"
        alt=""
        sx={{
          position: 'absolute', top: 104, left: 4, width: 64,
          transformOrigin: 'bottom left',
          animation: `${wave} 1.8s ease-in-out infinite alternate`,
          ...REDUCED_MOTION,
        }}
      />
      <Box
        component="img"
        fetchPriority="low"
        loading="lazy"
        decoding="async"
        src="/july4/flag.webp"
        alt=""
        sx={{
          position: 'absolute', top: 104, right: 4, width: 64,
          transform: 'scaleX(-1)',
          transformOrigin: 'bottom right',
          animation: `${wave} 1.8s ease-in-out infinite alternate-reverse`,
          ...REDUCED_MOTION,
        }}
      />
      {/* A bald eagle on patrol, sea to shining sea */}
      {fullShow && (
        <Box
          component="img"
          fetchPriority="low"
          loading="lazy"
          decoding="async"
          src="/july4/eagle.webp"
          alt=""
          sx={{
            position: 'absolute',
            top: '16%',
            left: 0,
            width: 150,
            opacity: 0.95,
            animation: `${soar} 24s linear infinite`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none', left: 'auto', right: 12 },
          }}
        />
      )}
    </Box>

    {/* Foreground layer: monuments stand proud OVER the page content */}
    {fullShow && (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1050,
        overflow: 'hidden',
      }}
    >
      {/* Lady Liberty, torch blazing through the night */}
      <Box sx={{ position: 'absolute', bottom: -8, left: 4, width: { xs: 83, sm: 98 } }}>
        <Box
          sx={{
            position: 'absolute',
            top: { xs: -19, sm: -22 },
            left: { xs: -19, sm: -22 },
            width: { xs: 56, sm: 66 },
            height: { xs: 56, sm: 66 },
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(255,225,130,0.95) 0%, rgba(255,170,50,0.55) 35%, transparent 70%)',
            animation: `${torchGlow} 2.2s ease-in-out infinite alternate`,
            ...REDUCED_MOTION,
          }}
        />
        <Box
          component="img"
          fetchPriority="low"
          loading="lazy"
          decoding="async"
          src="/july4/liberty.webp"
          alt=""
          sx={{
            width: '100%',
            display: 'block',
            opacity: 0.95,
            filter: 'drop-shadow(0 0 10px rgba(10,27,61,0.8))',
          }}
        />
      </Box>
      <Box
        component="img"
        fetchPriority="low"
        loading="lazy"
        decoding="async"
        src="/july4/eagle.webp"
        alt=""
        sx={{ position: 'absolute', bottom: 8, right: 8, width: 110, opacity: 0.7 }}
      />
    </Box>
    )}
    </>
  );
}
