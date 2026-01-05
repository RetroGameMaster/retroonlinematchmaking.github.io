// home.js - Home module JavaScript
export default function(rom) {
    // Update live stats
    setInterval(() => {
        document.getElementById('active-players').textContent = 
            Math.floor(100 + Math.random() * 50);
        document.getElementById('active-games').textContent = 
            Math.floor(20 + Math.random() * 10);
        document.getElementById('chat-messages').textContent = 
            Math.floor(300 + Math.random() * 100);
        document.getElementById('active-lobbies').textContent = 
            Math.floor(10 + Math.random() * 8);
    }, 3000);
}
