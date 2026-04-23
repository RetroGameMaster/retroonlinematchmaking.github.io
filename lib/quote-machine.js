// lib/quote-machine.js

const gameQuotes = [
  {
    text: "Alpha Actual, this is Echo 2-1. We are pinned down!",
    character: "SOCOM Operative",
    game: "SOCOM II",
    sprite: "./assets/quotes/socom.png" 
  },
  {
    text: "I need a vehicle! Anyone got a Warthog?",
    character: "Master Chief",
    game: "Halo 2",
    sprite: "./assets/quotes/chief.png"
  },
  {
    text: "Sweet Tooth needs more ice cream!",
    character: "Needles Kane",
    game: "Twisted Metal",
    sprite: "./assets/quotes/sweettooth.png"
  },
  {
    text: "Eat lead, losers!",
    character: "Sweet Tooth",
    game: "Twisted Metal: Black",
    sprite: "./assets/quotes/twisted.png" 
  },
  {
    text: "The bomb has been planted.",
    character: "Counter-Terrorist",
    game: "Counter-Strike 1.6",
    sprite: "./assets/quotes/cs.png"
  },
  {
    text: "Get over here!",
    character: "Scorpion",
    game: "Mortal Kombat",
    sprite: "./assets/quotes/scorpion.png"
  },
  {
    text: "Nerf this!",
    character: "Soldier",
    game: "Team Fortress 2",
    sprite: "./assets/quotes/tf2.png"
  },
  {
    text: "You must construct additional pylons!",
    character: "Protoss Observer",
    game: "StarCraft",
    sprite: "./assets/quotes/starcraft.png"
  },
  {
    text: "Requesting backup at Grid A-4!",
    character: "Operative",
    game: "Ghost Recon",
    sprite: "./assets/quotes/ghost.png"
  },
  {
    text: "The strong win. The weak lose. That is the law of nature.",
    character: "Heihachi Mishima",
    game: "Tekken",
    sprite: "./assets/quotes/tekken.png"
  },
  {
    text: "Finish Him!",
    character: "Shao Kahn",
    game: "Mortal Kombat 3",
    sprite: "./assets/quotes/mk3.png"
  },
  {
    text: "Victory is ours!",
    character: "Commander",
    game: "StarCraft: Brood War",
    sprite: "./assets/quotes/starcraft2.png"
  }
];

export function getRandomQuote() {
  const randomIndex = Math.floor(Math.random() * gameQuotes.length);
  return gameQuotes[randomIndex];
}
