const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.development') });

const { randomUUID } = require('node:crypto');
const fs = require('node:fs');

// Ensure audio_files directory exists
const audioFilesDir = path.resolve(__dirname, '..', 'audio_files');
if (!fs.existsSync(audioFilesDir)) {
  fs.mkdirSync(audioFilesDir, { recursive: true });
}

// Helper function to save audio file to filesystem and return URL
async function saveAudioFile(audioData, audioMimeType, uid, chatId, req) {
  try {
    // Generate UUID for filename - Google always returns PCM
    const audioUuid = randomUUID();
    const filename = `${audioUuid}.pcm`;
    
    // Ensure user and chat directory exists
    const chatAudioDir = path.join(audioFilesDir, uid, chatId);
    if (!fs.existsSync(chatAudioDir)) {
      fs.mkdirSync(chatAudioDir, { recursive: true });
    }
    
    // Save audio file
    const filePath = path.join(chatAudioDir, filename);
    const audioBuffer = Buffer.from(audioData, 'base64');
    fs.writeFileSync(filePath, audioBuffer);
    
    // Generate full URL
    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${port}`;
    const audioUrl = `${protocol}://${host}/api/audio/${uid}/${chatId}/${filename}`;
    
    console.log('Audio file saved:', filePath);
    console.log('Audio URL:', audioUrl);
    
    return audioUrl;
  } catch (error) {
    console.error('Error saving audio file:', error);
    return null;
  }
}

module.exports = {
  saveAudioFile,
};