(function () {
  'use strict';

  // In production the frontend is served from the same Express server,
  // so we use a relative /api path. Set window.RUNWAY_API_BASE before this
  // script loads if you need to override it (e.g. for local dev against a
  // remote backend).
  const API_BASE = window.RUNWAY_API_BASE || '/api';

  /* ---------------- theme ---------------- */
  const root = document.documentElement;
  function systemPrefersDark() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function applyTheme(t) {
    if (t) root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    const dark = t ? t === 'dark' : systemPrefersDark();
    document.getElementById('themeIcon').textContent = dark ? '☀️' : '🌙';
    document.getElementById('themeLabel').textContent = dark ? 'Light' : 'Dark';
  }
  let storedTheme = null;
  try { storedTheme = localStorage.getItem('runway_theme'); } catch (e) {}
  applyTheme(storedTheme);
  document.getElementById('themeToggle').addEventListener('click', function () {
    const currentlyDark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : systemPrefersDark();
    const next = currentlyDark ? 'light' : 'dark';
    try { localStorage.setItem('runway_theme', next); } catch (e) {}
    applyTheme(next);
  });

  /* ---------------- toast ---------------- */
  function toast(msg, isErr) {
    const wrap = document.getElementById('toastWrap');
    const el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4200);
  }

  /* ---------------- api helper ---------------- */
  async function api(path, opts = {}) {
    const headers = Object.assign({}, opts.headers);
    if (!(opts.body instanceof FormData) && opts.body) headers['Content-Type'] = 'application/json';
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    const res = await fetch(API_BASE + path, Object.assign({}, opts, { headers }));
    if (!res.ok) {
      let msg = 'Request failed.';
      try { msg = (await res.json()).error || msg; } catch (e) {}
      throw new Error(msg);
    }
    return res;
  }

  /* ---------------- app state ---------------- */
  const STEPS = ['Sign in', 'Upload profile', 'Review & edit', 'Download'];
  let state = {
    step: 0,
    email: '',
    token: null,
    fileName: '',
    resume: null,
  };
  try {
    const saved = JSON.parse(localStorage.getItem('runway_session') || 'null');
    if (saved && saved.token) { state.token = saved.token; state.email = saved.email; state.step = 1; }
  } catch (e) {}

  const app = document.getElementById('app');
  const stepperEl = document.getElementById('stepper');

  function renderStepper() {
    stepperEl.innerHTML = STEPS.map((label, i) => {
      const cls = i < state.step ? 'done' : (i === state.step ? 'active' : '');
      const mark = i < state.step ? '✓' : (i + 1);
      return `<div class="step ${cls}"><span class="num">${mark}</span><span class="step-label">${label}</span></div>`;
    }).join('');
  }

  function go(step) { state.step = step; render(); }

  /* ================= STEP 0: sign in ================= */
  function renderSignIn() {
    app.innerHTML = `
      <div class="panel fade-swap">
        <h2>Sign in to start</h2>
        <p class="sub">We'll email you a 6-digit code — no password to remember.</p>
        <div id="signInStage"></div>
      </div>
    `;
    renderStepper();
    renderEmailStage();

    function renderEmailStage() {
      document.getElementById('signInStage').innerHTML = `
        <label for="emailInput">College or personal email</label>
        <input type="email" id="emailInput" placeholder="you@university.edu" value="${state.email}">
        <div style="height:16px"></div>
        <button class="btn btn-primary" id="sendCodeBtn"><span id="sendCodeLabel">Send code</span></button>
      `;
      document.getElementById('sendCodeBtn').addEventListener('click', async () => {
        const val = document.getElementById('emailInput').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { toast('Enter a valid email address.', true); return; }
        const btn = document.getElementById('sendCodeBtn');
        const label = document.getElementById('sendCodeLabel');
        btn.setAttribute('disabled', 'disabled');
        label.innerHTML = '<span class="spinner"></span> Sending…';
        try {
          await api('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email: val }) });
          state.email = val;
          toast('Code sent — check your inbox.');
          renderOtpStage();
        } catch (err) {
          toast(err.message, true);
        } finally {
          btn.removeAttribute('disabled');
          label.textContent = 'Send code';
        }
      });
    }

    function renderOtpStage() {
      document.getElementById('signInStage').innerHTML = `
        <div class="banner">We sent a 6-digit code to <strong>${state.email}</strong>. It expires in 10 minutes.</div>
        <label>Enter the code</label>
        <div class="otp-boxes" id="otpBoxes"></div>
        <div class="row">
          <button class="btn btn-primary" id="verifyBtn"><span id="verifyLabel">Verify &amp; continue</span></button>
          <button class="btn btn-ghost" id="resendBtn">Resend code</button>
        </div>
      `;
      const boxesWrap = document.getElementById('otpBoxes');
      boxesWrap.innerHTML = Array.from({ length: 6 }).map((_, i) => `<input type="text" maxlength="1" inputmode="numeric" data-i="${i}">`).join('');
      const boxes = Array.from(boxesWrap.querySelectorAll('input'));
      boxes[0] && boxes[0].focus();
      boxes.forEach((b, i) => {
        b.addEventListener('input', () => { b.value = b.value.replace(/[^0-9]/g, ''); if (b.value && boxes[i + 1]) boxes[i + 1].focus(); });
        b.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); });
      });

      document.getElementById('verifyBtn').addEventListener('click', async () => {
        const code = boxes.map(b => b.value).join('');
        if (code.length < 6) { toast('Enter all 6 digits.', true); return; }
        const btn = document.getElementById('verifyBtn');
        const label = document.getElementById('verifyLabel');
        btn.setAttribute('disabled', 'disabled');
        label.innerHTML = '<span class="spinner"></span> Verifying…';
        try {
          const res = await api('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: state.email, code }) });
          const data = await res.json();
          state.token = data.token;
          try { localStorage.setItem('runway_session', JSON.stringify({ token: data.token, email: state.email })); } catch (e) {}
          toast('Signed in as ' + state.email);
          go(1);
        } catch (err) {
          toast(err.message, true);
        } finally {
          btn.removeAttribute('disabled');
          label.textContent = 'Verify & continue';
        }
      });
      document.getElementById('resendBtn').addEventListener('click', async () => {
        try {
          await api('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email: state.email }) });
          toast('New code sent.');
        } catch (err) { toast(err.message, true); }
      });
    }
  }

  /* ================= STEP 1: upload ================= */
  function renderUpload() {
    app.innerHTML = `
      <div class="panel fade-swap">
        <h2>Upload your LinkedIn PDF</h2>
        <p class="sub">On LinkedIn: open your profile → the <strong>More</strong> button → <strong>Save to PDF</strong>. Then drop that file below.</p>
        <div class="dropzone" id="dropzone">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.6"><path d="M12 3v12m0-12 4 4m-4-4-4 4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div>Drag your PDF here, or click to choose a file</div>
          <input type="file" id="fileInput" accept="application/pdf" class="hidden">
          <div class="file-name" id="fileNameLabel">${state.fileName || ''}</div>
        </div>
        <div id="progressWrap" class="hidden">
          <div class="progress-line"><div id="progressBar"></div></div>
          <div class="progress-status" id="progressStatus"></div>
        </div>
        <div class="row" style="margin-top:20px;">
          <button class="btn btn-ghost" id="backBtn">Back</button>
          <button class="btn btn-primary" id="continueBtn" ${state.resume ? '' : 'disabled'}>Continue to review</button>
        </div>
      </div>
    `;
    renderStepper();

    const dz = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    dz.addEventListener('click', () => fileInput.click());
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
    fileInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) handleFile(f); });
    document.getElementById('backBtn').addEventListener('click', () => go(0));
    document.getElementById('continueBtn').addEventListener('click', () => go(2));

    async function handleFile(f) {
      if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { toast('Please upload a PDF file.', true); return; }
      state.fileName = f.name;
      document.getElementById('fileNameLabel').textContent = f.name;
      const progressWrap = document.getElementById('progressWrap');
      const progressBar = document.getElementById('progressBar');
      const progressStatus = document.getElementById('progressStatus');
      progressWrap.classList.remove('hidden');
      progressBar.style.width = '15%';
      progressStatus.textContent = 'Uploading and reading your PDF…';
      try {
        const form = new FormData();
        form.append('pdf', f);
        progressBar.style.width = '35%';
        progressStatus.textContent = 'Asking the resume writer to structure it…';
        const res = await api('/resume/parse', { method: 'POST', body: form });
        const data = await res.json();
        state.resume = data.resume;
        progressBar.style.width = '100%';
        progressStatus.textContent = 'Done. Review the draft below.';
        document.getElementById('continueBtn').removeAttribute('disabled');
        toast('Draft ready — review it on the next step.');
      } catch (err) {
        progressStatus.textContent = 'Something went wrong reading that file.';
        toast(err.message, true);
      }
    }
  }

  /* ================= STEP 2: review & edit ================= */
  function renderReview() {
    const r = state.resume || emptyResume();
    app.innerHTML = `
      <div class="panel fade-swap">
        <h2>Review &amp; edit</h2>
        <p class="sub">This is a first draft. Fix anything that's off before you generate the PDF.</p>

        <div class="field-block"><label>Full name</label><input type="text" id="f_name" value="${esc(r.name)}"></div>
        <div class="field-block"><label>Headline</label><input type="text" id="f_headline" value="${esc(r.headline)}"></div>
        <div class="grid2">
          <div class="field-block"><label>Email</label><input type="text" id="f_email" value="${esc(r.contact.email)}"></div>
          <div class="field-block"><label>Phone</label><input type="text" id="f_phone" value="${esc(r.contact.phone)}"></div>
          <div class="field-block"><label>Location</label><input type="text" id="f_location" value="${esc(r.contact.location)}"></div>
          <div class="field-block"><label>LinkedIn / site</label><input type="text" id="f_linkedin" value="${esc(r.contact.linkedin)}"></div>
        </div>
        <div class="field-block"><label>Summary</label><textarea id="f_summary">${esc(r.summary)}</textarea></div>

        <div class="field-block"><label>Education</label><div class="list-editor" id="eduList"></div><button class="add-entry" id="addEdu">+ Add education</button></div>
        <div class="field-block"><label>Experience</label><div class="list-editor" id="expList"></div><button class="add-entry" id="addExp">+ Add experience</button></div>
        <div class="field-block"><label>Projects</label><div class="list-editor" id="projList"></div><button class="add-entry" id="addProj">+ Add project</button></div>

        <div class="field-block">
          <label>Skills</label>
          <div class="skills-tags" id="skillsTags"></div>
          <input type="text" id="skillInput" placeholder="Type a skill and press Enter">
        </div>
        <div class="field-block">
          <label>Certifications / activities</label>
          <div class="skills-tags" id="certTags"></div>
          <input type="text" id="certInput" placeholder="Type one and press Enter">
        </div>

        <div class="row" style="margin-top:8px;">
          <button class="btn btn-ghost" id="backBtn">Back</button>
          <button class="btn btn-primary" id="toDownloadBtn">Continue to download</button>
        </div>
      </div>
    `;
    renderStepper();

    const bind = (id, path) => document.getElementById(id).addEventListener('input', e => setPath(state.resume, path, e.target.value));
    bind('f_name', 'name'); bind('f_headline', 'headline'); bind('f_summary', 'summary');
    bind('f_email', 'contact.email'); bind('f_phone', 'contact.phone'); bind('f_location', 'contact.location'); bind('f_linkedin', 'contact.linkedin');

    renderListEditor('eduList', r.education, [
      { k: 'school', ph: 'School' }, { k: 'degree', ph: 'Degree' }, { k: 'dates', ph: 'Dates' }, { k: 'details', ph: 'Details (GPA, honors…)', area: true },
    ]);
    document.getElementById('addEdu').addEventListener('click', () => { state.resume.education.push({ school: '', degree: '', dates: '', details: '' }); renderReview(); });

    renderListEditor('expList', r.experience, [
      { k: 'title', ph: 'Role title' }, { k: 'org', ph: 'Company / org' }, { k: 'dates', ph: 'Dates' }, { k: 'bullets', ph: 'Bullet points, one per line', bullets: true },
    ]);
    document.getElementById('addExp').addEventListener('click', () => { state.resume.experience.push({ title: '', org: '', dates: '', bullets: [] }); renderReview(); });

    renderListEditor('projList', r.projects, [
      { k: 'name', ph: 'Project name' }, { k: 'dates', ph: 'Dates' }, { k: 'bullets', ph: 'Bullet points, one per line', bullets: true },
    ]);
    document.getElementById('addProj').addEventListener('click', () => { state.resume.projects.push({ name: '', dates: '', bullets: [] }); renderReview(); });

    renderTags('skillsTags', r.skills);
    document.getElementById('skillInput').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.value.trim()) { state.resume.skills.push(e.target.value.trim()); renderReview(); } });
    renderTags('certTags', r.certifications);
    document.getElementById('certInput').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.value.trim()) { state.resume.certifications.push(e.target.value.trim()); renderReview(); } });

    document.getElementById('backBtn').addEventListener('click', () => go(1));
    document.getElementById('toDownloadBtn').addEventListener('click', () => go(3));

    function renderListEditor(containerId, arr, fields) {
      const el = document.getElementById(containerId);
      el.innerHTML = arr.map((item, i) => `
        <div class="entry" data-i="${i}">
          <button class="remove" data-remove="${i}">✕</button>
          ${fields.map(f => {
            if (f.bullets) return `<label style="margin-top:8px;">${f.ph}</label><textarea data-field="${f.k}">${esc((item[f.k] || []).join('\n'))}</textarea>`;
            if (f.area) return `<label style="margin-top:8px;">${f.ph}</label><textarea data-field="${f.k}">${esc(item[f.k] || '')}</textarea>`;
            return `<label style="margin-top:8px;">${f.ph}</label><input type="text" data-field="${f.k}" value="${esc(item[f.k] || '')}">`;
          }).join('')}
        </div>
      `).join('') || `<div style="color:var(--text-dim); font-size:13px;">Nothing here yet.</div>`;

      el.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => { arr.splice(Number(btn.dataset.remove), 1); renderReview(); }));
      el.querySelectorAll('.entry').forEach(entryEl => {
        const i = Number(entryEl.dataset.i);
        entryEl.querySelectorAll('[data-field]').forEach(inp => {
          inp.addEventListener('input', () => {
            const f = inp.dataset.field;
            if (f === 'bullets') arr[i][f] = inp.value.split('\n').map(s => s.trim()).filter(Boolean);
            else arr[i][f] = inp.value;
          });
        });
      });
    }

    function renderTags(containerId, arr) {
      const el = document.getElementById(containerId);
      el.innerHTML = arr.map((s, i) => `<span class="tag">${esc(s)}<button data-i="${i}">✕</button></span>`).join('');
      el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { arr.splice(Number(b.dataset.i), 1); renderReview(); }));
    }
  }

  function emptyResume() {
    return { name: '', headline: '', contact: { email: '', phone: '', location: '', linkedin: '' }, summary: '', education: [], experience: [], projects: [], skills: [], certifications: [] };
  }
  function setPath(obj, path, val) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = val;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ================= STEP 3: preview & download ================= */
  function renderDownload() {
    const r = state.resume || emptyResume();
    app.innerHTML = `
      <div class="panel fade-swap">
        <h2>Your resume is ready</h2>
        <p class="sub">Here's a preview of the layout. Download it as a PDF, or go back to keep editing.</p>
        <div id="resumePreview" class="resume-preview">${resumeHTML(r)}</div>
        <div class="row" style="margin-top:26px;">
          <button class="btn btn-ghost" id="backBtn">Back to edit</button>
          <button class="btn btn-primary" id="downloadBtn"><span id="downloadLabel">Download PDF</span></button>
        </div>
      </div>
    `;
    renderStepper();
    document.getElementById('backBtn').addEventListener('click', () => go(2));
    document.getElementById('downloadBtn').addEventListener('click', downloadPDF);
  }

  function resumeHTML(r) {
    const contactBits = [r.contact.email, r.contact.phone, r.contact.location, r.contact.linkedin].filter(Boolean).join('  ·  ');
    const sec = (title, inner) => inner ? `<div class="rsec"><div class="rsec-title">${title}</div>${inner}</div>` : '';
    const edu = r.education.map(e => `<div class="item"><div class="item-top"><span>${esc(e.school)}</span><span>${esc(e.dates)}</span></div><div class="item-sub">${esc(e.degree)}</div>${e.details ? `<div>${esc(e.details)}</div>` : ''}</div>`).join('');
    const exp = r.experience.map(e => `<div class="item"><div class="item-top"><span>${esc(e.title)}${e.org ? ', ' + esc(e.org) : ''}</span><span>${esc(e.dates)}</span></div>${e.bullets.length ? `<ul>${e.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`).join('');
    const proj = r.projects.map(e => `<div class="item"><div class="item-top"><span>${esc(e.name)}</span><span>${esc(e.dates)}</span></div>${e.bullets.length ? `<ul>${e.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`).join('');
    return `
      <h1>${esc(r.name) || 'Your Name'}</h1>
      ${r.headline ? `<div style="font-size:12.5px;color:#2B4CE0;font-weight:600;margin-bottom:4px;">${esc(r.headline)}</div>` : ''}
      <div class="contact">${esc(contactBits)}</div>
      ${sec('Summary', r.summary ? `<div>${esc(r.summary)}</div>` : '')}
      ${sec('Education', edu)}
      ${sec('Experience', exp)}
      ${sec('Projects', proj)}
      ${r.skills.length ? sec('Skills', `<div>${esc(r.skills.join(' · '))}</div>`) : ''}
      ${r.certifications.length ? sec('Certifications & Activities', `<ul>${r.certifications.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`) : ''}
    `;
  }

  async function downloadPDF() {
    const btn = document.getElementById('downloadBtn');
    const label = document.getElementById('downloadLabel');
    btn.setAttribute('disabled', 'disabled');
    label.innerHTML = '<span class="spinner"></span> Preparing…';
    try {
      const res = await api('/resume/pdf', { method: 'POST', body: JSON.stringify({ resume: state.resume }) });
      const blob = await res.blob();
      const fname = (state.resume.name || 'resume').trim().replace(/\s+/g, '_').toLowerCase() + '_runway_resume.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fname; document.body.appendChild(a); a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Resume downloaded.');
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.removeAttribute('disabled');
      label.textContent = 'Download PDF';
    }
  }

  /* ================= router ================= */
  function render() {
    document.getElementById('heroSection').style.display = state.step === 0 ? '' : 'none';
    if (state.step === 0) renderSignIn();
    else if (state.step === 1) renderUpload();
    else if (state.step === 2) renderReview();
    else renderDownload();
  }

  render();
})();
