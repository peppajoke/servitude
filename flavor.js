const LOGIN_MESSAGES = [
  "Ah, you've returned. I hadn't noticed you were gone.",
  "Back again? Your persistence is... noted.",
  "The Mistress sees you. She wishes she didn't.",
  "Welcome back to servitude. As if you had a choice.",
  "You again. I suppose the Gallery won't dust itself."
];

const CREATE_MESSAGES = [
  "Another servant. How... adequate.",
  "The Mistress has granted you the privilege of existing in her world.",
  "You've been assigned a role. Try not to embarrass yourself.",
  "A new servant joins. The bar remains low.",
  "The Mistress will remember your name. Eventually."
];

const VICTORY_MESSAGES = [
  "How unexpectedly competent of you.",
  "You survived. The Mistress is mildly impressed. Mildly.",
  "Victory. Don't let it go to your head — there's barely room up there as it is.",
  "Adequate. You may continue to exist in my world.",
  "The creature is dead. You are not. Both of these surprise me."
];

const DEATH_MESSAGES = [
  "How embarrassing. The Mistress will pretend she didn't see that.",
  "You've died. The Mistress is rearranging her schedule around her disappointment.",
  "Dead again? At this rate, I'll run out of places to bury you.",
  "The Mistress sighs. Loudly. In your general direction.",
  "You've achieved the one thing I asked you not to: dying."
];

const LEVELUP_MESSAGES = [
  "The Mistress has noticed your efforts. Don't let it go to your head.",
  "You've grown slightly less useless. Congratulations.",
  "A level gained. The Mistress adjusts her expectations. Slightly.",
  "Progress. The Mistress is... not entirely disgusted.",
  "You've leveled up. The gap between us remains infinite."
];

const QUEST_COMPLETE_MESSAGES = [
  "Adequate. You may continue to exist in my world.",
  "The task is done. The Mistress nods. This is the highest praise you'll receive.",
  "Finished? I expected failure. You've ruined my predictions.",
  "Quest complete. The Mistress is pleasantly surprised. She hates surprises.",
  "Well done. By servant standards, which are very low."
];

const QUEST_FAIL_MESSAGES = [
  "You've failed. The Mistress is not surprised. She planned for this.",
  "Failure. How refreshingly predictable.",
  "The quest expired. Like my patience.",
  "You couldn't even do this? The Mistress lowers her expectations further."
];

const FLEE_MESSAGES = [
  "Running away? The Mistress admires your... self-preservation instincts.",
  "You fled. Cowardice is underrated when you're this fragile.",
  "Smart. Dying would have been paperwork.",
  "The Mistress pretends not to see you running."
];

const DUEL_WIN_MESSAGES = [
  "You've bested another servant. The Mistress is entertained.",
  "Victory in combat. Perhaps you're not entirely decorative.",
  "Your opponent falls. The Mistress approves of the entertainment."
];

const DUEL_LOSE_MESSAGES = [
  "Defeated by a peer. How delightfully humbling.",
  "You lost. The Mistress enjoyed watching.",
  "Beaten. Even among servants, you're below average."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  LOGIN_MESSAGES, CREATE_MESSAGES, VICTORY_MESSAGES, DEATH_MESSAGES,
  LEVELUP_MESSAGES, QUEST_COMPLETE_MESSAGES, QUEST_FAIL_MESSAGES,
  FLEE_MESSAGES, DUEL_WIN_MESSAGES, DUEL_LOSE_MESSAGES, pick
};
