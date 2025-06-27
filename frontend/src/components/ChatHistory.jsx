import React, { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  fetchChatHistory, 
  loadChat, 
  deleteChat, 
  startNewChat 
} from '../store/slices/chatSlice';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageCircle, 
  Trash2, 
  Plus, 
  Clock,
  Loader2
} from "lucide-react";

const ChatHistory = ({ onChatAction }) => {
  const dispatch = useAppDispatch();
  const { 
    chatHistory, 
    currentChatId, 
    isLoadingHistory,
    needsHistoryRefresh 
  } = useAppSelector((state) => state.chat);

  // Load chat history on component mount
  useEffect(() => {
    dispatch(fetchChatHistory());
  }, [dispatch]);

  // Refresh chat history when needed (e.g., after sending messages)
  useEffect(() => {
    if (needsHistoryRefresh) {
      dispatch(fetchChatHistory());
    }
  }, [needsHistoryRefresh, dispatch]);

  const handleLoadChat = useCallback((chatId) => {
    if (chatId !== currentChatId) {
      dispatch(loadChat(chatId));
      // Close mobile menu after loading a chat
      if (onChatAction) {
        onChatAction();
      }
    }
  }, [currentChatId, dispatch, onChatAction]);

  const handleDeleteChat = useCallback(async (chatId, event) => {
    event.stopPropagation(); // Prevent loading the chat when clicking delete
    
    if (confirm('Are you sure you want to delete this chat?')) {
      try {
        await dispatch(deleteChat(chatId)).unwrap();
        // Refresh chat history after successful deletion
        dispatch(fetchChatHistory());
        // Close mobile menu after deleting a chat
        if (onChatAction) {
          onChatAction();
        }
      } catch (error) {
        console.error('Failed to delete chat:', error);
      }
    }
  }, [dispatch, onChatAction]);

  const handleNewChat = useCallback(() => {
    dispatch(startNewChat());
    // Close mobile menu after starting a new chat
    if (onChatAction) {
      onChatAction();
    }
  }, [dispatch, onChatAction]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { 
        weekday: 'short',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Chat History
          </CardTitle>
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNewChat();
            }}
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
          >
            <Plus className="w-3 h-3" />
            New
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 min-h-0 overflow-hidden">
        <ScrollArea className="h-full px-4">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="ml-2 text-xs text-muted-foreground">
                Loading...
              </span>
            </div>
          ) : chatHistory.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-10 h-10 mx-auto mb-4 opacity-50" />
              <p className="text-xs text-muted-foreground">
                No chat history yet
              </p>
              <p className="text-2xs text-muted-foreground mt-2">
                Start a conversation to see it here
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {chatHistory.map((chat) => (
                <div
                  key={chat.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLoadChat(chat.id);
                  }}
                  className={`group p-3 border cursor-pointer transition-all duration-200 hover:shadow-sm ${
                    chat.id === currentChatId
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                      : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xs font-medium truncate">
                          {chat.title || 'Untitled Chat'}
                        </h3>
                        <span className="text-2xs text-muted-foreground bg-gray-100 dark:bg-gray-700 px-2 py-0.5">
                          {chat.messageCount}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(chat.updated_at)}</span>
                        </div>
                        
                        {chat.persona && (
                          <div className="flex items-center gap-1 text-2xs text-muted-foreground bg-blue-50 dark:bg-blue-950 px-2 py-0.5">
                            <span className="text-blue-600 dark:text-blue-400">🎭</span>
                            <span className="text-blue-600 dark:text-blue-400 font-medium truncate max-w-20">
                              {chat.persona.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteChat(chat.id, e);
                      }}
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ChatHistory; 