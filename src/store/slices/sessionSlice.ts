// src/store/slices/sessionSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { GenQuestion } from "../../utils/ai";

type Step = "IDLE" | "GATE" | "ASKING" | "DONE";

export type QA = {
  q: GenQuestion;
  answer: string;
  timeTaken: number;
  score: number;            // numeric is important
  verdict?: string;
  feedback?: string;
};

export type Profile = {
  name?: string;
  email?: string;
  phone?: string;
  resumeText?: string;
};

type SessionState = {
  authed: boolean;
  profile: Profile | null;
  step: Step;
  idx: number;
  questions: GenQuestion[];
  answers: QA[];
  finalScore: number;
  summary?: string;
};

const initialState: SessionState = {
  authed: false,
  profile: null,
  step: "IDLE",
  idx: 0,
  questions: [],
  answers: [],
  finalScore: 0,
  summary: "",
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    // Log in/out managed elsewhere (e.g., LoginModal); keep it simple here
    setAuthed: (state, action: PayloadAction<boolean>) => {
      state.authed = action.payload;
      if (action.payload && state.step === "IDLE") {
        state.step = "GATE";
      }
    },

    setProfile: (state, action: PayloadAction<Profile>) => {
      state.profile = { ...(state.profile || {}), ...action.payload };
      if (state.authed && state.step === "IDLE") {
        state.step = "GATE";
      }
    },

    setQuestions: (state, action: PayloadAction<GenQuestion[]>) => {
      state.questions = action.payload;
      state.answers = [];
      state.idx = 0;
      state.step = "ASKING";
      state.finalScore = 0;
      state.summary = "";
    },

    submitAnswer: (
      state,
      action: PayloadAction<{
        q: GenQuestion;
        answer: string;
        timeTaken: number;
        score: number;
        verdict?: string;
        feedback?: string;
      }>
    ) => {
      state.answers.push({
        q: action.payload.q,
        answer: action.payload.answer,
        timeTaken: action.payload.timeTaken,
        score: action.payload.score, // must be numeric
        verdict: action.payload.verdict,
        feedback: action.payload.feedback,
      });

      state.idx += 1;

      if (state.idx >= state.questions.length) {
        state.step = "DONE";
      } else {
        state.step = "ASKING";
      }
    },

    finish: (
      state,
      action: PayloadAction<{ finalScore: number; summary: string }>
    ) => {
      // console.log("[FINISH]", action.payload); // helpful while debugging
      state.finalScore = action.payload.finalScore;
      state.summary = action.payload.summary;
    },

    logout: () => initialState,
    reset: () => initialState,
  },
});

export const {
  setAuthed,
  setProfile,
  setQuestions,
  submitAnswer,
  finish,
  logout,
  reset,
} = sessionSlice.actions;

export default sessionSlice.reducer;
