import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Question } from "../../utils/ai";

type Step = "GATE" | "ASKING" | "DONE";

export type QAEntry = {
  q: Question;
  answer: string;
  timeTaken: number;
  score: number;
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
  questions: Question[];
  answers: QAEntry[];
  finalScore: number;
  summary?: string;
};

const initialState: SessionState = {
  authed: false,
  profile: null,
  step: "GATE",
  idx: 0,
  questions: [],
  answers: [],
  finalScore: 0,
  summary: undefined,
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    setAuthed(state, action: PayloadAction<boolean>) {
      state.authed = action.payload;
    },
    setProfile(state, action: PayloadAction<Profile>) {
      state.profile = { ...(state.profile || {}), ...action.payload };
    },
    setQuestions(state, action: PayloadAction<Question[]>) {
      state.questions = action.payload || [];
      state.answers = [];
      state.idx = 0;
      state.step = state.questions.length > 0 ? "ASKING" : "GATE";
      state.finalScore = 0;
      state.summary = undefined;
    },
    submitAnswer(state, action: PayloadAction<QAEntry>) {
      state.answers.push(action.payload);

      // advance index
      state.idx = Math.min(state.idx + 1, state.questions.length);

      // if finished
      if (state.idx >= state.questions.length) {
        state.step = "DONE";
      }
    },
    finish(
      state,
      action: PayloadAction<{ finalScore: number; summary?: string }>
    ) {
      state.finalScore = action.payload.finalScore;
      state.summary = action.payload.summary || state.summary;
      state.step = "DONE";
    },
    logout() {
      return { ...initialState };
    },
  },
});

export const {
  setAuthed,
  setProfile,
  setQuestions,
  submitAnswer,
  finish,
  logout,
} = sessionSlice.actions;

export default sessionSlice.reducer;
