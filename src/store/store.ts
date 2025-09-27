// src/store/store.ts
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";

// Slices
import sessionReducer from "./slices/sessionSlice";
import candidatesReducer from "./slices/candidatesSlice";

// --- root reducer ---
const rootReducer = combineReducers({
  session: sessionReducer,
  candidates: candidatesReducer, // <-- IMPORTANT: mount the candidates slice
});

// --- persist config ---
const persistConfig = {
  key: "root",
  storage,
  version: 1,
  whitelist: ["session", "candidates"], // persist both
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// --- store ---
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        // Allow redux-persist non-serializable actions
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
});

// --- persistor ---
export const persistor = persistStore(store);

// --- types ---
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
