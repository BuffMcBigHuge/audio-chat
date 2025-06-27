const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.development') });

const { createClient } = require('@supabase/supabase-js');

class DatabaseService {
  constructor() {
    this.PERSONAS_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours
    this.personasCache = null;
    this.lastPersonasCacheTime = null;
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  // Helper function to get personas from database with caching
  async getPersonas() {
    const now = Date.now();
    
    // Return cached personas if still fresh
    if (this.personasCache && (now - this.lastPersonasCacheTime) < this.PERSONAS_CACHE_TTL) {
      return this.personasCache;
    }
    
    try {
      const { data: personas, error } = await this.supabase
        .from('personas')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      // Cache the results
      this.personasCache = personas || [];
      this.lastPersonasCacheTime = now;
      
      return this.personasCache;
    } catch (error) {
      console.error('Error fetching personas from database:', error);
      
      // Return cached data if available, otherwise empty array
      return this.personasCache || [];
    }
  }

  // Helper function to get persona by ID or name
  async getPersonaById(personaId) {
    try {
      const personas = await this.getPersonas();
      return personas.find(p => p.id === personaId);
    } catch (error) {
      console.error('Error getting persona by ID:', error);
      return null;
    }
  }

  async getPersonaByName(personaName) {
    try {
      const personas = await this.getPersonas();
      return personas.find(p => p.name === personaName);
    } catch (error) {
      console.error('Error getting persona by name:', error);
      return null;
    }
  }

  // Helper function to ensure user exists in database
  async ensureUserExists(uid) {
    try {
      // Check if user exists
      const { data: existingUser, error: selectError } = await this.supabase
        .from('users')
        .select('*')
        .eq('uid', uid)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
      }

      if (!existingUser) {
        // Create new user
        const { data: newUser, error: insertError } = await this.supabase
          .from('users')
          .insert({ uid })
          .select()
          .single();

        if (insertError) throw insertError;
        return newUser;
      }

      return existingUser;
    } catch (error) {
      console.error('Error ensuring user exists:', error);
      throw error;
    }
  }

  // Helper function to get chat history for context
  async getChatHistory(uid, chatId = null) {
    try {
      if (chatId) {
        // Get specific chat messages
        const { data: chat, error } = await this.supabase
          .from('chats')
          .select('messages')
          .eq('uid', uid)
          .eq('id', chatId)
          .single();

        if (error) throw error;
        
        // Return the messages array from the specific chat, or empty array if no messages
        return chat?.messages || [];
      } else {
        // This case is for when we need all chats (like for chat list), not for conversation context
        const { data: chats, error } = await this.supabase
          .from('chats')
          .select('*')
          .eq('uid', uid)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return chats || [];
      }
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }

  // Helper function to save conversation to database
  async saveConversation(uid, chatId, userMessage, responseText, selectedPersona, audioUrl = null) {
    try {
      const newMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      };

      const assistantMessage = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
        persona: selectedPersona.name,
        personaId: selectedPersona.id,
        audioUrl: audioUrl
      };

      // Check if chat exists first
      const { data: existingChat, error: selectError } = await this.supabase
        .from('chats')
        .select('messages, persona_id')
        .eq('id', chatId)
        .eq('uid', uid)
        .maybeSingle(); // Use maybeSingle to avoid error when no rows found

      if (selectError) throw selectError;

      if (existingChat) {
        // Update existing chat
        const updatedMessages = [
          ...(existingChat.messages || []),
          newMessage,
          assistantMessage
        ];

        const { data: updatedChat, error: updateError } = await this.supabase
          .from('chats')
          .update({ 
            messages: updatedMessages,
            updated_at: new Date().toISOString()
          })
          .eq('id', chatId)
          .eq('uid', uid)
          .select()
          .single();

        if (updateError) throw updateError;
        return updatedChat;
      } else {
        // Create new chat with specific chatId
        const { data: newChat, error: insertError } = await this.supabase
          .from('chats')
          .insert({
            id: chatId, // Use the provided UUID as the chat ID
            uid,
            persona_id: selectedPersona.id, // Store the persona ID
            title: `Chat with ${selectedPersona.name}`,
            messages: [newMessage, assistantMessage]
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newChat;
      }
    } catch (dbError) {
      console.error('Error saving to database:', dbError);
      // Continue with response even if DB save fails
      return null;
    }
  }

  // Getter for accessing the supabase client directly if needed
  get client() {
    return this.supabase;
  }
}

// Create and export a singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;