import { configureStore } from '@reduxjs/toolkit';
import chatReducer from './slices/chatSlice';
import personaReducer from './slices/personaSlice';

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    persona: personaReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['chat/setCurrentAudio'],
        // Ignore these field paths in all actions
        ignoredActionsPaths: ['payload.audio'],
        // Ignore these paths in the state
        ignoredPaths: ['chat.currentAudio'],
      },
    }),
});

export default store;

// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch; 