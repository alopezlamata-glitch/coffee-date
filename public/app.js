(() => {
  const state = {
    me: localStorage.getItem('coffeeDatePerson'),
    settings: { personA: 'Adrian', personB: 'Karolina' },
    calendarCursor: new Date()
  };

  const SECTION_LABEL = { a: (name) => `${name}'s espressos`, b: (name) => `${name}'s experiments` };

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    for (const child of [].concat(children)) {
      if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  };

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function otherPerson(p) {
    return p === 'a' ? 'b' : 'a';
  }

  function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
  }

  function personName(p) {
    return p === 'a' ? state.settings.personA : state.settings.personB;
  }

  function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, options);
    let data = null;
    try { data = await res.json(); } catch (_) { /* no body */ }
    if (!res.ok) throw new Error((data && data.error) || 'Network error');
    return data;
  }

  // ---------- Onboarding ----------

  async function loadSettings() {
    state.settings = await api('/api/settings');
  }

  function renderOnboarding() {
    const wrap = $('#onboarding-buttons');
    wrap.innerHTML = '';
    wrap.appendChild(el('button', {
      textContent: state.settings.personA,
      onclick: () => choosePerson('a')
    }));
    wrap.appendChild(el('button', {
      textContent: state.settings.personB,
      onclick: () => choosePerson('b')
    }));
  }

  function choosePerson(p) {
    state.me = p;
    localStorage.setItem('coffeeDatePerson', p);
    $('#onboarding').hidden = true;
    $('#app').hidden = false;
    boot();
  }

  $('#onboarding-edit-names').addEventListener('click', async () => {
    const a = prompt('First person\'s name:', state.settings.personA);
    if (a === null) return;
    const b = prompt('Second person\'s name:', state.settings.personB);
    if (b === null) return;
    state.settings = await api('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personA: a, personB: b })
    });
    renderOnboarding();
  });

  // ---------- Header / scoreboard ----------

  function renderWhoAmI() {
    $('#whoami-btn').textContent = `You are: ${personName(state.me)}`;
  }

  $('#whoami-btn').addEventListener('click', () => {
    if (confirm('Change who you are on this device?')) {
      localStorage.removeItem('coffeeDatePerson');
      location.reload();
    }
  });

  async function refreshScores() {
    const scores = await api('/api/scores');
    $('#score-name-a').textContent = state.settings.personA;
    $('#score-name-b').textContent = state.settings.personB;
    $('#score-value-a').textContent = scores.a;
    $('#score-value-b').textContent = scores.b;
    $('#score-ties').textContent = plural(scores.ties, 'tie');

    $('#big-score-name-a').textContent = state.settings.personA;
    $('#big-score-name-b').textContent = state.settings.personB;
    $('#big-score-value-a').textContent = scores.a;
    $('#big-score-value-b').textContent = scores.b;
    $('#score-big-meta').textContent =
      `${plural(scores.daysPlayed, 'day')} played · ${plural(scores.ties, 'tie')}`;
  }

  // ---------- Tabs ----------

  const views = {
    today: $('#view-today'),
    add: $('#view-add'),
    calendar: $('#view-calendar'),
    score: $('#view-score')
  };

  function switchTab(view) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    Object.entries(views).forEach(([key, node]) => { node.hidden = key !== view; });
    if (view === 'calendar') renderCalendar();
    if (view === 'score') {
      refreshScores();
      $('#settings-name-a').value = state.settings.personA;
      $('#settings-name-b').value = state.settings.personB;
    }
  }

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.view));
  });

  $('#settings-save').addEventListener('click', async () => {
    state.settings = await api('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personA: $('#settings-name-a').value,
        personB: $('#settings-name-b').value
      })
    });
    renderWhoAmI();
    refreshScores();
    showToast('Names updated');
  });

  // ---------- Today view ----------

  $('#photo-input').addEventListener('change', () => {
    const file = $('#photo-input').files[0];
    $('#file-picker-text').textContent = file ? file.name : 'Add photo';
  });

  $('#upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = $('#photo-input');
    if (!fileInput.files[0]) return;
    const btn = $('#upload-btn');
    btn.disabled = true;
    btn.textContent = 'Uploading…';
    try {
      const fd = new FormData();
      fd.append('date', todayStr());
      fd.append('person', state.me);
      fd.append('caption', $('#caption-input').value);
      fd.append('image', fileInput.files[0]);
      await fetch('/api/photos', { method: 'POST', body: fd }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Upload failed');
        }
      });
      fileInput.value = '';
      $('#caption-input').value = '';
      $('#file-picker-text').textContent = 'Add photo';
      await renderToday();
      switchTab('today');
      showToast('Photo uploaded!');
    } catch (err) {
      showToast(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upload';
    }
  });

  async function vote(photoId) {
    try {
      await api('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayStr(), voter: state.me, photoId })
      });
      showToast('Vote saved');
      await renderToday();
    } catch (err) {
      showToast(err.message);
    }
  }

  function openPhotoModal(photo) {
    const modal = $('#photo-modal');
    $('#modal-body').innerHTML = '';
    const block = el('div', { className: 'modal-photo-block' }, [
      el('img', { src: photo.path, alt: '' }),
      el('div', { className: 'modal-photo-meta' }, [
        el('span', { textContent: personName(photo.person) }),
        el('span', { textContent: photo.caption || '' })
      ])
    ]);
    $('#modal-body').appendChild(block);
    modal.hidden = false;
  }

  $('#modal-close').addEventListener('click', () => { $('#photo-modal').hidden = true; });
  document.querySelector('.modal-backdrop').addEventListener('click', () => { $('#photo-modal').hidden = true; });

  const STAR_ICON = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.6L12 17.9l-5.8 3.1 1.1-6.6L2.5 9.4l6.6-.9L12 2.5Z"/></svg>';

  function buildPhotoCard(photo, day) {
    const card = el('div', { className: 'photo-card' });
    const media = el('div', { className: 'photo-media' });

    const img = el('img', { src: photo.path, alt: '' });
    img.addEventListener('click', () => openPhotoModal(photo));
    media.appendChild(img);

    const isMyVote = day.myVote === photo.id;
    const starBtn = el('button', {
      type: 'button',
      className: `star-btn${isMyVote ? ' voted' : ''}`,
      title: isMyVote ? 'Your vote' : 'Vote for this photo'
    });
    starBtn.innerHTML = STAR_ICON;
    starBtn.addEventListener('click', () => vote(photo.id));
    media.appendChild(starBtn);

    if (day.winner && day.winner.photoId === photo.id) {
      media.appendChild(el('div', { className: 'winner-badge', textContent: 'Winner' }));
    }

    card.appendChild(media);
    card.appendChild(el('div', { className: 'photo-caption', textContent: photo.caption || '' }));
    if (day.bothVoted && photo.voteCount !== null) {
      card.appendChild(el('span', { className: 'vote-count', textContent: plural(photo.voteCount, 'vote') }));
    }
    return card;
  }

  function renderPersonSection(person, day) {
    $(`#section-title-${person}`).textContent = SECTION_LABEL[person](personName(person));
    const grid = $(`#photos-grid-${person}`);
    grid.innerHTML = '';
    const photos = day.photos.filter((p) => p.person === person);
    if (photos.length === 0) {
      grid.appendChild(el('p', { className: 'section-empty', textContent: 'No photos yet.' }));
      return;
    }
    for (const photo of photos) {
      grid.appendChild(buildPhotoCard(photo, day));
    }
  }

  async function renderToday() {
    const date = todayStr();
    $('#today-date').textContent = capitalizeFirst(new Date().toLocaleDateString('en-US', {
      weekday: 'long', day: 'numeric', month: 'long'
    }));

    const day = await api(`/api/day/${date}?person=${state.me}`);

    const statusEl = $('#today-status');
    if (day.photos.length === 0) {
      statusEl.textContent = 'No photos uploaded today yet.';
    } else if (day.bothVoted) {
      statusEl.textContent = day.winner
        ? `${personName(day.winner.person)}'s photo wins today`
        : "It's a tie today — no point awarded.";
    } else if (day.myVote) {
      statusEl.textContent = `You voted. Waiting on ${personName(otherPerson(state.me))}…`;
    } else {
      statusEl.textContent = "Tap the star on today's best photo.";
    }

    renderPersonSection('a', day);
    renderPersonSection('b', day);
  }

  // ---------- Calendar ----------

  function monthStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  $('#cal-prev').addEventListener('click', () => {
    state.calendarCursor.setMonth(state.calendarCursor.getMonth() - 1);
    renderCalendar();
  });
  $('#cal-next').addEventListener('click', () => {
    state.calendarCursor.setMonth(state.calendarCursor.getMonth() + 1);
    renderCalendar();
  });

  async function renderCalendar() {
    const month = monthStr(state.calendarCursor);
    $('#cal-month-label').textContent = capitalizeFirst(state.calendarCursor.toLocaleDateString('en-US', {
      month: 'long', year: 'numeric'
    }));

    const data = await api(`/api/calendar?month=${month}`);
    const grid = $('#calendar-grid');
    grid.innerHTML = '';

    const firstDate = new Date(`${month}-01T00:00:00`);
    const leadingBlanks = (firstDate.getDay() + 6) % 7; // Monday-first
    for (let i = 0; i < leadingBlanks; i++) {
      grid.appendChild(el('div', { className: 'cal-day empty-slot' }));
    }

    for (const day of data.days) {
      const dayNum = Number(day.date.split('-')[2]);
      const cell = el('div', { className: 'cal-day' });
      if (day.status === 'winner' && day.winnerPhoto) {
        cell.classList.add('has-winner', `person-${day.winnerPhoto.person}`, 'clickable');
        cell.appendChild(el('img', { src: day.winnerPhoto.path, alt: '' }));
        cell.addEventListener('click', () => openDayModal(day.date));
      } else if (day.status === 'pending') {
        cell.classList.add('pending', 'clickable');
        cell.addEventListener('click', () => openDayModal(day.date));
      } else if (day.status === 'tie') {
        cell.classList.add('tie', 'clickable');
        cell.addEventListener('click', () => openDayModal(day.date));
      }
      cell.appendChild(el('span', { className: 'cal-daynum', textContent: String(dayNum) }));
      grid.appendChild(cell);
    }
  }

  async function openDayModal(date) {
    const day = await api(`/api/day/${date}?person=${state.me}`);
    const modal = $('#photo-modal');
    const body = $('#modal-body');
    body.innerHTML = '';
    body.appendChild(el('h3', { textContent: date, style: 'margin-top:0' }));

    if (day.photos.length === 0) {
      body.appendChild(el('p', { textContent: 'No photos that day.' }));
    } else if (!day.bothVoted) {
      body.appendChild(el('p', { textContent: "Both votes aren't in yet for that day." }));
    } else {
      body.appendChild(el('p', {
        textContent: day.winner ? `${personName(day.winner.person)} won` : 'Tie that day'
      }));
      for (const photo of day.photos) {
        const block = el('div', { className: 'modal-photo-block' }, [
          el('img', { src: photo.path, alt: '' }),
          el('div', { className: 'modal-photo-meta' }, [
            el('span', { textContent: personName(photo.person) }),
            el('span', { textContent: plural(photo.voteCount ?? 0, 'vote') })
          ])
        ]);
        body.appendChild(block);
      }
    }
    modal.hidden = false;
  }

  // ---------- Boot ----------

  async function boot() {
    renderWhoAmI();
    await Promise.all([renderToday(), refreshScores()]);
  }

  async function init() {
    await loadSettings();
    if (!state.me) {
      $('#onboarding').hidden = false;
      renderOnboarding();
    } else {
      $('#app').hidden = false;
      await boot();
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }

  init();
})();
