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
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import CasinoIcon from '@mui/icons-material/Casino';
import Skeleton from '@mui/material/Skeleton';
import { alpha } from '@mui/material/styles';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../lib/firebase';
import { deleteDrink } from '../../lib/drinkAdmin';
import { base64PngToJpegFile } from '../../lib/image';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import AdminGuard from '../../components/AdminGuard';
import AdminNav from '../../components/AdminNav';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function DrinkEdit() {
  return (
    <AdminGuard>
      <DrinkEditContent />
    </AdminGuard>
  );
}

// Mirrors buildDefaultPrompt in functions/src/generateDrinkImage.ts so the
// editor shows exactly what will be sent
function buildDefaultPrompt(name: string, ingredients: string[]): string {
  return `Professional cocktail photography of a ${name}. ` +
    `Ingredients: ${ingredients.slice(0, 3).join(', ')}. ` +
    'Moody upscale bar setting, dark background, dramatic side lighting, ' +
    'shallow depth of field, shot on a black marble surface. ' +
    'Photorealistic, editorial style, no text, no labels, no people.';
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  // null = follow the live default (rebuilds as name/ingredients change);
  // a string = the admin took over the prompt
  const [promptDraft, setPromptDraft] = useState<string | null>(null);
  const { supported: micSupported, listening, startListening, stopListening } = useSpeechInput(setAiPrompt);

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

  const handleGenerateImage = async (drinkName: string, drinkIngredients: string[]) => {
    setGeneratingImage(true);
    setError('');
    try {
      const prompt = (promptDraft ?? buildDefaultPrompt(drinkName, drinkIngredients)).trim();
      const fn = httpsCallable<
        { name: string; ingredients: string[]; prompt?: string },
        { imageBase64: string }
      >(functions, 'generateDrinkImage');
      const result = await fn({
        name: drinkName,
        ingredients: drinkIngredients,
        ...(prompt ? { prompt } : {}),
      });
      const slug = drinkName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const file = await base64PngToJpegFile(result.data.imageBase64, `${slug}.png`);
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setSuccess('Photo generated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateRecipe = async () => {
    if (!aiPrompt.trim()) return;
    setGeneratingRecipe(true);
    setError('');
    try {
      const fn = httpsCallable<
        { prompt: string },
        { name: string; description: string; ingredients: string[]; category: string }
      >(functions, 'generateDrinkRecipe');
      const result = await fn({ prompt: aiPrompt.trim() });
      const recipe = result.data;
      setName(recipe.name);
      setDescription(recipe.description);
      setIngredientsRaw(recipe.ingredients.join('\n'));
      setCategory(recipe.category);
      setGeneratingRecipe(false);
      // Chain straight into the photo so one tap builds the whole drink
      await handleGenerateImage(recipe.name, recipe.ingredients);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Recipe generation failed.');
      setGeneratingRecipe(false);
    }
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
    setDeleting(true);
    try {
      await deleteDrink({ id: id!, photoPath: existingPhotoPath });
      navigate('/admin/menu');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
      setDeleting(false);
      setConfirmDeleteOpen(false);
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

        {isNew && (
          <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Create with AI
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Describe the drink you want — it&apos;ll write the recipe and shoot the photo.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                size="small"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. a smoky mezcal drink with grapefruit…"
              />
              {micSupported && (
                <IconButton
                  onClick={listening ? stopListening : startListening}
                  aria-label={listening ? 'Stop listening' : 'Speak your drink idea'}
                  sx={{
                    bgcolor: listening ? 'error.main' : 'primary.dark',
                    color: 'white',
                    mt: 0.5,
                    '&:hover': { bgcolor: listening ? 'error.dark' : 'primary.main' },
                  }}
                >
                  {listening ? <StopIcon /> : <MicIcon />}
                </IconButton>
              )}
            </Box>
            {listening && (
              <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 1 }}>
                Listening…
              </Typography>
            )}
            <Button
              variant="contained"
              sx={{ mt: 1.5 }}
              startIcon={
                generatingRecipe || generatingImage
                  ? <CircularProgress size={14} sx={{ color: 'inherit' }} />
                  : <AutoAwesomeIcon fontSize="small" />
              }
              onClick={handleGenerateRecipe}
              disabled={!aiPrompt.trim() || generatingRecipe || generatingImage}
            >
              {generatingRecipe ? 'Writing recipe…' : generatingImage ? 'Shooting photo…' : 'Generate'}
            </Button>
          </Box>
        )}

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
            {generatingImage ? (
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1, mb: 1 }} />
            ) : photoPreview ? (
              <Box
                component="img"
                src={photoPreview}
                alt="preview"
                sx={(t) => ({ width: '100%', height: 180, objectFit: 'cover', borderRadius: 1, mb: 1, border: `1px solid ${alpha(t.palette.primary.main, 0.2)}` })}
              />
            ) : null}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" component="label" size="small" sx={{ borderColor: 'primary.dark', color: 'primary.main' }}>
                {photoPreview ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={generatingImage ? <CircularProgress size={12} /> : <CasinoIcon fontSize="small" />}
                onClick={() => handleGenerateImage(name, ingredients)}
                disabled={!name || ingredients.length === 0 || generatingImage || generatingRecipe}
                sx={{ borderColor: 'primary.dark', color: 'primary.main' }}
              >
                {photoPreview ? 'Regenerate with AI' : 'AI photo'}
              </Button>
              <Button
                size="small"
                onClick={() => setPromptOpen((open) => !open)}
                sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
              >
                {promptOpen ? 'Hide prompt' : 'Edit prompt…'}
              </Button>
            </Box>
            {promptOpen && (
              <Box sx={{ mt: 1.5 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  size="small"
                  label="Image prompt"
                  value={promptDraft ?? buildDefaultPrompt(name || 'cocktail', ingredients)}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  helperText="The exact prompt sent to the image model. Edit it, then hit Regenerate with AI."
                  slotProps={{ htmlInput: { maxLength: 1500 } }}
                />
                <Button
                  size="small"
                  onClick={() => setPromptDraft(null)}
                  disabled={promptDraft === null}
                  sx={{ mt: 0.5, color: 'text.secondary', fontSize: '0.7rem' }}
                >
                  Reset to default prompt
                </Button>
              </Box>
            )}
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
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleting}
                sx={{ borderColor: 'error.dark' }}
              >
                {deleting ? <CircularProgress size={20} color="error" /> : 'Delete'}
              </Button>
            )}
          </Box>
        </Box>

        <ConfirmDialog
          open={confirmDeleteOpen}
          title={`Delete "${name}"?`}
          message="This removes the drink and its photo permanently."
          busy={deleting}
          onConfirm={handleDelete}
          onClose={() => setConfirmDeleteOpen(false)}
        />
      </Container>
    </>
  );
}
