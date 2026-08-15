import { useState } from "react";
import { useGetReferralInfo, useGetReferralList } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Copy, Link2, TrendingUp, CheckCircle, Loader2, QrCode, Gift } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

function SimpleQR({ value }: { value: string }) {
  const size = 128;
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
  return <img src={url} alt="QR Code" className="w-32 h-32 rounded-lg border border-border" />;
}

export default function Referrals() {
  const { toast } = useToast();
  const { data: info, isLoading } = useGetReferralInfo();
  const { data: referrals } = useGetReferralList();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Referral link copied to clipboard." });
  };

  if (isLoading || !info) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const chartData = Array.from({ length: 7 }, (_, i) => ({
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    referrals: Math.floor(Math.random() * 3),
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Referral Center</h1>
        <p className="text-muted-foreground mt-1">Invite friends and earn $1.00 for each signup</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Referrals", value: info.totalReferrals, suffix: "", icon: <Users className="w-5 h-5 text-primary" /> },
          { label: "Active Referrals", value: info.activeReferrals, suffix: "", icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
          { label: "Total Earned", value: info.totalEarned.toFixed(2), suffix: "$", icon: <Gift className="w-5 h-5 text-yellow-500" /> },
          { label: "Pending Earnings", value: info.pendingEarnings.toFixed(2), suffix: "$", icon: <TrendingUp className="w-5 h-5 text-blue-400" /> },
        ].map(({ label, value, suffix, icon }) => (
          <Card key={label} className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">{icon}</div>
              </div>
              <div className="text-2xl font-bold">{suffix}{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader><CardTitle>Your Referral Link</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-mono flex-1 truncate text-muted-foreground">{info.referralLink}</span>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => handleCopy(info.referralLink)} data-testid="button-copy-link">
                <Copy className="w-4 h-4 mr-2" />Copy Link
              </Button>
              <Button variant="outline" onClick={() => handleCopy(info.referralCode)} data-testid="button-copy-code">
                <Copy className="w-4 h-4 mr-2" />Code: {info.referralCode}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="w-5 h-5" />QR Code</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <SimpleQR value={info.referralLink} />
            <p className="text-xs text-muted-foreground text-center">Scan to share your referral link</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle>Referral Activity (This Week)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="refGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217,91%,60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217,91%,60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="referrals" stroke="hsl(217,91%,60%)" fill="url(#refGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader><CardTitle>Referred Users ({referrals?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!referrals || referrals.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No referrals yet. Share your link to get started!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {referrals.map(r => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  data-testid={`referral-${r.id}`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                    {r.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.tasksCompleted} tasks · Joined {new Date(r.joinedAt).toLocaleDateString()}</div>
                  </div>
                  <Badge variant="outline" className={r.status === "active" ? "text-green-500 border-green-500/30" : "text-muted-foreground"}>
                    {r.status}
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
