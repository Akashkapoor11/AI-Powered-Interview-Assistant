import React, { useState } from "react";
import { Modal, Button, Form, Input, Typography } from "antd";

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  /** Optional hook the parent can use (e.g., to setAuthed(true)) */
  onSuccess?: () => void;
};

const { Text } = Typography;

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [loading, setLoading] = useState(false);

  const onFinish = async (_values: any) => {
    try {
      setLoading(true);
      // fake auth delay
      await new Promise((r) => setTimeout(r, 400));
      onSuccess?.(); // tell parent “login ok”
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Login"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnClose
    >
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: "Please enter your email" },
            { type: "email", message: "Enter a valid email" },
          ]}
        >
          <Input placeholder="you@example.com" />
        </Form.Item>

        <Form.Item
          label="Password"
          name="password"
          rules={[
            { required: true, message: "Please enter your password" },
            { min: 4, message: "At least 4 characters" },
          ]}
        >
          <Input.Password placeholder="••••" />
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={loading}
        >
          Continue
        </Button>

        <div style={{ marginTop: 8 }}>
          <Text type="secondary">Demo login accepts any credentials.</Text>
        </div>
      </Form>
    </Modal>
  );
}
