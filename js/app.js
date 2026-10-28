import { CATEGORIES, MERCHANTS, MERCHANT_BY_ID, categoryLabel } from './data.js';
import { loadCatalog } from './catalog.js';
import { syncWallet, syncCurrencies, undoUpdate, acceptUpdate, declineUpdate } from './sync.js';
import { rankCards, merchantDeals, quarterKey, spentInPeriod, capKey, fmt, fmtPct } from './engine.js';
import { load, save, cardFromPreset, blankCard, newUid } from './store.js';
import { getPosition, nearbyPlaces, cachedPlacesNear, inUS } from './location.js';
import { cloudEnabled, initCloud, scheduleUpload, savePrefs, signInWithGoogle, signInWithEmail, createAccount, resetPassword, signOutUser, describeAccountError } from './cloud.js';
import { applyRemote, combine } from './sync-merge.js';

const state = load();
let selection = null; // { title, cats, networks }
let places = [];
let catalog = { cards: [] };
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k in n && typeof v !== 'string') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

let account = { user: null, prefs: { emailMine: true, emailAll: false }, syncError: null, syncedAt: null };

function persist() {
  state.modifiedAt = Date.now();
  save(state);
  scheduleUpload(state, state.deviceId);
  renderAll();
}

const catLabel = categoryLabel;
const accountError = (e) => describeAccountError(e, { online: navigator.onLine, domain: location.host });
const amount = () => Number($('#amount').value) || 0;
const rankOpts = (extra = {}) => ({ currencies: state.currencies, log: state.log, amount: amount(), abroad: !!state.settings.abroad, ...extra });

// ---------- Pick view ----------

function renderTiles() {
  const box = $('#tiles');
  box.replaceChildren();
  if (!state.wallet.length) {
    box.append(el('p', { class: 'muted' }, 'Add your cards in the Wallet tab to see recommendations.'));
    return;
  }
  for (const cat of CATEGORIES.filter((c) => !c.hidden)) {
    const [top] = rankCards(state.wallet, [cat.id, 'other'], rankOpts({ amount: 0 }));
    if (!top) continue;
    const [deal] = merchantDeals(state.wallet, [cat.id, 'other'], MERCHANT_BY_ID, rankOpts({ amount: 0 }));
    box.append(
      el('button', { class: 'tile', onclick: () => select({ title: cat.label, cats: [cat.id] }) },
        el('span', { class: 'tile-icon' }, cat.icon),
        el('span', { class: 'tile-label' }, cat.label),
        el('span', { class: 'tile-card', style: `--card:${top.card.color}` }, top.card.short || top.card.name),
        el('span', { class: 'tile-pct' }, fmtPct(top.pct), top.missed ? ' ⚠️' : ''),
        deal && el('span', { class: 'tile-deal' }, `${deal.merchant.name}: ${deal.top.card.short || deal.top.card.name} ${fmtPct(deal.top.pct)}`),
      ),
    );
  }
}

function select(sel) {
  selection = sel;
  renderResult();
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderResult() {
  const box = $('#result');
  box.replaceChildren();
  if (!selection) return;
  const cats = [...selection.cats, 'other'];
  const ranked = rankCards(state.wallet, cats, rankOpts({ networks: selection.networks }));
  box.append(
    el('div', { class: 'result-head' },
      el('h2', {}, selection.title),
      el('div', { class: 'muted small' }, selection.cats.filter((c) => c !== 'other').map(catLabel).join(' · ') || 'General purchase'),
    ),
  );
  if (!ranked.length) {
    box.append(el('p', { class: 'muted' }, 'No cards yet — add some in the Wallet tab.'));
    return;
  }
  if (ranked.every((r) => r.blocked)) {
    box.append(el('p', { class: 'warn small' }, `None of your cards are accepted here (${selection.networks.join('/')} only).`));
  }
  ranked.forEach((r, i) => box.append(resultRow(r, i === 0 && !r.blocked)));
  const deals = merchantDeals(state.wallet, cats, MERCHANT_BY_ID, rankOpts({ networks: selection.networks }));
  if (deals.length) {
    box.append(el('div', { class: 'deals' },
      el('div', { class: 'small muted' }, 'Better at specific places:'),
      deals.map((d) => el('button', { class: 'chip', onclick: () => select({ title: d.merchant.name, cats: d.merchant.cats, networks: d.merchant.networks }) },
        `${d.merchant.name}: ${d.top.card.short || d.top.card.name} ${fmtPct(d.top.pct)}`)),
    ));
  }
  box.append(el('label', { class: 'row small' },
    el('input', { type: 'checkbox', checked: !!state.settings.abroad, onchange: (e) => { state.settings.abroad = e.target.checked; persist(); } }),
    ' Paying abroad / in a foreign currency (counts foreign transaction fees)'));
  box.append(el('button', { class: 'link', onclick: () => { selection = null; renderResult(); } }, 'Clear'));
}

function resultRow(r, isBest) {
  const c = r.card;
  const cpp = state.currencies[c.currency]?.cpp ?? 1;
  const earn = c.currency === 'cash' ? '' : ` (${+r.rate.toFixed(2)}x × ${cpp}¢)`;
  const capLine = r.cap && r.capLeft != null ? `$${fmt(r.capLeft)} of $${fmt(r.cap.amount)} left this ${r.cap.period}` : '';
  return el('div', { class: `result-row${isBest ? ' best' : ''}${r.blocked ? ' blocked' : ''}`, style: `--card:${c.color}` },
    el('div', { class: 'swatch' }),
    el('div', { class: 'grow' },
      el('div', { class: 'card-name' }, isBest ? 'Use ' : '', el('strong', {}, c.name)),
      el('div', { class: 'small muted' }, r.label + earn),
      capLine && el('div', { class: 'small muted' }, capLine),
      r.notes.map((n) => el('div', { class: 'small warn' }, n)),
      r.blocked && el('div', { class: 'small warn' }, r.blocked),
      r.perks.map((b) => el('div', { class: 'small tip' }, `💡 ${b.text}`)),
      r.missed && el('div', { class: 'small warn' },
        `Activate ${r.missed.quarter} bonus for ${fmtPct(r.missed.pct)}! `,
        el('button', { class: 'link', onclick: () => { c.activated[r.missed.quarter] = true; persist(); } }, 'I activated it'),
      ),
    ),
    el('div', { class: 'right' },
      el('div', { class: 'pct' }, fmtPct(r.pct)),
      el('button', { class: 'link small', onclick: () => logPurchase(r) }, 'log $'),
    ),
  );
}

function logPurchase(r) {
  let amt = amount();
  if (!amt) {
    const v = prompt(`Amount spent on ${r.card.name}?`);
    amt = Number(v);
    if (!amt || amt <= 0) return;
  }
  state.log.unshift({
    id: newUid(), ts: Date.now(), cardUid: r.card.uid, amount: amt,
    capKey: r.key, where: selection?.title ?? '',
  });
  state.log = state.log.slice(0, 500);
  $('#amount').value = '';
  persist();
  toast(`Logged $${fmt(amt)} on ${r.card.short || r.card.name}`);
}

function renderSuggestions() {
  const q = $('#search').value.trim().toLowerCase();
  const box = $('#suggestions');
  box.replaceChildren();
  if (!q) return;
  const hits = [];
  for (const m of MERCHANTS) {
    if (m.name.toLowerCase().includes(q) || m.match.test(q)) hits.push({ title: m.name, cats: m.cats, networks: m.networks });
  }
  for (const c of CATEGORIES) {
    if (!c.hidden && c.label.toLowerCase().includes(q)) hits.push({ title: c.label, cats: [c.id] });
  }
  hits.push({ title: `"${$('#search').value.trim()}" (everything else)`, cats: ['other'] });
  hits.slice(0, 8).forEach((h) => box.append(el('button', { class: 'chip', onclick: () => { $('#search').value = ''; box.replaceChildren(); select(h); } }, h.title)));
}

function showPlaces(list) {
  const box = $('#places');
  box.replaceChildren();
  list.forEach((p, i) => box.append(
    el('button', { class: `chip${i === 0 ? ' on' : ''}`, onclick: (e) => {
      box.querySelectorAll('.chip').forEach((b) => b.classList.remove('on'));
      e.currentTarget.classList.add('on');
      select({ title: p.name, cats: p.cats, networks: p.networks });
    } }, `${p.name} · ${p.distance}m`),
  ));
  const p = list[0];
  select({ title: p.name, cats: p.cats, networks: p.networks });
}

function locateFailed(err) {
  const status = $('#locateStatus');
  status.replaceChildren(
    el('span', { class: 'warn' }, err.message || 'The location lookup failed.'), ' ',
    el('button', { class: 'link', onclick: locate }, 'Try again'),
    el('div', {}, 'You can also type the store name in the search box or tap a category below.'),
    err.details && el('details', { class: 'small' }, el('summary', {}, 'What happened'), el('div', {}, err.details)),
  );
}

let locating = false;
async function locate() {
  if (locating) return;
  locating = true;
  const status = $('#locateStatus');
  $('#places').replaceChildren();
  status.textContent = 'Getting your location…';
  try {
    const pos = await getPosition();
    const abroad = !inUS(pos.latitude, pos.longitude);
    if (abroad !== !!state.settings.abroad) {
      state.settings.abroad = abroad;
      save(state);
      toast(abroad ? 'Looks like you are outside the US: foreign transaction fees now count' : 'Back in the US: foreign fees no longer count');
    }
    const radius = Math.max(state.settings.radius, Math.min(pos.accuracy, 300));
    // Show stores remembered from an earlier visit right away, then refresh.
    const saved = cachedPlacesNear(pos.latitude, pos.longitude, Math.max(150, Math.min(pos.accuracy, 300)));
    if (saved?.length) {
      showPlaces(saved);
      status.textContent = 'Stores from your last visit here. Checking for updates…';
    } else {
      status.textContent = `Looking up stores near you (±${Math.round(pos.accuracy)} m)…`;
    }
    let source;
    try {
      ({ places, source } = await nearbyPlaces(pos.latitude, pos.longitude, radius));
    } catch (e) {
      if (saved?.length) {
        status.replaceChildren(
          'Showing stores saved from your last visit here. ',
          el('details', { class: 'small' }, el('summary', {}, "Why it couldn't refresh"), el('div', {}, `${e.message} ${e.details || ''}`)),
        );
        return;
      }
      throw e;
    }
    status.textContent = `Nearest first (±${Math.round(pos.accuracy)} m, from ${source}). Tap the right one if it guessed wrong:`;
    // If you already tapped one of the remembered stores, keep that choice.
    const keep = saved?.length && places.some((p) => p.name === selection?.title) ? selection : null;
    showPlaces(places);
    if (keep) select(keep);
  } catch (e) {
    locateFailed(e);
  } finally {
    locating = false;
  }
}

// ---------- Wallet view ----------

function renderWallet() {
  const box = $('#walletList');
  box.replaceChildren();
  if (!state.wallet.length) box.append(el('p', { class: 'muted' }, 'No cards yet.'));
  const q = quarterKey();
  for (const card of state.wallet) {
    const cur = state.currencies[card.currency];
    const parts = [];
    const rot = card.rotating;
    const def = rot?.quarters?.[q];
    if (rot) {
      if (def) {
        const spent = spentInPeriod(state.log, `${card.uid}:rot`, rot.cap.period);
        parts.push(el('div', { class: 'rot' },
          el('div', {}, el('strong', {}, `${q} ${def.rate}%: `), def.cats.map((c) => catLabel(c) + (def.rates?.[c] ? ` (${def.rates[c]}%)` : '')).join(', ')),
          rot.activationRequired && el('label', { class: 'row' },
            el('input', { type: 'checkbox', checked: !!card.activated?.[q], onchange: (e) => { card.activated ??= {}; card.activated[q] = e.target.checked; persist(); } }),
            card.activated?.[q] ? ' Activated' : ' Not activated yet — tick once you activate',
          ),
          progress(spent, rot.cap.amount, rot.cap.period),
        ));
      } else {
        parts.push(el('div', { class: 'warn small' }, `No rotating categories entered for ${q}. Tap Edit to add them.`));
      }
    }
    card.rules.forEach((rule, i) => {
      if (rule.choiceOptions) {
        parts.push(el('label', { class: 'row small' }, `${rule.label || 'Your pick'} (${rule.rate}${card.currency === 'cash' ? '%' : 'x'}): `,
          el('select', { onchange: (e) => { rule.cats = [e.target.value]; persist(); } },
            rule.choiceOptions.map((o) => el('option', { value: o, selected: rule.cats[0] === o }, catLabel(o)))),
        ));
      }
      if (rule.cap && !(i > 0 && card.rules.slice(0, i).some((r) => r.cap?.group && r.cap.group === rule.cap.group))) {
        const spent = spentInPeriod(state.log, capKey(card, rule, i), rule.cap.period);
        parts.push(el('div', { class: 'small' }, `${rule.cats.map(catLabel).join(', ')} cap:`, progress(spent, rule.cap.amount, rule.cap.period)));
      }
    });
    box.append(el('div', { class: 'wallet-card', style: `--card:${card.color}` },
      el('div', { class: 'wallet-head' },
        el('div', { class: 'swatch' }),
        el('div', { class: 'grow' },
          el('strong', {}, card.name),
          el('div', { class: 'small muted' }, `${cur?.name ?? card.currency}${card.currency === 'cash' ? '' : ` @ ${cur?.cpp}¢`} · base ${card.base}${card.currency === 'cash' ? '%' : 'x'} · ${card.network}`),
        ),
        el('button', { class: 'link', onclick: () => editCard(card) }, 'Edit'),
      ),
      card.discontinued && el('div', { class: 'small warn' }, 'The issuer no longer offers this card to new applicants. Existing cards keep working.'),
      card.presetId && !card.verified && !card.customized && el('div', { class: 'small muted' }, 'Terms not yet verified against current sources. The monthly update will check them, or tap Edit to adjust.'),
      card.pendingVersion && el('div', { class: 'small update' },
        'An update is available for this card, but you have edited it. ',
        el('button', { class: 'link', onclick: () => { acceptUpdate(card, catalog); persist(); } }, 'Use the update'),
        el('button', { class: 'link', onclick: () => { declineUpdate(card); persist(); } }, 'Keep mine'),
      ),
      parts,
      card.benefits?.length > 0 && el('details', { class: 'benefits small' },
        el('summary', {}, `Benefits (${card.benefits.length})`),
        el('ul', {}, card.benefits.map((b) => el('li', {}, b.text))),
      ),
    ));
  }
  renderLog();
}

function progress(spent, cap, period) {
  const pct = Math.min(100, (spent / cap) * 100);
  return el('div', { class: 'progress-wrap' },
    el('div', { class: 'progress' }, el('div', { style: `width:${pct}%` })),
    el('span', { class: 'small muted' }, `$${fmt(spent)} / $${fmt(cap)} this ${period}`),
  );
}

function renderLog() {
  const box = $('#logList');
  box.replaceChildren();
  if (!state.log.length) {
    box.append(el('p', { class: 'muted small' }, 'Nothing logged yet. Tap "log $" on a recommendation.'));
    return;
  }
  for (const e of state.log.slice(0, 30)) {
    const card = state.wallet.find((c) => c.uid === e.cardUid);
    box.append(el('div', { class: 'log-row small' },
      el('span', { class: 'grow' }, `${new Date(e.ts).toLocaleDateString()} · ${card?.short || card?.name || 'Removed card'} · ${e.where}`),
      el('strong', {}, `$${fmt(e.amount)}`),
      el('button', { class: 'link', onclick: () => { state.log = state.log.filter((x) => x.id !== e.id); persist(); } }, '✕'),
    ));
  }
}

// ---------- Dialogs ----------

function openDialog(build, onSave) {
  const dlg = $('#dialog');
  const body = $('#dialogBody');
  body.replaceChildren(...build().flat(Infinity));
  dlg.onclose = () => { if (dlg.returnValue === 'save') onSave?.(); };
  dlg.returnValue = '';
  dlg.oncancel = null;
  dlg.showModal();
}

function addCardDialog() {
  const owned = () => new Set(state.wallet.map((c) => c.presetId));
  const issuers = [...new Set(catalog.cards.map((c) => c.issuer))].sort((a, b) => a.localeCompare(b));
  const filters = { issuer: '', type: '', q: '' };
  const list = el('div', { class: 'preset-list' });

  const meta = (p) => [
    p.type === 'debit' ? 'Debit' : null,
    p.annualFee ? `$${p.annualFee}/yr` : 'No annual fee',
    p.network[0].toUpperCase() + p.network.slice(1),
    p.discontinued ? 'No longer offered' : null,
    p.verified ? null : 'terms not yet verified',
  ].filter(Boolean).join(' · ');

  const renderList = () => {
    const have = owned();
    const q = filters.q.trim().toLowerCase();
    const shown = catalog.cards.filter((p) =>
      (!filters.issuer || p.issuer === filters.issuer)
      && (!filters.type || p.type === filters.type)
      && (!q || `${p.name} ${p.issuer} ${p.short}`.toLowerCase().includes(q)));
    list.replaceChildren();
    if (!shown.length) list.append(el('p', { class: 'muted small' }, 'No match. Try "Custom card" below to add it yourself.'));
    for (const issuer of issuers) {
      const group = shown.filter((p) => p.issuer === issuer).sort((a, b) => a.name.localeCompare(b.name));
      if (!group.length) continue;
      list.append(el('div', { class: 'issuer-head' }, issuer));
      for (const p of group) {
        const added = have.has(p.presetId);
        list.append(el('button', { type: 'button', class: `preset${added ? ' added' : ''}`, disabled: added, style: `--card:${p.color}`, onclick: () => {
          state.wallet.push(cardFromPreset(p));
          persist();
          renderList();
          toast(`Added ${p.name}`);
        } },
          el('span', { class: 'swatch' }),
          el('span', { class: 'grow' }, p.name, el('div', { class: 'small muted' }, meta(p))),
          el('span', { class: 'small' }, added ? '✓ Added' : '＋'),
        ));
      }
    }
  };

  openDialog(() => [
    el('h2', {}, 'Add cards'),
    el('div', { class: 'filters' },
      el('input', { type: 'search', placeholder: 'Search cards…', onkeydown: (e) => { if (e.key === 'Enter') e.preventDefault(); }, oninput: (e) => { filters.q = e.target.value; renderList(); } }),
      el('select', { onchange: (e) => { filters.issuer = e.target.value; renderList(); } },
        el('option', { value: '' }, 'All issuers'),
        issuers.map((i) => el('option', { value: i }, `${i} (${catalog.cards.filter((c) => c.issuer === i).length})`))),
      el('select', { onchange: (e) => { filters.type = e.target.value; renderList(); } },
        el('option', { value: '' }, 'Credit & debit'),
        el('option', { value: 'credit' }, 'Credit cards'),
        el('option', { value: 'debit' }, 'Debit cards')),
    ),
    list,
    el('div', { class: 'btn-row sticky' },
      el('button', { type: 'button', onclick: () => { $('#dialog').close(); editCard(blankCard(), true); } }, 'Custom card…'),
      el('button', { value: 'cancel', class: 'primary' }, 'Done'),
    ),
  ]);
  renderList();
}

function catPicker(selected, onChange) {
  const set = new Set(selected);
  const summary = el('summary', {}, selected.length ? selected.map(catLabel).join(', ') : 'Pick categories');
  return el('details', { class: 'cat-picker' }, summary,
    el('div', { class: 'cat-grid' }, CATEGORIES.filter((c) => c.id !== 'other').map((c) =>
      el('label', {}, el('input', { type: 'checkbox', checked: set.has(c.id), onchange: (e) => {
        e.target.checked ? set.add(c.id) : set.delete(c.id);
        const arr = [...set];
        summary.textContent = arr.length ? arr.map(catLabel).join(', ') : 'Pick categories';
        onChange(arr);
      } }), ` ${c.label}`))),
  );
}

function editCard(card, isNew = false) {
  const d = structuredClone(card);
  const field = (label, input) => el('label', { class: 'field' }, el('span', {}, label), input);
  const bind = (key, type = 'text') => el('input', { type, value: d[key] ?? '', step: 'any', oninput: (e) => { d[key] = type === 'number' ? Number(e.target.value) : e.target.value; } });

  const build = () => [
    el('h2', {}, isNew ? 'New card' : 'Edit card'),
    field('Name', bind('name')),
    field('Short name', bind('short')),
    field('Color', bind('color', 'color')),
    field('Network', el('select', { onchange: (e) => { d.network = e.target.value; } },
      ['visa', 'mastercard', 'amex', 'discover'].map((n) => el('option', { value: n, selected: d.network === n }, n)))),
    field('Rewards currency', el('select', { onchange: (e) => { d.currency = e.target.value; } },
      Object.entries(state.currencies).map(([id, c]) => el('option', { value: id, selected: d.currency === id }, `${c.name} (${c.cpp}¢)`)))),
    field('Base rate (% or x)', bind('base', 'number')),

    el('h3', {}, 'Bonus categories'),
    d.rules.map((rule, i) => el('div', { class: 'rule' },
      rule.choiceOptions
        ? el('div', { class: 'small muted' }, `${rule.label || 'Choice'}: pick in Wallet`)
        : catPicker(rule.cats, (arr) => { rule.cats = arr; }),
      el('div', { class: 'rule-nums' },
        field('Rate', el('input', { type: 'number', step: 'any', value: rule.rate, oninput: (e) => { rule.rate = Number(e.target.value); } })),
        field('Cap $', el('input', { type: 'number', step: 'any', value: rule.cap?.amount ?? '', placeholder: 'none', oninput: (e) => {
          const v = Number(e.target.value);
          if (v > 0) rule.cap = { period: 'year', ...rule.cap, amount: v };
          else delete rule.cap;
        } })),
        field('per', el('select', { onchange: (e) => { if (rule.cap) rule.cap.period = e.target.value; } },
          ['month', 'quarter', 'year'].map((p) => el('option', { value: p, selected: (rule.cap?.period ?? 'year') === p }, p)))),
      ),
      el('button', { type: 'button', class: 'link warn', onclick: () => { d.rules.splice(i, 1); rerender(); } }, 'Remove'),
    )),
    el('button', { type: 'button', onclick: () => { d.rules.push({ cats: [], rate: 2 }); rerender(); } }, '＋ Bonus category'),

    el('h3', {}, 'Rotating quarterly categories'),
    el('label', { class: 'row' }, el('input', { type: 'checkbox', checked: !!d.rotating, onchange: (e) => {
      d.rotating = e.target.checked ? { activationRequired: true, cap: { amount: 1500, period: 'quarter' }, quarters: {} } : undefined;
      rerender();
    } }), ' This card has rotating categories'),
    d.rotating && [
      el('label', { class: 'row' }, el('input', { type: 'checkbox', checked: d.rotating.activationRequired, onchange: (e) => { d.rotating.activationRequired = e.target.checked; } }), ' Must activate each quarter'),
      field('Quarterly cap $', el('input', { type: 'number', value: d.rotating.cap.amount, oninput: (e) => { d.rotating.cap.amount = Number(e.target.value); } })),
      Object.entries(d.rotating.quarters).sort(([a], [b]) => b.localeCompare(a)).map(([q, def]) => el('div', { class: 'rule' },
        el('strong', {}, q),
        catPicker(def.cats, (arr) => { def.cats = arr; def.custom = true; }),
        field('Rate', el('input', { type: 'number', step: 'any', value: def.rate, oninput: (e) => { def.rate = Number(e.target.value); def.custom = true; } })),
        def.rates && el('div', { class: 'small muted' }, 'Special rates: ' + Object.entries(def.rates).map(([c, r]) => `${catLabel(c)} ${r}`).join(', ')),
        el('button', { type: 'button', class: 'link warn', onclick: () => { delete d.rotating.quarters[q]; rerender(); } }, 'Remove quarter'),
      )),
      el('button', { type: 'button', onclick: () => {
        const q = prompt('Quarter (e.g. 2027-Q1)', nextQuarter(d.rotating.quarters));
        if (q && /^\d{4}-Q[1-4]$/.test(q)) { d.rotating.quarters[q] ??= { cats: [], rate: 5, custom: true }; rerender(); }
      } }, '＋ Quarter'),
    ],

    el('div', { class: 'btn-row sticky' },
      !isNew && el('button', { type: 'button', class: 'warn', onclick: () => {
        if (!confirm(`Remove ${card.name} from your wallet?`)) return;
        state.wallet = state.wallet.filter((c) => c.uid !== card.uid);
        $('#dialog').close();
        persist();
      } }, 'Delete'),
      el('button', { value: 'cancel', formnovalidate: true }, 'Cancel'),
      el('button', { value: 'save', class: 'primary' }, 'Save'),
    ),
  ];
  const rerender = () => $('#dialogBody').replaceChildren(...build().flat(Infinity));
  openDialog(() => build().flat(Infinity), () => {
    if (!d.rotating) delete d.rotating;
    const fields = (c) => JSON.stringify(['name', 'network', 'currency', 'base', 'rules'].map((f) => c[f]));
    if (d.presetId && fields(d) !== fields(card)) d.customized = true;
    const i = state.wallet.findIndex((c) => c.uid === d.uid);
    if (i >= 0) state.wallet[i] = d;
    else state.wallet.push(d);
    persist();
  });
}

function nextQuarter(quarters) {
  const keys = Object.keys(quarters).sort();
  const last = keys.at(-1) || quarterKey();
  let [y, q] = [Number(last.slice(0, 4)), Number(last.slice(-1))];
  if (keys.length) { q += 1; if (q > 4) { q = 1; y += 1; } }
  return `${y}-Q${q}`;
}

// ---------- Settings ----------

const CPP_CHOICES = [0, 0.1, 0.25, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.25, 1.3, 1.4, 1.5, 1.6, 1.75, 2, 2.25, 2.5];

function renderPoints() {
  const box = $('#pointsList');
  box.replaceChildren();
  const byCurrency = new Map();
  for (const card of state.wallet) {
    if (card.currency === 'cash' || !state.currencies[card.currency]) continue;
    if (!byCurrency.has(card.currency)) byCurrency.set(card.currency, []);
    byCurrency.get(card.currency).push(card);
  }
  if (!state.wallet.length) {
    box.append(el('p', { class: 'muted' }, 'Add your cards first (menu → Add cards). Their rewards programs will show up here.'));
  } else if (!byCurrency.size) {
    box.append(el('p', { class: 'muted' }, 'All your cards earn cash back, which is always worth 1¢ per point, so there is nothing to set.'));
  }
  for (const [id, cards] of byCurrency) {
    const c = state.currencies[id];
    const typical = catalog.currencies?.[id]?.cpp;
    const values = [...new Set([...CPP_CHOICES, Number(c.cpp), ...(typical != null ? [typical] : [])])].sort((a, b) => a - b);
    const select = el('select', { onchange: (e) => {
      if (e.target.value === 'custom') {
        const v = Number(prompt(`What is one ${c.name} point worth to you, in cents?`, String(c.cpp)));
        if (Number.isFinite(v) && v >= 0) c.cpp = v;
      } else {
        c.cpp = Number(e.target.value);
      }
      persist();
    } },
      values.map((v) => el('option', { value: v, selected: Number(c.cpp) === v }, `${v}¢${v === typical ? ' (typical)' : ''}`)),
      el('option', { value: 'custom' }, 'Custom…'),
    );
    box.append(el('div', { class: 'currency' },
      el('div', { class: 'row' }, el('strong', { class: 'grow' }, c.name), select),
      el('div', { class: 'small muted' }, `Your cards: ${cards.map((k) => k.short || k.name).join(', ')}`),
      c.note && el('div', { class: 'small muted' }, c.note),
    ));
  }
  box.append(el('button', { class: 'link small', onclick: () => {
    const name = prompt('Name of the rewards program (e.g. "Bilt points"), for a custom card');
    if (!name) return;
    const cpp = Number(prompt('Cents per point to you', '1'));
    state.currencies[`c_${newUid()}`] = { name, cpp: cpp || 1 };
    persist();
    toast('Added. Choose it in your custom card\'s Edit screen.');
  } }, '＋ Add a rewards program for a custom card'));
}

function renderSettings() {
  $('#catalogInfo').textContent = catalog.updated
    ? `Card data from ${catalog.updated}. Last checked ${state.lastChecked ? new Date(state.lastChecked).toLocaleString() : 'never'}.`
    : "Card data hasn't loaded yet.";
  $('#autoLocate').checked = state.settings.autoLocate;
  $('#radius').value = state.settings.radius;
}

// ---------- Shell ----------

function renderNotices() {
  const box = $('#updates');
  box.replaceChildren();
  state.notices ??= [];
  for (const n of state.notices) {
    const card = state.wallet.find((c) => c.uid === n.cardUid);
    if (!card) continue;
    const dismiss = () => { state.notices = state.notices.filter((x) => x !== n); persist(); };
    box.append(el('div', { class: 'notice', style: `--card:${card.color}` },
      el('div', { class: 'grow' },
        el('strong', {}, n.applied ? `${card.name} updated` : `Update available: ${card.name}`),
        n.entries.length
          ? n.entries.map((e) => el('div', { class: 'small' }, e.text))
          : el('div', { class: 'small muted' }, 'Card details refreshed.'),
        el('div', {},
          n.applied && card.previous && el('button', { class: 'link small', onclick: () => { undoUpdate(card); dismiss(); toast('Change undone'); } }, 'Undo'),
          !n.applied && card.pendingVersion && [
            el('button', { class: 'link small', onclick: () => { acceptUpdate(card, catalog); dismiss(); } }, 'Use the update'),
            el('button', { class: 'link small', onclick: () => { declineUpdate(card); dismiss(); } }, 'Keep mine'),
          ],
        ),
      ),
      el('button', { class: 'link', 'aria-label': 'Dismiss', onclick: dismiss }, '✕'),
    ));
  }
}

async function refreshCatalog({ manual = false } = {}) {
  try {
    const res = await loadCatalog();
    catalog = res.catalog;
    syncCurrencies(state.currencies, catalog.currencies);
    const notices = syncWallet(state.wallet, catalog);
    state.notices = [...(state.notices || []), ...notices];
    if (res.fresh) state.lastChecked = Date.now();
    persist();
    if (manual) toast(notices.length ? `${notices.length} card update(s)` : res.fresh ? 'Your cards are up to date' : 'Offline — using saved card data');
  } catch {
    if (manual) toast('Could not check for updates');
    renderAll();
  }
}

// ---------- Account ----------

function renderAccount() {
  const box = $('#account');
  box.replaceChildren();
  if (!cloudEnabled) {
    box.append(el('p', { class: 'muted small' }, 'Accounts are not switched on for this copy of the app yet, so your cards are saved on this device only. Use Export/Import below to move them.'));
    return;
  }
  const u = account.user;
  if (!u) {
    box.append(
      el('p', { class: 'muted small' }, 'Sign in to keep your cards in sync on every device and browser, and to get email updates.'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'primary', onclick: () => signInWithGoogle().catch((e) => alert(`Sign-in failed: ${accountError(e)}`)) }, 'Sign in with Google'),
      ),
      emailSignInForm(),
    );
    return;
  }
  const pref = (key, label) => el('label', { class: 'row' },
    el('input', { type: 'checkbox', checked: !!account.prefs[key], onchange: async (e) => {
      account.prefs = { ...account.prefs, [key]: e.target.checked };
      try { await savePrefs(state, state.deviceId, account.prefs); toast('Email preferences saved'); } catch (err) { alert(`Could not save: ${accountError(err)}`); }
    } }), ` ${label}`);
  box.append(
    el('p', { class: 'small' }, `Signed in as ${u.email || u.displayName || 'you'}.`),
    account.syncError
      ? el('p', { class: 'small warn' }, `Sync isn't working: ${account.syncError}`)
      : el('p', { class: 'small muted' }, account.syncedAt ? `Cards synced across your devices (last ${new Date(account.syncedAt).toLocaleTimeString()}).` : 'Syncing…'),
    el('h3', {}, 'Email updates'),
    pref('emailMine', 'When cards in my wallet change (new rotating categories, earn rates, benefits)'),
    pref('emailAll', 'All card news: any card changing, new cards, and discontinued cards'),
    el('button', { onclick: () => signOutUser() }, 'Sign out'),
  );
}

function emailSignInForm() {
  const email = el('input', { type: 'email', placeholder: 'Email', autocomplete: 'email' });
  const password = el('input', { type: 'password', placeholder: 'Password (6+ characters)', autocomplete: 'current-password' });
  const msg = el('div', { class: 'small' });
  const run = async (label, fn) => {
    msg.className = 'small muted';
    msg.textContent = `${label}…`;
    try {
      await fn();
    } catch (e) {
      msg.className = 'small warn';
      msg.textContent = accountError(e);
    }
  };
  return el('div', { class: 'email-signin' },
    el('div', { class: 'small muted' }, 'Or use your email and a password:'),
    email, password,
    el('div', { class: 'btn-row' },
      el('button', { onclick: () => run('Signing in', () => signInWithEmail(email.value.trim(), password.value)) }, 'Sign in'),
      el('button', { onclick: () => run('Creating your account', () => createAccount(email.value.trim(), password.value)) }, 'Create account'),
      el('button', { class: 'link', onclick: () => run('Sending reset email', async () => {
        await resetPassword(email.value.trim());
        msg.className = 'small';
        msg.textContent = `Password reset email sent to ${email.value.trim()}. Check your inbox (and spam).`;
      }) }, 'Forgot password?'),
    ),
    msg,
  );
}

function chooseSyncSource(localCount, remoteCount) {
  return new Promise((resolve) => {
    const pick = (v) => { $('#dialog').close(); resolve(v); };
    openDialog(() => [
      el('h2', {}, 'Which cards should we keep?'),
      el('p', {}, `This device has ${localCount} card(s). Your account has ${remoteCount} card(s).`),
      el('div', { class: 'preset-list' },
        el('button', { type: 'button', class: 'primary', onclick: () => pick('combine') }, 'Combine both (recommended)'),
        el('button', { type: 'button', onclick: () => pick('remote') }, "Use my account's cards"),
        el('button', { type: 'button', onclick: () => pick('local') }, "Use this device's cards"),
      ),
    ]);
    $('#dialog').oncancel = (e) => e.preventDefault();
  });
}

async function startCloud() {
  if (!cloudEnabled) return;
  try {
    await initCloud({
      deviceId: state.deviceId,
      getState: () => state,
      onUser: (u) => {
        account.user = u;
        account.syncError = null;
        renderAccount();
      },
      onSyncError: (e) => {
        account.syncError = accountError(e);
        renderAccount();
      },
      onSynced: () => {
        account.syncError = null;
        account.syncedAt = Date.now();
        renderAccount();
      },
      onFirstSync: async (remote, prefs) => {
        if (prefs) account.prefs = { ...account.prefs, ...prefs };
        const uid = account.user.uid;
        let choice = 'local';
        if (remote) {
          const localN = state.wallet.length;
          const remoteN = remote.wallet?.length || 0;
          if (!localN) choice = 'remote';
          else if (!remoteN) choice = 'local';
          else if (state.syncedUid === uid) choice = (remote.modifiedAt || 0) > (state.modifiedAt || 0) ? 'remote' : 'local';
          else choice = await chooseSyncSource(localN, remoteN);
        }
        if (choice === 'remote') applyRemote(state, remote);
        if (choice === 'combine') { applyRemote(state, combine(state, remote)); choice = 'local'; }
        state.syncedUid = uid;
        save(state);
        renderAll();
        if (!prefs) await savePrefs(state, state.deviceId, account.prefs).catch(() => {});
        return choice;
      },
      onRemote: (remote, prefs) => {
        if (prefs) account.prefs = { ...account.prefs, ...prefs };
        applyRemote(state, remote);
        save(state);
        renderAll();
      },
    });
  } catch (e) {
    console.warn('Accounts unavailable', e);
    $('#account').replaceChildren(el('p', { class: 'muted small warn' }, `${accountError(e)} Your cards are still saved on this device.`),
      el('button', { onclick: () => location.reload() }, 'Try again'));
  }
}

function renderAll() {
  renderAccount();
  $('#quarterBadge').textContent = quarterKey();
  renderNotices();
  renderTiles();
  renderResult();
  renderWallet();
  renderSettings();
  renderPoints();
}

function showView(name) {
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${name}`; });
  document.querySelectorAll('#menu [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo(0, 0);
}

function toast(msg) {
  const t = el('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2500);
}

// Hamburger menu (top right).
const menu = $('#menu');
const menuBtn = $('#menuBtn');
function setMenu(open) {
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.classList.toggle('open', open);
}
menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { showView(b.dataset.view); setMenu(false); }));
$('#menuAddCard').addEventListener('click', () => { setMenu(false); showView('wallet'); addCardDialog(); });
menu.querySelector('a').addEventListener('click', () => setMenu(false));
$('#locateBtn').addEventListener('click', locate);
$('#search').addEventListener('input', renderSuggestions);
$('#search').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#suggestions .chip')?.click(); });
$('#amount').addEventListener('input', renderResult);
$('#addCardBtn').addEventListener('click', addCardDialog);
$('#autoLocate').addEventListener('change', (e) => { state.settings.autoLocate = e.target.checked; save(state); });
$('#radius').addEventListener('change', (e) => { state.settings.radius = Number(e.target.value) || 120; save(state); });
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `pick-a-card-backup-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.wallet)) throw new Error('Not a Pick-A-Card backup');
    if (!confirm('Replace everything on this phone with the backup?')) return;
    Object.assign(state, data);
    persist();
    toast('Backup restored');
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  }
});

$('#checkUpdatesBtn').addEventListener('click', () => refreshCatalog({ manual: true }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - (state.lastChecked || 0) > CHECK_EVERY_MS) refreshCatalog();
});

renderAll();
if (!state.wallet.length) showView('wallet');
const params = new URLSearchParams(location.search);
if (params.get('view')) showView(params.get('view'));
// Start the store lookup right away; don't wait on the card-data check.
if (params.has('locate') || (state.settings.autoLocate && state.wallet.length)) locate();
await refreshCatalog();
startCloud();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
