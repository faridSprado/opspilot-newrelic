import { ChatPanel } from '@/components/chat-panel';

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-300">Copiloto</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Pregúntale a OpsPilot</h1>
      </div>
      <ChatPanel />
    </div>
  );
}
