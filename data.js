const CLASSES = {
  Courier: { str: 4, wit: 6, dev: 4, luck: 6, hp: 90, desc: 'Swift and expendable. Perfect for errands.' },
  Gatherer: { str: 5, wit: 5, dev: 6, luck: 4, hp: 95, desc: 'Collects things. Like a magpie, but less charming.' },
  Guard: { str: 7, wit: 3, dev: 5, luck: 5, hp: 120, desc: 'Large. Useful for standing in front of things.' },
  Muse: { str: 3, wit: 8, dev: 5, luck: 4, hp: 80, desc: 'Inspires the Mistress. Occasionally on purpose.' }
};

const ZONES = {
  'The Gallery': {
    monsters: [
      { name: 'Smudge Imp', hp: 30, str: 4, xp: 10, favor: 2, loot: ['Smudged Pigment', 'Imp Dust'] },
      { name: 'Rogue Brushstroke', hp: 40, str: 5, xp: 15, favor: 3, loot: ['Bristle Fragment', 'Dried Paint'] },
      { name: 'Leaky Frame', hp: 50, str: 3, xp: 12, favor: 2, loot: ['Gilded Splinter', 'Frame Nail'] }
    ],
    quests: [
      { title: 'Dust the Portraits', desc: 'The portraits are filthy. You are also filthy, so you should feel kinship.', type: 'kill', target: 'Smudge Imp', count: 3, favor: 8, xp: 40 },
      { title: 'Collect Bristle Fragments', desc: 'I need bristles for a new brush. Try not to get paint on yourself.', type: 'collect', target: 'Bristle Fragment', count: 3, favor: 10, xp: 50 },
      { title: 'Frame Patrol', desc: 'Walk the gallery. If anything moves, hit it. If it doesn\'t move, dust it.', type: 'kill', target: 'Leaky Frame', count: 2, favor: 7, xp: 35 }
    ]
  },
  'The Studio': {
    monsters: [
      { name: 'Bleeding Easel', hp: 70, str: 8, xp: 25, favor: 5, loot: ['Crimson Pigment', 'Easel Splinter'] },
      { name: 'Palette Golem', hp: 90, str: 10, xp: 30, favor: 6, loot: ['Living Paint', 'Stone Palette'] },
      { name: 'Canvas Mimic', hp: 60, str: 12, xp: 28, favor: 5, loot: ['Mimic Thread', 'Blank Canvas'] }
    ],
    quests: [
      { title: 'Fetch Crimson Pigment', desc: 'Fetch me Crimson Pigment from the Bleeding Easels. Try not to die, I just mopped.', type: 'collect', target: 'Crimson Pigment', count: 3, favor: 15, xp: 80 },
      { title: 'Golem Disposal', desc: 'The Palette Golems are ruining my color theory. Remove them. Violently.', type: 'kill', target: 'Palette Golem', count: 3, favor: 18, xp: 90 },
      { title: 'Canvas Inspection', desc: 'Check the canvases for mimics. If they bite, they\'re mimics.', type: 'kill', target: 'Canvas Mimic', count: 4, favor: 16, xp: 85 }
    ]
  },
  'The Unfinished Canvas': {
    monsters: [
      { name: 'Faded Sketch', hp: 25, str: 3, xp: 5, favor: 1, loot: ['Faded Charcoal', 'Torn Paper'] },
      { name: 'Abandoned Outline', hp: 35, str: 4, xp: 8, favor: 1, loot: ['Eraser Dust', 'Pencil Stub'] },
      { name: 'Exile Shade', hp: 45, str: 6, xp: 10, favor: 2, loot: ['Shadow Fragment', 'Lost Intention'] }
    ],
    quests: [
      { title: 'Prove Your Worth', desc: 'You\'re in exile. Kill things until I feel something. Pity, probably.', type: 'kill', target: 'Exile Shade', count: 5, favor: 12, xp: 50 },
      { title: 'Scavenge Materials', desc: 'Gather scraps. Even garbage has more purpose than you right now.', type: 'collect', target: 'Faded Charcoal', count: 5, favor: 10, xp: 40 }
    ]
  },
  'The Vault': {
    monsters: [
      { name: 'Masterwork Guardian', hp: 150, str: 15, xp: 50, favor: 10, loot: ['Guardian Core', 'Gilded Fragment'] },
      { name: 'The Unfinished Masterpiece', hp: 200, str: 18, xp: 80, favor: 15, loot: ['Masterpiece Shard', 'Divine Pigment'] },
      { name: 'Living Sculpture', hp: 120, str: 13, xp: 45, favor: 8, loot: ['Marble Dust', 'Sculpted Eye'] }
    ],
    quests: [
      { title: 'Guard the Vermeer', desc: 'Guard the north gallery. If anything gets paint on my Vermeer, you\'re exiled.', type: 'kill', target: 'Living Sculpture', count: 3, favor: 25, xp: 150 },
      { title: 'The Masterpiece Hunt', desc: 'An Unfinished Masterpiece roams. End it. Art should know when it\'s done.', type: 'kill', target: 'The Unfinished Masterpiece', count: 1, favor: 30, xp: 200 },
      { title: 'Vault Inventory', desc: 'Count the Guardian Cores. If the number is wrong, I\'ll know who to blame.', type: 'collect', target: 'Guardian Core', count: 3, favor: 22, xp: 130 }
    ]
  }
};

const XP_PER_LEVEL = 100;

function xpForLevel(level) {
  return level * XP_PER_LEVEL;
}

function favorRank(favor) {
  if (favor < 0) return 'Exiled';
  if (favor < 10) return 'Forgotten';
  if (favor < 30) return 'Tolerated';
  if (favor < 60) return 'Noticed';
  if (favor < 100) return 'Favored';
  return 'Inner Circle';
}

module.exports = { CLASSES, ZONES, XP_PER_LEVEL, xpForLevel, favorRank };
