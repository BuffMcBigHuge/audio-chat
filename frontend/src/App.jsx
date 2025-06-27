import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { fetchPersonas } from './store/slices/personaSlice';
import { 
  setIsRecording, 
  addUserMessage, 
  sendAudioMessage,
  sendTextMessage,
  fetchAudioFromUrl
} from './store/slices/chatSlice';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  User, 
  Bot, 
  Menu,
  MessageCircle,
  Settings,
  Sparkles,
  Send,
  Type
} from "lucide-react";
import PersonaSelector from './components/PersonaSelector';
import ChatHistory from './components/ChatHistory';
import { ModeToggle } from './components/ui/mode-toggle';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { getUserUID } from './utils/userUtils';

// Extract MobileChatHistory component outside of App to prevent re-creation on every render
const MobileChatHistory = ({ isOpen, onOpenChange }) => {
  const handleChatAction = useCallback(() => {
    // Close mobile menu when a chat action is performed
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="lg:hidden"
        >
          <Menu className="w-4 h-4 mr-2" />
          <MessageCircle className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Chat History
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-hidden p-4">
          <ChatHistory onChatAction={handleChatAction} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

function App() {
  const dispatch = useAppDispatch();
  const { messages, isRecording, isProcessing, currentChatId } = useAppSelector(
    (state) => state.chat
  );
  const { selectedPersona } = useAppSelector((state) => state.persona);
  
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const scrollAreaRef = useRef(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  
  // Use the modern AudioWorklet-based audio player
  const { playPCMAudio, stopAudio } = useAudioPlayer();

  // Memoized handlers to prevent unnecessary re-renders
  const handleMobileMenuChange = useCallback((open) => {
    setIsMobileMenuOpen(open);
  }, []);

  // Initialize user UID and load personas on component mount
  useEffect(() => {
    // Ensure user has a UID
    const uid = getUserUID();
    console.log('User UID:', uid);
    
    // Load personas
    dispatch(fetchPersonas());
  }, [dispatch]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Auto-play audio when new bot messages arrive
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    
    // Auto-play new bot messages with audio URLs
    if (lastMessage && 
        lastMessage.type === 'bot' && 
        lastMessage.audioUrl && 
        !lastMessage.isProcessing) {
      
      console.log('🎵 Auto-playing new bot message audio');
      
      // Small delay to ensure UI has updated
      const timeoutId = setTimeout(() => {
        playAudio(lastMessage).catch(error => {
          console.error('❌ Auto-play failed:', error);
        });
      }, 100);

      // Clean up timeout if component unmounts or messages change
      return () => clearTimeout(timeoutId);
    }
  }, [messages]);

  const handleRecord = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorder.current.stop();
      dispatch(setIsRecording(false));
    } else {
      // Start recording
      try {
        // Stop any currently playing persona audio before starting to record
        stopAudio();
        console.log('🎵 Stopped persona audio to start recording');
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream);
        audioChunks.current = [];
        
        mediaRecorder.current.ondataavailable = (event) => {
          audioChunks.current.push(event.data);
        };
        
        mediaRecorder.current.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          const reader = new FileReader();
          
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1];
            
            // Add user message placeholder
            dispatch(addUserMessage({
              content: 'Processing audio...',
              timestamp: new Date().toLocaleTimeString(),
              isProcessing: true
            }));
            
            // Send audio message with selected persona and current chat ID
            dispatch(sendAudioMessage({
              base64Audio,
              personaName: selectedPersona?.name,
              personaId: selectedPersona?.id,
              chatId: currentChatId
            }));
          };
        };
        
        mediaRecorder.current.start();
        dispatch(setIsRecording(true));
      } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone. Please check permissions.');
      }
    }
  };

  const handleSendText = async () => {
    if (!textInput.trim() || !selectedPersona || isProcessing) return;
    
    const message = textInput.trim();
    setTextInput('');
    
    // Add user message
    dispatch(addUserMessage({
      content: message,
      timestamp: new Date().toLocaleTimeString(),
      isProcessing: false
    }));
    
    // Send text message to backend using the proper API endpoint
    dispatch(sendTextMessage({
      textMessage: message,
      personaName: selectedPersona.name,
      personaId: selectedPersona.id,
      chatId: currentChatId
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const playAudio = async (message) => {
    console.log('🎵 Playing audio for message:', message.id);
    
    // Stop any currently playing audio
    stopAudio();
    
    try {
      if (message.audioUrl) {
        console.log('🎵 Fetching audio from URL:', message.audioUrl);
        
        // Check if we already have cached audio data
        if (message.audioData) {
          console.log('🎵 Using cached audio data');
          await playPCMAudio(message.audioData);
          console.log('✅ Cached audio playback completed');
        } else {
          // Fetch audio data from URL and cache it
          await dispatch(fetchAudioFromUrl({ 
            messageId: message.id, 
            audioUrl: message.audioUrl 
          })).unwrap();
          
          // Audio data should now be available, play it
          const updatedMessage = messages.find(msg => msg.id === message.id);
          if (updatedMessage?.audioData) {
            await playPCMAudio(updatedMessage.audioData);
            console.log('✅ Fetched audio playback completed');
          }
        }
      } else {
        console.warn('⚠️ No audio URL available for message:', message.id);
      }
    } catch (error) {
      console.error('❌ Audio playback failed:', error);
    }
  };

  // Persona Modal Component with proper scrolling behavior
  const PersonaModal = () => {
    // Handle modal body scroll prevention using CSS classes
    React.useEffect(() => {
      if (isPersonaModalOpen) {
        document.body.classList.add('modal-open');
      } else {
        document.body.classList.remove('modal-open');
      }

      // Cleanup function
      return () => {
        document.body.classList.remove('modal-open');
      };
    }, [isPersonaModalOpen]);

    return (
      <Dialog open={isPersonaModalOpen} onOpenChange={setIsPersonaModalOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <Sparkles className="w-3 h-3" />
            {selectedPersona ? selectedPersona.name : 'Choose Persona'}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl h-[80vh] max-h-[600px] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 p-4 border-b bg-background">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4" />
              Choose AI Persona
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <PersonaSelector onSelect={() => setIsPersonaModalOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar - Fixed width, full height */}
      <div className="hidden lg:flex w-80 flex-col border-r border-border">
        <ChatHistory />
      </div>

      {/* Main Chat Area - Takes remaining space */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Fixed Header */}
        <header className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between p-4">
            {/* Left: Mobile menu */}
            <div className="flex items-center gap-2">
              <MobileChatHistory 
                isOpen={isMobileMenuOpen} 
                onOpenChange={handleMobileMenuChange} 
              />
            </div>
            
            {/* Center: Title */}
            <div className="flex-1 flex justify-center">
              <h1 className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                🎤 Audio Chat
              </h1>
            </div>
            
            {/* Right: Persona selector and theme toggle */}
            <div className="flex items-center gap-2">
              <PersonaModal />
              <ModeToggle />
            </div>
          </div>
        </header>

        {/* Chat Messages - Scrollable area */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <Mic className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-sm font-semibold mb-2">
                    {currentChatId ? 'Continue your conversation!' : 'Start a new conversation!'}
                  </h2>
                  <p className="text-xs">
                    {selectedPersona 
                      ? `Currently speaking with ${selectedPersona.name}`
                      : 'Select a persona above to begin'
                    }
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.type === 'bot' && (
                      <Avatar className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 shrink-0">
                        <AvatarFallback>
                          <Bot className="w-4 h-4 text-white" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={`max-w-[75%] ${message.type === 'user' ? 'order-2' : ''}`}>
                      <div
                        className={`px-4 py-3 ${
                          message.type === 'user'
                            ? 'bg-blue-500 text-white ml-auto'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs leading-relaxed">{message.content}</span>
                          {message.isProcessing && (
                            <div className="w-2 h-2 bg-current animate-pulse shrink-0" />
                          )}
                          {message.audioUrl && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 hover:bg-white/20 shrink-0"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔊 Play button clicked for message:', message.id);
                                playAudio(message);
                              }}
                              type="button"
                            >
                              <Volume2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="text-2xs text-muted-foreground mt-1 px-2">
                        {message.timestamp}
                        {message.persona && (
                          <span className="ml-2">• {message.persona}</span>
                        )}
                      </div>
                    </div>

                    {message.type === 'user' && (
                      <Avatar className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 order-3 shrink-0">
                        <AvatarFallback>
                          <User className="w-4 h-4 text-white" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Fixed Footer - Input Controls */}
        <footer className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="p-4">
            <div className="max-w-4xl mx-auto">
              {/* Text Input Row */}
              <div className="flex items-center gap-2 mb-4">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={selectedPersona ? `Type a message to ${selectedPersona.name}...` : "Select a persona to start typing..."}
                  disabled={!selectedPersona || isProcessing}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendText}
                  disabled={!textInput.trim() || !selectedPersona || isProcessing}
                  size="lg"
                  className="h-10 px-4"
                >
                  <Send className="w-3 h-3" />
                </Button>
              </div>

              {/* Voice Recording Section */}
              <div className="text-center">
                <div className="flex justify-center items-center gap-4 mb-3">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-2xs text-muted-foreground flex items-center gap-2">
                    <Type className="w-3 h-3" />
                    or speak
                    <Mic className="w-3 h-3" />
                  </span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>
                
                <Button
                  onClick={handleRecord}
                  disabled={isProcessing || !selectedPersona}
                  size="lg"
                  className={`w-16 h-16 ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : isProcessing
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600'
                  } shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100`}
                >
                  {isProcessing ? (
                    <div></div>
                    /* <div className="w-6 h-6 border-2 border-white border-t-transparent animate-spin" /> */
                  ) : isRecording ? (
                    <MicOff className="w-6 h-6" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </Button>

                {/* Status Text */}
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    {!selectedPersona
                      ? 'Please select a persona to start'
                      : isProcessing
                      ? 'Processing your message...'
                      : isRecording
                      ? 'Recording... Click to stop'
                      : 'Click to record or type above'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;