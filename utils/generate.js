const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.development') });

const { GoogleGenAI } = require('@google/genai');

class AIService {
  constructor() {
    this.genAI = new GoogleGenAI({
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });
  }

  // Helper function to generate AI response using chat API
  async generateAIResponse(userMessage, selectedPersona, chatHistory) {
    // Create system instruction
    const systemInstruction = `
- Include tones and expressions in your responses to match the conversation, written in square brackets, (i.e. [laughing], [breathing heavily], [crying], [screaming], etc.)
- Your are writing the script line for ${selectedPersona.name}. ${selectedPersona.description || ''}
- You are to respond as a script in a movie, with a lot of emotion and expression tags to be read out loud by an actor.
- Character Tone: ${selectedPersona.tone}
- Keep responses under 100 words for natural audio pacing
- Use natural conversational language with contractions and colloquialisms
`
    // Format chat history
    const formattedHistory = chatHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    console.log('System instruction:', systemInstruction);
    console.log('Chat history:', formattedHistory);

    // Create chat with history and system instruction
    const chat = this.genAI.chats.create({
      model: "gemini-2.5-flash",
      history: formattedHistory,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    // Send the user message
    const response = await chat.sendMessage({
      message: userMessage
    });

    return response.text;
  }

  // Helper function to generate audio from text
  async generateAudio(responseText, selectedPersona) {
    // Create enhanced TTS prompt with natural language instructions for speech control
    const ttsPrompt = `Say this in the style, ${selectedPersona.tone}: ${responseText}`;
    console.log('TTS prompt:', ttsPrompt);

    // Convert to speech with enhanced prompting for better voice control
    const audioResponse = await this.genAI.models.generateContent({
      model: "gemini-2.5-pro-preview-tts",
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { 
              voiceName: selectedPersona.voice_name || selectedPersona.voiceName // Handle both database and legacy format
            }
          }
        }
      }
    });

    // Extract L16 PCM audio data from GenAI response
    const audioInlineData = audioResponse.candidates[0].content.parts[0].inlineData;
    const audioData = audioInlineData.data;
    const responseMimeType = audioInlineData.mimeType;
    
    console.log('🎵 GenAI returned audio with MIME type:', responseMimeType);
    console.log('📏 PCM audio data size (base64):', audioData.length);

    return { audioData, responseMimeType };
  }

  // Helper function to transcribe audio to text using Gemini's audio understanding
  async transcribeAudio(audioData, mimeType = "audio/wav") {
    const sttResponse = await this.genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{
        parts: [{
          inlineData: {
            data: audioData,
            mimeType: mimeType
          }
        }, {
          text: "Please transcribe this audio. Transcribed text:"
        }]
      }]
    });

    const transcribedText = sttResponse.candidates[0].content.parts[0].text;
    console.log('Transcribed text:', transcribedText);
    
    return transcribedText;
  }

  // Getter for accessing the GenAI client directly if needed
  get client() {
    return this.genAI;
  }
}

// Create and export a singleton instance
const aiService = new AIService();

module.exports = aiService;