// src/components/WelcomeBackModal.tsx
import React, { useEffect } from "react";
import { Modal } from "antd";
import { useSelector } from "react-redux";
import { RootState } from "../store/store";

export default function WelcomeBackModal() {
  const { step, questions, answers } = useSelector(
    (s: RootState) => s.session || {}
  );

  useEffect(() => {
    // Safe guards with ?.
    const qLen = questions?.length || 0;
    const aLen = answers?.length || 0;

    if (step !== "DONE" && (qLen > 0 || aLen > 0)) {
      Modal.info({
        title: "Welcome back",
        content:
          "We restored your previous interview session. You can continue where you left off.",
      });
    }
  }, [step, questions, answers]);

  return null; // modal is shown via side-effect only
}
