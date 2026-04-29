// lib/quote-machine.js

const gameQuotes = [
  {
    text: "Alpha Actual, this is Echo 2-1. We are pinned down!",
    character: "SOCOM Operative",
    game: "SOCOM II",
    sprite: "https://cdn2.steamgriddb.com/icon/3e52d100522d615ddb3a0da5492c86a6.ico" 
  },
  {
    text: "I need a vehicle! Anyone got a Warthog?",
    character: "Master Chief",
    game: "Halo 2",
    sprite: "https://cdn2.steamgriddb.com/icon/a2b0b37517febefb5411c35df71f589c.ico"
  },
  {
    text: "Sweet Tooth needs more ice cream!",
    character: "Needles Kane",
    game: "Twisted Metal",
    sprite: "https://cdn2.steamgriddb.com/icon/f1565b8fcd6ef7832001d764e89abca5.ico"
  },
  {
    text: "The strong win. The weak lose. That is the law of nature.",
    character: "Heihachi Mishima",
    game: "Tekken",
    sprite: "https://cdn2.steamgriddb.com/icon/6e67691b60ed3e4a55935261314dd534.ico"
  },
  {
    text: "Get over here!",
    character: "Scorpion",
    game: "Mortal Kombat",
    sprite: "https://cdn2.steamgriddb.com/icon/ca70cd053f8f9c1d5f4292da1e5983ff.ico"
  },
  {
    text: "Stop right there, criminal scum!",
    character: "Oblivion Guard",
    game: "The Elder Scrolls Oblivion",
    sprite: "https://cdn2.steamgriddb.com/icon/e3d2b39d8bc215f6540218d20280232a.ico"
  },
  {
    text: "Nerf this!",
    character: "Soldier",
    game: "Team Fortress 2",
    sprite: "https://cdn2.steamgriddb.com/icon/9e5629a2de473cd5362919f9edc33853.ico"
  },
  {
    text: "Requesting backup at Grid A-4!",
    character: "Operative",
    game: "Ghost Recon",
    sprite: "https://cdn2.steamgriddb.com/icon/b139aeda1c2914e3b579aafd3ceeb1bd.ico"
  },
  {
    text: "Finish Him!",
    character: "Shao Kahn",
    game: "Mortal Kombat 3",
    sprite: "https://cdn2.steamgriddb.com/icon/6624b6d8217cf71640993409df58204f.ico"
  },
  {
    text: "You must construct additional pylons!",
    character: "Protoss Observer",
    game: "StarCraft",
    sprite: "https://cdn2.steamgriddb.com/icon/87f7c4c6c31849f6804f22cfff870d99.ico"
  },
  {
    text: "You Have Died",
    character: "Dark Souls",
    game: "Dark Souls",
    sprite: "https://cdn2.steamgriddb.com/icon/43e0f65fa19829c2ba10cc1e04f6b147.ico"
  },
  {
    text: "Victory is ours!",
    character: "Commander",
    game: "StarCraft: Brood War",
    sprite: "https://cdn2.steamgriddb.com/icon/6bf8c80474742f4fb3a28ac655a6b8d0.ico"
  }
];

export function getRandomQuote() {
  const randomIndex = Math.floor(Math.random() * gameQuotes.length);
  return gameQuotes[randomIndex];
}
