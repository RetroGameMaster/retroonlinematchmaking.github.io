// Configuration for all Article Reactions
// Type 'unicode' = Standard Emoji
// Type 'image' = Custom URL (SVG/PNG from Supabase Storage)

export const REACTIONS = [
  { id: 'fire', label: 'Fire', type: 'unicode', value: '🔥' },
  { id: 'heart', label: 'Love', type: 'unicode', value: '❤️' },
  { id: 'laugh', label: 'Funny', type: 'unicode', value: '😂' },
  { id: 'wow', label: 'Wow', type: 'unicode', value: '😮' },
  { id: 'sad', label: 'Sad', type: 'unicode', value: '😢' },
  
  // --- CUSTOM ROM GUILD REACTIONS ---
  // You can upload these images to your 'article-uploads' bucket later
  { 
    id: 'rom_legend', 
    label: 'ROM Legend', 
    type: 'image', 
    value: 'https://ui-avatars.com/api/?name=ROM&background=06b6d4&color=fff' // Replace with custom logo URL later
  },
  { 
    id: 'retro_star', 
    label: 'Retro Star', 
    type: 'image', 
    value: 'https://ui-avatars.com/api/?name=Star&background=f59e0b&color=fff' // Replace with custom star icon
  }
];

// Helper: Get reaction config by ID
export function getReactionConfig(id) {
  return REACTIONS.find(r => r.id === id);
}

// Helper: Render a single reaction icon (returns HTML string or DOM element logic)
export function renderReactionIcon(id, size = '24px') {
  const config = getReactionConfig(id);
  if (!config) return '';

  if (config.type === 'image') {
    return `<img src="${config.value}" alt="${config.label}" style="width:${size}; height:${size}; object-fit:contain;" />`;
  } else {
    // Unicode emoji needs slightly different font handling sometimes
    return `<span style="font-size:${size}; line-height:1;">${config.value}</span>`;
  }
}

// Helper: Get all reaction IDs for the database
export function getReactionIds() {
  return REACTIONS.map(r => r.id);
}
