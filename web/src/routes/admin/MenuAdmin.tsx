import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDrinks } from '../../hooks/useDrinks';
import { deleteDrink } from '../../lib/drinkAdmin';
import AdminGuard from '../../components/AdminGuard';
import AdminNav from '../../components/AdminNav';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { Drink } from '../../lib/schema';

export default function MenuAdmin() {
  return (
    <AdminGuard>
      <MenuAdminContent />
    </AdminGuard>
  );
}

function MenuAdminContent() {
  const navigate = useNavigate();
  const { drinks, loading } = useDrinks(true);
  const [deleteTarget, setDeleteTarget] = useState<Drink | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleAvailable = async (drinkId: string, current: boolean) => {
    await updateDoc(doc(db, 'drinks', drinkId), {
      available: !current,
      updatedAt: serverTimestamp(),
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDrink(deleteTarget);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <AdminNav />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Menu</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/menu/new')}
          >
            Add Drink
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress sx={{ color: 'primary.main' }} />
          </Box>
        ) : (
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Ingredients</TableCell>
                  <TableCell align="center">Available</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {drinks.map((drink) => (
                  <TableRow key={drink.id} sx={{ opacity: drink.available ? 1 : 0.5 }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: '"Cormorant", serif', fontSize: '1rem' }}>
                        {drink.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={drink.category} size="small" variant="outlined" sx={{ fontSize: '0.65rem', borderColor: 'primary.dark', color: 'primary.main' }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {drink.ingredients.slice(0, 2).join(', ')}{drink.ingredients.length > 2 ? '…' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={drink.available}
                        onChange={() => toggleAvailable(drink.id, drink.available)}
                        size="small"
                        sx={{ '& .MuiSwitch-thumb': { color: drink.available ? 'primary.main' : undefined } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" aria-label={`Edit ${drink.name}`} onClick={() => navigate(`/admin/menu/${drink.id}`)}>
                        <EditIcon fontSize="small" sx={{ color: 'primary.main' }} />
                      </IconButton>
                      <IconButton size="small" aria-label={`Delete ${drink.name}`} onClick={() => setDeleteTarget(drink)}>
                        <DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {drinks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary', fontStyle: 'italic' }}>
                      No drinks yet. Add one!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        )}

        <ConfirmDialog
          open={!!deleteTarget}
          title={`Delete "${deleteTarget?.name}"?`}
          message="This removes the drink and its photo permanently."
          busy={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      </Container>
    </>
  );
}
