import { useState, useEffect } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../lib/firebase';
import AdminGuard from '../../components/AdminGuard';
import AdminNav from '../../components/AdminNav';

export default function DrinkEdit() {
  return (
    <AdminGuard>
      <DrinkEditContent />
    </AdminGuard>
  );
}

function DrinkEditContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredientsRaw, setIngredientsRaw] = useState('');
  const [category, setCategory] = useState('Cocktails');
  const [available, setAvailable] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [existingPhotoPath, setExistingPhotoPath] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isNew) return;
    getDoc(doc(db, 'drinks', id!)).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setName(d.name ?? '');
      setDescription(d.description ?? '');
      setIngredientsRaw((d.ingredients ?? []).join('\n'));
      setCategory(d.category ?? 'Cocktails');
      setAvailable(d.available ?? true);
      setExistingPhotoPath(d.photoPath ?? '');
      if (d.photoPath) setPhotoPreview(d.photoPath);
    });
  }, [id, isNew]);

  const ingredients = ingredientsRaw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleGenerateDescription = async () => {
    if (!name || ingredients.length === 0) {
      setError('Fill in the name and at least one ingredient first.');
      return;
    }
    setGeneratingDesc(true);
    setError('');
    try {
      const fn = httpsCallable<{ name: string; ingredients: string[]; category: string }, { description: string }>(
        functions,
        'generateDrinkDescription',
      );
      const result = await fn({ name, ingredients, category });
      setDescription(result.data.description);
      setSuccess('Description generated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      let photoPath = existingPhotoPath;

      if (photoFile) {
        const storageRef = ref(storage, `drinks/${Date.now()}-${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
        photoPath = await getDownloadURL(storageRef);
      }

      const data = {
        name: name.trim(),
        description: description.trim(),
        ingredients,
        category: category.trim() || 'Cocktails',
        available,
        photoPath: photoPath || null,
        updatedAt: serverTimestamp(),
      };

      if (isNew) {
        const newRef = doc(db, 'drinks', crypto.randomUUID());
        await setDoc(newRef, { ...data, createdAt: serverTimestamp() });
        navigate(`/admin/menu/${newRef.id}`);
      } else {
        await updateDoc(doc(db, 'drinks', id!), data);
        setSuccess('Saved!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${name}"?`)) return;
    setDeleting(true);
    try {
      if (existingPhotoPath) {
        try { await deleteObject(ref(storage, existingPhotoPath)); } catch { /* ignore */ }
      }
      await deleteDoc(doc(db, 'drinks', id!));
      navigate('/admin/menu');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
      setDeleting(false);
    }
  };

  return (
    <>
      <AdminNav />
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
          <IconButton onClick={() => navigate('/admin/menu')} sx={{ color: 'primary.main' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">{isNew ? 'New Drink' : 'Edit Drink'}</Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            fullWidth
            placeholder="Cocktails, Sours, Classics…"
          />
          <TextField
            label="Ingredients (one per line)"
            value={ingredientsRaw}
            onChange={(e) => setIngredientsRaw(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            placeholder="2 oz bourbon&#10;¾ oz lemon juice&#10;½ oz simple syrup"
          />

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                Description
              </Typography>
              <Button
                size="small"
                startIcon={generatingDesc ? <CircularProgress size={12} /> : <AutoAwesomeIcon fontSize="small" />}
                onClick={handleGenerateDescription}
                disabled={generatingDesc}
                sx={{ color: 'primary.main', fontSize: '0.7rem' }}
              >
                AI Generate
              </Button>
            </Box>
            <TextField
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={2}
              fullWidth
              placeholder="An evocative description…"
            />
          </Box>

          <FormControlLabel
            control={<Switch checked={available} onChange={(e) => setAvailable(e.target.checked)} />}
            label={available ? 'Available' : 'Unavailable (hidden from guests)'}
            sx={{ color: available ? 'text.primary' : 'text.secondary' }}
          />

          <Divider />

          {/* Photo */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Photo (optional)
            </Typography>
            {photoPreview && (
              <Box
                component="img"
                src={photoPreview}
                alt="preview"
                sx={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 1, mb: 1, border: '1px solid rgba(201,169,110,0.2)' }}
              />
            )}
            <Button variant="outlined" component="label" size="small" sx={{ borderColor: 'primary.dark', color: 'primary.main' }}>
              {photoPreview ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
            </Button>
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={saving}
              sx={{ flexGrow: 1 }}
            >
              {saving ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : 'Save'}
            </Button>
            {!isNew && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleDelete}
                disabled={deleting}
                sx={{ borderColor: 'error.dark' }}
              >
                {deleting ? <CircularProgress size={20} color="error" /> : 'Delete'}
              </Button>
            )}
          </Box>
        </Box>
      </Container>
    </>
  );
}
