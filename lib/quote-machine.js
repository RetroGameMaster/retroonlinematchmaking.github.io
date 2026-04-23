// lib/quote-machine.js

export const retroQuotes = [
  {
    quote: "It's dangerous to go alone! Take this.",
    character: "Old Man",
    game: "The Legend of Zelda",
    // You can use an Image URL OR an Emoji
    sprite: "https://www.zelda.com/universe/gallery/images/character_01.jpg", 
    // sprite: "👴", // Example if you wanted an emoji instead
    color: "#4ade80" // Green text for Zelda
  },
  {
    quote: "I used to be an adventurer like you, then I took an arrow in the knee.",
    character: "Guard",
    game: "Skyrim",
    sprite: "https://static.wikia.nocookie.net/elderscrolls/images/6/6f/Skyrim_guard.png",
    color: "#9ca3af" // Gray text
  },
  {
    quote: "War... War never changes.",
    character: "Narrator",
    game: "Fallout",
    sprite: "https://static.wikia.nocookie.net/fallout/images/4/4e/Fallout_Narrator.png",
    color: "#fbbf24" // Amber text
  },
  {
    quote: "All your base are belong to us.",
    character: "CATS Operator",
    game: "Zero Wing",
    sprite: "😼", // Using an emoji here as an example
    color: "#ef4444" // Red text
  },
  {
    quote: "Would you kindly...",
    character: "Atlas",
    game: "BioShock",
    sprite: "https://static.wikia.nocookie.net/bioshock/images/9/9a/Atlas_BioShock.png",
    color: "#a855f7" // Purple text
  },
];

export function getRandomQuote() {
  const randomIndex = Math.floor(Math.random() * retroQuotes.length);
  return retroQuotes[randomIndex];
}
