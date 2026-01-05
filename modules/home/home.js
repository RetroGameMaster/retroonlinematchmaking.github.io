// home.js - Home module JavaScript
function initHomeModule(rom) {
    // Update live stats
    setInterval(() => {
        const activePlayers = document.getElementById('active-players');
        const activeGames = document.getElementById('active-games');
        const chatMessages = document.getElementById('chat-messages');
        const activeLobbies = document.getElementById('active-lobbies');
        
        if (activePlayers) activePlayers.textContent = Math.floor(100 + Math.random() * 50);
        if (activeGames) activeGames.textContent = Math.floor(20 + Math.random() * 10);
        if (chatMessages) chatMessages.textContent = Math.floor(300 + Math.random() * 100);
        if (activeLobbies) activeLobbies.textContent = Math.floor(10 + Math.random() * 8);
    }, 3000);
}

// Execute when loaded
if (typeof window.rom !== 'undefined') {
    initHomeModule(window.rom);
}
