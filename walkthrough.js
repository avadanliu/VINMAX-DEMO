(function () {
  // ── Styles
  const style = document.createElement('style');
  style.textContent = `
    #vmx-wt-backdrop {
      position: fixed; top: 40px; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.42);
      z-index: 9998;
    }
    #vmx-wt-card {
      position: fixed; z-index: 9999;
      background: #fff; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      width: 300px;
      pointer-events: all;
      font-family: 'Graphik', Helvetica, Arial, sans-serif;
      overflow: visible;
      transition: opacity 150ms ease;
    }
    .vmx-wt-arrow-up {
      position: absolute;
      top: -8px;
      overflow: visible;
      filter: drop-shadow(0 -3px 3px rgba(0,0,0,0.13));
    }
    .vmx-wt-arrow-right {
      position: absolute;
      right: -8px;
      top: 50%;
      transform: translateY(-50%);
      overflow: visible;
      filter: drop-shadow(3px 0 3px rgba(0,0,0,0.13));
    }
    .vmx-wt-arrow-down {
      position: absolute;
      bottom: -8px;
      overflow: visible;
      filter: drop-shadow(0 5px 4px rgba(0,0,0,0.22));
    }
    .vmx-wt-arrow-left {
      position: absolute;
      left: -8px;
      top: 50%;
      transform: translateY(-50%);
      overflow: visible;
      filter: drop-shadow(-3px 0 3px rgba(0,0,0,0.13));
    }
    .vmx-wt-content {
      display: flex; flex-direction: column; gap: 16px;
      padding: 24px;
    }
    .vmx-wt-footer {
      display: flex; gap: 8px; justify-content: space-between;
      padding: 12px 24px 20px;
    }
    .vmx-wt-step-label {
      font-size: 14px; color: #5e6976;
      font-weight: 500; line-height: 18px;
      letter-spacing: 0.2px;
    }
    .vmx-wt-title {
      font-family: 'Rund Display', sans-serif;
      font-size: 18px; font-weight: 600;
      color: #0d1722; line-height: 24px;
      letter-spacing: 0.3px;
    }
    .vmx-wt-body {
      font-family: 'Rund Display', sans-serif;
      font-size: 16px; font-weight: 400;
      color: #0d1722; line-height: 20px;
      letter-spacing: 0.2px;
    }
    .vmx-wt-btn-back {
      width: 44px; height: 44px;
      background: #fff; border: 1px solid #d8dbde;
      border-radius: 999px; font-family: inherit;
      font-size: 18px; font-weight: 400;
      color: #3e4b5b; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .vmx-wt-btn-back:hover { background: #f4f6f9; }
    .vmx-wt-btn-next {
      height: 44px; padding: 0 24px;
      background: #0763d3; border: none;
      border-radius: 999px; font-family: inherit;
      font-size: 15px; font-weight: 500;
      color: #fff; cursor: pointer;
    }
    .vmx-wt-btn-next:hover { background: #0552b4; }
  `;
  document.head.appendChild(style);

  // ── State
  let steps = [];
  let currentStep = -1;
  let lastStepIdx = -1;

  // ── CSV parser (same logic as app.js)
  function parseCsvRow(line) {
    const result = [];
    let field = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(field); field = '';
      } else {
        field += c;
      }
    }
    result.push(field);
    return result;
  }

  function parseCsv(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const headers = parseCsvRow(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = parseCsvRow(line);
      const row = {};
      headers.forEach((h, j) => { row[h] = values[j] !== undefined ? values[j] : ''; });
      rows.push(row);
    }
    return rows;
  }

  // ── DOM elements
  let backdrop, card;

  function buildDOM() {
    backdrop = document.createElement('div');
    backdrop.id = 'vmx-wt-backdrop';
    backdrop.style.display = 'none';
    // Forward scroll events through the backdrop to whatever scrollable element is underneath
    backdrop.addEventListener('wheel', function(e) {
      backdrop.style.pointerEvents = 'none';
      const target = document.elementFromPoint(e.clientX, e.clientY);
      backdrop.style.pointerEvents = '';
      if (!target) return;
      const scrollable = target.closest('.vmx-scroll');
      if (scrollable) {
        scrollable.scrollTop += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
    document.body.appendChild(backdrop);

    card = document.createElement('div');
    card.id = 'vmx-wt-card';
    card.style.display = 'none';
    document.body.appendChild(card);
  }

  // ── Dynamic position resolver — computes placement from live DOM anchors
  const CARD_W = 300;
  const CARD_H = 262;
  const ARROW_SZ = 8;
  const GAP = 12;

  // Cached DOM anchors — found once, reused on every step render
  const domCache = {};

  function resolvePosition(key, cardH) {
    const vw = window.innerWidth;
    const h = cardH != null ? cardH : CARD_H;

    if (key === 'center') {
      return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    }

    if (key === 'above-vdp-graph') {
      domCache.vdpSection ??= (() => {
        const h = Array.from(document.querySelectorAll('div')).find(d => d.textContent.trim() === 'VINMax impact on daily VDP views');
        return h ? h.parentElement : null;
      })();
      if (!domCache.vdpSection) return resolvePosition('center');
      const r = domCache.vdpSection.getBoundingClientRect();
      const sectionCX = Math.round(r.left + r.width / 2);
      const cardLeft = Math.max(GAP, Math.min(vw - CARD_W - GAP, sectionCX - CARD_W / 2));
      const cardTop = Math.round(r.top - h - GAP - ARROW_SZ);
      return { left: `${cardLeft}px`, top: `${cardTop}px`, transform: '', arrowDown: sectionCX - cardLeft - ARROW_SZ };
    }

    if (key === 'below-third-vehicle') {
      domCache.vehicleHeaderRow ??= (() => {
        const cell = Array.from(document.querySelectorAll('div')).find(d => d.textContent.trim() === 'Vehicle' && d.style.minWidth === '280px');
        return cell ? cell.parentElement : null;
      })();
      if (!domCache.vehicleHeaderRow) return resolvePosition('center');
      const headerRow = domCache.vehicleHeaderRow;
      const row3 = headerRow.nextElementSibling?.nextElementSibling?.nextElementSibling;
      if (!row3) return resolvePosition('center');
      const hr = headerRow.getBoundingClientRect();
      const r3 = row3.getBoundingClientRect();
      const cardLeft = Math.max(GAP, Math.min(vw - CARD_W - GAP, Math.round(hr.left)));
      const arrowOffset = CARD_W / 2 - ARROW_SZ;
      const cardTop = Math.round(r3.top - h - GAP - ARROW_SZ);
      return { left: `${cardLeft}px`, top: `${cardTop}px`, transform: '', arrowDown: arrowOffset };
    }

    if (key === 'left-of-drawer') {
      // Drawer appears/disappears between steps — do not cache
      const drawer = Array.from(document.querySelectorAll('div')).find(d => {
        const r = d.getBoundingClientRect();
        return Math.round(r.right) >= vw - 2 && r.width > 300 && r.width < vw * 0.6 && r.height > 300 && r.top < 150;
      });
      if (!drawer) return resolvePosition('center');
      const r = drawer.getBoundingClientRect();
      const cardLeft = Math.round(r.left - CARD_W - GAP - ARROW_SZ);
      return { left: `${cardLeft}px`, top: '50%', transform: 'translateY(-50%)', arrowRight: true };
    }

    if (key === 'above-history-header') {
      // Re-query every time — history tab may not have been active when cached
      const cell = Array.from(document.querySelectorAll('div')).find(d => d.textContent.trim() === 'Vehicle' && d.style.minWidth === '200px');
      if (!cell) return resolvePosition('center');
      const hr = cell.parentElement.getBoundingClientRect();
      const cardLeft = Math.max(GAP, Math.round(hr.right - CARD_W));
      const cardTop = Math.round(hr.top - h - GAP - ARROW_SZ);
      const arrowOffset = Math.round(CARD_W / 2 - ARROW_SZ);
      return { left: `${cardLeft}px`, top: `${cardTop}px`, transform: '', arrowDown: arrowOffset };
    }

    if (key === 'right-of-history-tab') {
      domCache.historyTab ??= Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'History');
      if (!domCache.historyTab) return resolvePosition('center');
      const r = domCache.historyTab.getBoundingClientRect();
      const tabCY = Math.round(r.top + r.height / 2);
      const cardLeft = Math.round(r.right + GAP);
      const cardTop = Math.max(GAP, Math.round(tabCY - h / 2));
      return { left: `${cardLeft}px`, top: `${cardTop}px`, transform: '', arrowLeftDir: true, arrowLeftTop: tabCY - cardTop - ARROW_SZ };
    }

    if (key === 'left-of-sold-filter') {
      domCache.soldLabel ??= Array.from(document.querySelectorAll('label')).find(l => l.innerText.trim().startsWith('Sold'));
      if (!domCache.soldLabel) return resolvePosition('center');
      const r = domCache.soldLabel.getBoundingClientRect();
      const soldCY = Math.round(r.top + r.height / 2);
      const cardLeft = Math.round(r.left - CARD_W - 16 - ARROW_SZ);
      const cardTop = Math.round(soldCY - h / 2);
      return { left: `${cardLeft}px`, top: `${cardTop}px`, transform: '', arrowRight: true, arrowRightTop: soldCY - cardTop - ARROW_SZ };
    }

    return resolvePosition('center');
  }

  // ── Navigate app state via exposed vmxNav
  function navigateApp(step) {
    const nav = window.vmxNav;
    if (!nav) return;
    nav.setTab(step.tab);
    if (step.vehicle === 'first' || step.vehicle === 'third') {
      const idx = step.vehicle === 'third' ? 2 : 0;
      setTimeout(() => {
        const active = window.vmxActive;
        if (active && active.length > idx) nav.openDrawer(active[idx].id);
      }, 80);
    } else {
      nav.closeDrawer();
    }
  }

  // ── Arrow SVG builder
  function arrowSvg(pos) {
    const sk = `fill="none" stroke="rgba(0,0,0,0.09)" stroke-width="1"`;
    if (pos.arrowLeft != null)
      return `<svg class="vmx-wt-arrow-up" style="left:${pos.arrowLeft}px" xmlns="http://www.w3.org/2000/svg" width="16" height="9" viewBox="0 0 16 9"><polygon points="8,0 16,9 0,9" fill="white"/><path d="M8,0 L0,9" ${sk}/><path d="M8,0 L16,9" ${sk}/></svg>`;
    if (pos.arrowDown != null)
      return `<svg class="vmx-wt-arrow-down" style="left:${pos.arrowDown}px" xmlns="http://www.w3.org/2000/svg" width="16" height="9" viewBox="0 0 16 9"><polygon points="0,0 16,0 8,9" fill="white"/><path d="M0,0 L8,9" ${sk}/><path d="M16,0 L8,9" ${sk}/></svg>`;
    if (pos.arrowRight) {
      const style = pos.arrowRightTop != null ? `style="top:${pos.arrowRightTop}px;transform:none"` : '';
      return `<svg class="vmx-wt-arrow-right" ${style} xmlns="http://www.w3.org/2000/svg" width="9" height="16" viewBox="0 0 9 16"><polygon points="0,0 9,8 0,16" fill="white"/><path d="M0,0 L9,8" ${sk}/><path d="M0,16 L9,8" ${sk}/></svg>`;
    }
    if (pos.arrowLeftDir) {
      const style = pos.arrowLeftTop != null ? `style="top:${pos.arrowLeftTop}px;transform:none"` : '';
      return `<svg class="vmx-wt-arrow-left" ${style} xmlns="http://www.w3.org/2000/svg" width="9" height="16" viewBox="0 0 9 16"><polygon points="9,0 0,8 9,16" fill="white"/><path d="M9,0 L0,8" ${sk}/><path d="M9,16 L0,8" ${sk}/></svg>`;
    }
    return '';
  }

  // ── Render splash (step=start)
  function renderSplash(s) {
    card.style.width = '500px';
    card.style.padding = '52px 56px 48px';
    card.style.textAlign = 'center';
    card.style.background = 'linear-gradient(180deg, #E4F5FE 0%, #FFF 100%)';
    card.style.borderRadius = '16px';
    backdrop.style.background = 'rgba(0,0,0,0.5)';
    backdrop.style.pointerEvents = 'all';
    const p = resolvePosition('center');
    card.style.left = p.left;
    card.style.top = p.top;
    card.style.transform = p.transform;

    card.innerHTML = `
      <div style="margin-bottom:20px">
        <img src="assets/CarGurus-logo.png" alt="CarGurus" style="height:24px;width:auto">
      </div>
      <div style="margin-bottom:16px;padding:16px 0">
        <img src="assets/VINMax-logo.png" alt="VINMax" style="height:46px;width:auto">
      </div>
      <button class="vmx-wt-btn-next" id="vmx-wt-start-btn" style="padding:0 32px;height:40px;font-size:14px;border-radius:999px">${s.next_label}</button>
    `;
    document.getElementById('vmx-wt-start-btn').onclick = () => goToStep(1);
  }

  // ── Render tooltip step
  function renderStep(s) {
    card.style.width = '300px';
    card.style.padding = '0';
    card.style.textAlign = 'left';
    card.style.background = '#fff';
    card.style.borderRadius = '16px';
    backdrop.style.background = 'transparent';
    backdrop.style.display = 'block';
    backdrop.style.pointerEvents = (s.step === '3') ? 'none' : 'all';

    const isLast = currentStep === lastStepIdx;

    const pos = resolvePosition(s.position);
    card.style.left = pos.left;
    card.style.top = pos.top;
    card.style.transform = pos.transform;

    const backSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8.23687 14.8605L8.45914 14.6395C8.60644 14.4931 8.60644 14.2556 8.45914 14.1092L2.84833 8.53124H14.664C14.8723 8.53124 15.0412 8.36333 15.0412 8.15624V7.84374C15.0412 7.63665 14.8723 7.46874 14.664 7.46874H2.84833L8.45914 1.8908C8.60644 1.74437 8.60644 1.50693 8.45914 1.36046L8.23687 1.13952C8.08957 0.993084 7.85073 0.993084 7.70343 1.13952L1.06922 7.73483C0.921915 7.88127 0.921915 8.11871 1.06922 8.26518L7.70343 14.8605C7.85073 15.0069 8.08957 15.0069 8.23687 14.8605V14.8605Z" fill="#0D1722"/></svg>`;

    card.innerHTML = `
      ${arrowSvg(pos)}
      <div class="vmx-wt-content">
        ${s.step_label ? `<div class="vmx-wt-step-label">${s.step_label}</div>` : ''}
        <div class="vmx-wt-title">${s.title}</div>
        ${s.body ? `<div class="vmx-wt-body">${s.body}</div>` : ''}
      </div>
      <div class="vmx-wt-footer">
        ${parseInt(s.step) > 1
          ? `<button class="vmx-wt-btn-back" id="vmx-wt-back">${backSvg}</button>`
          : `<span></span>`}
        <button class="vmx-wt-btn-next" id="vmx-wt-next">${s.next_label}</button>
      </div>
    `;

    const backBtn = document.getElementById('vmx-wt-back');
    if (backBtn) backBtn.onclick = () => goToStep(currentStep - 1);

    document.getElementById('vmx-wt-next').onclick = () => {
      if (isLast) {
        backdrop.style.display = 'none';
        fadeOut(() => { card.style.display = 'none'; });
      } else {
        goToStep(currentStep + 1);
      }
    };

    // Re-position using actual rendered card height after layout settles
    setTimeout(() => {
      const actualH = card.offsetHeight;
      if (!actualH || card.style.display === 'none') return;
      // Clear domCache entries that depend on live DOM positions
      delete domCache.vehicleHeaderRow;
      const refined = resolvePosition(s.position, actualH);
      card.style.left = refined.left;
      card.style.top = refined.top;
      card.style.transform = refined.transform;
    }, 80);
  }

  // ── Fade helpers
  function fadeOut(cb) {
    card.style.opacity = '0';
    setTimeout(cb, 150);
  }

  function fadeIn() {
    card.style.opacity = '0';
    card.style.display = 'block';
    requestAnimationFrame(() => { card.style.opacity = '1'; });
  }

  // ── Render dispatcher
  function render() {
    if (currentStep < 0 || currentStep >= steps.length) {
      backdrop.style.display = 'none';
      card.style.display = 'none';
      return;
    }
    backdrop.style.display = 'block';
    card.style.display = 'block';
    card.style.opacity = '1';

    const s = steps[currentStep];
    if (s.step === 'start') {
      renderSplash(s);
    } else {
      renderStep(s);
    }
  }

  // ── Sync step to URL param
  function syncStepUrl(idx) {
    const s = idx >= 0 && idx < steps.length ? steps[idx] : null;
    const url = new URL(window.location);
    if (s) {
      url.searchParams.set('step', s.step);
    } else {
      url.searchParams.delete('step');
    }
    window.history.pushState({ vmxStep: idx }, '', url);
  }

  function goToStep(idx, skipUrlSync) {
    const fromIdx = currentStep;
    currentStep = idx;
    const s = idx >= 0 && idx < steps.length ? steps[idx] : null;

    if (!s || s.step === 'start') {
      // Clear cached DOM anchors so a restart always gets fresh references
      Object.keys(domCache).forEach(k => delete domCache[k]);
      if (window.vmxNav) {
        window.vmxNav.setTab('performance');
        if (window.vmxNav.setSoldOnly) window.vmxNav.setSoldOnly(false);
      }
      if (!skipUrlSync) syncStepUrl(idx);
      render();
      return;
    }

    const prev = fromIdx >= 0 && fromIdx < steps.length ? steps[fromIdx] : null;
    const tabChanged = !prev || prev.tab !== s.tab;
    const navDelay = s.step === '3' ? 480 : tabChanged ? 300 : 150;

    if (s.step === '5') {
      const arrive5 = () => {
        navigateApp(s);
        if (!skipUrlSync) syncStepUrl(idx);
        setTimeout(() => {
          if (window.vmxNav?.setSoldOnly) window.vmxNav.setSoldOnly(true);
          setTimeout(() => { render(); fadeIn(); }, 500);
        }, 100);
      };
      if (card.style.display === 'none' || card.style.display === '') {
        arrive5();
      } else {
        fadeOut(() => { card.style.display = 'none'; arrive5(); });
      }
      return;
    }

    if (prev && prev.step === '5' && window.vmxNav?.setSoldOnly) {
      window.vmxNav.setSoldOnly(false);
    }

    const arrive = () => {
      navigateApp(s);
      if (!skipUrlSync) syncStepUrl(idx);
      setTimeout(() => { render(); fadeIn(); }, navDelay);
    };

    if (card.style.display === 'none' || card.style.display === '') {
      arrive();
    } else {
      fadeOut(() => { card.style.display = 'none'; arrive(); });
    }
  }

  // ── Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    if (!steps.length) return;
    const param = new URLSearchParams(window.location.search).get('step');
    const idx = steps.findIndex(s => s.step === param);
    if (idx >= 0) {
      goToStep(idx, true);
    } else {
      currentStep = -1;
      backdrop.style.display = 'none';
      card.style.display = 'none';
    }
  });

  // ── Init
  async function init() {
    buildDOM();
    try {
      const res = await fetch('data/walkthrough.csv?v=5');
      const text = await res.text();
      steps = parseCsv(text);
      lastStepIdx = steps.reduce((max, s, i) => s.step !== 'start' ? i : max, -1);
    } catch (e) {
      console.warn('VINMax walkthrough: could not load walkthrough.csv', e);
      return;
    }
    const disclaimerText = (steps.find(s => s.disclaimer) || {}).disclaimer || '';
    if (disclaimerText) {
      const el = document.getElementById('vmx-demo-banner-text');
      if (el) el.textContent = disclaimerText;
    }
    const startBtn = document.getElementById('vmx-demo-start-btn');
    const stepParam = new URLSearchParams(window.location.search).get('step');
    const idx = stepParam ? steps.findIndex(s => s.step === stepParam) : 0;
    let autoStartTimer = setTimeout(() => goToStep(idx >= 0 ? idx : 0), 600);
    if (startBtn) startBtn.onclick = () => {
      clearTimeout(autoStartTimer);
      goToStep(0);
    };
  }

  init();
})();
