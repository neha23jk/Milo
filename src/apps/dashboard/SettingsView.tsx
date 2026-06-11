import { useEffect, useState } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as autostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { getApiKey, hasApiKey, setApiKey } from "@/lib/secureStore";
import { providerFor } from "@/services/ai";
import type { Settings } from "@/types";

export function SettingsView() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  const [apiKey, setApiKeyInput] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [testing, setTesting] = useState<null | "ok" | "fail">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const existing = await getApiKey("gemini");
      if (existing) setApiKeyInput(existing);
      setKeySaved(await hasApiKey("gemini"));
    })();
  }, []);

  const onSaveKey = async () => {
    setBusy(true);
    setTesting(null);
    try {
      await setApiKey("gemini", apiKey.trim());
      setKeySaved(apiKey.trim().length > 0);
    } finally {
      setBusy(false);
    }
  };

  const onTestKey = async () => {
    setTesting(null);
    setBusy(true);
    try {
      await setApiKey("gemini", apiKey.trim());
      const intent = await providerFor("gemini").classifyIntent(
        "Help me plan my study schedule",
      );
      setTesting(intent === "productivity" ? "ok" : "ok");
    } catch {
      setTesting("fail");
    } finally {
      setBusy(false);
    }
  };

  const onToggleAutostart = async (value: boolean) => {
    try {
      if (value) await enableAutostart();
      else await disableAutostart();
      await update("autostart", value);
    } catch {
      // ignore – best effort
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const enabled = await autostartEnabled();
        if (settings && enabled !== settings.autostart) {
          await update("autostart", enabled);
        }
      } catch {
        // plugin not ready in browser preview
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!settings) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure Mochi's AI, schedule defaults, and behavior.
        </p>
      </header>

      {/* AI key (BYOK) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-primary" /> Gemini API key
          </CardTitle>
          <CardDescription>
            Bring your own key (free tier). Stored securely on this device, never
            uploaded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setKeySaved(false);
                setTesting(null);
              }}
              placeholder="AIza…"
            />
            <Button onClick={onSaveKey} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
            <Button variant="outline" onClick={onTestKey} disabled={busy || !apiKey}>
              Test
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {keySaved && (
              <span className="flex items-center gap-1 text-primary">
                <Check className="size-3" /> Saved
              </span>
            )}
            {testing === "ok" && (
              <span className="text-chart-2">Connection works ✓</span>
            )}
            {testing === "fail" && (
              <span className="text-destructive">
                Test failed — check the key
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule defaults</CardTitle>
          <CardDescription>Your usual available hours.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-6">
          <div className="space-y-1.5">
            <Label htmlFor="start">Start</Label>
            <Input
              id="start"
              type="time"
              value={settings.defaultWorkStart}
              onChange={(e) => void update("defaultWorkStart", e.target.value)}
              className="w-32"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">End</Label>
            <Input
              id="end"
              type="time"
              value={settings.defaultWorkEnd}
              onChange={(e) => void update("defaultWorkEnd", e.target.value)}
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance + behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance & behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Theme</Label>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as Settings["theme"][]).map((t) => (
                <button
                  key={t}
                  onClick={() => void update("theme", t)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors",
                    settings.theme === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Row
            label="Start on login"
            description="Launch Mochi automatically when you sign in."
          >
            <Switch
              checked={settings.autostart}
              onCheckedChange={onToggleAutostart}
            />
          </Row>

          <Row
            label="Hide over fullscreen apps"
            description="Tuck the pet away during games and videos."
          >
            <Switch
              checked={settings.hideOnFullscreen}
              onCheckedChange={(v) => void update("hideOnFullscreen", v)}
            />
          </Row>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {children}
    </div>
  );
}
