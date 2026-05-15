'use client';

import { Button } from '@/components/ui/button';

export function SuggestedPrompts({ prompts, onPick }: { prompts: string[]; onPick: (prompt: string) => void }) {
  if (!prompts.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map(prompt => <Button key={prompt} size="sm" variant="ghost" onClick={() => onPick(prompt)}>{prompt}</Button>)}
    </div>
  );
}
