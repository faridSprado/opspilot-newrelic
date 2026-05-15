"use client";

import {
  Download,
  FilePlus2,
  Pencil,
  RefreshCw,
  SendHorizontal,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPostAllowFalse,
} from "@/lib/api";
import type {
  ChatResponse,
  ChatSessionSummary,
  StoredChatMessage,
} from "@/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatMessage } from "@/components/chat-message";
import { ChartCard } from "@/components/chart-card";
import { SuggestedPrompts } from "@/components/suggested-prompts";
import { ToolTrace } from "@/components/tool-trace";
import { ChatApmSelector } from "@/components/chat-apm-selector";
import { cn } from "@/lib/utils";

const defaultPrompts = [
  "Lista mis APMs",
  "Grafica throughput y response time",
  "Dame endpoints más lentos con p95 y p99",
  "Busca errores recientes por clase",
  "Analiza el impacto del último deploy",
];

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: ChatResponse;
  createdAt?: string;
};

type SessionListResponse = { ok: boolean; sessions: ChatSessionSummary[] };
type SessionDetailResponse = {
  ok: boolean;
  session: ChatSessionSummary;
  messages: StoredChatMessage[];
};
type SessionMutationResponse = { ok: boolean; session: ChatSessionSummary };

function messageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isChatResponse(value: unknown): value is ChatResponse {
  return Boolean(
    value &&
    typeof value === "object" &&
    "session_id" in value &&
    "answer" in value,
  );
}

function fromStoredMessage(message: StoredChatMessage): Message | null {
  if (message.role !== "user" && message.role !== "assistant") return null;
  const response =
    message.role === "assistant" && isChatResponse(message.metadata)
      ? message.metadata
      : undefined;
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    response,
    createdAt: message.created_at,
  };
}

function safeFileName(value: string) {
  return (
    (value || "chat-opspilot")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "chat-opspilot"
  );
}

export function ChatPanel() {
  const router = useRouter();
  const consumedPrompt = useRef<string | null>(null);
  const chatPrintRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessionTitle, setSessionTitle] = useState("Nueva conversación");
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const {
    accountId,
    selectedEntity,
    timeRange,
    timeRangeSelection,
    setSelectedEntity,
    setAccountId,
  } = useWorkspaceStore();

  async function refreshSessions() {
    setSessionsLoading(true);
    try {
      const response = await apiGet<SessionListResponse>("/api/chat/sessions");
      setSessions(response.sessions ?? []);
    } catch {
      // La lista de chats no debe bloquear el uso del copiloto.
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadSession(id: string) {
    try {
      const response = await apiGet<SessionDetailResponse>(
        `/api/chat/sessions/${id}`,
      );
      setSessionId(response.session.id);
      setSessionTitle(response.session.title || "Conversación");
      setMessages(
        response.messages
          .map(fromStoredMessage)
          .filter((item): item is Message => Boolean(item)),
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function startNewChat() {
    try {
      const response = await apiPost<SessionMutationResponse>(
        "/api/chat/sessions",
        {
          title: "Nueva conversación",
          selected_entity_guid:
            useWorkspaceStore.getState().selectedEntity?.guid,
        },
      );
      setSessionId(response.session.id);
      setSessionTitle(response.session.title || "Nueva conversación");
      setMessages([]);
      setInput("");
      await refreshSessions();
      toast.success("Nueva conversación lista.");
    } catch {
      setSessionId(undefined);
      setSessionTitle("Nueva conversación");
      setMessages([]);
      setInput("");
    }
  }

  async function renameSession(id: string, currentTitle: string) {
    const title = window.prompt(
      "Nuevo nombre para esta conversación",
      currentTitle || "Nueva conversación",
    );
    if (!title?.trim()) return;
    try {
      const response = await apiPatch<SessionMutationResponse>(
        `/api/chat/sessions/${id}`,
        { title: title.trim() },
      );
      if (sessionId === id) setSessionTitle(response.session.title);
      await refreshSessions();
      toast.success("Conversación renombrada.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function clearCurrentChat() {
    if (!messages.length) return;
    if (!window.confirm("¿Limpiar los mensajes de esta conversación?")) return;
    if (sessionId) {
      try {
        await apiDelete<{ ok: boolean }>(
          `/api/chat/sessions/${sessionId}/messages`,
        );
        await refreshSessions();
      } catch (error) {
        toast.error((error as Error).message);
        return;
      }
    }
    setMessages([]);
    toast.success("Chat limpiado.");
  }

  async function deleteSession(id: string) {
    if (
      !window.confirm(
        "¿Eliminar esta conversación? Esta acción no se puede deshacer.",
      )
    )
      return;
    try {
      await apiDelete<{ ok: boolean }>(`/api/chat/sessions/${id}`);
      if (sessionId === id) {
        setSessionId(undefined);
        setSessionTitle("Nueva conversación");
        setMessages([]);
      }
      await refreshSessions();
      toast.success("Conversación eliminada.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  function exportCurrentChat() {
    if (!messages.length) {
      toast.info("No hay mensajes para exportar todavía.");
      return;
    }

    const exportArea = chatPrintRef.current;
    if (!exportArea) {
      toast.error("No encontré el contenido del chat para exportar.");
      return;
    }

    const details = Array.from(exportArea.querySelectorAll("details"));
    const previousOpenState = details.map((item) => item.open);
    const previousTitle = document.title;
    document.title = safeFileName(sessionTitle || "chat-opspilot");
    details.forEach((item) => {
      item.open = true;
    });

    toast.info(
      "Se abrirá la ventana de impresión. Elige “Guardar como PDF” para exportar el chat completo.",
    );
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        details.forEach((item, index) => {
          item.open = previousOpenState[index];
        });
        document.title = previousTitle;
      }, 500);
    }, 100);
  }

  async function submit(prompt: string) {
    if (!prompt.trim()) return;
    const workspace = useWorkspaceStore.getState();
    const activeTimeRange = workspace.refreshEffectiveTimeRange();
    const activeAccountId = workspace.accountId;
    const activeEntity = workspace.selectedEntity;

    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: messageId(), role: "user", content: prompt },
    ]);
    try {
      const response = await apiPostAllowFalse<ChatResponse>("/api/chat", {
        message: prompt,
        session_id: sessionId,
        account_id: activeAccountId,
        entity_guid: activeEntity?.guid,
        entity_name: activeEntity?.name,
        transaction_event_type:
          activeEntity?.transaction_event_type ?? "Transaction",
        transaction_name_attribute:
          activeEntity?.transaction_name_attribute ?? "name",
        time_range: activeTimeRange,
      });
      setSessionId(response.session_id);
      const autoTitle = prompt.trim().slice(0, 80) || "Nueva conversación";
      if (sessionTitle === "Nueva conversación") {
        setSessionTitle(autoTitle);
        void apiPatch<SessionMutationResponse>(
          `/api/chat/sessions/${response.session_id}`,
          { title: autoTitle },
        )
          .catch(() => undefined)
          .finally(() => void refreshSessions());
      } else {
        void refreshSessions();
      }
      setMessages((prev) => [
        ...prev,
        {
          id: messageId(),
          role: "assistant",
          content: response.answer,
          response,
        },
      ]);
      if (response.ok === false)
        toast.warning(
          response.answer || "New Relic no devolvió datos para la consulta.",
        );
    } catch (error) {
      const message = (error as Error).message;
      toast.error(message);
      setMessages((prev) => [
        ...prev,
        { id: messageId(), role: "assistant", content: message },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshSessions();
  }, []);

  useEffect(() => {
    const prompt = new URLSearchParams(window.location.search).get("prompt");
    if (!prompt || consumedPrompt.current === prompt) return;
    consumedPrompt.current = prompt;
    void submit(prompt);
    router.replace("/app/chat");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const prompt = input;
    setInput("");
    void submit(prompt);
  }

  const activeSuggestions = useMemo(() => {
    const latest = [...messages]
      .reverse()
      .find((message) => message.response?.suggestions?.length);
    return latest?.response?.suggestions?.length
      ? latest.response.suggestions
      : defaultPrompts;
  }, [messages]);

  return (
    <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="flex max-h-[calc(100vh-9rem)] flex-col overflow-hidden">
        <div className="border-b border-white/10 p-4 dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300 dark:text-emerald-300">
                Chats
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Historial local del backend
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void refreshSessions()}
              aria-label="Actualizar conversaciones"
            >
              <RefreshCw
                className={cn("h-4 w-4", sessionsLoading && "animate-spin")}
              />
            </Button>
          </div>
          <Button
            className="mt-4 w-full"
            variant="primary"
            onClick={() => void startNewChat()}
          >
            <FilePlus2 className="h-4 w-4" /> Nuevo chat
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
          {!sessions.length && (
            <p className="rounded-2xl border border-white/10 bg-white/[.03] p-3 text-xs text-slate-400 dark:text-slate-400">
              Aún no hay conversaciones guardadas.
            </p>
          )}
          {sessions.map((session) => {
            const active = session.id === sessionId;
            return (
              <div
                key={session.id}
                className={cn(
                  "group rounded-2xl border p-3 transition",
                  active
                    ? "border-emerald-300/40 bg-emerald-300/[.08]"
                    : "border-white/10 bg-white/[.03] hover:border-emerald-300/25 hover:bg-white/[.05]",
                )}
              >
                <button
                  type="button"
                  onClick={() => void loadSession(session.id)}
                  className="block w-full text-left"
                >
                  <p
                    className={cn(
                      "line-clamp-1 text-sm font-medium",
                      active
                        ? "text-emerald-100 dark:text-emerald-100"
                        : "text-slate-100 dark:text-slate-100",
                    )}
                  >
                    {session.title || "Conversación"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {session.last_message || "Sin mensajes todavía"}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                    {session.message_count ?? 0} mensajes
                  </p>
                </button>
                <div className="mt-3 flex gap-2 opacity-80 transition group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void renameSession(session.id, session.title)
                    }
                    aria-label="Renombrar conversación"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void deleteSession(session.id)}
                    aria-label="Eliminar conversación"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div ref={chatPrintRef} className="print-chat-area">
        <Card className="flex min-h-[calc(100vh-9rem)] flex-col overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white dark:text-white">
                  {sessionTitle || "Copiloto New Relic"}
                </h2>
                <p className="mt-1 text-sm text-slate-400 dark:text-slate-400">
                  Contexto: {selectedEntity?.name ?? "sin APM seleccionada"} ·{" "}
                  {accountId ?? "sin cuenta"} · UTC ·{" "}
                  {timeRangeSelection.kind === "custom"
                    ? "rango personalizado"
                    : timeRangeSelection.label}{" "}
                  · intervalo {timeRange.step ?? "auto"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void clearCurrentChat()}
                  disabled={!messages.length}
                >
                  Limpiar chat
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={exportCurrentChat}
                  disabled={!messages.length}
                >
                  <Download className="h-4 w-4" /> Exportar PDF
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => void startNewChat()}
                >
                  <FilePlus2 className="h-4 w-4" /> Nuevo
                </Button>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-6 overflow-auto p-5">
            {messages.map((message) => (
              <Fragment key={message.id}>
                <ChatMessage role={message.role} content={message.content} />
                {message.role === "assistant" && message.response ? (
                  <div className="ml-12 max-w-[min(100%,1100px)] space-y-5">
                    {message.response.tool_traces.length ? (
                      <details className="rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm text-slate-300 dark:text-slate-300">
                        <summary className="cursor-pointer text-sm font-medium text-white dark:text-white">
                          LLM y herramientas ejecutadas
                        </summary>
                        <div className="mt-4">
                          <ToolTrace traces={message.response.tool_traces} />
                        </div>
                      </details>
                    ) : null}
                    {message.response.entities?.length ? (
                      <ChatApmSelector
                        entities={message.response.entities}
                        onSelect={(entity) => {
                          setSelectedEntity(entity);
                          if (entity.account_id)
                            setAccountId(entity.account_id);
                          setMessages((prev) => [
                            ...prev,
                            {
                              id: messageId(),
                              role: "assistant",
                              content: `APM seleccionada: ${entity.name}. A partir de ahora responderé usando esa entidad como contexto.`,
                            },
                          ]);
                        }}
                      />
                    ) : null}
                    {message.response.visualizations.map((spec) => (
                      <ChartCard key={spec.id} spec={spec} />
                    ))}
                  </div>
                ) : null}
              </Fragment>
            ))}
            {loading && (
              <ChatMessage
                role="assistant"
                content="Pensando con el LLM y usando herramientas seguras si hacen falta…"
              />
            )}
          </div>
          <form onSubmit={onSubmit} className="border-t border-white/10 p-4">
            <div className="no-print mb-3">
              <SuggestedPrompts
                prompts={activeSuggestions}
                onPick={(prompt) => void submit(prompt)}
              />
            </div>
            <div className="no-print flex gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Pregunta por tus APMs, errores, throughput, deploys…"
                className="h-11 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-500 dark:text-white"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                aria-label="Enviar pregunta"
              >
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
