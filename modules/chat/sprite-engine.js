// modules/chat/sprite-engine.js
import { supabase } from '../../lib/supabase.js';

export default class SpriteEngine {
  constructor(containerId, userId) {
    this.container = document.getElementById(containerId);
    this.userId = userId;
    this.canvas = null;
    this.ctx = null;
    this.sprites = {}; // Loaded image objects
    this.users = {};   // Active users in chat: { userId: { x, y, spriteId, state, frame, direction, message, messageTimer } }
    this.animationFrameId = null;
    this.spriteDefinitions = {}; // Meta data from DB
    this.isPlaying = false;
    
    // Constants
    this.GROUND_Y = 0; // Will be calculated based on container height
    this.SPEED = 1.5;
    this.SCALE = 2; // Scale up 64px sprites to 128px
  }

  async init() {
    if (!this.container) return console.error('Sprite Container not found');

    // 1. Setup Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'sprite-chat-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.bottom = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '150px'; // Height of the play area
    this.canvas.style.pointerEvents = 'none'; // Let clicks pass through to chat
    this.canvas.style.zIndex = '10';
    this.container.style.position = 'relative'; // Ensure container is relative for absolute canvas
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // 2. Load Sprite Definitions & User Data
    await this.loadData();

    // 3. Add "Local User" to the world
    if (this.userId && this.spriteDefinitions[this.users[this.userId]?.spriteId]) {
      const userSprite = this.users[this.userId];
      userSprite.x = this.canvas.width / 2;
      userSprite.y = this.canvas.height - (this.spriteDefinitions[userSprite.spriteId].frame_height * this.SCALE);
      userSprite.direction = 1; // 1 = right, -1 = left
      userSprite.state = 'idle';
      userSprite.frame = 0;
      userSprite.frameTimer = 0;
    }

    // 4. Start Game Loop
    this.isPlaying = true;
    this.loop();
    
    console.log('✅ Sprite Engine Initialized');
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = this.container.offsetWidth;
    this.canvas.height = 150;
    this.GROUND_Y = this.canvas.height - 10;
    
    // Re-position users on resize
    Object.values(this.users).forEach(u => {
      if (u.y > this.GROUND_Y) {
         const h = this.spriteDefinitions[u.spriteId]?.frame_height * this.SCALE || 64;
         u.y = this.GROUND_Y - h;
      }
    });
  }

  async loadData() {
    // 1. Fetch All Sprite Definitions
    const { data: sprites } = await supabase.from('sprites').select('*');
    if (sprites) {
      sprites.forEach(s => {
        this.spriteDefinitions[s.id] = s;
        // Preload Image
        const img = new Image();
        img.src = s.image_url;
        img.crossOrigin = "anonymous"; // Crucial for external URLs like Spriters Resource
        this.sprites[s.id] = img;
      });
    }

    // 2. Fetch Current User's Sprite Assignment
    if (this.userId) {
      const { data: userSpriteData } = await supabase
        .from('user_sprites')
        .select('sprite_id')
        .eq('user_id', this.userId)
        .single();

      if (userSpriteData) {
        this.users[this.userId] = {
          spriteId: userSpriteData.sprite_id,
          x: 100, y: 0, direction: 1, state: 'idle', frame: 0, frameTimer: 0,
          message: null, messageTimer: 0
        };
      } else {
        // Assign random if missing
        await supabase.rpc('assign_random_sprite');
        // Reload quickly
        setTimeout(() => this.loadData(), 500);
      }
    }
  }

  // Called by Chat Module when a message is sent
  speak(userId, text) {
    if (!this.users[userId]) return;
    this.users[userId].message = text;
    this.users[userId].messageTimer = 180; // Show for 3 seconds (60fps * 3)
    // Briefly switch to talk state if available, else idle
    if (this.spriteDefinitions[this.users[userId].spriteId].animation_map['attack_light']) {
       // Optional: Play a quick gesture
    }
  }

  // Called by Chat Module when a user joins/leaves (Future expansion)
  addUser(userId, spriteId) {
    if (!this.spriteDefinitions[spriteId]) return;
    this.users[userId] = {
      spriteId, x: Math.random() * this.canvas.width, y: 0, 
      direction: Math.random() > 0.5 ? 1 : -1, state: 'idle', frame: 0, frameTimer: 0,
      message: null, messageTimer: 0
    };
  }

  update() {
    Object.keys(this.users).forEach(uid => {
      const u = this.users[uid];
      const def = this.spriteDefinitions[u.spriteId];
      if (!def) return;

      // 1. Message Timer
      if (u.messageTimer > 0) u.messageTimer--;
      else u.message = null;

      // 2. Movement Logic (Simple Patrol)
      if (u.state === 'idle' || u.state === 'walk') {
        u.x += this.SPEED * u.direction;
        
        // Turn around at edges
        const spriteW = def.frame_width * this.SCALE;
        if (u.x > this.canvas.width - spriteW) { u.direction = -1; u.state = 'walk'; }
        else if (u.x < 0) { u.direction = 1; u.state = 'walk'; }
        
        // Randomly stop or start walking
        if (Math.random() < 0.01) u.state = u.state === 'walk' ? 'idle' : 'walk';
      }

      // 3. Animation Frame Logic
      u.frameTimer++;
      if (u.frameTimer > 8) { // Change frame every 8 ticks
        u.frameTimer = 0;
        const animMap = def.animation_map;
        const frames = animMap[u.state] || animMap['idle'] || [0];
        
        u.frame = (u.frame + 1) % frames.length;
      }
    });
  }

  draw() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    Object.keys(this.users).forEach(uid => {
      const u = this.users[uid];
      const def = this.spriteDefinitions[u.spriteId];
      const img = this.sprites[u.spriteId];

      if (!img || !img.complete || !def) return;

      const frameW = def.frame_width;
      const frameH = def.frame_height;
      const drawW = frameW * this.SCALE;
      const drawH = frameH * this.SCALE;

      // Get current frame index
      const animMap = def.animation_map;
      const frames = animMap[u.state] || animMap['idle'] || [0];
      const frameIndex = frames[u.frame] || 0;

      // Calculate Source Rect (from sprite sheet)
      // Assuming horizontal strip:
      const sx = frameIndex * frameW;
      const sy = 0; 

      // Draw Sprite (Flip if moving left)
      this.ctx.save();
      if (u.direction === -1) {
        this.ctx.translate(u.x + drawW, u.y);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(img, sx, sy, frameW, frameH, 0, 0, drawW, drawH);
      } else {
        this.ctx.drawImage(img, sx, sy, frameW, frameH, u.x, u.y, drawW, drawH);
      }
      this.ctx.restore();

      // Draw Chat Bubble
      if (u.message) {
        this.drawBubble(u.x + drawW/2, u.y, u.message);
      }
    });
  }

  drawBubble(x, y, text) {
    const ctx = this.ctx;
    const padding = 10;
    const lineHeight = 20;
    const maxWidth = 200;
    
    ctx.font = '14px Arial';
    const words = text.split(' ');
    let line = '';
    const lines = [];

    // Simple word wrap
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const bubbleW = Math.max(...lines.map(l => ctx.measureText(l).width)) + (padding * 2);
    const bubbleH = (lines.length * lineHeight) + (padding * 2);
    const bubbleX = x - bubbleW / 2;
    const bubbleY = y - bubbleH - 15;

    // Draw Bubble
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 10);
    ctx.fill();
    ctx.stroke();

    // Draw Text
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => {
      ctx.fillText(l.trim(), bubbleX + padding, bubbleY + padding + (i * lineHeight));
    });
  }

  loop() {
    if (!this.isPlaying) return;
    this.update();
    this.draw();
    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }

  destroy() {
    this.isPlaying = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.canvas) this.canvas.remove();
  }
}
