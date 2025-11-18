"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  callLeads as initialLeads,
  CallLead,
  CallScriptStep,
} from "@/data/leads";
import {
  CalendarDays,
  CheckCircle2,
  CircleOff,
  Clock,
  Lightbulb,
  NotebookPen,
  PauseCircle,
  PhoneCall,
  PlayCircle,
  Sparkles,
  Target,
} from "lucide-react";

type CallState = "idle" | "dialing" | "active" | "wrap-up";

type ConversationEntry = {
  id: string;
  speaker: "agent" | "lead" | "system";
  text: string;
  timestamp: number;
};

type FollowUpTask = {
  id: string;
  label: string;
  done: boolean;
};

type LeadRuntime = {
  conversation: ConversationEntry[];
  notes: string;
  wrapSummary: string;
  tasks: FollowUpTask[];
  scriptCursor: number;
};

const classNames = (...values: (string | undefined | null | false)[]) =>
  values.filter(Boolean).join(" ");

const buildInitialRuntime = (lead: CallLead): LeadRuntime => ({
  conversation: [
    {
      id: `${lead.id}-prep`,
      speaker: "system",
      text: `Prepared to connect with ${lead.name} (${lead.company}).`,
      timestamp: Date.now(),
    },
  ],
  notes: lead.notes.join("\n"),
  wrapSummary: "",
  tasks: [
    ...lead.objectives.map((objective, index) => ({
      id: `${lead.id}-objective-${index}`,
      label: objective,
      done: false,
    })),
    ...lead.preparation.map((prep, index) => ({
      id: `${lead.id}-prep-${index}`,
      label: prep,
      done: true,
    })),
  ],
  scriptCursor: 0,
});

const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

export default function Home() {
  const [leads, setLeads] = useState<CallLead[]>(() =>
    initialLeads.map((lead) => ({ ...lead })),
  );
  const [leadRuntime, setLeadRuntime] = useState<Record<string, LeadRuntime>>(
    () =>
      Object.fromEntries(
        initialLeads.map((lead) => [lead.id, buildInitialRuntime(lead)]),
      ),
  );
  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    initialLeads[0].id,
  );
  const [callState, setCallState] = useState<CallState>("idle");
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId)!,
    [leads, selectedLeadId],
  );

  const runtime = leadRuntime[selectedLeadId];

  const appendConversation = useCallback(
    (leadId: string, entries: ConversationEntry[]) => {
      setLeadRuntime((prev) => ({
        ...prev,
        [leadId]: {
          ...prev[leadId],
          conversation: [...prev[leadId].conversation, ...entries],
        },
      }));
    },
    [],
  );

  const advanceScript = useCallback(
    (leadId: string, auto = false) => {
      setLeadRuntime((prev) => {
        const lead = leads.find((item) => item.id === leadId);
        if (!lead) {
          return prev;
        }
        const current = prev[leadId];
        const step = lead.callScript[current.scriptCursor];
        if (!step) {
          return prev;
        }

        const agentEntry: ConversationEntry = {
          id: `${leadId}-agent-${step.id}-${current.scriptCursor}`,
          speaker: "agent",
          text: step.agentPrompt,
          timestamp: Date.now(),
        };
        const customerEntry: ConversationEntry = {
          id: `${leadId}-lead-${step.id}-${current.scriptCursor}`,
          speaker: "lead",
          text:
            step.customerSignals[current.scriptCursor % step.customerSignals.length] ??
            step.customerSignals[0] ??
            "Sounds good, please continue.",
          timestamp: Date.now() + 400,
        };

        return {
          ...prev,
          [leadId]: {
            ...current,
            conversation: [...current.conversation, agentEntry, customerEntry],
            scriptCursor: Math.min(
              current.scriptCursor + 1,
              lead.callScript.length,
            ),
            wrapSummary:
              auto && current.wrapSummary.length
                ? current.wrapSummary
                : current.wrapSummary,
          },
        };
      });
    },
    [leads],
  );

  useEffect(() => {
    if (callState === "active" && callStartTime) {
      const interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - callStartTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [callState, callStartTime]);

  useEffect(() => {
    if (callState !== "dialing") {
      return undefined;
    }
    const timeout = setTimeout(() => {
      setCallState("active");
      setCallStartTime(Date.now());
      setElapsedSeconds(0);
      appendConversation(selectedLeadId, [
        {
          id: `${selectedLeadId}-connected`,
          speaker: "system",
          text: `Connected with ${selectedLead.name}.`,
          timestamp: Date.now(),
        },
      ]);
    }, 1400);

    return () => clearTimeout(timeout);
  }, [appendConversation, callState, selectedLead.name, selectedLeadId]);

  useEffect(() => {
    if (!autoAdvance || callState !== "active") {
      return undefined;
    }

    const interval = setInterval(() => {
      advanceScript(selectedLeadId, true);
    }, 6000);

    return () => clearInterval(interval);
  }, [advanceScript, autoAdvance, callState, selectedLeadId]);

  const resetCallSession = useCallback(() => {
    setCallState("idle");
    setCallStartTime(null);
    setElapsedSeconds(0);
    setAutoAdvance(true);
    setIsSpeaking(false);
  }, []);

  const handleSelectLead = useCallback(
    (leadId: string) => {
      if (leadId === selectedLeadId) {
        return;
      }
      resetCallSession();
      setSelectedLeadId(leadId);
    },
    [resetCallSession, selectedLeadId],
  );

  const handleStartCall = useCallback(() => {
    if (callState === "active" || callState === "dialing") {
      return;
    }
    setCallState("dialing");
    appendConversation(selectedLeadId, [
      {
        id: `${selectedLeadId}-dialing`,
        speaker: "system",
        text: `Dialing ${selectedLead.name}...`,
        timestamp: Date.now(),
      },
    ]);
  }, [appendConversation, callState, selectedLead.name, selectedLeadId]);

  const handlePauseCall = useCallback(() => {
    if (callState !== "active") {
      return;
    }
    setCallState("wrap-up");
    setCallStartTime(null);
    appendConversation(selectedLeadId, [
      {
        id: `${selectedLeadId}-paused`,
        speaker: "system",
        text: "Call placed on hold for wrap-up.",
        timestamp: Date.now(),
      },
    ]);
  }, [appendConversation, callState, selectedLeadId]);

  const handleResetCall = useCallback(() => {
    resetCallSession();
    setLeadRuntime((prev) => ({
      ...prev,
      [selectedLeadId]: {
        ...buildInitialRuntime(selectedLead),
        notes: prev[selectedLeadId].notes,
        wrapSummary: "",
      },
    }));
  }, [resetCallSession, selectedLead, selectedLeadId]);

  const toggleTask = useCallback((leadId: string, taskId: string) => {
    setLeadRuntime((prev) => ({
      ...prev,
      [leadId]: {
        ...prev[leadId],
        tasks: prev[leadId].tasks.map((task) =>
          task.id === taskId ? { ...task, done: !task.done } : task,
        ),
      },
    }));
  }, []);

  const handlePersistNotes = useCallback(
    (value: string) => {
      setLeadRuntime((prev) => ({
        ...prev,
        [selectedLeadId]: {
          ...prev[selectedLeadId],
          notes: value,
        },
      }));
    },
    [selectedLeadId],
  );

  const handleWrapSummaryChange = useCallback(
    (value: string) => {
      setLeadRuntime((prev) => ({
        ...prev,
        [selectedLeadId]: {
          ...prev[selectedLeadId],
          wrapSummary: value,
        },
      }));
    },
    [selectedLeadId],
  );

  const handleCompleteWrapUp = useCallback(() => {
    if (!runtime.wrapSummary.trim()) {
      return;
    }
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === selectedLeadId
          ? { ...lead, status: "completed", nextAction: "Call completed" }
          : lead,
      ),
    );
    appendConversation(selectedLeadId, [
      {
        id: `${selectedLeadId}-wrap-up`,
        speaker: "system",
        text: "Wrap-up saved and contact marked as completed.",
        timestamp: Date.now(),
      },
    ]);
    resetCallSession();
  }, [appendConversation, resetCallSession, runtime.wrapSummary, selectedLeadId]);

  const handleManualLog = useCallback(
    (speaker: ConversationEntry["speaker"], text: string) => {
      if (!text.trim()) {
        return;
      }
      appendConversation(selectedLeadId, [
        {
          id: `${selectedLeadId}-manual-${Date.now()}`,
          speaker,
          text,
          timestamp: Date.now(),
        },
      ]);
    },
    [appendConversation, selectedLeadId],
  );

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  const callProgress = useMemo(() => {
    if (!selectedLead.callScript.length) {
      return 0;
    }
    return Math.round(
      (runtime.scriptCursor / selectedLead.callScript.length) * 100,
    );
  }, [runtime.scriptCursor, selectedLead.callScript.length]);

  const activeStep: CallScriptStep | undefined =
    selectedLead.callScript[runtime.scriptCursor] ??
    selectedLead.callScript[selectedLead.callScript.length - 1];

  const upcomingSteps = selectedLead.callScript.slice(runtime.scriptCursor);

  const conversationTimeline = runtime.conversation.slice(-14).reverse();

  return (
    <div className="min-h-screen bg-stone-950">
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 text-stone-100">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-stone-800 bg-gradient-to-br from-stone-900/90 to-stone-950/90 px-8 py-6 backdrop-blur">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-stone-400">
              Helios Calling Agent
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50">
              Agent Control Tower
            </h1>
            <p className="mt-3 max-w-xl text-sm text-stone-400">
              Orchestrate outbound conversations with guided scripts, live
              context, and instant wrap-up automation. You&apos;re currently
              focused on{" "}
              <span className="font-semibold text-stone-100">
                {selectedLead.name}
              </span>{" "}
              from {selectedLead.company}.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-stone-800 bg-stone-900/80 px-5 py-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                Call state
              </p>
              <p
                className={classNames(
                  "mt-1 inline-flex items-center gap-2 text-sm font-medium",
                  callState === "active" && "text-emerald-400",
                  callState === "dialing" && "text-sky-400",
                  callState === "wrap-up" && "text-amber-400",
                )}
              >
                <span className="flex h-2.5 w-2.5 rounded-full bg-current" />
                {callState.toUpperCase()}
              </p>
            </div>
            <div className="h-10 w-px bg-stone-800" />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                Call clock
              </p>
              <p className="mt-1 text-lg font-mono tabular-nums text-stone-100">
                {formatDuration(elapsedSeconds)}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[320px_1fr_320px]">
          <aside className="flex flex-col gap-4">
            <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-300">
                  Call queue
                </h2>
                <Clock className="h-4 w-4 text-stone-500" />
              </div>
              <div className="mt-4 space-y-3">
                {leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => handleSelectLead(lead.id)}
                    className={classNames(
                      "w-full rounded-2xl border px-4 py-3 text-left transition",
                      selectedLeadId === lead.id
                        ? "border-emerald-400/70 bg-emerald-950/40 text-emerald-100"
                        : "border-stone-800 bg-stone-950/40 hover:border-stone-700 hover:bg-stone-900/60",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{lead.name}</p>
                      <span
                        className={classNames(
                          "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]",
                          lead.status === "new" && "bg-sky-500/10 text-sky-300",
                          lead.status === "in-progress" &&
                            "bg-amber-500/10 text-amber-300",
                          lead.status === "follow-up" &&
                            "bg-purple-500/10 text-purple-300",
                          lead.status === "completed" &&
                            "bg-emerald-500/10 text-emerald-300",
                        )}
                      >
                        {lead.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-400">
                      {lead.company} · {lead.title}
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      Next: {lead.nextAction}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-300">
                  Agent boost
                </h2>
                <Sparkles className="h-4 w-4 text-stone-500" />
              </div>
              <ul className="mt-4 space-y-3 text-xs text-stone-400">
                <li>
                  • Mirror back the customer&apos;s phrasing to build rapport.
                </li>
                <li>
                  • Anchor every benefit with a metric or stakeholder outcome.
                </li>
                <li>• Confirm next steps twice: once verbally, once via email.</li>
                <li>
                  • Leave the call with a calendar invite or shared resource link.
                </li>
              </ul>
            </div>
          </aside>

          <section className="flex flex-col gap-4">
            <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                    Active contact
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-stone-100">
                    {selectedLead.name}
                  </h2>
                  <p className="text-sm text-stone-400">
                    {selectedLead.title} · {selectedLead.company}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleStartCall}
                    className={classNames(
                      "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                      callState === "active"
                        ? "border-emerald-500/40 bg-emerald-600/10 text-emerald-300"
                        : "border-emerald-500/50 bg-emerald-600 text-emerald-50 hover:bg-emerald-500",
                    )}
                  >
                    <PhoneCall className="h-4 w-4" />
                    {callState === "active" ? "Connected" : "Start Call"}
                  </button>
                  <button
                    type="button"
                    onClick={
                      callState === "active" ? handlePauseCall : handleResetCall
                    }
                    className="flex items-center gap-2 rounded-full border border-stone-700 px-4 py-2 text-sm text-stone-300 transition hover:border-stone-500 hover:bg-stone-800/60"
                  >
                    {callState === "active" ? (
                      <>
                        <PauseCircle className="h-4 w-4" />
                        Pause & Wrap
                      </>
                    ) : (
                      <>
                        <CircleOff className="h-4 w-4" />
                        Reset Session
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-stone-500">
                    <span>Call momentum</span>
                    <span>{callProgress}%</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-stone-800">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-purple-500 transition-all"
                      style={{ width: `${callProgress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-stone-400">
                    Progress through scripted milestones.
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-stone-500">
                    <span>Confidence</span>
                    <span>
                      {Math.round(
                        (selectedLead.confidence + callProgress / 100) * 50,
                      )}
                      %
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-stone-200">
                    {selectedLead.lastOutcome}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">
                    Focus on closing the loop with decisive next steps.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-3xl border border-stone-800 bg-stone-900/50 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-300">
                    Guided script
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-stone-400">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoAdvance}
                        onChange={() => setAutoAdvance((prev) => !prev)}
                        className="h-3.5 w-3.5 rounded border border-stone-600 bg-stone-900 accent-emerald-500"
                      />
                      Auto-advance
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        activeStep &&
                        speak(`${activeStep.title}. ${activeStep.agentPrompt}`)
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-stone-700 px-3 py-1.5 transition hover:border-emerald-500 hover:text-emerald-300"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      {isSpeaking ? "Speaking" : "Voice cue"}
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  {upcomingSteps.length === 0 ? (
                    <p className="rounded-2xl border border-emerald-500/30 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">
                      Script complete—transition to wrap-up.
                    </p>
                  ) : (
                    upcomingSteps.map((step, index) => (
                      <div
                        key={step.id}
                        className={classNames(
                          "rounded-2xl border px-4 py-3",
                          index === 0
                            ? "border-emerald-500/40 bg-emerald-900/20"
                            : "border-stone-800 bg-stone-950/40",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.25em] text-stone-500">
                            Step {runtime.scriptCursor + index + 1}
                          </p>
                          <span className="text-xs text-stone-500">
                            {step.title}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-stone-100">
                          {step.agentPrompt}
                        </p>
                        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-stone-500">
                          Listen for
                        </p>
                        <ul className="mt-1 space-y-1 text-xs text-stone-400">
                          {step.customerSignals.map((signal) => (
                            <li key={signal}>• {signal}</li>
                          ))}
                        </ul>
                        {index === 0 && (
                          <button
                            type="button"
                            onClick={() => advanceScript(selectedLeadId)}
                            className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-50 transition hover:bg-emerald-500"
                          >
                            <PlayCircle className="h-3 w-3" />
                            Push to log
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="flex h-full flex-col rounded-3xl border border-stone-800 bg-stone-900/50">
                <div className="flex items-center justify-between border-b border-stone-800 px-6 py-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-300">
                    Conversation journal
                  </h3>
                  <NotebookPen className="h-4 w-4 text-stone-500" />
                </div>
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
                  {conversationTimeline.map((entry) => (
                    <div
                      key={entry.id}
                      className={classNames(
                        "rounded-2xl border px-4 py-3 text-sm",
                        entry.speaker === "agent" &&
                          "border-emerald-500/30 bg-emerald-900/10 text-emerald-100",
                        entry.speaker === "lead" &&
                          "border-sky-500/30 bg-sky-900/10 text-sky-100",
                        entry.speaker === "system" &&
                          "border-stone-800 bg-stone-950/50 text-stone-400",
                      )}
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-stone-500">
                        <span>{entry.speaker}</span>
                        <span>{formatTime(entry.timestamp)}</span>
                      </div>
                      <p className="mt-1 text-sm">{entry.text}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 border-t border-stone-800 px-6 py-4 text-xs text-stone-400">
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      const formData = new FormData(form);
                      const speaker = formData.get("speaker") as
                        | ConversationEntry["speaker"]
                        | null;
                      const message = (formData.get("message") as string) ?? "";
                      handleManualLog(speaker ?? "agent", message);
                      form.reset();
                    }}
                  >
                    <div className="grid grid-cols-[140px_1fr] gap-2">
                      <select
                        name="speaker"
                        className="rounded-full border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200"
                        defaultValue="agent"
                      >
                        <option value="agent">Agent utterance</option>
                        <option value="lead">Lead utterance</option>
                        <option value="system">System note</option>
                      </select>
                      <input
                        name="message"
                        placeholder="Add quick transcript note..."
                        className="rounded-full border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-200 placeholder:text-stone-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-50 transition hover:bg-emerald-500"
                    >
                      Append note
                    </button>
                  </form>
                </div>
              </article>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-3xl border border-stone-800 bg-stone-900/60 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-300">
                    Follow-up tasks
                  </h3>
                  <CheckCircle2 className="h-4 w-4 text-stone-500" />
                </div>
                <ul className="mt-4 space-y-2">
                  {runtime.tasks.map((task) => (
                    <li key={task.id}>
                      <label
                        className={classNames(
                          "flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm transition",
                          task.done
                            ? "border-emerald-500/40 bg-emerald-900/20 text-emerald-100"
                            : "border-stone-800 bg-stone-950/50 text-stone-200 hover:border-stone-700",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={() => toggleTask(selectedLeadId, task.id)}
                            className="h-4 w-4 rounded border border-stone-600 bg-stone-950 accent-emerald-500"
                          />
                          <span>{task.label}</span>
                        </div>
                        {task.done && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-3xl border border-stone-800 bg-stone-900/60 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-300">
                    Wrap-up composer
                  </h3>
                  <Lightbulb className="h-4 w-4 text-stone-500" />
                </div>
                <textarea
                  value={runtime.wrapSummary}
                  onChange={(event) => handleWrapSummaryChange(event.target.value)}
                  placeholder="Capture outcomes, commitments, and follow-ups..."
                  className="mt-4 h-32 w-full resize-none rounded-2xl border border-stone-800 bg-stone-950/60 px-4 py-3 text-sm text-stone-200 placeholder:text-stone-500 focus:border-emerald-500 focus:outline-none"
                />
                <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                  <p>
                    Recommended next step:{" "}
                    <span className="text-stone-200">{selectedLead.nextAction}</span>
                  </p>
                  <button
                    type="button"
                    onClick={handleCompleteWrapUp}
                    className={classNames(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] transition",
                      runtime.wrapSummary.trim()
                        ? "border-emerald-500/50 bg-emerald-600 text-emerald-50 hover:bg-emerald-500"
                        : "cursor-not-allowed border-stone-700 bg-stone-800/70 text-stone-500",
                    )}
                  >
                    <Target className="h-3 w-3" />
                    Mark complete
                  </button>
                </div>
              </article>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-300">
                  Contact dossier
                </h3>
                <CalendarDays className="h-4 w-4 text-stone-500" />
              </div>
              <div className="mt-4 space-y-4 text-xs text-stone-400">
                <div>
                  <p className="text-stone-500">Phone</p>
                  <p className="text-sm text-stone-200">{selectedLead.phone}</p>
                </div>
                <div>
                  <p className="text-stone-500">Email</p>
                  <p className="text-sm text-stone-200">{selectedLead.email}</p>
                </div>
                <div>
                  <p className="text-stone-500">Timezone</p>
                  <p className="text-sm text-stone-200">{selectedLead.timezone}</p>
                </div>
                <div>
                  <p className="text-stone-500">Tags</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedLead.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-stone-700 bg-stone-950/40 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-stone-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-300">
                  Intelligence insights
                </h3>
                <Sparkles className="h-4 w-4 text-stone-500" />
              </div>
              <div className="mt-4 space-y-3 text-xs text-stone-400">
                <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
                    Signal boost
                  </p>
                  <p className="mt-2 text-sm text-stone-200">
                    Leverage the customer&apos;s {selectedLead.tags[0]} priority to
                    anchor your ROI framing.
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
                    Momentum
                  </p>
                  <p className="mt-2 text-sm text-stone-200">
                    While {selectedLead.name.split(" ")[0]} evaluates, share a
                    written summary with their stakeholders before end-of-day.
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
                    Wrap-up cue
                  </p>
                  <p className="mt-2 text-sm text-stone-200">
                    Highlight how today&apos;s commitments ladder into
                    {" "}
                    {selectedLead.nextAction.toLowerCase()}.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-300">
                  Notes & references
                </h3>
                <NotebookPen className="h-4 w-4 text-stone-500" />
              </div>
              <textarea
                value={runtime.notes}
                onChange={(event) => handlePersistNotes(event.target.value)}
                placeholder="Drop helpful context here..."
                className="mt-4 h-40 w-full resize-none rounded-2xl border border-stone-800 bg-stone-950/60 px-4 py-3 text-sm text-stone-200 placeholder:text-stone-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
