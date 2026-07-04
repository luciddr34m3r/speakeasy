import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import type { Drink } from '../lib/schema';

interface DrinkCardProps {
  drink: Drink;
}

export default function DrinkCard({ drink }: DrinkCardProps) {
  const navigate = useNavigate();
  const { custom } = useTheme();

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/drink/${drink.id}`)}
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {drink.photoPath ? (
          <CardMedia
            component="img"
            height={180}
            image={drink.photoPath}
            alt={drink.name}
            sx={{ objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              height: 180,
              background: custom.placeholderGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="h2" sx={{ color: 'primary.main', opacity: 0.3, fontSize: '3rem' }}>
              {custom.placeholderEmoji}
            </Typography>
          </Box>
        )}
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
            <Typography variant="h5" component="h2" sx={{ lineHeight: 1.2 }}>
              {drink.name}
            </Typography>
            <Chip
              label={drink.category}
              size="small"
              variant="outlined"
              sx={{ ml: 1, flexShrink: 0, fontSize: '0.65rem', borderColor: 'primary.dark', color: 'primary.main' }}
            />
          </Box>
          {drink.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
              {drink.description}
            </Typography>
          )}
          {drink.ingredients.length > 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
              {drink.ingredients.slice(0, 3).join(' · ')}{drink.ingredients.length > 3 ? ' ···' : ''}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
