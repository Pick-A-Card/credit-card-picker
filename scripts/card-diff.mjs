// Works out what changed between two versions of data/cards.json, and turns
// that into email content. Pure functions — tested in tests/card-diff.test.mjs.

const quarterName = (q) => `${q.slice(5)} ${q.slice(0, 4)}`;

/**
 * @returns {Array<{ presetId, name, kind: 'changed'|'new'|'discontinued'|'quarter', text }>}
 */
export function diffCatalogs(oldRaw, newRaw, labelFor = (c) => c) {
  const before = new Map((oldRaw?.cards || []).map((c) => [c.presetId, c]));
  const events = [];
  for (const card of newRaw.cards) {
    const old = before.get(card.presetId);
    const base = { presetId: card.presetId, name: card.name };
    if (!old) {
      events.push({ ...base, kind: 'new', text: `Now in Pick-A-Card: ${card.name} (${card.issuer || 'new card'}).` });
      continue;
    }
    const seen = new Set((old.changelog || []).map((e) => `${e.date}|${e.text}`));
    const fresh = (card.changelog || []).filter((e) => !seen.has(`${e.date}|${e.text}`));
    const newlyDiscontinued = card.discontinued && !old.discontinued;
    if (newlyDiscontinued && !fresh.length) {
      events.push({ ...base, kind: 'discontinued', text: `${card.name} is no longer offered to new applicants. Existing cards keep working.` });
    }
    for (const e of fresh) events.push({ ...base, kind: newlyDiscontinued ? 'discontinued' : 'changed', text: e.text });
    for (const [q, def] of Object.entries(card.rotating?.quarters || {})) {
      const prev = old.rotating?.quarters?.[q];
      if (prev && JSON.stringify(prev.cats) === JSON.stringify(def.cats) && prev.rate === def.rate) continue;
      const cats = def.cats.map(labelFor).join(', ');
      events.push({ ...base, kind: 'quarter', text: `${prev ? 'Corrected' : 'New'} ${quarterName(q)} ${def.rate}% categories: ${cats}.` });
    }
  }
  return events;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function section(title, events) {
  if (!events.length) return { text: '', html: '' };
  const byCard = new Map();
  for (const e of events) {
    if (!byCard.has(e.name)) byCard.set(e.name, []);
    byCard.get(e.name).push(e.text);
  }
  let text = `${title}\n`;
  let html = `<h2 style="font-size:18px">${esc(title)}</h2>`;
  for (const [name, lines] of byCard) {
    text += `\n${name}\n${lines.map((l) => `  - ${l}`).join('\n')}\n`;
    html += `<p><strong>${esc(name)}</strong></p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  }
  return { text, html };
}

/**
 * Build one person's email, or null if there is nothing for them.
 * @param {{ presetIds: string[], prefs: { emailMine?: boolean, emailAll?: boolean } }} person
 */
const SUPPORT_URL = 'https://buymeacoffee.com/pickacard';

export function buildEmail(events, person, appUrl) {
  const mine = new Set(person.presetIds || []);
  const yours = events.filter((e) => mine.has(e.presetId));
  const others = events.filter((e) => !mine.has(e.presetId));
  const wantsAll = !!person.prefs?.emailAll;
  const wantsMine = !!person.prefs?.emailMine;
  const parts = [];
  if ((wantsMine || wantsAll) && yours.length) parts.push(section('Your cards', yours));
  if (wantsAll && others.length) parts.push(section('Other card news', others));
  if (!parts.length) return null;
  const yourNames = [...new Set(yours.map((e) => e.name))];
  const otherCount = new Set(others.map((e) => e.name)).size;
  const subject = yourNames.length
    ? `Pick-A-Card: updates to ${yourNames.length === 1 ? yourNames[0] : `${yourNames.length} of your cards`}`
    : `Pick-A-Card: ${otherCount} card update${otherCount === 1 ? '' : 's'}`;
  const footer = `Open Pick-A-Card: ${appUrl}\nChange or stop these emails: ${appUrl}?view=settings\nEnjoying Pick-A-Card? Buy me a coffee: ${SUPPORT_URL}`;
  return {
    subject,
    text: `${parts.map((p) => p.text).join('\n')}\n${footer}\n`,
    html: `${parts.map((p) => p.html).join('')}<hr><p style="color:#666;font-size:13px"><a href="${esc(appUrl)}">Open Pick-A-Card</a> · <a href="${esc(appUrl)}?view=settings">Change or stop these emails</a> · <a href="${SUPPORT_URL}">Buy me a coffee ☕</a></p>`,
  };
}
