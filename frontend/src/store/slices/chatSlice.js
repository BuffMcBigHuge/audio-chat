import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getUserUID } from '../../utils/userUtils';

// Async thunk for sending audio message with UID and chat context
export const sendAudioMessage = createAsyncThunk(
  'chat/sendAudioMessage',
  async ({ base64Audio, personaName, personaId, chatId }, { dispatch, getState }) => {
    try {
      const uid = getUserUID();
      
      const response = await fetch('http://localhost:3001/api/chat/audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: base64Audio,
          personaName: personaName,
          personaId: personaId,
          uid: uid,
          chatId: chatId || null
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('📦 Response data:', responseData);
        
        const { transcribedText, responseText, audioUrl, chatId: returnedChatId } = responseData;
        
        return {
          transcribedText,
          responseText,
          audioUrl, // URL to fetch audio file
          timestamp: new Date().toLocaleTimeString(),
          chatId: returnedChatId
        };
      } else {
        throw new Error('Failed to get response from server');
      }
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
);

// Async thunk for sending text message with UID and chat context
export const sendTextMessage = createAsyncThunk(
  'chat/sendTextMessage',
  async ({ textMessage, personaName, personaId, chatId }, { dispatch, getState }) => {
    try {
      const uid = getUserUID();
      
      const response = await fetch('http://localhost:3001/api/chat/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: textMessage,
          personaName: personaName,
          personaId: personaId,
          uid: uid,
          chatId: chatId || null
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('📦 Text response data:', responseData);
        
        const { transcribedText, responseText, audioUrl, chatId: returnedChatId } = responseData;
        
        return {
          userMessage: textMessage, // The original text message
          responseText,
          audioUrl, // URL to fetch audio file
          timestamp: new Date().toLocaleTimeString(),
          chatId: returnedChatId
        };
      } else {
        throw new Error('Failed to get response from server');
      }
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
);

// Async thunk for fetching chat history
export const fetchChatHistory = createAsyncThunk(
  'chat/fetchChatHistory',
  async (_, { getState }) => {
    try {
      const uid = getUserUID();
      
      const response = await fetch(`http://localhost:3001/api/chats/${uid}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.chats;
      } else {
        throw new Error('Failed to fetch chat history');
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    }
  }
);

// Async thunk for loading a specific chat
export const loadChat = createAsyncThunk(
  'chat/loadChat',
  async (chatId, { getState }) => {
    try {
      const uid = getUserUID();
      
      const response = await fetch(`http://localhost:3001/api/chats/${uid}/${chatId}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.chat;
      } else {
        throw new Error('Failed to load chat');
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      throw error;
    }
  }
);

// Async thunk for deleting a chat
export const deleteChat = createAsyncThunk(
  'chat/deleteChat',
  async (chatId, { getState }) => {
    try {
      const uid = getUserUID();
      
      const response = await fetch(`http://localhost:3001/api/chats/${uid}/${chatId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Don't dispatch fetchChatHistory here to prevent recursive calls
        // Instead, let the component handle the refresh
        return chatId;
      } else {
        throw new Error('Failed to delete chat');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }
);

// Async thunk for fetching audio data from URL
export const fetchAudioFromUrl = createAsyncThunk(
  'chat/fetchAudioFromUrl',
  async ({ messageId, audioUrl }) => {
    try {
      const response = await fetch(audioUrl);
      
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        
        // Convert ArrayBuffer to base64 in chunks to avoid stack overflow
        const uint8Array = new Uint8Array(arrayBuffer);
        const chunkSize = 8192; // Process 8KB at a time
        let binaryString = '';
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, chunk);
        }
        
        const base64Audio = btoa(binaryString);
        return { messageId, audioData: base64Audio };
      } else {
        throw new Error('Failed to fetch audio file');
      }
    } catch (error) {
      console.error('Error fetching audio from URL:', error);
      throw error;
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    messages: [],
    chatHistory: [],
    currentChatId: null,
    chatPersona: null,
    isRecording: false,
    isProcessing: false,
    isLoadingHistory: false,
    currentAudio: null,
    error: null,
    needsHistoryRefresh: false,
  },
  reducers: {
    setIsRecording: (state, action) => {
      state.isRecording = action.payload;
    },
    setCurrentAudio: (state, action) => {
      state.currentAudio = action.payload;
    },
    setCurrentChatId: (state, action) => {
      state.currentChatId = action.payload;
    },
    addUserMessage: (state, action) => {
      const message = {
        id: Date.now(),
        type: 'user',
        ...action.payload,
      };
      state.messages.push(message);
    },
    updateUserMessage: (state, action) => {
      const { id, updates } = action.payload;
      const messageIndex = state.messages.findIndex(msg => msg.id === id);
      if (messageIndex !== -1) {
        state.messages[messageIndex] = { ...state.messages[messageIndex], ...updates };
      }
    },
    addBotMessage: (state, action) => {
      const message = {
        id: Date.now() + 1,
        type: 'bot',
        ...action.payload,
      };
      state.messages.push(message);
    },
    clearMessages: (state) => {
      state.messages = [];
      state.currentChatId = null;
      state.chatPersona = null;
    },
    startNewChat: (state) => {
      state.messages = [];
      state.currentChatId = null;
      state.chatPersona = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Send audio message
      .addCase(sendAudioMessage.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(sendAudioMessage.fulfilled, (state, action) => {
        state.isProcessing = false;
        
        // Update current chat ID if we got one back
        if (action.payload.chatId && !state.currentChatId) {
          state.currentChatId = action.payload.chatId;
        }
        
        // Update the last user message with transcribed text
        const lastUserMessage = [...state.messages].reverse().find(msg => msg.type === 'user');
        if (lastUserMessage) {
          const messageIndex = state.messages.findIndex(msg => msg.id === lastUserMessage.id);
          if (messageIndex !== -1) {
            state.messages[messageIndex].content = `"${action.payload.transcribedText}"`;
            state.messages[messageIndex].isProcessing = false;
          }
        }
        
        // Add bot response with audio URL
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: action.payload.responseText,
          timestamp: action.payload.timestamp,
          audioUrl: action.payload.audioUrl, // URL to fetch audio file
        };
        state.messages.push(botMessage);
        
        // Mark that chat history needs refresh
        state.needsHistoryRefresh = true;
      })
      .addCase(sendAudioMessage.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.error.message;
        
        // Update the last user message to show error
        const lastUserMessage = [...state.messages].reverse().find(msg => msg.type === 'user');
        if (lastUserMessage) {
          const messageIndex = state.messages.findIndex(msg => msg.id === lastUserMessage.id);
          if (messageIndex !== -1) {
            state.messages[messageIndex].content = 'Error processing request';
            state.messages[messageIndex].isProcessing = false;
          }
        }
      })
      
      // Send text message
      .addCase(sendTextMessage.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(sendTextMessage.fulfilled, (state, action) => {
        state.isProcessing = false;
        
        // Update current chat ID if we got one back
        if (action.payload.chatId && !state.currentChatId) {
          state.currentChatId = action.payload.chatId;
        }
        
        // The user message is already added before the API call
        // Just add the bot response with audio URL
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: action.payload.responseText,
          timestamp: action.payload.timestamp,
          audioUrl: action.payload.audioUrl, // URL to fetch audio file
        };
        state.messages.push(botMessage);
        
        // Mark that chat history needs refresh
        state.needsHistoryRefresh = true;
      })
      .addCase(sendTextMessage.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.error.message;
        
        // Add error message as bot response
        const errorMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: 'Sorry, there was an error processing your message.',
          timestamp: new Date().toLocaleTimeString(),
        };
        state.messages.push(errorMessage);
      })
      
      // Fetch chat history
      .addCase(fetchChatHistory.pending, (state) => {
        state.isLoadingHistory = true;
        state.error = null;
      })
      .addCase(fetchChatHistory.fulfilled, (state, action) => {
        state.isLoadingHistory = false;
        state.chatHistory = action.payload;
        state.needsHistoryRefresh = false;
      })
      .addCase(fetchChatHistory.rejected, (state, action) => {
        state.isLoadingHistory = false;
        state.error = action.error.message;
      })
      
      // Load specific chat
      .addCase(loadChat.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(loadChat.fulfilled, (state, action) => {
        state.isProcessing = false;
        state.currentChatId = action.payload.id;
        
        // Store the chat's persona information for cross-slice communication
        state.chatPersona = action.payload.persona;
        
        // Convert database messages to UI format
        const messages = action.payload.messages || [];
        state.messages = messages.map((msg, index) => ({
          id: Date.now() + index,
          type: msg.role === 'user' ? 'user' : 'bot',
          content: msg.content,
          timestamp: new Date(msg.timestamp).toLocaleTimeString(),
          persona: msg.persona,
          audioUrl: msg.audioUrl || null, // Include audioUrl from database
        }));
      })
      .addCase(loadChat.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.error.message;
      })
      
      // Delete chat
      .addCase(deleteChat.fulfilled, (state, action) => {
        // If we deleted the currently loaded chat, clear it
        if (state.currentChatId === action.payload) {
          state.messages = [];
          state.currentChatId = null;
        }
        
        // Remove from chat history
        state.chatHistory = state.chatHistory.filter(chat => chat.id !== action.payload);
      })
      .addCase(deleteChat.rejected, (state, action) => {
        state.error = action.error.message;
      })
      
      // Fetch audio from URL
      .addCase(fetchAudioFromUrl.fulfilled, (state, action) => {
        const { messageId, audioData } = action.payload;
        const messageIndex = state.messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          state.messages[messageIndex].audioData = audioData;
          state.messages[messageIndex].audioMimeType = 'audio/L16';
        }
      })
      .addCase(fetchAudioFromUrl.rejected, (state, action) => {
        console.error('Failed to fetch audio:', action.error.message);
      });
  },
});

export const {
  setIsRecording,
  setCurrentAudio,
  setCurrentChatId,
  addUserMessage,
  updateUserMessage,
  addBotMessage,
  clearMessages,
  startNewChat,
  clearError,
} = chatSlice.actions;

export default chatSlice.reducer; 