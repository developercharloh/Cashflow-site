import { useState } from "react";
import { useGetLeaderboard, getGetLeaderboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, CheckSquare, Loader2, Crown, Medal } from "lucide-react";
import { motion } from "framer-motion";

const TYPE_OPTIONS = [
  { value: "earners", label: "Top Earners", icon: <Trophy className="w-4 h-4" /> },
  { value: "referrers", label: "Top Referrers", icon: <Users className="w-4 h-4" /> },
  { value: "completers", label: "Most Tasks", icon: <CheckSquare className="w-4 h-4" /> },
];

const PERIOD_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "alltime", label: "All Time" },
];

const RANK_STYLES: Record<number, { bg: string; text: string; icon: React.ReactNode }> = {
  1: { bg: "bg-yellow-500/10 border-yellow-500/30", text: "text-yellow-500", icon: <Crown className="w-5 h-5 text-yellow-500" /> },
  2: { bg: "bg-slate-400/10 border-slate-400/30", text: "text-slate-400", icon: <Medal className="w-5 h-5 text-slate-400" /> },
  3: { bg: "bg-amber-600/10 border-amber-600/30", text: "text-amber-600", icon: <Medal className="w-5 h-5 text-amber-600" /> },
};

function LeaderboardEntry({ entry, type }: { entry: any; type: string }) {
  const rankStyle = RANK_STYLES[entry.rank];
  const isTop3 = entry.rank <= 3;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: entry.rank * 0.04 }}
      className={`flex items-center gap-4 p-3 rounded-lg border ${isTop3 ? rankStyle.bg : "border-transparent hover:bg-muted/40"} transition-colors`}
      data-testid={`leaderboard-${entry.rank}`}
    >
      <div className={`w-9 flex items-center justify-center font-bold text-sm ${isTop3 ? rankStyle.text : "text-muted-foreground"}`}>
        {isTop3 ? rankStyle.icon : `#${entry.rank}`}
      </div>
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
        {entry.name?.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{entry.name}</div>
        {entry.badge && (
          <Badge variant="outline" className="text-xs mt-0.5 capitalize">{entry.badge}</Badge>
        )}
      </div>
      <div className={`text-right font-bold ${isTop3 ? rankStyle.text : ""}`}>
        {type === "earners"
          ? `$${entry.value.toFixed(2)}`
          : type === "referrers"
          ? `${entry.value} refs`
          : `${entry.value} tasks`}
      </div>
    </motion.div>
  );
}

export default function Leaderboard() {
  const [type, setType] = useState("earners");
  const [period, setPeriod] = useState("alltime");

  const { data: entries, isLoading } = useGetLeaderboard(
    { type, period },
    { query: { queryKey: getGetLeaderboardQueryKey({ type, period }) } }
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground mt-1">See who's earning the most on TaskEarn Pro</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Tabs value={type} onValueChange={setType} className="flex-1">
          <TabsList className="w-full">
            {TYPE_OPTIONS.map(opt => (
              <TabsTrigger key={opt.value} value={opt.value} className="flex-1 gap-2 text-xs sm:text-sm">
                {opt.icon}{opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            {PERIOD_OPTIONS.map(opt => (
              <TabsTrigger key={opt.value} value={opt.value} className="text-xs sm:text-sm">{opt.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            {TYPE_OPTIONS.find(t => t.value === type)?.label} — {PERIOD_OPTIONS.find(p => p.value === period)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No data yet. Be the first on the leaderboard!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {entries.map(entry => (
                <LeaderboardEntry key={entry.userId} entry={entry} type={type} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
