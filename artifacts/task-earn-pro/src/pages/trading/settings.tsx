import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ChevronRight, RefreshCw, CreditCard, Smartphone, Bitcoin, DollarSign, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_START, type AccountMode } from "@/lib/trading-engine";

const DEPOSIT_METHODS = [
  { id: "card",   label: "Card Payment",  desc: "Visa, Mastercard, Amex — all cards",  icon: CreditCard,   iconBg: "bg-blue-600" },
  { id: "mpesa",  label: "M-Pesa",        desc: "Mobile money — Kenya & East Africa",   icon: Smartphone,   iconBg: "bg-green-600" },
  { id: "trc20",  label: "USDT TRC-20",   desc: "Tron network (fast, low fees)",        icon: Bitcoin,      iconBg: "bg-orange-500" },
  { id: "bep20",  label: "USDT BEP-20",   desc: "Binance Smart Chain",                  icon: Bitcoin,      iconBg: "bg-yellow-500" },
  { id: "erc20",  label: "USDT ERC-20",   desc: "Ethereum network",                     icon: Bitcoin,      iconBg: "bg-purple-600" },
  { id: "paypal", label: "PayPal",         desc: "Pay with your PayPal balance",         icon: DollarSign,   iconBg: "bg-sky-600" },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<AccountMode>(() =>
    (localStorage.getItem("trading_mode") as AccountMode) || "demo"
  );

  const resetDemo = () => {
    localStorage.setItem("elite_demo", DEMO_START.toFixed(2));
    toast({ title: "Demo balance reset", description: `$${DEMO_START.toLocaleString()} restored` });
    window.dispatchEvent(new Event("storage"));
  };

  const switchMode = (m: AccountMode) => {
    setMode(m);
    localStorage.setItem("trading_mode", m);
    toast({ title: `Switched to ${m === "demo" ? "Demo" : "Real"} account` });
  };

  const handleLogout = () => {
    logout();
    setLocation("/auth/login");
  };

  const handleDeposit = (method: string) => {
    toast({ title: `${method} deposit`, description: "Deposit processing coming soon — real account connection required." });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-lg font-black text-foreground">Settings</h1>
      </div>

      <div className="px-4 space-y-4 pb-4">
        {/* Account */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] font-black text-muted-foreground tracking-widest">ACCOUNT</p>
          </div>
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs text-muted-foreground mb-0.5">Logged in as</p>
            <p className="text-sm font-bold text-foreground">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>

          {/* Mode selector */}
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-foreground mb-2">Trading Account</p>
            <div className="flex gap-2">
              {(["demo", "real"] as AccountMode[]).map(m => (
                <button
                  key={m}
                  data-testid={`settings-mode-${m}`}
                  onClick={() => switchMode(m)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border",
                    mode === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:bg-accent"
                  )}
                >
                  {m === "demo" ? "Demo Account" : "Real Account"}
                </button>
              ))}
            </div>
            {mode === "real" && (
              <div className="mt-3 rounded-xl bg-warning/10 border border-warning/30 px-3 py-2">
                <p className="text-[10px] text-warning font-semibold">Real account requires identity verification and a minimum deposit. Balance: $0.00</p>
              </div>
            )}
          </div>
        </div>

        {/* Demo controls */}
        {mode === "demo" && (
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[10px] font-black text-muted-foreground tracking-widest">DEMO ACCOUNT</p>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Reset Demo Balance</p>
                <p className="text-xs text-muted-foreground">Restore to $10,000.00</p>
              </div>
              <button
                data-testid="reset-demo-btn"
                onClick={resetDemo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/30 text-xs font-bold hover:bg-primary/25 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Deposit methods */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] font-black text-muted-foreground tracking-widest">DEPOSIT METHODS</p>
          </div>
          {DEPOSIT_METHODS.map((m, i) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                data-testid={`deposit-${m.id}`}
                onClick={() => handleDeposit(m.label)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left",
                  i < DEPOSIT_METHODS.length - 1 && "border-b border-border"
                )}
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", m.iconBg)}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Profile & KYC */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] font-black text-muted-foreground tracking-widest">VERIFICATION</p>
          </div>
          <button
            data-testid="settings-profile"
            onClick={() => setLocation("/profile")}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border"
          >
            <p className="text-sm font-semibold text-foreground">Profile</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            data-testid="settings-kyc"
            onClick={() => setLocation("/kyc")}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <p className="text-sm font-semibold text-foreground">Identity Verification (KYC)</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Sign out */}
        <button
          data-testid="signout-btn"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive font-bold text-sm hover:bg-destructive/20 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
