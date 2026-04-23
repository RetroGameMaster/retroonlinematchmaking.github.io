// lib/quote-machine.js

const gameQuotes = [
  {
    text: "Alpha Actual, this is Echo 2-1. We are pinned down! Requesting immediate fire support!",
    character: "SOCOM Operative",
    game: "SOCOM II: U.S. Navy SEALs",
    sprite: "https://i.imgur.com/8ZzJvDl.png" 
  },
  {
    text: "I need a vehicle! Anyone got a Warthog?",
    character: "Master Chief",
    game: "Halo 2",
    sprite: "https://i.imgur.com/3QfVx9P.png"
  },
  {
    text: "Sweet Tooth needs more ice cream!",
    character: "Needles Kane",
    game: "Twisted Metal: Black",
    sprite: "https://i.imgur.com/5vRjK2L.png"
  },
  {
    text: "Bogeys at 6 o'clock! Shake them!",
    character: "Warhawk Pilot",
    game: "Warhawk",
    sprite: "https://i.imgur.com/mXkGqWb.png"
  },
  {
    text: "The bomb has been planted.",
    character: "Counter-Terrorist",
    game: "Counter-Strike 1.6",
    sprite: "https://i.imgur.com/9dF3hTz.png"
  },
  {
    text: "Get over here!",
    character: "Scorpion",
    game: "Mortal Kombat",
    sprite: "https://i.imgur.com/LpYxS1w.png"
  },
  {
    text: "Team Fortress 2? I thought this was Team Fortress Classic!",
    character: "Scout",
    game: "Team Fortress 2",
    sprite: "https://i.imgur.com/rN3jOqP.png"
  },
  {
    text: "Nerf this!",
    character: "Soldier",
    game: "Team Fortress 2",
    sprite: "https://i.imgur.com/8ZzJvDl.png" // Reusing a generic soldier silhouette if specific fails, or swap URL
  },
  {
    text: "Requesting backup at Grid A-4!",
    character: "Ghost Recon Operative",
    game: "Ghost Recon Advanced Warfighter",
    sprite: "https://i.imgur.com/kL9mN2p.png"
  },
  {
    text: "Victory is ours!",
    character: "Commander",
    game: "StarCraft: Brood War",
    sprite: "https://i.imgur.com/vT7wQ3x.png"
  },
  {
    text: "Let's rock and roll!",
    character: "Duke Nukem",
    game: "Duke Nukem 3D (Multiplayer)",
    sprite: "https://i.imgur.com/zR8yH4k.png"
  },
  {
    text: "Finish Him!",
    character: "Shao Kahn",
    game: "Mortal Kombat 3",
    sprite: "https://i.imgur.com/LpYxS1w.png"
  }
];

export function getRandomQuote() {
  const randomIndex = Math.floor(Math.random() * gameQuotes.length);
  return gameQuotes[randomIndex];
}
