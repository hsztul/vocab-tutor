"use client";

import * as React from "react";
import dataset from "@/data/sat_vocab_structured.json";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminPage() {
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const controllerRef = React.useRef<AbortController | null>(null);

  const valid = React.useMemo(() => {
    // Keep only entries with at least one valid sense (pos + definition)
    return (dataset as any[])
      .map((w) => ({
        word: typeof w?.word === "string" ? w.word.trim() : "",
        senses: Array.isArray(w?.senses)
          ? w.senses.filter((s: any) => typeof s?.pos === "string" && typeof s?.definition === "string" && s.definition.trim())
          : [],
      }))
      .filter((w) => w.word && w.senses.length > 0);
  }, []);

  const ingest = async (limit?: number) => {
    setBusy(true);
    setStatus(null);
    try {
      const payload = typeof limit === "number" ? valid.slice(0, limit) : valid;
      setProgress({ done: payload.length, total: payload.length });
      const res = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`${res.status}: ${txt}`);
      }
      const data = await res.json();
      setStatus(`Ingested ${payload.length} words — result: ${JSON.stringify(data)}`);
      toast.success("Ingestion complete", { description: `${payload.length} words ingested` });
    } catch (e: any) {
      setStatus(e?.message || "Failed");
      toast.error("Ingestion failed", { description: String(e?.message || "") });
    } finally {
      setBusy(false);
    }
  };

  const ingestBatched = async (batchSize = 200) => {
    if (busy) return;
    const payload = valid;
    setBusy(true);
    setStatus(null);
    setProgress({ done: 0, total: payload.length });
    controllerRef.current = new AbortController();
    const signal = controllerRef.current.signal;
    toast("Starting batched ingestion", { description: `${payload.length} words` });
    try {
      for (let i = 0; i < payload.length; i += batchSize) {
        if (signal.aborted) throw new Error("Cancelled");
        const slice = payload.slice(i, i + batchSize);
        const res = await fetch("/api/admin/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(slice),
          signal,
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`${res.status}: ${txt}`);
        }
        setProgress((p) => ({ done: Math.min(p.done + slice.length, payload.length), total: payload.length }));
        setStatus(`Batch ${Math.min(i + batchSize, payload.length)} / ${payload.length} ingested`);
        // brief yield to keep UI responsive
        await new Promise((r) => setTimeout(r, 50));
      }
      toast.success("All batches ingested", { description: `${payload.length} words` });
    } catch (e: any) {
      if (e?.name === "AbortError" || e?.message === "Cancelled") {
        toast("Ingestion cancelled");
      } else {
        setStatus(e?.message || "Failed");
        toast.error("Batched ingestion failed", { description: String(e?.message || "") });
      }
    } finally {
      setBusy(false);
      controllerRef.current = null;
    }
  };

  const cancel = () => {
    controllerRef.current?.abort();
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="text-sm text-foreground/70">
        Dev-only helper to ingest the bundled SAT deck into the database. You must be authorized via ADMIN_USER_IDS.
      </p>
      <div className="text-xs text-foreground/60">
        Valid entries: <span className="font-medium text-foreground">{valid.length}</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => ingest(500)} disabled={busy}>
          {busy ? "Ingesting..." : "Ingest first 500"}
        </Button>
        <Button variant="outline" onClick={() => ingestBatched(200)} disabled={busy}>
          Ingest all (batched, 200)
        </Button>
        <Button variant="ghost" onClick={cancel} disabled={!busy}>
          Cancel
        </Button>
        {status ? <span className="text-sm text-foreground/70">{status}</span> : null}
        {busy ? (
          <span className="text-xs text-foreground/60">
            Progress: <span className="font-medium text-foreground">{progress.done}</span> / {progress.total}
          </span>
        ) : null}
      </div>
    </section>
  );
}
