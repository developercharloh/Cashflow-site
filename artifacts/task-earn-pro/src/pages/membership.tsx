import { useState } from "react";
import { useGetMembershipLevels, useInitializeUpgrade, verifyUpgrade, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Star, CheckCircle, Lock, ChevronRight, Zap, Crown, ShieldCheck, Rocket, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

const LEVEL_COLORS: Record<number, { border: string; bg: string; badge: string; text: string; gradient: string }> = {
  1: { border: "border-slate-400/50",  bg: "bg-slate-400/5",  badge: "bg-slate-400/10 text-slate-400 border-slate-400/30",  text: "text-slate-400",  gradient: "from-slate-600/20 to-transparent" },
  2: { border: "border-blue-400/50",   bg: "bg-blue-400/5",   badge: "bg-blue-400/10 text-blue-400 border-blue-400/30",     text: "text-blue-400",   gradient: "from-blue-600/20 to-transparent" },
  3: { border: "border-purple-500/50", bg: "bg-purple-500/5", badge: "bg-purple-500/10 text-purple-500 border-purple-500/30",text: "text-purple-500", gradient: "from-purple-600/20 to-transparent" },
  4: { border: "border-yellow-500/50", bg: "bg-yellow-500/5", badge: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",text: "text-yellow-500", gradient: "from-yellow-600/20 to-transparent" },
};

const LEVEL_ICONS: Record<number, React.ReactNode> = {
  1: <Star className="w-5 h-5" />,
  2: <Rocket className="w-5 h-5" />,
  3: <ShieldCheck className="w-5 h-5" />,
  4: <Crown className="w-5 h-5" />,
};

// Upgrade pricing — level → price in USD
const UPGRADE_PRICES: Record<number, number> = {
  2: 20,
  3: 50,
  4: 100,
};

function UpgradeModal({ targetLevel, levelName, price, onClose }: {
  targetLevel: number;
  levelName: string;
  price: number;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const upgradeMutation = useInitializeUpgrade();
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handlePay = () => {
    setLoading(true);
    upgradeMutation.mutate({ data: { targetLevel } }, {
      onSuccess: (res) => {
        setReference(res.reference ?? null);
        if (res.authorizationUrl) {
          window.open(res.authorizationUrl, "_blank");
        }
        setLoading(false);
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
        setLoading(false);
      },
    });
  };

  const handleVerify = async () => {
    if (!reference) return;
    setVerifying(true);
    try {
      const res = await verifyUpgrade(reference);
      toast({ title: "Upgrade Successful! 🎉", description: (res as any).message ?? `Welcome to ${levelName}!` });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      onClose();
    } catch (err: any) {
      toast({ title: "Verification Failed", description: err?.message ?? "Payment not confirmed yet. Try again in a moment.", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const colors = LEVEL_COLORS[targetLevel];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={colors?.text}>{LEVEL_ICONS[targetLevel]}</span>
            Upgrade to {levelName}
          </DialogTitle>
          <DialogDescription>
            One-time payment via Paystack (card, bank, M-Pesa, Airtel).
          </DialogDescription>
        </DialogHeader>
        <div className={`p-4 rounded-lg border ${colors?.border} ${colors?.bg} text-center space-y-2`}>
          <p className={`text-4xl font-bold ${colors?.text}`}>${price}</p>
          <p className="text-sm text-muted-foreground">One-time upgrade · Permanent access</p>
        </div>
        <div className="space-y-2">
          {!reference ? (
            <Button onClick={handlePay} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Pay ${price} via Paystack
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground">
                Payment window opened. Complete payment then click verify.
              </p>
              <Button onClick={handleVerify} disabled={verifying} variant="outline" className="w-full">
                {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2 text-green-500" />}
                Verify Payment
              </Button>
              <Button onClick={handlePay} disabled={loading} variant="ghost" size="sm" className="w-full text-xs">
                Retry Payment
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Membership() {
  const { user } = useAuth();
  const { data: levels, isLoading } = useGetMembershipLevels();
  const { toast } = useToast();
  const [upgradeTarget, setUpgradeTarget] = useState<{ level: number; name: string; price: number } | null>(null);

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

  const handleUpgrade = (level: number, name: string) => {
    if (level <= currentLevel) {
      toast({ title: "Already Unlocked", description: `You are already at ${name} level.` });
      return;
    }
    const price = UPGRADE_PRICES[level];
    if (!price) {
      toast({ title: "Free Tier", description: "Explorer is the free starting tier." });
      return;
    }
    setUpgradeTarget({ level, name, price });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Membership Levels</h1>
        <p className="text-muted-foreground mt-1">Level up through earnings or upgrade instantly via payment</p>
      </div>

      {/* Current level card */}
      {currentLevelData && (
        <Card className={`border-2 ${LEVEL_COLORS[currentLevel]?.border} ${LEVEL_COLORS[currentLevel]?.bg}`}>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Your Current Level</p>
                <h2 className={`text-2xl font-bold ${LEVEL_COLORS[currentLevel]?.text}`}>{currentLevelData.name}</h2>
              </div>
              <div className={`w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center ${LEVEL_COLORS[currentLevel]?.text}`}>
                {LEVEL_ICONS[currentLevel]}
              </div>
            </div>
            {nextLevel && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress to {nextLevel.name}</span>
                  <span className="font-medium">${totalEarned.toFixed(0)} / ${nextLevel.minEarnings}</span>
                </div>
                <Progress value={progressToNext} className="h-2" />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Earn ${Math.max(0, (nextLevel.minEarnings ?? 0) - totalEarned).toFixed(2)} more to auto-level
                  </p>
                  {UPGRADE_PRICES[nextLevel.level] && (
                    <Button size="sm" variant="outline" onClick={() => handleUpgrade(nextLevel.level, nextLevel.name)}
                      className={`h-7 text-xs ${LEVEL_COLORS[nextLevel.level]?.text} border-current hover:bg-current/10`}>
                      <Zap className="w-3 h-3 mr-1" />Upgrade Now – ${UPGRADE_PRICES[nextLevel.level]}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {currentLevel === 4 && (
              <div className="flex items-center gap-2 text-yellow-500 text-sm">
                <Crown className="w-4 h-4" />
                <span className="font-medium">You're at the highest tier — Elite!</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upgrade path banner */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {[2, 3, 4].map(lvl => {
          const levelData = levels.find(l => l.level === lvl);
          const colors = LEVEL_COLORS[lvl];
          const unlocked = currentLevel >= lvl;
          const price = UPGRADE_PRICES[lvl];
          return (
            <button
              key={lvl}
              onClick={() => levelData && handleUpgrade(lvl, levelData.name)}
              className={`p-3 rounded-xl border transition-all ${unlocked
                ? `${colors?.border} ${colors?.bg} cursor-default`
                : "border-border hover:border-primary/30 hover:bg-primary/5 cursor-pointer"
              }`}
            >
              <div className={`flex items-center justify-center mb-1 ${unlocked ? colors?.text : "text-muted-foreground"}`}>
                {LEVEL_ICONS[lvl]}
              </div>
              <div className={`font-semibold ${unlocked ? colors?.text : ""}`}>{levelData?.name}</div>
              {unlocked ? (
                <div className="text-green-500 flex items-center justify-center gap-0.5 mt-0.5">
                  <CheckCircle className="w-3 h-3" /> Unlocked
                </div>
              ) : (
                <div className="text-primary mt-0.5">${price} one-time</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Level detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {levels.map((level, idx) => {
          const colors = LEVEL_COLORS[level.level] ?? LEVEL_COLORS[1];
          const isCurrentLevel = level.level === currentLevel;
          const isUnlocked = level.level <= currentLevel;
          const price = UPGRADE_PRICES[level.level];
          const canUpgrade = !isUnlocked && !!price;

          return (
            <motion.div
              key={level.level}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
            >
              <Card className={`border h-full flex flex-col ${isCurrentLevel ? `border-2 ${colors.border} ${colors.bg}` : "border-border"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={colors.badge}>Level {level.level}</Badge>
                      {isCurrentLevel && <Badge className="text-xs">Current</Badge>}
                      {level.level === 1 && <Badge variant="secondary" className="text-xs">Free</Badge>}
                    </div>
                    <span className={isUnlocked ? colors.text : "text-muted-foreground"}>
                      {isUnlocked ? <CheckCircle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={colors.text}>{LEVEL_ICONS[level.level]}</span>
                    <CardTitle className={`text-xl ${isCurrentLevel ? colors.text : ""}`}>{level.name}</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">{level.description}</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
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
                  <div className="space-y-1.5 flex-1">
                    {level.perks.map(perk => (
                      <div key={perk} className="flex items-start gap-2 text-sm">
                        <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isUnlocked ? colors.text : "text-muted-foreground"}`} />
                        <span className={isUnlocked ? "" : "text-muted-foreground"}>{perk}</span>
                      </div>
                    ))}
                  </div>
                  {canUpgrade && (
                    <Button
                      onClick={() => handleUpgrade(level.level, level.name)}
                      size="sm"
                      className={`w-full mt-2 border ${colors.border} bg-transparent ${colors.text} hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all`}
                      variant="outline"
                    >
                      <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                      Upgrade to {level.name} — ${price}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {upgradeTarget && (
        <UpgradeModal
          targetLevel={upgradeTarget.level}
          levelName={upgradeTarget.name}
          price={upgradeTarget.price}
          onClose={() => setUpgradeTarget(null)}
        />
      )}
    </div>
  );
}
