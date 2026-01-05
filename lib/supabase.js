// lib/supabase.js - ONLY Supabase configuration
export function initSupabase() {
    const SUPABASE_URL = 'https://lapyxhothazalssrbimb.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcHl4aG90aGF6YWxzc3JiaW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNjg0NDUsImV4cCI6MjA3Njk0NDQ0NX0.isfh75lAbJotctu6dkd_aAYK-2YNyYM4o-jqKFB5tVA';

    // Make sure supabase is available globally
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase library not loaded!');
        return null;
    }
    
    if (window.supabaseClient) {
        return window.supabaseClient;
    }
    
    try {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized');
        return window.supabaseClient;
    } catch (error) {
        console.error('❌ Supabase init failed:', error);
        return null;
    }
}
