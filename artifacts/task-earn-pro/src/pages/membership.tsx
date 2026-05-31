import { useGetMembershipLevels } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Star, CheckCircle, Lock, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const LEVEL_COLORS: Record<number, { border: string; bg: string; badge: string; text: string }> = {
  1: { border: "border-slate-400/50", bg: "bg-slate-400/5", badge: "bg-slate-400/10 text-slate-400 border-slate-400/30", text: "text-slate-400" },
  2: { border: "border-blue-400/50", bg: "bg-blue-400/5", badge: "bg-blue-400/10 text-blue-400 border-blue-400/30", text: "text-blue-400" },
  3: { border: "border-purple-500/50", bg: "bg-purple-500/5", badge: "bg-purple-500/10 text-purple-500 border-purple-500/30", text: "text-purple-500" },
  4: { border: "border-yellow-500/50", bg: "bg-yellow-500/5", badge: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30", text: "text-yellow-500" },
};

export default function Membership() {
  const { user } = useAuth();
  const { data: levels, isLoading } = useGetMembershipLevels();

  if (isLoading || !levels) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const currentLevel = user?.level ?? 1;
  const currentLevelData = levels.find(l => l.level === currentLevel);
  const nextLevel = levels.find(l => l.level === currentLevel + 1);
  const totalEarned = user?.balance ?? 0;
  const progressToNext = nextLevel
    ? Math.min(100, ((totalEarned - (currentLevelData?.minEarnings ?? 0)) / ((nextLevel.minEarnings ?? 0) - (currentLevelData?.minEarnings ?? 0))) * 100)
    : 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Membership Levels</h1>
        <p className="text-muted-foreground mt-1">Level up to unlock better-paying tasks and rewards</p>
      </div>

      {currentLevelData && (
        <Card className={`border-2 ${LEVEL_COLORS[currentLevel]?.border} ${LEVEL_COLORS[currentLevel]?.bg}`}>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Your Current Level</p>
                <h2 className={`text-2xl font-bold ${LEVEL_COLORS[currentLevel]?.text}`}>{currentLevelData.name}</h2>
              </div>
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Star className={`w-7 h-7 ${LEVEL_COLORS[currentLevel]?.text}`} />
              </div>
            </div>
            {nextLevel && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress to {nextLevel.name}</span>
                  <span className="font-medium">${totalEarned.toFixed(0)} / ${nextLevel.minEarnings}</span>
                </div>
                <Progress value={progressToNext} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Earn ${Math.max(0, (nextLevel.minEarnings ?? 0) - totalEarned).toFixed(2)} more to reach {nextLevel.name}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {levels.map((level, idx) => {
          const colors = LEVEL_COLORS[level.level] ?? LEVEL_COLORS[1];
          const isCurrentLevel = level.level === currentLevel;
          const isUnlocked = level.level <= currentLevel;

          return (
            <motion.div
              key={level.level}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className={`border h-full ${isCurrentLevel ? `border-2 ${colors.border} ${colors.bg}` : "border-border"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={colors.badge}>Level {level.level}</Badge>
                      {isCurrentLevel && <Badge className="text-xs">Current</Badge>}
                    </div>
                    {isUnlocked ? <CheckCircle className={`w-5 h-5 ${colors.text}`} /> : <Lock className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <CardTitle className={`text-xl ${isCurrentLevel ? colors.text : ""}`}>{level.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{level.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Earnings range: </span>
                    <span className="font-medium">
                      ${level.minEarnings}{level.maxEarnings ? ` – $${level.maxEarnings}` : "+"}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Task multiplier: </span>
                    <span className={`font-bold ${colors.text}`}>{level.taskMultiplier}x</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {level.perks.map(perk => (
                      <div key={perk} className="flex items-start gap-2 text-sm">
                        <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isUnlocked ? colors.text : "text-muted-foreground"}`} />
                        <span className={isUnlocked ? "" : "text-muted-foreground"}>{perk}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
