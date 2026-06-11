import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listenApp } from "@/lib/events";
import { todayLocalDate } from "@/lib/datetime";
import {
  generateDailyReport,
  getDailyStats,
  getProductiveHours,
  getReport,
  type DailyReport,
  type DayStat,
  type HourStat,
} from "@/services/reports";

function weekday(date: string): string {
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

export function AnalyticsView() {
  const date = todayLocalDate();
  const [daily, setDaily] = useState<DayStat[]>([]);
  const [hours, setHours] = useState<HourStat[]>([]);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async () => {
    const [d, h, r] = await Promise.all([
      getDailyStats(7),
      getProductiveHours(),
      getReport(date),
    ]);
    setDaily(d);
    setHours(h);
    setReport(r);
  }, [date]);

  useEffect(() => {
    void refresh();
    const unlisten = listenApp("daily_report_ready", () => void refresh());
    return () => void unlisten.then((fn) => fn());
  }, [refresh]);

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const r = await generateDailyReport(date);
      setReport(r);
      await refresh();
    } finally {
      setGenerating(false);
    }
  };

  const completionData = daily.map((s) => ({
    label: weekday(s.date),
    pct: Math.round(s.completionRate * 100),
  }));
  const focusData = daily.map((s) => ({
    label: weekday(s.date),
    min: s.focusMinutes,
  }));
  const hoursData = hours
    .filter((h) => h.hour >= 5 && h.hour <= 23)
    .map((h) => ({ label: `${h.hour}`, min: h.focusMinutes }));

  const totalFocus = daily.reduce((s, d) => s + d.focusMinutes, 0);
  const avgCompletion = daily.length
    ? Math.round(
        (daily.reduce((s, d) => s + d.completionRate, 0) / daily.length) * 100,
      )
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Your last 7 days · {avgCompletion}% avg completion · {totalFocus} min focused
        </p>
      </header>

      {/* Today's report */}
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Today's report</CardTitle>
            <CardDescription>
              {report
                ? `${report.tasksCompleted} done · ${Math.round(report.completionRate * 100)}% · ${report.focusMinutes} min focused`
                : "Not generated yet."}
            </CardDescription>
          </div>
          <Button size="sm" onClick={onGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {report ? "Refresh" : "Generate"}
          </Button>
        </CardHeader>
        {report?.aiSummary && (
          <CardContent>
            <p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
              {report.aiSummary}
            </p>
          </CardContent>
        )}
      </Card>

      {/* Completion trend */}
      <ChartCard title="Completion rate" subtitle="% of tasks completed per day">
        <AreaChart data={completionData}>
          <defs>
            <linearGradient id="fillPct" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeOpacity={0.15} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={28}
          />
          <Tooltip
            formatter={(v) => [`${v}%`, "Completion"]}
            contentStyle={tooltipStyle}
          />
          <Area
            type="monotone"
            dataKey="pct"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#fillPct)"
          />
        </AreaChart>
      </ChartCard>

      {/* Focus minutes per day */}
      <ChartCard title="Focus minutes" subtitle="Time logged with the focus timer">
        <BarChart data={focusData}>
          <CartesianGrid vertical={false} strokeOpacity={0.15} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={28} />
          <Tooltip
            formatter={(v) => [`${v} min`, "Focus"]}
            contentStyle={tooltipStyle}
          />
          <Bar dataKey="min" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      {/* Productive hours */}
      <ChartCard title="Most productive hours" subtitle="Focus minutes by hour of day">
        <BarChart data={hoursData}>
          <CartesianGrid vertical={false} strokeOpacity={0.15} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={28} />
          <Tooltip
            formatter={(v) => [`${v} min`, "Focus"]}
            labelFormatter={(l) => `${l}:00`}
            contentStyle={tooltipStyle}
          />
          <Bar dataKey="min" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
};

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactElement;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
