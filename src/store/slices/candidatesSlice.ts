// src/store/slices/candidatesSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type CandidateRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  finalScore: number;
  summary: string;
  // Optional detailed info to show in a drawer later:
  answers?: Array<{
    qid: string;
    question: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    score: number;
    answer: string;
  }>;
};

type CandidatesState = {
  list: CandidateRow[];
};

const initialState: CandidatesState = {
  list: [], // <- IMPORTANT: never undefined
};

const candidatesSlice = createSlice({
  name: "candidates",
  initialState,
  reducers: {
    addCandidate(state, action: PayloadAction<CandidateRow>) {
      // small dedupe by email + score
      const exists = state.list.some(
        (c) => c.email === action.payload.email && c.finalScore === action.payload.finalScore
      );
      if (!exists) state.list.unshift(action.payload);
    },
    removeCandidate(state, action: PayloadAction<string>) {
      state.list = state.list.filter((c) => c.id !== action.payload);
    },
    clearCandidates(state) {
      state.list = [];
    },
  },
});

export const { addCandidate, removeCandidate, clearCandidates } = candidatesSlice.actions;
export default candidatesSlice.reducer;
