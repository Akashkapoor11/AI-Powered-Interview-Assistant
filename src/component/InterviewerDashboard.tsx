import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Progress,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  Divider,
} from "antd";
import {
  EyeOutlined,
  DeleteOutlined,
  SaveOutlined,
  FileTextOutlined,
  ExportOutlined,
  SearchOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { addCandidate, removeCandidate } from "../store/slices/candidatesSlice";

const { Title, Text } = Typography;

type AnswerRow = {
  q: { id: string; text: string; difficulty: "EASY" | "MEDIUM" | "HARD"; seconds: number };
  answer: string;
  score: number;
  verdict?: "correct" | "partially_correct" | "incorrect" | "partial";
  feedback?: string;
  timeTaken?: number;
};

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  finalScore: number;
  summary: string;          // make this required to satisfy slice types on Vercel
  createdAt: number;
  answers?: AnswerRow[];
};

function truncate(s: string | undefined, n = 80) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export default function InterviewerDashboard() {
  const dispatch = useDispatch();

  // Current session (not yet saved)
  const session = useSelector((s: RootState) => s.session);
  const { profile, finalScore = 0, summary, answers = [] } = session as any;

  // Live score before DONE
  const liveScore = (answers as AnswerRow[]).reduce((s, a) => s + (a?.score || 0), 0);
  const shownScore = finalScore > 0 ? finalScore : liveScore;

  // Persisted candidates list
  const candidates = useSelector((s: RootState) => (s as any).candidates?.list || []) as Candidate[];

  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const onSave = () => {
    if (!profile?.name || !profile?.email || !profile?.phone) {
      message.warning("Please complete candidate profile on the Interviewee tab first.");
      return;
    }
    const payload: Candidate = {
      id: `${Date.now()}`,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      finalScore: shownScore,           // save the visible score
      summary: summary || "—",          // always a string
      answers: answers as AnswerRow[],
      createdAt: Date.now(),
    };
    // if your slice enforces a stricter type, you can cast: dispatch(addCandidate(payload as any));
    dispatch(addCandidate(payload));
    message.success("Candidate saved to dashboard.");
  };

  const onRemove = (id: string) => {
    dispatch(removeCandidate(id));
    message.success("Candidate removed.");
    if (openId === id) setOpenId(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates.slice().sort((a, b) => b.createdAt - a.createdAt);
    return candidates
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.summary || "").toLowerCase().includes(q)
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [candidates, query]);

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      width: 180,
      sorter: (a: Candidate, b: Candidate) => a.name.localeCompare(b.name),
      render: (v: string) => (
        <Space>
          <UserOutlined />
          <Text strong ellipsis={{ tooltip: v }} style={{ maxWidth: 120, display: "inline-block" }}>
            {v}
          </Text>
        </Space>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      width: 300,
      sorter: (a: Candidate, b: Candidate) => a.email.localeCompare(b.email),
      render: (v: string) => (
        <Space>
          <MailOutlined />
          <a href={`mailto:${v}`} style={{ maxWidth: 240, display: "inline-block" }}>
            <Text ellipsis={{ tooltip: v }}>{v}</Text>
          </a>
        </Space>
      ),
    },
    {
      title: "Phone",
      dataIndex: "phone",
      width: 180,
      sorter: (a: Candidate, b: Candidate) => a.phone.localeCompare(b.phone),
      render: (v: string) => (
        <Space>
          <PhoneOutlined />
          <a href={`tel:${v}`} style={{ maxWidth: 120, display: "inline-block" }}>
            <Text ellipsis={{ tooltip: v }}>{v}</Text>
          </a>
        </Space>
      ),
    },
    {
      title: "Final Score",
      dataIndex: "finalScore",
      width: 140,
      sorter: (a: Candidate, b: Candidate) => a.finalScore - b.finalScore,
      render: (v: number) => (
        <Space>
          <Progress
            type="circle"
            width={36}
            percent={Math.min(100, Math.round((v / 60) * 100))}
            format={() => v}
          />
        </Space>
      ),
    },
    {
      title: "Summary",
      dataIndex: "summary",
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v}>
          <Text>{truncate(v, 90)}</Text>
        </Tooltip>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 200,
      render: (_: any, record: Candidate) => (
        <Space>
          <Tooltip title="View details">
            <Button
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setOpenId(record.id);
              }}
            />
          </Tooltip>
          <Tooltip title="Export JSON">
            <Button
              icon={<ExportOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                const blob = new Blob([JSON.stringify(record, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${record.name.replace(/\s+/g, "_")}_interview.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            />
          </Tooltip>
          <Tooltip title="Remove">
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(record.id);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const currentCard = (
    <Card
      style={{
        borderRadius: 16,
        marginBottom: 16,
        background: "linear-gradient(135deg, #fef3c7, #e0f2fe 40%, #f5f3ff 80%)",
      }}
      bodyStyle={{ padding: 20 }}
    >
      <Space align="start" style={{ width: "100%", justifyContent: "space-between" }}>
        <Space align="start">
          <Progress
            type="dashboard"
            percent={Math.min(100, Math.round(((shownScore || 0) / 60) * 100))}
            format={() => shownScore || 0}
            width={108}
            strokeColor={{ "0%": "#34d399", "100%": "#2563eb" }}
          />
          <div>
            <Title level={5} style={{ margin: 0, color: "rgba(15,23,42,0.95)" }}>
              Current Candidate
            </Title>
            <Text type="secondary" style={{ color: "rgba(15,23,42,0.75)" }}>
              Final Score: <Text strong style={{ color: "rgba(15,23,42,0.95)" }}>{shownScore || 0}</Text> — Click “Save to Dashboard”.
            </Text>
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                <Tag color={profile?.name ? "success" : "warning"}>
                  Name: {profile?.name || "missing"}
                </Tag>
                <Tag color={profile?.email ? "processing" : "warning"}>
                  Email: {profile?.email || "missing"}
                </Tag>
                <Tag color={profile?.phone ? "blue" : "warning"}>
                  Phone: {profile?.phone || "missing"}
                </Tag>
              </Space>
            </div>
          </div>
        </Space>

        <Space>
          <Tooltip title="Save this interview into the Candidates list">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={onSave}
              size="large"
              style={{ fontWeight: 600, boxShadow: "0 8px 18px rgba(37,99,235,.25)" }}
            >
              Save to Dashboard
            </Button>
          </Tooltip>
        </Space>
      </Space>
    </Card>
  );

  const selected = useMemo(
    () => filtered.find((c) => c.id === openId) || null,
    [filtered, openId]
  );

  return (
    <div style={{ padding: 16 }}>
      {currentCard}

      <Card
        title={
          <Space size="large" style={{ width: "100%", justifyContent: "space-between" }}>
            <Space>
              <Title level={5} style={{ margin: 0 }}>
                Candidates
              </Title>
              <Tag>{filtered.length}</Tag>
            </Space>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search by name/email/summary"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: 360 }}
            />
          </Space>
        }
        bodyStyle={{ paddingTop: 0 }}
        style={{
          borderRadius: 16,
          background: "linear-gradient(180deg, #ffffff, #f9fafb)",
        }}
      >
        {filtered.length === 0 ? (
          <Empty
            imageStyle={{ height: 64 }}
            description={
              <span>
                No candidates yet. Go to <Text strong>Interviewee (Chat)</Text> and save one here.
              </span>
            }
          />
        ) : (
          <Table<Candidate>
            rowKey="id"
            columns={columns as any}
            dataSource={filtered}
            pagination={{ pageSize: 6, showSizeChanger: false }}
            onRow={(record) => ({
              onClick: () => setOpenId(record.id),
              style: { cursor: "pointer" },
            })}
            tableLayout="fixed"
            scroll={{ x: 1100 }}
          />
        )}
      </Card>

      {/* Detail Drawer */}
      <Drawer
        width={720}
        title={
          <Space>
            <FileTextOutlined />
            <span>Interview Details</span>
          </Space>
        }
        open={!!openId}
        onClose={() => setOpenId(null)}
      >
        {!selected ? (
          <Empty description="No candidate selected" />
        ) : (
          <>
            <Space size="large" align="start">
              <Progress
                type="dashboard"
                percent={Math.min(100, Math.round((selected.finalScore / 60) * 100))}
                format={() => selected.finalScore}
                width={110}
              />
              <div>
                <Title level={4} style={{ marginBottom: 0 }}>
                  {selected.name}
                </Title>
                <Space direction="vertical" size={2}>
                  <Space>
                    <MailOutlined />
                    <a href={`mailto:${selected.email}`}>{selected.email}</a>
                  </Space>
                  <Space>
                    <PhoneOutlined />
                    <a href={`tel:${selected.phone}`}>{selected.phone}</a>
                  </Space>
                </Space>
              </div>
            </Space>

            <Divider />

            <Title level={5}>Summary</Title>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Text>{selected.summary || "—"}</Text>
            </Card>

            <Title level={5}>Per-question breakdown</Title>
            {(selected.answers || []).map((row, i) => {
              const verdict = (row.verdict || "partial") as
                | "correct"
                | "partially_correct"
                | "incorrect"
                | "partial";
              const color =
                verdict === "correct"
                  ? "green"
                  : verdict === "incorrect"
                  ? "red"
                  : "gold";
              const max =
                row.q.difficulty === "EASY"
                  ? 5
                  : row.q.difficulty === "MEDIUM"
                  ? 10
                  : 15;

              return (
                <Card
                  key={row.q.id || i}
                  size="small"
                  style={{ marginBottom: 12 }}
                  title={
                    <Space>
                      <Tag color={row.q.difficulty === "EASY" ? "blue" : row.q.difficulty === "MEDIUM" ? "purple" : "magenta"}>
                        {row.q.difficulty}
                      </Tag>
                      <Text strong>
                        Q{i + 1}. {row.q.text}
                      </Text>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Tag color={color} style={{ textTransform: "uppercase" }}>
                        {verdict.replace("_", " ")}
                      </Tag>
                      <Tag>
                        Score: <b>{row.score}</b> / {max}
                      </Tag>
                      {typeof row.timeTaken === "number" && <Tag>Time: {row.timeTaken}s</Tag>}
                    </Space>
                  }
                >
                  <div style={{ marginBottom: 6 }}>
                    <Text type="secondary">Answer</Text>
                    <Card style={{ marginTop: 6 }} size="small">
                      <Text>{row.answer || "—"}</Text>
                    </Card>
                  </div>
                  {row.feedback && (
                    <div>
                      <Text type="secondary">AI feedback</Text>
                      <Card style={{ marginTop: 6 }} size="small">
                        <Text>{row.feedback}</Text>
                      </Card>
                    </div>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </Drawer>
    </div>
  );
}
