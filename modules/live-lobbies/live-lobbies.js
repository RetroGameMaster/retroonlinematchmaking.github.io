// modules/live-lobbies/live-lobbies.js

export default function initModule(rom) {
  console.log('🌍 Live Lobbies module initialized (Coming Soon)');
  
  const appContent = document.getElementById('app-content');
  if (!appContent) return;

  // Render the Coming Soon UI
  appContent.innerHTML = `
    <div class="max-w-4xl mx-auto p-8 animate-fade-in">
      <div class="text-center py-20 bg-gray-800 rounded-xl border border-cyan-500/30 shadow-lg relative overflow-hidden">
        
        <!-- Background Decor -->
        <div class="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div class="absolute top-10 left-10 text-9xl">🚧</div>
          <div class="absolute bottom-10 right-10 text-9xl">📡</div>
        </div>

        <!-- Icon -->
        <div class="relative z-10 mb-6">
          <div class="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-900 border-2 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
            <span class="text-5xl">🚀</span>
          </div>
        </div>

        <!-- Title -->
        <h1 class="relative z-10 text-4xl md:text-5xl font-bold text-cyan-400 mb-4 glow">
          Coming Soon
        </h1>

        <!-- Subtitle -->
        <p class="relative z-10 text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          We are building something amazing. The Global Live Lobby Feed will be available shortly.
        </p>

        <!-- Status Badge -->
        <div class="relative z-10 inline-block px-4 py-2 bg-gray-900 rounded-full border border-gray-700">
          <span class="flex items-center gap-2 text-sm font-bold text-yellow-400">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
            </span>
            In Development
          </span>
        </div>

        <!-- Back Button -->
        <div class="relative z-10 mt-12">
          <a href="#/home" class="inline-block bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-3 rounded-lg font-bold transition transform hover:scale-105 shadow-lg">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  `;
}
