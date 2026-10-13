import { translate, useLang } from '@/lib/i18n';
import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DEFAULT_BASE, getRemote, setRemote } from "@/lib/ai/client";
import { MODELS, type ModelKey } from "@/lib/ai/router";

export function AiSettings() {
  const { t: translate } = useLang();
  const [base, setBase] = useState(DEFAULT_BASE);
  const [key, setKey] = useState("");
  const [models, setModels] = useState<Partial<Record<ModelKey, string>>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => { const c = getRemote(); if (c) { setBase(c.baseUrl); setKey(c.apiKey); setModels(c.models ?? {}); setSaved(true); } }, []);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label={translate("Wisen AI settings")} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Settings2 className="size-4" /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 text-sm">
        <div><p className="font-semibold">{translate("Live model inference (optional)")}</p><p className="text-xs text-muted-foreground">{translate("Wisen AI works out of the box. Add an OpenRouter (or compatible) key to run the exact routed models. The key stays in this browser.")}</p></div>
        <input value={base} onChange={(e) => setBase(e.target.value)} placeholder={translate("API base URL")} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs" />
        <input value={key} onChange={(e) => setKey(e.target.value)} type="password" placeholder={translate("API key")} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs" />
        <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">{translate("Model IDs")}</summary>
          <div className="mt-2 space-y-1.5">{(Object.keys(MODELS) as ModelKey[]).map((k) => (
            <label key={k} className="grid grid-cols-[6rem_1fr] items-center gap-2"><span>{translate(MODELS[k].label)}</span><input value={models[k] ?? ""} placeholder={MODELS[k].remote} onChange={(e) => setModels({ ...models, [k]: e.target.value })} className="h-7 rounded border border-input bg-background px-1.5 font-mono text-[10px]" /></label>
          ))}</div>
        </details>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { setRemote({ baseUrl: base, apiKey: key.trim(), models }); setSaved(!!key.trim()); }}>{translate("Save")}</Button>
          {saved && <Button size="sm" variant="ghost" onClick={() => { setRemote(null); setKey(""); setSaved(false); }}>{translate("Use built-in engine")}</Button>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
