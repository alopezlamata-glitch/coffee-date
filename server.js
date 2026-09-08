const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const store = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 3000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function isPerson(v) {
  return v === 'a' || v === 'b';
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, store.UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo se admiten imágenes'));
    cb(null, true);
  }
});

app.use(express.json());
app.use('/uploads', express.static(store.UPLOADS_DIR, { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/settings', (req, res) => {
  res.json(store.getSettings());
});

app.post('/api/settings', (req, res) => {
  const { personA, personB } = req.body || {};
  const patch = {};
  if (typeof personA === 'string' && personA.trim()) patch.personA = personA.trim().slice(0, 40);
  if (typeof personB === 'string' && personB.trim()) patch.personB = personB.trim().slice(0, 40);
  res.json(store.updateSettings(patch));
});

app.get('/api/day/:date', (req, res) => {
  const { date } = req.params;
  const { person } = req.query;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Fecha inválida' });
  if (!isPerson(person)) return res.status(400).json({ error: 'Persona inválida' });
  res.json(store.getDay(date, person));
});

app.post('/api/photos', upload.single('image'), (req, res) => {
  try {
    const { date, person, caption } = req.body || {};
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Fecha inválida' });
    if (!isPerson(person)) return res.status(400).json({ error: 'Persona inválida' });
    if (!req.file) return res.status(400).json({ error: 'Falta la imagen' });
    const photo = store.addPhoto({ date, person, filename: req.file.filename, caption });
    res.status(201).json(photo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/photos/:id', (req, res) => {
  const { person } = req.query;
  if (!isPerson(person)) return res.status(400).json({ error: 'Persona inválida' });
  const ok = store.deletePhoto(req.params.id, person);
  if (!ok) return res.status(404).json({ error: 'No encontrada' });
  res.json({ ok: true });
});

app.post('/api/vote', (req, res) => {
  try {
    const { date, voter, photoId } = req.body || {};
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Fecha inválida' });
    if (!isPerson(voter)) return res.status(400).json({ error: 'Persona inválida' });
    if (!photoId) return res.status(400).json({ error: 'Falta la foto' });
    store.castVote({ date, voter, photoId });
    res.json(store.getDay(date, voter));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/calendar', (req, res) => {
  const { month } = req.query;
  if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'Mes inválido' });
  res.json(store.getCalendarMonth(month));
});

app.get('/api/scores', (req, res) => {
  res.json(store.getScores());
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Error' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Coffee Date corriendo en http://localhost:${PORT}`);
});
