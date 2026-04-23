// modules/chat/realtime.js
import { supabase } from '../../lib/supabase.js';

let messageChannel = null;
let typingChannel = null;
let presenceChannel = null;

/**
 * Subscribe to messages for a specific room or DM
 */
export function subscribeToMessages(targetId, type = 'room', onMessageEvent) {
  // Unsubscribe from previous channel
  unsubscribeFromMessages();

  const channelName = type === 'room' ? `room:${targetId}` : `dm:${targetId}`;
  const tableName = type === 'room' ? 'chat_messages' : 'private_messages';
  
  // Filter logic differs slightly between tables
  const filter = type === 'room' 
    ? `room_id=eq.${targetId}` 
    : `or(sender_id.eq.${targetId},recipient_id.eq.${targetId})`;

  messageChannel = supabase.channel(channelName)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: tableName,
        filter: filter
      }, 
      (payload) => {
        if (onMessageEvent) onMessageEvent(payload);
      }
    )
    .subscribe((status) => {
      console.log(`✅ Message subscription ${channelName}: ${status}`);
    });

  return messageChannel;
}

/**
 * Unsubscribe from current message channel
 */
export function unsubscribeFromMessages() {
  if (messageChannel) {
    supabase.removeChannel(messageChannel);
    messageChannel = null;
  }
}

/**
 * Send typing indicator event
 */
export function sendTypingIndicator(targetId, type = 'room', userId, username) {
  if (!typingChannel) {
    setupTypingChannel();
  }

  const payload = {
    target_id: targetId,
    type: type,
    user_id: userId,
    username: username,
    timestamp: Date.now()
  };

  typingChannel.send({
    type: 'broadcast',
    event: 'typing',
    payload: payload
  });
}

/**
 * Setup typing indicator listener
 */
function setupTypingChannel() {
  typingChannel = supabase.channel('chat:typing');
  
  typingChannel.on('broadcast', { event: 'typing' }, (payload) => {
    // Dispatch custom event for UI to handle
    window.dispatchEvent(new CustomEvent('chat:typing', { detail: payload.payload }));
  });

  typingChannel.subscribe();
}

/**
 * Subscribe to online users / presence
 */
export function subscribeToPresence(onPresenceChange) {
  if (presenceChannel) return presenceChannel;

  presenceChannel = supabase.channel('chat:presence')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'online_users' },
      (payload) => {
        if (onPresenceChange) onPresenceChange(payload);
      }
    )
    .subscribe();

  return presenceChannel;
}

/**
 * Cleanup all subscriptions
 */
export function cleanupAllSubscriptions() {
  unsubscribeFromMessages();
  if (typingChannel) {
    supabase.removeChannel(typingChannel);
    typingChannel = null;
  }
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }
}
