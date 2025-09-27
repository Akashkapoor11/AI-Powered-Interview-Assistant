// src/component/InterviewChat.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Input,
  message,
  Progress,
  Space,
  Typography,
  Modal,
  Tag,
} from "antd";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import {
  setProfile,
  setQuestions,
  submitAnswer,
  finish,
  logout,
  setAuthed,
} from "../store/slices/sessionSlice";
import {
  extractTextFromPdf,
  extractTextFromDocx,
  extractTextFromImage,
  extractFields,
} from "../utils/resume";
import {
  generateQuestions,
  scoreAnswer,
  summarizeCandidate,
} from "../utils/ai";
import LoginModal from "./LoginModal";

const { Title, Text } = Typography;

/** Small keyword-based backup so interviews continue even if AI scoring fails. */
function localFallbackScore(
  question: { text: string; difficulty: "EASY" | "MEDIUM" | "HARD" },
  answer: string
) {
  const corpus = (question.text + " " + answer).toLowerCase();
  const hits =
    (corpus.includes("react") ? 1 : 0) +
    (corpus.includes("state") ? 1 : 0) +
    (corpus.includes("hook") ? 1 : 0) +
    (corpus.includes("node") ? 1 : 0) +
    (corpus.includes("express") ? 1 : 0) +
    (corpus.includes("api") ? 1 : 0) +
    (corpus.includes("typescript") ? 1 : 0);

  const max =
    question.difficulty === "EASY"
      ? 5
      : question.difficulty === "MEDIUM"
      ? 10
      : 15;

  const points = Math.min(max, Math.round((hits / 4) * max));
  const verdict =
    points >= Math.ceil(max * 0.6)
      ? "correct"
      : points > 0
      ? "partial"
      : "incorrect";
  const feedback =
    points > 0
      ? "Fallback scoring used. Some relevant terms detected."
      : "Fallback scoring used. Could not detect relevant content.";
  return { points, verdict, feedback };
}

export default function InterviewChat() {
  const dispatch = useDispatch();
  const { profile, authed, step, idx, questions, answers } = useSelector(
    (s: RootState) => s.session
  );

  // --------- Welcome back (once per restored session) ----------
  useEffect(() => {
    const hasUnfinished =
      step !== "DONE" &&
      ((questions?.length ?? 0) > 0 || (answers?.length ?? 0) > 0);
    const seen = localStorage.getItem("welcomeSeen") === "1";

    if (hasUnfinished && !seen) {
      Modal.info({
        title: "Welcome back",
        content:
          "We restored your previous interview session. You can continue where you left off.",
        onOk: () => localStorage.setItem("welcomeSeen", "1"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------- Self-heal stale persisted state ----------
  useEffect(() => {
    if (step === "ASKING") {
      const bad =
        !Array.isArray(questions) ||
        questions.length === 0 ||
        idx < 0 ||
        idx >= questions.length;
      if (bad) {
        if (profile?.name || profile?.email || profile?.phone) {
          dispatch(setQuestions(generateQuestions(profile)));
        } else {
          dispatch(logout());
          message.info(
            "Session reset due to stale data. Please upload your resume again."
          );
        }
      }
    }
  }, [step, questions, idx, profile, dispatch]);

  // --------- Upload / login / gating ----------
  const [loginOpen, setLoginOpen] = useState(false);
  const [gateValues, setGateValues] = useState({
    name: "",
    email: "",
    phone: "",
  });

  async function handleUpload(file: File) {
    try {
      const name = file.name.toLowerCase();
      const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
      const isDocx = name.endsWith(".docx");
      const isImg = /\.(png|jpe?g)$/i.test(name);

      message.loading({ content: "Parsing resume…", key: "resume" });

      let text = "";
      if (isPdf) text = await extractTextFromPdf(file);
      else if (isDocx) text = await extractTextFromDocx(file);
      else if (isImg) text = await extractTextFromImage(file);
      else {
        message.error({ content: "Upload PDF, DOCX, JPG or PNG.", key: "resume" });
        return;
      }

      if (!text.trim()) {
        message.warning({
          content: "Could not extract text — please fill or paste details.",
          key: "resume",
        });
        return;
      }

      const fields = extractFields(text);
      dispatch(setProfile({ ...fields, resumeText: text }));
      message.success({ content: "Resume parsed successfully.", key: "resume" });

      setLoginOpen(true);
      setGateValues({
        name: fields.name || "",
        email: fields.email || "",
        phone: fields.phone || "",
      });
    } catch (e) {
      console.error(e);
      message.error({
        content: "Failed to parse resume. Try another file or paste text.",
        key: "resume",
      });
    }
  }

  function gateSatisfied() {
    const p = { ...(profile || {}), ...gateValues };
    return !!(p.name && p.email && p.phone);
  }

  function startInterview() {
    const merged = { ...(profile || {}), ...gateValues };
    dispatch(setProfile(merged));
    dispatch(setQuestions(generateQuestions(merged)));
  }

  // --------- Timers & answering ----------
  const current = questions?.[idx];
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [answer, setAnswer] = useState("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!current) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    setAnswer("");
    setTimeLeft(current.seconds ?? 0);

    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(timerRef.current!);
          timerRef.current = null;
          void autoSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000) as any;

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  async function autoSubmit() {
    if (!current) return;

    try {
      const res = await scoreAnswer(current, answer || "");
      dispatch(
        submitAnswer({
          q: current,
          answer: answer || "",
          timeTaken: Math.max(0, (current.seconds ?? 0) - timeLeft),
          score: Number.isFinite(res.points) ? res.points : 0,
          verdict: res.verdict,
          feedback: res.feedback,
        })
      );
      message.info(`${res.verdict.toUpperCase()}: ${res.feedback}`);
    } catch (err) {
      console.error("autoSubmit error:", err);
      const fb = localFallbackScore(current, answer || "");
      dispatch(
        submitAnswer({
          q: current,
          answer: answer || "",
          timeTaken: Math.max(0, (current.seconds ?? 0) - timeLeft),
          score: fb.points,
          verdict: fb.verdict,
          feedback: fb.feedback,
        })
      );
      message.warning(
        `Using offline scoring — ${fb.verdict.toUpperCase()}: ${fb.feedback}`
      );
    }
  }

  // finalize when done
  useEffect(() => {
    if (step !== "DONE") return;
    (async () => {
      const final = (answers || []).reduce((s, a) => s + (a?.score || 0), 0);
      const sum = await summarizeCandidate(profile || {}, answers || [], final);
      dispatch(finish({ finalScore: final, summary: sum }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // --------- Login/Logout/Reset ----------
  function handleLogout() {
    Modal.confirm({
      title: "Log out?",
      content:
        "This will clear the current session so another person can start a new interview.",
      okText: "Log out",
      okType: "danger",
      onOk: () => {
        dispatch(logout());
        try {
          localStorage.removeItem("persist:root");
          localStorage.removeItem("welcomeSeen");
        } catch {}
        message.success("Logged out. You can upload a new resume and log in.");
      },
    });
  }

  function handleHardReset() {
    Modal.confirm({
      title: "Reset session?",
      content:
        "This clears all saved progress and local data in case something got corrupted.",
      okText: "Reset",
      okType: "danger",
      onOk: () => {
        dispatch(logout());
        try {
          localStorage.removeItem("persist:root");
          localStorage.removeItem("welcomeSeen");
        } catch {}
        message.success("Session reset. Start again by uploading a resume.");
      },
    });
  }

  // --------- UI ----------
  const gateView = (
    <Card style={{ marginTop: 16 }}>
      <Title level={5}>Before we start, tell me your missing details</Title>
      {!profile?.name && (
        <Input
          placeholder="Full Name"
          style={{ marginBottom: 8 }}
          value={gateValues.name}
          onChange={(e) =>
            setGateValues((v) => ({ ...v, name: e.target.value }))
          }
        />
      )}
      {!profile?.email && (
        <Input
          placeholder="Email"
          style={{ marginBottom: 8 }}
          value={gateValues.email}
          onChange={(e) =>
            setGateValues((v) => ({ ...v, email: e.target.value }))
          }
        />
      )}
      {!profile?.phone && (
        <Input
          placeholder="Phone"
          style={{ marginBottom: 8 }}
          value={gateValues.phone}
          onChange={(e) =>
            setGateValues((v) => ({ ...v, phone: e.target.value }))
          }
        />
      )}
      <Space>
        <Button
          type="primary"
          onClick={startInterview}
          disabled={!authed || !gateSatisfied()}
        >
          Start Interview
        </Button>
        {!authed && <Text type="secondary">Please log in first.</Text>}
      </Space>
    </Card>
  );

  const askView = current && (
    <Card style={{ marginTop: 16 }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Text strong>
          Q{Math.min(idx + 1, questions.length)}/{questions.length} (
          {current?.difficulty}) — Time left: {Math.max(0, timeLeft)}s
        </Text>
        <Title level={5} style={{ marginTop: 0 }}>
          {current?.text}
        </Title>
        <Input.TextArea
          rows={6}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <Progress
              percent={
                current?.seconds
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        Math.round(
                          ((current.seconds - Math.max(0, timeLeft)) /
                            current.seconds) *
                            100
                        )
                      )
                    )
                  : 0
              }
            />
          </div>
          <Button type="primary" onClick={autoSubmit}>
            Submit
          </Button>
        </div>
      </Space>
    </Card>
  );

  const doneView = (
    <Card style={{ marginTop: 16 }}>
      <Title level={5}>Interview complete 🎉</Title>
      <Text>
        Switch to the Interviewer tab to see your final score and summary.
      </Text>
    </Card>
  );

  return (
    <div style={{ padding: 16 }}>
      <Card
        style={{
          borderRadius: 16,
          padding: 16,
          background:
            "linear-gradient(135deg, #f0f9ff, #e0f2fe, #f0f9ff, #fdf4ff)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <Space wrap size="middle">
          <input
            type="file"
            accept=".pdf,.docx,.jpg,.jpeg,.png"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.currentTarget.value = ""; // allow re-upload same file
            }}
            style={{ display: "none" }}
            id="resume-input"
          />

          <Button
            type="primary"
            size="large"
            shape="round"
            onClick={() => document.getElementById("resume-input")?.click()}
            style={{
              boxShadow: "0 6px 16px rgba(37, 99, 235, 0.35)",
              fontWeight: 600,
            }}
          >
            Upload Resume (PDF/DOCX/JPG/PNG)
          </Button>

          {!authed ? (
            <Button
              type="primary"
              size="large"
              shape="round"
              onClick={() => setLoginOpen(true)}
              style={{
                background: "#16a34a",
                borderColor: "#16a34a",
                fontWeight: 600,
                boxShadow: "0 6px 16px rgba(22,163,74,.35)",
              }}
            >
              Login
            </Button>
          ) : (
            <Space size="small" wrap>
              <Button
                type="primary"
                danger
                size="large"
                shape="round"
                onClick={handleLogout}
                style={{ fontWeight: 600 }}
              >
                Logout
              </Button>
              <Button
                size="large"
                shape="round"
                onClick={handleHardReset}
                style={{
                  background: "#ffffff",
                  borderColor: "#d0d5dd",
                  color: "#111827",
                  fontWeight: 600,
                  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
                }}
              >
                Reset Session
              </Button>
            </Space>
          )}
        </Space>

        <div
          style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <Tag color={profile?.name ? "success" : "warning"}>
            <b>Name:</b>&nbsp;{profile?.name || "missing"}
          </Tag>
          <Tag color={profile?.email ? "processing" : "warning"}>
            <b>Email:</b>&nbsp;{profile?.email || "missing"}
          </Tag>
          <Tag color={profile?.phone ? "blue" : "warning"}>
            <b>Phone:</b>&nbsp;{profile?.phone || "missing"}
          </Tag>
        </div>
      </Card>

      {step === "GATE" && gateView}
      {step === "ASKING" && askView}
      {step === "DONE" && doneView}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => dispatch(setAuthed(true))}
      />
    </div>
  );
}
