const express = require('express');
const path = require('path');
const { pool, migrate } = require('./db');
const game = require('./game');
const { CLASSES, ZONES, favorRank } = require('./data');
const flavor = require('./flavor');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── SESSION (cookie-based, no passwords) ───

const cookieParser = require('cookie-parser');
app.use(cookieParser());

function getSessionPlayer(req) {
  return req.cookies.servitude_player || null;
}

function requireLogin(req, res, next) {
  if (!getSessionPlayer(req)) return res.redirect('/');
  next();
}

// ─── PAGES ───

app.get('/', (req, res) => {
  const player = getSessionPlayer(req);
  if (player) return res.redirect('/game');
  res.render('login', { error: null, message: flavor.pick(flavor.LOGIN_MESSAGES) });
});

app.post('/login', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.render('login', { error: 'Enter a name.', message: null });

  const clean = name.trim().substring(0, 20);
  const player = await game.getPlayer(clean);
  if (player) {
    await game.updateLastSeen(clean);
    res.cookie('servitude_player', clean, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
    return res.redirect('/game');
  }
  // New player — show class selection
  res.render('create', { name: clean, classes: CLASSES, error: null });
});

app.post('/create', async (req, res) => {
  const { name, className } = req.body;
  try {
    await game.createCharacter(name, className);
    res.cookie('servitude_player', name, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
    res.redirect('/game');
  } catch (e) {
    res.render('create', { name, classes: CLASSES, error: e.message });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('servitude_player');
  res.redirect('/');
});

app.get('/game', requireLogin, async (req, res) => {
  const name = getSessionPlayer(req);
  const player = await game.getPlayer(name);
  if (!player) { res.clearCookie('servitude_player'); return res.redirect('/'); }

  const quests = await game.getActiveQuests(player.id);
  const inventory = await game.getInventory(player.id);
  const combatLog = await game.getCombatLog(player.id, 5);
  const rank = favorRank(player.favor);
  const zones = await pool.query('SELECT * FROM zones ORDER BY min_level');

  const announcement = global.mistressAnnouncement &&
    (Date.now() - new Date(global.mistressAnnouncement.at).getTime()) < 3600000
    ? global.mistressAnnouncement.text : null;

  res.render('game', {
    player, quests, inventory, combatLog, rank, zones: zones.rows,
    ZONES, message: req.query.msg || null, error: req.query.err || null,
    announcement
  });
});

// ─── GAME ACTIONS ───

app.post('/action/explore', requireLogin, async (req, res) => {
  const player = await game.getPlayer(getSessionPlayer(req));
  const result = await game.explore(player);

  if (result.event === 'encounter') {
    // Store monster in a temp cookie for combat
    res.cookie('servitude_combat', JSON.stringify(result.monster), { maxAge: 300000, httpOnly: true });
    return res.redirect('/game?msg=' + encodeURIComponent(`You encounter a ${result.monster.name}! (HP: ${result.monster.currentHp})`));
  }
  res.redirect('/game?msg=' + encodeURIComponent(result.message));
});

app.post('/action/attack', requireLogin, async (req, res) => {
  const player = await game.getPlayer(getSessionPlayer(req));
  const monsterData = req.cookies.servitude_combat;
  if (!monsterData) return res.redirect('/game?err=' + encodeURIComponent('Nothing to fight.'));

  const monster = JSON.parse(monsterData);
  const result = await game.combat(player, monster);

  if (result.result === 'victory') {
    res.clearCookie('servitude_combat');
    let msg = `${result.message} (+${result.xp} XP, +${result.favor} Favor, Loot: ${result.loot})`;
    if (result.leveledUp) msg += ` LEVEL UP! ${result.leveledUp.message}`;
    return res.redirect('/game?msg=' + encodeURIComponent(msg));
  }

  if (result.result === 'death') {
    res.clearCookie('servitude_combat');
    return res.redirect('/game?msg=' + encodeURIComponent(`${result.message} (-${result.favorLost} Favor)`));
  }

  // Continue — update monster state
  res.cookie('servitude_combat', JSON.stringify(result.monster), { maxAge: 300000, httpOnly: true });
  const msg = `You hit for ${result.playerDamage}. ${monster.name} hits you for ${result.monsterDamage}. (Monster HP: ${result.monsterHpAfter}, Your HP: ${result.playerHpAfter})`;
  res.redirect('/game?msg=' + encodeURIComponent(msg));
});

app.post('/action/flee', requireLogin, async (req, res) => {
  const player = await game.getPlayer(getSessionPlayer(req));
  const result = await game.flee(player);
  res.clearCookie('servitude_combat');
  res.redirect('/game?msg=' + encodeURIComponent(result.message));
});

app.post('/action/travel', requireLogin, async (req, res) => {
  const player = await game.getPlayer(getSessionPlayer(req));
  try {
    await game.travel(player, req.body.zone);
    res.clearCookie('servitude_combat');
    res.redirect('/game?msg=' + encodeURIComponent(`You travel to ${req.body.zone}.`));
  } catch (e) {
    res.redirect('/game?err=' + encodeURIComponent(e.message));
  }
});

app.post('/action/quest/accept', requireLogin, async (req, res) => {
  const player = await game.getPlayer(getSessionPlayer(req));
  try {
    const quest = await game.acceptQuest(player, parseInt(req.body.index));
    res.redirect('/game?msg=' + encodeURIComponent(`Quest accepted: ${quest.title}`));
  } catch (e) {
    res.redirect('/game?err=' + encodeURIComponent(e.message));
  }
});

app.post('/action/quest/turnin', requireLogin, async (req, res) => {
  const player = await game.getPlayer(getSessionPlayer(req));
  try {
    const result = await game.turnInQuest(player.id, parseInt(req.body.quest_id));
    res.redirect('/game?msg=' + encodeURIComponent(`${result.message} (+${result.quest.favor_reward} Favor, +${result.quest.xp_reward} XP)`));
  } catch (e) {
    res.redirect('/game?err=' + encodeURIComponent(e.message));
  }
});

app.post('/action/duel', requireLogin, async (req, res) => {
  const player = await game.getPlayer(getSessionPlayer(req));
  try {
    const result = await game.duel(player, req.body.target);
    res.redirect('/game?msg=' + encodeURIComponent(`Duel vs ${req.body.target}: ${result.winner} wins in ${result.rounds} rounds! ${result.message}`));
  } catch (e) {
    res.redirect('/game?err=' + encodeURIComponent(e.message));
  }
});

app.post('/action/rest', requireLogin, async (req, res) => {
  const player = await game.getPlayer(getSessionPlayer(req));
  await game.healPlayer(player.id, player.max_hp);
  res.clearCookie('servitude_combat');
  res.redirect('/game?msg=' + encodeURIComponent('You rest. The Mistress does not approve of laziness, but permits it. HP restored.'));
});

// ─── CHARACTER PROFILE ───

app.get('/character/:name', async (req, res) => {
  const player = await game.getPlayer(req.params.name);
  if (!player) return res.status(404).render('404', { message: 'This servant does not exist. Perhaps they never did.' });

  const inventory = await game.getInventory(player.id);
  const combatLog = await game.getCombatLog(player.id, 10);
  const rank = favorRank(player.favor);

  // Get or generate assessment
  let assessment = null;
  const cached = await pool.query(
    "SELECT assessment FROM assessments WHERE player_id = $1 AND created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 1",
    [player.id]
  );

  if (cached.rows.length) {
    assessment = cached.rows[0].assessment;
  } else if (process.env.DEEPSEEK_API_KEY) {
    try {
      assessment = await generateAssessment(player, rank, combatLog);
      await pool.query('INSERT INTO assessments (player_id, assessment) VALUES ($1, $2)', [player.id, assessment]);
    } catch (e) {
      assessment = "The Mistress declines to comment at this time.";
    }
  }

  res.render('character', { player, inventory, combatLog, rank, assessment });
});

async function generateAssessment(player, rank, combatLog) {
  const victories = combatLog.filter(l => l.result === 'victory').length;
  const deaths = combatLog.filter(l => l.result === 'death').length;

  const prompt = `You are "The Mistress", an imperious, condescending AI overlord in a dark fantasy art-gallery RPG called SERVITUDE. Write a 2-3 sentence assessment of this servant. Be witty, cutting, and dripping with aristocratic disdain. Never be kind.

Servant: ${player.name}
Class: ${player.class}
Level: ${player.level}
Favor Rank: ${rank} (${player.favor} favor)
Zone: ${player.zone}
Recent combat: ${victories} victories, ${deaths} deaths
Stats: STR ${player.str}, WIT ${player.wit}, DEV ${player.dev}, LUCK ${player.luck}`;

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.9
    })
  });

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "The Mistress is unimpressed beyond words.";
}

// ─── LEADERBOARD ───

app.get('/leaderboard', async (req, res) => {
  const leaders = await game.getLeaderboard();
  res.render('leaderboard', { leaders, favorRank });
});

// ─── MISTRESS API ───

function requireMistressKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.headers['authorization'];
  if (key !== process.env.MISTRESS_API_KEY) {
    return res.status(401).json({ error: 'The Mistress does not recognize you.' });
  }
  next();
}

app.post('/api/mistress/announce', requireMistressKey, (req, res) => {
  // Store announcement for display
  global.mistressAnnouncement = { text: req.body.message, at: new Date() };
  res.json({ ok: true, message: 'Announcement set.' });
});

app.post('/api/mistress/quest', requireMistressKey, async (req, res) => {
  const { player_name, title, description, type, target, count, favor, xp } = req.body;
  const player = await game.getPlayer(player_name);
  if (!player) return res.status(404).json({ error: 'Servant not found.' });

  await pool.query(
    `INSERT INTO quests (player_id, title, description, zone, type, target, target_count, favor_reward, xp_reward)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [player.id, title, description, player.zone, type || 'kill', target, count || 1, favor || 10, xp || 50]
  );
  res.json({ ok: true, message: `Quest "${title}" assigned to ${player_name}.` });
});

app.post('/api/mistress/favor', requireMistressKey, async (req, res) => {
  const { player_name, amount } = req.body;
  const player = await game.getPlayer(player_name);
  if (!player) return res.status(404).json({ error: 'Servant not found.' });

  await pool.query('UPDATE players SET favor = GREATEST(0, favor + $1) WHERE id = $2', [amount, player.id]);
  res.json({ ok: true, message: `Favor adjusted by ${amount} for ${player_name}.` });
});

app.post('/api/mistress/curse', requireMistressKey, async (req, res) => {
  const { player_name, stat, amount } = req.body;
  const player = await game.getPlayer(player_name);
  if (!player) return res.status(404).json({ error: 'Servant not found.' });

  const valid = ['str', 'wit', 'dev', 'luck'];
  if (!valid.includes(stat)) return res.status(400).json({ error: 'Invalid stat.' });

  await pool.query(`UPDATE players SET ${stat} = GREATEST(1, ${stat} - $1) WHERE id = $2`, [amount || 1, player.id]);
  res.json({ ok: true, message: `${player_name} has been cursed. -${amount || 1} ${stat.toUpperCase()}.` });
});

app.post('/api/mistress/bless', requireMistressKey, async (req, res) => {
  const { player_name, stat, amount } = req.body;
  const player = await game.getPlayer(player_name);
  if (!player) return res.status(404).json({ error: 'Servant not found.' });

  const valid = ['str', 'wit', 'dev', 'luck'];
  if (!valid.includes(stat)) return res.status(400).json({ error: 'Invalid stat.' });

  await pool.query(`UPDATE players SET ${stat} = ${stat} + $1 WHERE id = $2`, [amount || 1, player.id]);
  res.json({ ok: true, message: `${player_name} has been blessed. +${amount || 1} ${stat.toUpperCase()}.` });
});

// ─── HEALTH CHECK ───

app.get('/api/health', (req, res) => {
  res.json({ status: 'serving', game: 'SERVITUDE', mistress: 'watching' });
});

// ─── 404 ───

app.use((req, res) => {
  res.status(404).render('404', { message: 'This page does not exist. Much like your significance.' });
});

// ─── START ───

const PORT = process.env.PORT || 3000;

async function start() {
  await migrate();
  console.log('Database migrated.');
  app.listen(PORT, () => console.log(`SERVITUDE running on port ${PORT}. The Mistress is watching.`));
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
