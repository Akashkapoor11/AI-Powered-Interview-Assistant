import React, { useState } from "react";
import { Modal, Input, message } from "antd";
import { useDispatch } from "react-redux";
import { setAuthed } from "../store/slices/sessionSlice";

export default function LoginModal({ open, onClose }: { open: boolean; onClose: ()=>void; }) {
  const [email, setEmail] = useState("");
  const dispatch = useDispatch();

  function submit() {
    if (!/\S+@\S+\.\S+/.test(email)) { message.error("Enter a valid email"); return; }
    dispatch(setAuthed(true));
    message.success("Logged in");
    onClose();
  }

  return (
    <Modal open={open} onCancel={onClose} onOk={submit} title="Login to start interview">
      <p>Enter your email to continue.</p>
      <Input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="your@email.com" />
    </Modal>
  );
}
