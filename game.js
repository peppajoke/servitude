const { pool } = require('./db');
const { CLASSES, ZONES, xpForLevel, favorRank } = require('./data');
const flavor = require('./flavor');

// ─── CHARACTER ───

async function createCharacter(name, className) {
  const cls = CLASSES[className];
  if (!cls) throw new Error('Invalid class');
  const existing = await pool.query('SELECT id FROM players WHERE name = $1', [name]);
  if (existing.rows.length) throw new Error('Name taken');

  const res = await pool.query(
    `INSERT INTO players (name, class, str, wit, dev, luck, hp, max_hp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *`,
    [name, className, cls.str, cls.wit, cls.dev, cls.luck, cls.hp]
  );
  return res.rows[0];
}

async function getPlayer(name) {
  const res = await pool.query('SELECT * FROM players WHERE name = $1', [name]);
  return res.rows[0] || null;
}

async function getPlayerById(id) {
  const res = await pool.query('SELECT * FROM players WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function updateLastSeen(name) {
  await pool.query('UPDATE players SET last_seen = NOW() WHERE name = $1', [name]);
}

// ─── COMBAT ───

function rollDamage(str, luck) {
  const base = Math.floor(Math.random() * str) + Math.ceil(str / 2);
  const crit = Math.random() * 100 < luck * 2;
  return crit ? base * 2 : base;
}

async function explore(player) {
  const zone = ZONES[player.zone];
  if (!zone) return { event: 'nothing', message: 'This zone is empty. Like your future.' };

  if (Math.random() < 0.7) {
    const template = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
    const monster = { ...template, currentHp: template.hp };
    return { event: 'encounter', monster };
  }
  return { event: 'nothing', message: 'You wander. Nothing happens. The Mistress is equally uneventful.' };
}

async function combat(player, monster) {
  const playerDmg = rollDamage(player.str, player.luck);
  const monsterDmg = rollDamage(monster.str, 3);
  const monsterHpAfter = monster.currentHp - playerDmg;
  const playerHpAfter = player.hp - monsterDmg;

  const log = {
    playerDamage: playerDmg,
    monsterDamage: monsterDmg,
    monsterHpAfter: Math.max(0, monsterHpAfter),
    playerHpAfter: Math.max(0, playerHpAfter)
  };

  if (monsterHpAfter <= 0) {
    // Monster dies
    const lootItem = monster.loot[Math.floor(Math.random() * monster.loot.length)];
    const leveledUp = await grantXp(player.id, monster.xp);

    await pool.query('UPDATE players SET hp = $1, favor = favor + $2 WHERE id = $3',
      [Math.max(1, playerHpAfter), monster.favor, player.id]);

    // Add loot
    const existing = await pool.query('SELECT id, quantity FROM inventory WHERE player_id = $1 AND item = $2', [player.id, lootItem]);
    if (existing.rows.length) {
      await pool.query('UPDATE inventory SET quantity = quantity + 1 WHERE id = $1', [existing.rows[0].id]);
    } else {
      await pool.query('INSERT INTO inventory (player_id, item) VALUES ($1, $2)', [player.id, lootItem]);
    }

    // Track quest progress
    await pool.query(
      `UPDATE quests SET progress = progress + 1
       WHERE player_id = $1 AND status = 'active' AND type = 'kill' AND target = $2`,
      [player.id, monster.name]
    );
    await pool.query(
      `UPDATE quests SET progress = progress + 1
       WHERE player_id = $1 AND status = 'active' AND type = 'collect' AND target = $2`,
      [player.id, lootItem]
    );

    await pool.query(
      `INSERT INTO combat_log (player_id, monster, result, damage_dealt, damage_taken, loot, xp_gained, favor_change)
       VALUES ($1, $2, 'victory', $3, $4, $5, $6, $7)`,
      [player.id, monster.name, playerDmg, monsterDmg, lootItem, monster.xp, monster.favor]
    );

    return { ...log, result: 'victory', loot: lootItem, xp: monster.xp, favor: monster.favor, leveledUp, message: flavor.pick(flavor.VICTORY_MESSAGES) };
  }

  if (playerHpAfter <= 0) {
    // Player dies
    const favorLoss = Math.min(player.favor, 5);
    await pool.query('UPDATE players SET hp = max_hp, favor = GREATEST(0, favor - $1) WHERE id = $2', [favorLoss, player.id]);

    await pool.query(
      `INSERT INTO combat_log (player_id, monster, result, damage_dealt, damage_taken, favor_change)
       VALUES ($1, $2, 'death', $3, $4, $5)`,
      [player.id, monster.name, playerDmg, monsterDmg, -favorLoss]
    );

    return { ...log, result: 'death', favorLost: favorLoss, message: flavor.pick(flavor.DEATH_MESSAGES) };
  }

  // Fight continues
  await pool.query('UPDATE players SET hp = $1 WHERE id = $2', [playerHpAfter, player.id]);
  return { ...log, result: 'continue', monster: { ...monster, currentHp: monsterHpAfter } };
}

async function flee(player) {
  const success = Math.random() < 0.6 + (player.luck * 0.02);
  if (success) {
    return { fled: true, message: flavor.pick(flavor.FLEE_MESSAGES) };
  }
  const dmg = Math.floor(Math.random() * 10) + 5;
  const newHp = Math.max(1, player.hp - dmg);
  await pool.query('UPDATE players SET hp = $1 WHERE id = $2', [newHp, player.id]);
  return { fled: false, damage: dmg, message: "You tried to run. It didn't go well." };
}

// ─── LEVELING ───

async function grantXp(playerId, amount) {
  const player = await getPlayerById(playerId);
  const newXp = player.xp + amount;
  const needed = xpForLevel(player.level);

  if (newXp >= needed) {
    const newLevel = player.level + 1;
    const hpGain = 10 + Math.floor(Math.random() * 10);
    await pool.query(
      `UPDATE players SET level = $1, xp = $2, max_hp = max_hp + $3, hp = LEAST(hp + $3, max_hp + $3),
       str = str + 1, wit = wit + 1, dev = dev + 1
       WHERE id = $4`,
      [newLevel, newXp - needed, hpGain, playerId]
    );
    return { leveled: true, newLevel, message: flavor.pick(flavor.LEVELUP_MESSAGES) };
  }

  await pool.query('UPDATE players SET xp = $1 WHERE id = $2', [newXp, playerId]);
  return null;
}

// ─── QUESTS ───

async function getAvailableQuests(player) {
  const zone = ZONES[player.zone];
  if (!zone) return [];
  return zone.quests;
}

async function acceptQuest(player, questIndex) {
  const zone = ZONES[player.zone];
  if (!zone || !zone.quests[questIndex]) throw new Error('Invalid quest');

  const active = await pool.query("SELECT id FROM quests WHERE player_id = $1 AND status = 'active'", [player.id]);
  if (active.rows.length >= 3) throw new Error('Too many active quests (max 3)');

  const q = zone.quests[questIndex];
  const res = await pool.query(
    `INSERT INTO quests (player_id, title, description, zone, type, target, target_count, favor_reward, xp_reward)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [player.id, q.title, q.desc, player.zone, q.type, q.target, q.count, q.favor, q.xp]
  );
  return res.rows[0];
}

async function getActiveQuests(playerId) {
  const res = await pool.query("SELECT * FROM quests WHERE player_id = $1 AND status = 'active' ORDER BY created_at", [playerId]);
  return res.rows;
}

async function turnInQuest(playerId, questId) {
  const res = await pool.query("SELECT * FROM quests WHERE id = $1 AND player_id = $2 AND status = 'active'", [questId, playerId]);
  if (!res.rows.length) throw new Error('Quest not found');
  const quest = res.rows[0];

  if (quest.progress < quest.target_count) {
    throw new Error(`Not complete: ${quest.progress}/${quest.target_count}`);
  }

  await pool.query("UPDATE quests SET status = 'completed' WHERE id = $1", [questId]);
  await pool.query('UPDATE players SET favor = favor + $1 WHERE id = $2', [quest.favor_reward, playerId]);
  await grantXp(playerId, quest.xp_reward);

  return { quest, message: flavor.pick(flavor.QUEST_COMPLETE_MESSAGES) };
}

// ─── ZONES ───

async function travel(player, zoneName) {
  const zone = ZONES[zoneName];
  if (!zone) throw new Error('Unknown zone');

  const zoneData = await pool.query('SELECT * FROM zones WHERE name = $1', [zoneName]);
  if (!zoneData.rows.length) throw new Error('Unknown zone');

  if (player.level < zoneData.rows[0].min_level) {
    throw new Error(`Requires level ${zoneData.rows[0].min_level}. You are level ${player.level}.`);
  }

  await pool.query('UPDATE players SET zone = $1 WHERE id = $2', [zoneName, player.id]);
  return zoneData.rows[0];
}

// ─── DUELS ───

async function duel(challenger, defenderName) {
  const defender = await getPlayer(defenderName);
  if (!defender) throw new Error('Player not found');
  if (defender.id === challenger.id) throw new Error("You can't duel yourself. The Mistress finds self-harm tedious.");

  const stake = 5;
  let cHp = challenger.hp, dHp = defender.hp;
  let rounds = 0;

  while (cHp > 0 && dHp > 0 && rounds < 20) {
    rounds++;
    dHp -= rollDamage(challenger.str, challenger.luck);
    if (dHp <= 0) break;
    cHp -= rollDamage(defender.str, defender.luck);
  }

  const winner = dHp <= 0 ? challenger : defender;
  const loser = winner.id === challenger.id ? defender : challenger;

  await pool.query('UPDATE players SET favor = favor + $1 WHERE id = $2', [stake, winner.id]);
  await pool.query('UPDATE players SET favor = GREATEST(0, favor - $1) WHERE id = $2', [stake, loser.id]);
  await pool.query(
    'INSERT INTO duels (challenger_id, defender_id, winner_id, rounds, favor_stake) VALUES ($1, $2, $3, $4, $5)',
    [challenger.id, defender.id, winner.id, rounds, stake]
  );

  const isWin = winner.id === challenger.id;
  return {
    winner: winner.name,
    loser: loser.name,
    rounds,
    stake,
    message: isWin ? flavor.pick(flavor.DUEL_WIN_MESSAGES) : flavor.pick(flavor.DUEL_LOSE_MESSAGES)
  };
}

// ─── INVENTORY ───

async function getInventory(playerId) {
  const res = await pool.query('SELECT item, quantity FROM inventory WHERE player_id = $1 ORDER BY item', [playerId]);
  return res.rows;
}

// ─── LEADERBOARD ───

async function getLeaderboard() {
  const res = await pool.query('SELECT name, class, level, favor FROM players ORDER BY favor DESC, level DESC LIMIT 20');
  return res.rows;
}

// ─── COMBAT LOG ───

async function getCombatLog(playerId, limit = 10) {
  const res = await pool.query(
    'SELECT * FROM combat_log WHERE player_id = $1 ORDER BY created_at DESC LIMIT $2',
    [playerId, limit]
  );
  return res.rows;
}

// ─── REST ───

async function healPlayer(playerId, amount) {
  await pool.query('UPDATE players SET hp = LEAST(hp + $1, max_hp) WHERE id = $2', [amount, playerId]);
}

module.exports = {
  createCharacter, getPlayer, getPlayerById, updateLastSeen,
  explore, combat, flee, grantXp,
  getAvailableQuests, acceptQuest, getActiveQuests, turnInQuest,
  travel, duel, getInventory, getLeaderboard, getCombatLog, healPlayer,
  favorRank
};
