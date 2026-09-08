(() => {
  const state = {
    me: localStorage.getItem('coffeeDatePerson'),
    settings: { personA: 'Persona A', personB: 'Persona B' },
    calendarCursor: new Date()
  };

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
    if (!res.ok) throw new Error((data && data.error) || 'Error de red');
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
    const a = prompt('Nombre de la primera persona:', state.settings.personA);
    if (a === null) return;
    const b = prompt('Nombre de la segunda persona:', state.settings.personB);
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
    $('#whoami-btn').textContent = `Eres: ${personName(state.me)}`;
  }

  $('#whoami-btn').addEventListener('click', () => {
    if (confirm('¿Cambiar quién eres en este dispositivo?')) {
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
    $('#score-ties').textContent = scores.ties;

    $('#big-score-name-a').textContent = state.settings.personA;
    $('#big-score-name-b').textContent = state.settings.personB;
    $('#big-score-value-a').textContent = scores.a;
    $('#big-score-value-b').textContent = scores.b;
    $('#score-big-meta').textContent =
      `${scores.daysPlayed} día${scores.daysPlayed === 1 ? '' : 's'} jugado${scores.daysPlayed === 1 ? '' : 's'} · ${scores.ties} empate${scores.ties === 1 ? '' : 's'}`;
  }

  // ---------- Tabs ----------

  const views = {
    today: $('#view-today'),
    calendar: $('#view-calendar'),
    score: $('#view-score')
  };

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      Object.entries(views).forEach(([key, node]) => { node.hidden = key !== btn.dataset.view; });
      if (btn.dataset.view === 'calendar') renderCalendar();
      if (btn.dataset.view === 'score') {
        refreshScores();
        $('#settings-name-a').value = state.settings.personA;
        $('#settings-name-b').value = state.settings.personB;
      }
    });
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
    showToast('Nombres actualizados');
  });

  // ---------- Today view ----------

  $('#photo-input').addEventListener('change', () => {
    const file = $('#photo-input').files[0];
    $('#file-picker-text').textContent = file ? `📷 ${file.name}` : '📷 Subir foto de tu café';
  });

  $('#upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = $('#photo-input');
    if (!fileInput.files[0]) return;
    const btn = $('#upload-btn');
    btn.disabled = true;
    btn.textContent = 'Subiendo…';
    try {
      const fd = new FormData();
      fd.append('date', todayStr());
      fd.append('person', state.me);
      fd.append('caption', $('#caption-input').value);
      fd.append('image', fileInput.files[0]);
      await fetch('/api/photos', { method: 'POST', body: fd }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'No se pudo subir');
        }
      });
      fileInput.value = '';
      $('#caption-input').value = '';
      $('#file-picker-text').textContent = '📷 Subir foto de tu café';
      showToast('¡Foto subida!');
      await renderToday();
    } catch (err) {
      showToast(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Subir';
    }
  });

  async function vote(photoId) {
    try {
      await api('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayStr(), voter: state.me, photoId })
      });
      showToast('Voto registrado');
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

  async function renderToday() {
    const date = todayStr();
    $('#today-date').textContent = capitalizeFirst(new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    }));

    const day = await api(`/api/day/${date}?person=${state.me}`);

    const statusEl = $('#today-status');
    if (day.photos.length === 0) {
      statusEl.textContent = 'Nadie ha subido fotos hoy todavía.';
    } else if (day.bothVoted) {
      statusEl.textContent = day.winner
        ? `🏆 Gana la foto de ${personName(day.winner.person)}`
        : 'Empate hoy — ¡nadie gana el punto!';
    } else if (day.myVote) {
      statusEl.textContent = `Ya has votado. Esperando el voto de ${personName(otherPerson(state.me))}…`;
    } else {
      statusEl.textContent = 'Vota tu foto favorita de hoy.';
    }

    const grid = $('#photos-grid');
    grid.innerHTML = '';
    for (const photo of day.photos) {
      const card = el('div', { className: 'photo-card' });
      if (day.winner && day.winner.photoId === photo.id) {
        card.appendChild(el('div', { className: 'winner-crown', textContent: '👑' }));
      }
      const img = el('img', { src: photo.path, alt: '' });
      img.addEventListener('click', () => openPhotoModal(photo));
      card.appendChild(img);
      card.appendChild(el('div', { className: 'photo-owner-tag', textContent: personName(photo.person) }));
      card.appendChild(el('div', { className: 'photo-caption', textContent: photo.caption || '' }));

      const row = el('div', { className: 'photo-vote-row' });
      const isMyVote = day.myVote === photo.id;
      const voteBtn = el('button', {
        className: `vote-btn${isMyVote ? ' voted' : ''}`,
        textContent: isMyVote ? '✓ Tu voto' : 'Votar'
      });
      voteBtn.addEventListener('click', () => vote(photo.id));
      row.appendChild(voteBtn);
      if (day.bothVoted && photo.voteCount !== null) {
        row.appendChild(el('span', { className: 'vote-count', textContent: `${photo.voteCount}★` }));
      }
      card.appendChild(row);
      grid.appendChild(card);
    }
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
    $('#cal-month-label').textContent = capitalizeFirst(state.calendarCursor.toLocaleDateString('es-ES', {
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
      body.appendChild(el('p', { textContent: 'No hay fotos ese día.' }));
    } else if (!day.bothVoted) {
      body.appendChild(el('p', { textContent: 'Todavía no han votado los dos ese día.' }));
    } else {
      body.appendChild(el('p', {
        textContent: day.winner ? `Ganó ${personName(day.winner.person)}` : 'Empate ese día'
      }));
      for (const photo of day.photos) {
        const block = el('div', { className: 'modal-photo-block' }, [
          el('img', { src: photo.path, alt: '' }),
          el('div', { className: 'modal-photo-meta' }, [
            el('span', { textContent: personName(photo.person) }),
            el('span', { textContent: `${photo.voteCount ?? 0}★` })
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
