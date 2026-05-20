import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { promises as dnsPromises } from 'dns';

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

mkdirSync('/data', { recursive: true });
const db = new Database('/data/dmarc.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    pass_rate INTEGER NOT NULL,
    spf_pass_rate INTEGER NOT NULL DEFAULT 0,
    dkim_pass_rate INTEGER NOT NULL DEFAULT 0,
    total_messages INTEGER NOT NULL,
    policy TEXT,
    org_name TEXT,
    ai_conclusion TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS rdns (
    ip TEXT PRIMARY KEY,
    ptr TEXT,
    updated_at TEXT
  )
`);

try { db.exec(`ALTER TABLE checks ADD COLUMN spf_pass_rate INTEGER NOT NULL DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE checks ADD COLUMN dkim_pass_rate INTEGER NOT NULL DEFAULT 0`); } catch(e) {}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(join(__dirname, 'public')));

app.post('/api/log', (req, res) => {
  const { domain, passRate, spfPassRate, dkimPassRate, totalMessages, policy, orgName, aiConclusion } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain påkrevd' });
  db.prepare(`
    INSERT INTO checks (domain, checked_at, pass_rate, spf_pass_rate, dkim_pass_rate, total_messages, policy, org_name, ai_conclusion)
    VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)
  `).run(domain, passRate, spfPassRate ?? 0, dkimPassRate ?? 0, totalMessages, policy, orgName, aiConclusion);
  res.json({ ok: true });
});

function calcStreak(rows) {
  // rows er sortert nyeste først
  // Finn den siste sammenhengende rekken der alle tre er 100%
  let streakStart = null;
  for (const row of rows) {
    if (row.pass_rate === 100 && row.spf_pass_rate === 100 && row.dkim_pass_rate === 100) {
      streakStart = row.checked_at; // fortsett bakover
    } else {
      break; // brutt streak
    }
  }
  return streakStart; // null = ingen aktiv streak
}

app.get('/api/log', (req, res) => {
  const domains = db.prepare(`
    SELECT domain FROM checks GROUP BY domain ORDER BY MAX(checked_at) DESC
  `).all().map(({ domain }) => domain);

  const now = new Date();
  const result = domains.map(domain => {
    const rows = db.prepare(`
      SELECT * FROM checks WHERE domain = ? ORDER BY checked_at DESC
    `).all(domain);

    const latest = rows[0];
    const firstCheck = new Date(rows[rows.length - 1].checked_at);
    const lastCheck = new Date(latest.checked_at);
    const daysSinceLast = Math.floor((now - lastCheck) / 864e5);

    const streakStart = calcStreak(rows);
    const streakDays = streakStart
      ? Math.floor((now - new Date(streakStart)) / 864e5)
      : 0;

    const currentlyAllPass = latest.pass_rate === 100 && latest.spf_pass_rate === 100 && latest.dkim_pass_rate === 100;
    const canDisable = rows.length >= 2 && currentlyAllPass && streakDays >= 28;

    // Status melding
    let statusMsg = '';
    if (!canDisable) {
      if (!currentlyAllPass) {
        if (latest.pass_rate < 100) statusMsg = 'DMARC har feil';
        else if (latest.spf_pass_rate < 100) statusMsg = 'SPF har feil';
        else statusMsg = 'DKIM har feil';
      } else if (streakDays < 28) {
        statusMsg = `${28 - streakDays} dager igjen`;
      } else {
        statusMsg = 'Trenger flere sjekker';
      }
    }

    return {
      domain,
      check_count: rows.length,
      first_check: rows[rows.length - 1].checked_at,
      last_check: latest.checked_at,
      latest_pass_rate: latest.pass_rate,
      latest_spf_pass_rate: latest.spf_pass_rate,
      latest_dkim_pass_rate: latest.dkim_pass_rate,
      latest_policy: latest.policy,
      latest_conclusion: latest.ai_conclusion,
      streakDays,
      streakStart,
      daysSinceLast,
      currentlyAllPass,
      canDisable,
      statusMsg,
    };
  });

  res.json(result);
});

app.get('/api/log/:domain', (req, res) => {
  const rows = db.prepare('SELECT * FROM checks WHERE domain = ? ORDER BY checked_at DESC').all(req.params.domain);
  res.json(rows);
});

app.get('/api/rdns', async (req, res) => {
  const ip = req.query.ip;
  if (!ip) return res.status(400).json({ error: 'ip påkrevd' });

  const cached = db.prepare('SELECT ptr, updated_at FROM rdns WHERE ip = ?').get(ip);
  const now = new Date();
  if (cached) {
    try {
      const ageMinutes = (now - new Date(cached.updated_at)) / 60000;
      if (ageMinutes < 5) return res.json({ ip, ptr: cached.ptr });
    } catch(e) { /* fallthrough til oppslag */ }
  }

  try {
    const names = await dnsPromises.reverse(ip);
    const ptr = Array.isArray(names) && names.length ? names[0] : '';
    db.prepare('INSERT OR REPLACE INTO rdns (ip, ptr, updated_at) VALUES (?, ?, ?)').run(ip, ptr, now.toISOString());
    return res.json({ ip, ptr });
  } catch (e) {
    db.prepare('INSERT OR REPLACE INTO rdns (ip, ptr, updated_at) VALUES (?, ?, ?)').run(ip, '', now.toISOString());
    return res.json({ ip, ptr: '' });
  }
});

app.delete('/api/log/:domain', (req, res) => {
  db.prepare('DELETE FROM checks WHERE domain = ?').run(req.params.domain);
  res.json({ ok: true });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DMARC Analyzer kjører på port ${PORT}`));
