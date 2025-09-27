// src/utils/ai.ts
/// <reference types="vite/client" />
// Gemini-powered scoring + robust offline fallback with error handling

type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type Question = {
  id: string;
  text: string;
  difficulty: Difficulty;
  seconds: number;
};

export type Scored = {
  points: number; // numeric score (0..5, 0..10, 0..15 based on difficulty)
  verdict: "correct" | "partially_correct" | "incorrect";
  feedback: string;
};

// ------------------------- Config -------------------------

const GEMINI_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
// Only include models your key supports — you confirmed gemini-2.5-flash
const GEMINI_MODELS = ["gemini-2.5-flash"] as const;
const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_KEY}`;

// Cache model status and cooldown to avoid spam
const modelStatus: Record<string, "ok" | "not-found" | "unavailable" | "rate" | "empty"> = {};
let cooldownUntil = 0;

function inCooldown() {
  return Date.now() < cooldownUntil;
}
function setCooldown(minutes = 10) {
  cooldownUntil = Date.now() + minutes * 60 * 1000;
}

// -------------------- Question Generation -----------------

export function generateQuestions(profile?: any): Question[] {
  const easy: Question[] = [
    { id: "q1", text: "What is the virtual DOM in React and why is it useful?", difficulty: "EASY", seconds: 20 },
    { id: "q2", text: "Explain the purpose of useState in React.", difficulty: "EASY", seconds: 20 },
  ];
  const medium: Question[] = [
    {
      id: "q3",
      text: "How does React’s reconciliation work when keys change in a list?",
      difficulty: "MEDIUM",
      seconds: 60,
    },
    {
      id: "q4",
      text: "Describe the difference between REST and GraphQL for a Node/Express backend.",
      difficulty: "MEDIUM",
      seconds: 60,
    },
  ];
  const hard: Question[] = [
    {
      id: "q5",
      text:
        "Design an SSR strategy for a React app that fetches data and hydrates on the client. What pitfalls would you watch for?",
      difficulty: "HARD",
      seconds: 120,
    },
    {
      id: "q6",
      text:
        "Given a high-traffic Node.js service, how would you profile, detect bottlenecks (CPU/I/O), and scale horizontally while keeping sessions consistent?",
      difficulty: "HARD",
      seconds: 120,
    },
  ];
  if (profile?.resumeText && /next\.js|remix|ssr/i.test(profile.resumeText)) {
    hard[0].text =
      "You mentioned SSR in your resume. Outline an SSR setup for React (Next.js or custom Express) including data fetching and caching. Discuss hydration and performance trade-offs.";
  }
  return [...easy, ...medium, ...hard];
}

// ------------------------ Offline Scoring -------------------------

function offlineHeuristicScore(q: Question, answer: string): Scored {
  const clean = (answer || "").toLowerCase().trim();
  const ranges: Record<Difficulty, number> = { EASY: 5, MEDIUM: 10, HARD: 15 };
  const max = ranges[q.difficulty];
  if (!clean) return { points: 0, verdict: "incorrect", feedback: "No answer provided." };

  const topicHints: Record<string, string[]> = {
    virtualDom: ["virtual dom", "reconcile", "diffing", "fiber"],
    useState: ["usestate", "state", "hook"],
    keys: ["key", "reconciliation", "list", "diff"],
    restVsGraphQL: ["rest", "graphql", "overfetching", "underfetching", "schema"],
    ssr: ["ssr", "server-side", "hydrate", "hydration", "cache", "render"],
    nodeScale: ["cluster", "pm2", "load balancer", "sticky", "profil", "cpu", "io", "horizontal", "redis"],
  };

  let bag: string[] = [];
  if (/virtual.*dom/i.test(q.text)) bag = topicHints.virtualDom;
  else if (/usestate/i.test(q.text)) bag = topicHints.useState;
  else if (/reconciliation|keys|list/i.test(q.text)) bag = topicHints.keys;
  else if (/rest.*graphql|graphql.*rest/i.test(q.text)) bag = topicHints.restVsGraphQL;
  else if (/ssr|server.*render/i.test(q.text)) bag = topicHints.ssr;
  else if (/traffic|profile|bottleneck|scale|session/i.test(q.text)) bag = topicHints.nodeScale;

  const matches = bag.filter((k) => clean.includes(k)).length;
  let pts = Math.round(max * (matches / (bag.length || 1)));

  if (clean.split(/\s+/).length > 30) pts = Math.min(max, pts + Math.ceil(max * 0.15));
  if (/my name is|akash|kapoor|phone|email/i.test(clean) && clean.split(/\s+/).length < 8) pts = 0;

  const verdict: Scored["verdict"] =
    pts >= max * 0.8 ? "correct" : pts >= max * 0.35 ? "partially_correct" : "incorrect";
  return {
    points: pts,
    verdict,
    feedback:
      verdict === "correct"
        ? "Good coverage of the key ideas."
        : verdict === "partially_correct"
        ? "Covers some points; could be more precise and complete."
        : "Key concepts were missing or unclear.",
  };
}

// ------------------------ Helpers -------------------------

function extractFirstJsonObject(s: string): any | null {
  try {
    // Try entire string first
    return JSON.parse(s);
  } catch {
    // Fallback: find first {...} block
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

// ------------------------ Gemini Caller -------------------------

async function postToGemini(prompt: string, abortMs = 12000): Promise<string | null> {
  if (!GEMINI_KEY) return null;
  if (inCooldown()) return null;

  for (const model of GEMINI_MODELS) {
    const status = modelStatus[model];
    if (status && status !== "ok") continue;

    const url = GEMINI_URL(model);
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), abortMs);

      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
        }),
      });

      clearTimeout(t);

      if (!res.ok) {
        const body = await res.text();
        if (res.status === 404) {
          modelStatus[model] = "not-found";
          console.warn(`[Gemini] ${model} not found (404). Skipping further calls.`);
          continue;
        }
        if (res.status === 429) {
          modelStatus[model] = "rate";
          console.warn(`[Gemini] Rate limited (429). Falling back offline.`);
          return null;
        }
        if (res.status === 503) {
          modelStatus[model] = "unavailable";
          setCooldown(10);
          console.warn(`[Gemini] Service unavailable (503). Using offline for 10m.`);
          return null;
        }
        console.warn(`[Gemini] HTTP ${res.status} on ${model}. Falling back.`, body.slice(0, 160));
        return null;
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      let text = "";
      if (candidate?.content?.parts?.length) {
        for (const part of candidate.content.parts) {
          if (typeof part?.text === "string") text += part.text;
          if (part?.inlineData?.data) text += String(part.inlineData.data);
        }
      }
      if (!text.trim()) {
        modelStatus[model] = "empty";
        console.warn(`[Gemini] Empty/filtered response from ${model}. Falling back.`);
        continue;
      }
      modelStatus[model] = "ok";
      return text.trim();
    } catch (err: any) {
      if (err?.name === "AbortError") console.warn(`[Gemini] ${model} timed out.`);
      else console.warn(`[Gemini] ${model} network error.`, String(err).slice(0, 120));
      continue;
    }
  }
  return null;
}

// ------------------------ Public API -------------------------

export async function scoreAnswer(q: Question, answer: string): Promise<Scored> {
  if (!answer || !answer.trim())
    return { points: 0, verdict: "incorrect", feedback: "No answer provided." };

  const max: Record<Difficulty, number> = { EASY: 5, MEDIUM: 10, HARD: 15 };

  const prompt = [
    `You are a senior interviewer evaluating a candidate's answer.`,
    `Question: ${q.text}`,
    `Answer: ${answer}`,
    `Difficulty: ${q.difficulty} (max points = ${max[q.difficulty]}).`,
    `Return JSON only: {"points": number, "verdict": "correct"|"partially_correct"|"incorrect", "feedback": string}.`,
    `Rules: be objective, reward correctness/clarity; do not give points for irrelevant personal info; clamp points within range.`,
  ].join("\n");

  try {
    const text = await postToGemini(prompt);
    if (!text) return offlineHeuristicScore(q, answer);

    const parsed = extractFirstJsonObject(text);
    if (!parsed) return offlineHeuristicScore(q, answer);

    const pts = Math.max(0, Math.min(max[q.difficulty], Number(parsed.points ?? 0)));
    const verdict: Scored["verdict"] =
      parsed.verdict === "correct" || parsed.verdict === "partially_correct" ? parsed.verdict : "incorrect";
    const feedback =
      typeof parsed.feedback === "string" && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : "No feedback provided";

    return { points: pts, verdict, feedback };
  } catch {
    return offlineHeuristicScore(q, answer);
  }
}

export async function summarizeCandidate(
  profile: any,
  answers: Array<{ q: Question; answer: string; score: number; verdict?: string }>,
  finalScore: number
): Promise<string> {
  if (!GEMINI_KEY) {
    const name = profile?.name || "Candidate";
    return `${name} achieved a final score of ${finalScore}.`;
  }

  const short = answers
    .map(
      (a, i) =>
        `Q${i + 1} (${a.q.difficulty}): "${a.q.text}" → score ${a.score}/${
          a.q.difficulty === "EASY" ? 5 : a.q.difficulty === "MEDIUM" ? 10 : 15
        }${a.verdict ? ` (${a.verdict})` : ""}`
    )
    .join("\n");

  const prompt = [
    `Summarize the interview for the interviewer.`,
    `Candidate: ${profile?.name || "N/A"}  Email: ${profile?.email || "N/A"}  Phone: ${profile?.phone || "N/A"}`,
    `Final score: ${finalScore}`,
    `Per-question results:\n${short}`,
    `Write 2–3 sentences: strengths, weaknesses, and recommendation.`,
  ].join("\n");

  try {
    const text = await postToGemini(prompt);
    if (!text) return `Final score ${finalScore}. (Offline summary)`;
    return text.trim();
  } catch {
    return `Final score ${finalScore}. (Offline summary)`;
  }
}
