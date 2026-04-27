"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGrace } from "@/components/useGrace";
import WorkspaceShell from "@/components/grace-workspace/WorkspaceShell";
import GreetingState from "@/components/grace-workspace/GreetingState";
import ChatFeed from "@/components/grace-workspace/ChatFeed";
import DockedComposer from "@/components/grace-workspace/DockedComposer";

export default function GraceWorkspaceClient() {
    const {
        messages,
        streamingText,
        isAwaitingReply,
        input,
        setInput,
        send,
        toggleVoice,
        voiceEnabled,
        errorMessage,
        closePanel,
        endConversation,
        conversationActive,
    } = useGrace();

    // Close the side drawer if it was open — workspace owns the screen here.
    useEffect(() => {
        closePanel();
    }, [closePanel]);

    // First name for greeting — keep neutral fallback so we don't hardcode "Claire".
    const greetingName = useMemo(() => "there", []);

    // Has the user actually sent anything in this session yet?
    const hasUserSent = messages.some((m) => m.role === "user");

    // Locally track first send so the transition fires immediately
    // (otherwise we wait for the message to arrive in state).
    const [chatStarted, setChatStarted] = useState(hasUserSent);
    useEffect(() => {
        if (hasUserSent && !chatStarted) setChatStarted(true);
    }, [hasUserSent, chatStarted]);

    const handleSend = (text?: string) => {
        const v = (text ?? input).trim();
        if (!v) return;
        setChatStarted(true);
        send(text);
    };

    const handleNewConversation = () => {
        if (conversationActive) endConversation();
        setChatStarted(false);
        setInput("");
    };

    return (
        <WorkspaceShell onNewConversation={handleNewConversation}>
            <AnimatePresence mode="wait" initial={false}>
                {!chatStarted ? (
                    <motion.div
                        key="greeting"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <GreetingState
                            name={greetingName}
                            input={input}
                            onInputChange={setInput}
                            onSubmit={handleSend}
                            onSkillClick={(q) => handleSend(q)}
                            onToggleVoice={toggleVoice}
                            voiceEnabled={voiceEnabled}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="conversation"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <ChatFeed
                            messages={messages}
                            streamingText={streamingText}
                            isAwaitingReply={isAwaitingReply}
                            errorMessage={errorMessage}
                        />
                        <DockedComposer
                            input={input}
                            onInputChange={setInput}
                            onSubmit={handleSend}
                            onToggleVoice={toggleVoice}
                            voiceEnabled={voiceEnabled}
                            autoFocus
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </WorkspaceShell>
    );
}
