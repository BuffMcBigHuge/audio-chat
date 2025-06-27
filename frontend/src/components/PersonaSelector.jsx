import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectPersona } from '../store/slices/personaSlice';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

const PersonaSelector = ({ onSelect }) => {
  const dispatch = useAppDispatch();
  const { personas, selectedPersona, loading } = useAppSelector((state) => state.persona);

  const handlePersonaSelect = (persona) => {
    dispatch(selectPersona(persona));
    // Call the optional onSelect callback (useful for closing modals)
    if (onSelect) {
      onSelect(persona);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="ml-2 text-xs text-muted-foreground">Loading personas...</span>
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-muted-foreground">No personas available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      {/* Main scrollable content area */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-4">
            {personas.map((persona) => (
              <Button
                key={persona.name}
                variant={selectedPersona?.name === persona.name ? "default" : "outline"}
                className="flex flex-col items-start gap-2 h-auto py-3 px-3 text-left w-full"
                onClick={() => handlePersonaSelect(persona)}
              >
                <div className="flex items-center gap-2 w-full">
                  <Avatar className="w-6 h-6 shrink-0">
                    <AvatarFallback className="text-2xs bg-gradient-to-r from-purple-400 to-blue-400 text-white">
                      {persona.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">{persona.name}</div>
                  </div>
                </div>
                <div className="text-2xs text-muted-foreground line-clamp-2 w-full text-left">
                  {persona.tone}
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>
      
      {/* Fixed selected persona footer */}
      {selectedPersona && (
        <div className="flex-shrink-0 mt-4 p-3 bg-muted/50 border">
          <h4 className="font-medium text-2xs mb-2 text-muted-foreground uppercase tracking-wide">Selected Persona</h4>
          <div className="flex items-center gap-2">
            <Avatar className="w-5 h-5 shrink-0">
              <AvatarFallback className="text-2xs bg-gradient-to-r from-purple-400 to-blue-400 text-white">
                {selectedPersona.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-xs truncate">{selectedPersona.name}</p>
              <p className="text-2xs text-muted-foreground line-clamp-1">
                {selectedPersona.tone}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonaSelector; 