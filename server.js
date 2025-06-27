console.log('🔧 Loading environment configuration...');
require('dotenv').config({ path: '.env.development' });

console.log('📦 Loading core dependencies...');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const db = require('./utils/db');
const ai = require('./utils/generate');
const {
  saveAudioFile,
} = require('./utils/helpers');

// Utility function to remove square brackets and their content from text
function cleanResponseText(text) {
  if (!text) return text;
  // Remove square brackets and everything inside them, including any leading/trailing spaces
  return text.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

console.log('🚀 Initializing Express app...');
const app = express();
const port = process.env.PORT || 3001;

console.log('🔧 Setting up middleware...');
app.use(cors());
app.use(express.json());
app.use(helmet());
console.log('✅ Middleware configured');

// Ensure audio_files directory exists
const audioFilesDir = path.join(__dirname, 'audio_files');
if (!fs.existsSync(audioFilesDir)) {
  fs.mkdirSync(audioFilesDir, { recursive: true });
}

// Endpoint to serve audio files
app.get('/api/audio/:uid/:chatId/:filename', (req, res) => {
  try {
    const { uid, chatId, filename } = req.params;
    const filePath = path.join(audioFilesDir, uid, chatId, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }
    
    // All files are PCM from Google
    const contentType = 'audio/L16';
    
    // Set headers and send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving audio file:', error);
    res.status(500).json({ error: 'Failed to serve audio file' });
  }
});

// New endpoint to get personas list
app.get('/api/personas', async (req, res) => {
  try {
    const personas = await db.getPersonas();
    res.json({ personas });
  } catch (error) {
    console.error('Error loading personas:', error);
    res.status(500).json({ error: 'Failed to load personas' });
  }
});

// Endpoint to get user's chat history
app.get('/api/chats/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    // Ensure user exists
    await db.ensureUserExists(uid);
    
    // Get chat history with persona information
    const { data: chats, error } = await db.client
      .from('chats')
      .select(`
        *,
        personas (
          id,
          name,
          voice_name
        )
      `)
      .eq('uid', uid)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    res.json({ 
      chats: (chats || []).map(chat => ({
        id: chat.id,
        title: chat.title || 'Untitled Chat',
        created_at: chat.created_at,
        updated_at: chat.updated_at,
        messageCount: chat.messages ? chat.messages.length : 0,
        persona: chat.personas ? {
          id: chat.personas.id,
          name: chat.personas.name,
          voiceName: chat.personas.voice_name
        } : null
      }))
    });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ error: 'Failed to get chat history', details: error.message });
  }
});

// Endpoint to get specific chat with full messages
app.get('/api/chats/:uid/:chatId', async (req, res) => {
  try {
    const { uid, chatId } = req.params;
    
    const { data: chat, error } = await db.client
      .from('chats')
      .select(`
        *,
        personas (
          id,
          name,
          tone,
          voice_name
        )
      `)
      .eq('uid', uid)
      .eq('id', chatId)
      .single();

    if (error) throw error;

    // Clean the chat.messages content by removing square brackets and their content
    chat.messages = chat.messages.map(message => {
      return {
        ...message,
        content: cleanResponseText(message.content)
      }
    });

    // Transform the response to include persona in a more accessible format
    const response = {
      ...chat,
      persona: chat.personas ? {
        id: chat.personas.id,
        name: chat.personas.name,
        tone: chat.personas.tone,
        voiceName: chat.personas.voice_name
      } : null
    };
    
    // Remove the nested personas object since we've flattened it
    delete response.personas;

    res.json({ chat: response });
  } catch (error) {
    console.error('Error getting specific chat:', error);
    res.status(500).json({ error: 'Failed to get chat', details: error.message });
  }
});

// Endpoint to delete a chat
app.delete('/api/chats/:uid/:chatId', async (req, res) => {
  try {
    const { uid, chatId } = req.params;
    
    const { error } = await db.client
      .from('chats')
      .delete()
      .eq('uid', uid)
      .eq('id', chatId);

    if (error) throw error;

    res.json({ success: true, message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat', details: error.message });
  }
});

// Text chat endpoint
app.post('/api/chat/text', async (req, res) => {
  try {
    const { message, personaName, personaId, uid, chatId } = req.body;

    console.log('Received text message:', message);
    console.log('Selected persona:', personaName || personaId);
    console.log('User UID:', uid);
    console.log('Chat ID:', chatId);

    // Ensure user exists in database
    await db.ensureUserExists(uid);

    // Find the selected persona by ID or name, or use default
    let selectedPersona = null;
    if (personaId) {
      selectedPersona = await db.getPersonaById(personaId);
    } else if (personaName) {
      selectedPersona = await db.getPersonaByName(personaName);
    }
    
    // If no persona found or if chatId exists, try to get from chat's default persona
    if (!selectedPersona && chatId) {
      const { data: chat, error } = await db.client
        .from('chats')
        .select('persona_id, personas(id, name, tone, voice_name)')
        .eq('id', chatId)
        .eq('uid', uid)
        .single();
      
      if (!error && chat?.personas) {
        selectedPersona = chat.personas;
      }
    }
    
    // Fallback to first available persona if none found
    if (!selectedPersona) {
      const personas = await db.getPersonas();
      selectedPersona = personas[0];
    }
    
    if (!selectedPersona) {
      throw new Error('No personas available. Please run persona sync first.');
    }
    
    console.log('Using voice:', selectedPersona.voice_name);

    // Get chat history for context - only if continuing an existing chat
    const chatHistory = chatId ? await db.getChatHistory(uid, chatId) : [];

    // Generate AI response
    const rawResponseText = await ai.generateAIResponse(message, selectedPersona, chatHistory);
    const responseText = cleanResponseText(rawResponseText);
    console.log('Generated response:', responseText);

    // Generate audio response (use cleaned text)
    const { audioData, responseMimeType } = await ai.generateAudio(responseText, selectedPersona);

    // Generate chatId if not provided (new chat)
    const currentChatId = chatId || randomUUID();

    // Save audio file and get URL
    const audioUrl = await saveAudioFile(audioData, responseMimeType, uid, currentChatId, req);

    // Save conversation to database with audio URL
    const savedChat = await db.saveConversation(uid, currentChatId, message, responseText, selectedPersona, audioUrl);
    console.log('Chat saved successfully:', savedChat?.id);
    
    // Return JSON response with audio URL for frontend processing
    res.json({
      transcribedText: message, // For consistency with audio endpoint
      responseText,
      audioUrl, // URL to fetch audio file
      timestamp: new Date().toISOString(),
      chatId: savedChat?.id || currentChatId
    });

  } catch (error) {
    console.error('Error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'An error occurred processing your request', details: error.message });
  }
});

// Audio chat endpoint
app.post('/api/chat/audio', async (req, res) => {
  try {
    const { message, personaName, personaId, uid, chatId } = req.body;

    console.log('Received audio data, length:', message.length);
    console.log('Selected persona:', personaName || personaId);
    console.log('User UID:', uid);
    console.log('Chat ID:', chatId);

    // Ensure user exists in database
    await db.ensureUserExists(uid);

    // Find the selected persona by ID or name, or use default
    let selectedPersona = null;
    if (personaId) {
      selectedPersona = await db.getPersonaById(personaId);
    } else if (personaName) {
      selectedPersona = await db.getPersonaByName(personaName);
    }
    
    // If no persona found or if chatId exists, try to get from chat's default persona
    if (!selectedPersona && chatId) {
      const { data: chat, error } = await db.client
        .from('chats')
        .select('persona_id, personas(id, name, tone, voice_name)')
        .eq('id', chatId)
        .eq('uid', uid)
        .single();
      
      if (!error && chat?.personas) {
        selectedPersona = chat.personas;
      }
    }
    
    // Fallback to first available persona if none found
    if (!selectedPersona) {
      const personas = await db.getPersonas();
      selectedPersona = personas[0];
    }
    
    if (!selectedPersona) {
      throw new Error('No personas available. Please run persona sync first.');
    }
    
    console.log('Using voice:', selectedPersona.voice_name);

    // Get chat history for context - only if continuing an existing chat
    const chatHistory = chatId ? await db.getChatHistory(uid, chatId) : [];

    // First convert speech to text using Gemini's audio understanding
    const transcribedText = await ai.transcribeAudio(message, "audio/wav");

    // Generate AI response
    const rawResponseText = await ai.generateAIResponseFull(transcribedText, selectedPersona, chatHistory);
    const responseText = cleanResponseText(rawResponseText);
    console.log('Generated response:', responseText);

    // Generate audio response (use cleaned text)
    const { audioData, responseMimeType } = await ai.generateAudio(responseText, selectedPersona);

    // Generate chatId if not provided (new chat)
    const currentChatId = chatId || randomUUID();

    // Save audio file and get URL
    const audioUrl = await saveAudioFile(audioData, responseMimeType, uid, currentChatId, req);

    // Save conversation to database with audio URL
    const savedChat = await db.saveConversation(uid, currentChatId, transcribedText, responseText, selectedPersona, audioUrl);
    console.log('Chat saved successfully:', savedChat?.id);
    
    // Return JSON response with audio URL for frontend processing
    res.json({
      transcribedText,
      responseText,
      audioUrl, // URL to fetch audio file
      timestamp: new Date().toISOString(),
      chatId: savedChat?.id || currentChatId
    });
  } catch (error) {
    console.error('Error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'An error occurred processing your request', details: error.message });
  }
});

// Add error handling for uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

process.on('exit', (code) => {
  console.log('🔄 Process exiting with code:', code);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

app.listen(port, () => {
  console.log(`✅ Server listening at http://localhost:${port}`);
  console.log('🚀 Server started successfully');
});

