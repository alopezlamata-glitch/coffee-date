const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const DEFAULT_DB = {
  settings: { personA: 'Persona A', personB: 'Persona B' },
  photos: [],
  votes: []
};

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function load() {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
    return structuredClone(DEFAULT_DB);
  }
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return { ...structuredClone(DEFAULT_DB), ...parsed };
}

function save(db) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function getSettings() {
  return load().settings;
}

function updateSettings(patch) {
  const db = load();
  db.settings = { ...db.settings, ...patch };
  save(db);
  return db.settings;
}

function addPhoto({ date, person, filename, caption }) {
  const db = load();
  const photo = {
    id: crypto.randomUUID(),
    date,
    person,
    path: `/uploads/${filename}`,
    caption: (caption || '').slice(0, 200),
    createdAt: new Date().toISOString()
  };
  db.photos.push(photo);
  save(db);
  return photo;
}

function deletePhoto(id, person) {
  const db = load();
  const idx = db.photos.findIndex((p) => p.id === id && p.person === person);
  if (idx === -1) return false;
  const [photo] = db.photos.splice(idx, 1);
  db.votes = db.votes.filter((v) => v.photoId !== id);
  save(db);
  try {
    const filePath = path.join(UPLOADS_DIR, path.basename(photo.path));
    fs.unlinkSync(filePath);
  } catch (_) {
    /* file already gone, ignore */
  }
  return true;
}

function castVote({ date, voter, photoId }) {
  const db = load();
  const photoExists = db.photos.some((p) => p.id === photoId && p.date === date);
  if (!photoExists) throw new Error('La foto no existe para ese día');
  const existing = db.votes.find((v) => v.date === date && v.voter === voter);
  if (existing) {
    existing.photoId = photoId;
    existing.createdAt = new Date().toISOString();
  } else {
    db.votes.push({ date, voter, photoId, createdAt: new Date().toISOString() });
  }
  save(db);
  return computeDay(db, date);
}

function otherPerson(person) {
  return person === 'a' ? 'b' : 'a';
}

function computeDay(db, date) {
  const photos = db.photos.filter((p) => p.date === date);
  const votes = db.votes.filter((v) => v.date === date);
  const voteByVoter = { a: votes.find((v) => v.voter === 'a'), b: votes.find((v) => v.voter === 'b') };
  const bothVoted = Boolean(voteByVoter.a && voteByVoter.b);

  const counts = {};
  for (const v of votes) counts[v.photoId] = (counts[v.photoId] || 0) + 1;

  let winner = null;
  if (bothVoted) {
    let maxVotes = -1;
    let winners = [];
    for (const p of photos) {
      const c = counts[p.id] || 0;
      if (c > maxVotes) {
        maxVotes = c;
        winners = [p];
      } else if (c === maxVotes) {
        winners.push(p);
      }
    }
    const distinctPeople = new Set(winners.map((w) => w.person));
    if (winners.length > 0 && maxVotes > 0 && distinctPeople.size === 1) {
      winner = winners[0];
    }
  }

  return { date, photos, votes, counts, bothVoted, winner };
}

function getDay(date, person) {
  const db = load();
  const result = computeDay(db, date);
  const myVote = result.votes.find((v) => v.voter === person) || null;
  const partnerVoted = result.votes.some((v) => v.voter === otherPerson(person));
  return {
    date,
    photos: result.photos.map((p) => ({
      id: p.id,
      person: p.person,
      path: p.path,
      caption: p.caption,
      createdAt: p.createdAt,
      voteCount: result.bothVoted ? result.counts[p.id] || 0 : null
    })),
    myVote: myVote ? myVote.photoId : null,
    partnerVoted,
    bothVoted: result.bothVoted,
    winner: result.bothVoted && result.winner
      ? { photoId: result.winner.id, person: result.winner.person, path: result.winner.path }
      : null,
    isTie: result.bothVoted && !result.winner && result.photos.length > 0
  };
}

function allDatesWithActivity(db) {
  const dates = new Set();
  for (const p of db.photos) dates.add(p.date);
  for (const v of db.votes) dates.add(v.date);
  return [...dates].sort();
}

function getCalendarMonth(month) {
  const db = load();
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const result = computeDay(db, date);
    let status = 'empty';
    let winnerPhoto = null;
    if (result.photos.length > 0) {
      if (result.bothVoted) {
        status = result.winner ? 'winner' : 'tie';
        if (result.winner) {
          winnerPhoto = { path: result.winner.path, person: result.winner.person };
        }
      } else {
        status = 'pending';
      }
    }
    days.push({ date, status, winnerPhoto, photoCount: result.photos.length });
  }
  return { month, days };
}

function getScores() {
  const db = load();
  const dates = allDatesWithActivity(db);
  const scores = { a: 0, b: 0, ties: 0, daysPlayed: 0 };
  for (const date of dates) {
    const result = computeDay(db, date);
    if (!result.bothVoted || result.photos.length === 0) continue;
    scores.daysPlayed++;
    if (result.winner) {
      scores[result.winner.person]++;
    } else {
      scores.ties++;
    }
  }
  return scores;
}

module.exports = {
  UPLOADS_DIR,
  getSettings,
  updateSettings,
  addPhoto,
  deletePhoto,
  castVote,
  getDay,
  getCalendarMonth,
  getScores
};
