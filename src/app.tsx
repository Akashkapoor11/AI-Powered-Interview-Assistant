import React from "react";
import { ConfigProvider, Layout, Tabs, Typography } from "antd";
import InterviewChat from "./component/InterviewChat";
import InterviewerDashboard from "./component/InterviewerDashboard";

const { Header, Content } = Layout;
const { Title } = Typography;

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#7c3aed",   // purple
          colorInfo: "#06b6d4",      // cyan
          colorSuccess: "#22c55e",
          colorWarning: "#f59e0b",
          colorError: "#ef4444",
          borderRadius: 14,
          fontSize: 14,
          colorTextBase: "#e5e7eb",
          colorBgBase: "#0b1220",    // dark base
        },
        components: {
          Card: { colorBgContainer: "rgba(255,255,255,0.06)", borderRadiusLG: 18 },
          Tabs: { titleFontSize: 16 },
          Button: { controlHeight: 38 },
          Input: { controlHeight: 38, colorBgContainer: "rgba(255,255,255,0.08)" },
        },
      }}
    >
      <Layout style={{ minHeight: "100vh" }} className="app-gradient">
        <Header
          style={{
            background: "transparent",
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div className="logo-pulse" />
          <Title level={3} style={{ margin: 0, color: "#fff" }}>
            AI-Powered Interview Assistant
          </Title>
        </Header>

        <Content style={{ maxWidth: 1160, margin: "0 auto", width: "100%", padding: 16 }}>
          <div className="glass-surface">
            <Tabs
              defaultActiveKey="interviewee"
              items={[
                { key: "interviewee", label: "Interviewee (Chat)", children: <InterviewChat /> },
                { key: "interviewer", label: "Interviewer (Dashboard)", children: <InterviewerDashboard /> },
              ]}
            />
          </div>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
