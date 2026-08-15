import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Introduction",
    items: [
      'Welcome to Elite Signals Pro ("the Platform"). By registering, accessing, or using our services, you agree to comply with and be bound by these Terms and Conditions. If you do not agree, you must discontinue use immediately.',
    ],
  },
  {
    title: "2. Eligibility",
    items: [
      "You must be at least 18 years old.",
      "You must provide accurate and complete registration details.",
      "Elite Signals Pro reserves the right to verify user identity at any time (KYC).",
    ],
  },
  {
    title: "3. Account Registration",
    items: [
      "Only one account per user is allowed.",
      "Multiple or duplicate accounts will be suspended.",
      "You are responsible for safeguarding your login credentials.",
    ],
  },
  {
    title: "4. Services Provided",
    items: [
      "Elite Signals Pro offers a digital trading platform where users predict price movements (BUY/SELL) of financial assets.",
      "The platform does not provide investment advice or guarantees of profit.",
    ],
  },
  {
    title: "5. Risk Disclosure",
    items: [
      "Trading involves a high level of risk.",
      "You may lose all your invested capital.",
      "Trading outcomes are not guaranteed.",
      "You are solely responsible for your trading decisions.",
    ],
  },
  {
    title: "6. Deposits",
    items: [
      "Deposits can be made via approved payment methods (e.g., M-PESA or other supported channels).",
      "Funds must originate from accounts owned by you.",
      "Elite Signals Pro is not responsible for delays caused by payment providers.",
    ],
  },
  {
    title: "7. Withdrawals",
    items: [
      "Withdrawal requests must be submitted through the Platform.",
      "Identity verification may be required before processing withdrawals.",
      "Withdrawals will be sent to the registered user's payment account.",
      "Processing time depends on system checks and third-party providers.",
      "Suspicious activity may lead to delays or account review.",
    ],
  },
  {
    title: "8. Bonuses & Promotions",
    items: [
      "Bonuses are subject to specific conditions and wagering requirements.",
      "Abuse of promotions (e.g., multiple accounts, hedging, arbitrage) is prohibited.",
      "Elite Signals Pro reserves the right to revoke bonuses or related profits.",
    ],
  },
  {
    title: "9. Prohibited Activities",
    intro: "Users are strictly prohibited from:",
    items: [
      "Engaging in fraud or money laundering",
      "Using bots, scripts, or automated trading systems without approval",
      "Exploiting system errors or price delays",
      "Attempting unauthorized system access",
    ],
    footer: "Violations may result in account suspension, termination, or fund restriction.",
  },
  {
    title: "10. Market Data Disclaimer",
    items: [
      "Price feeds and charts are sourced from third-party providers.",
      "Elite Signals Pro does not guarantee accuracy or uninterrupted availability.",
      "Platform delays or technical errors may occur.",
    ],
  },
  {
    title: "11. Trade Execution",
    intro: "All trades are final once confirmed. Elite Signals Pro is not liable for losses due to:",
    items: [
      "Internet connectivity issues",
      "Device failure",
      "User mistakes",
    ],
  },
  {
    title: "12. Fees & Charges",
    items: [
      "Elite Signals Pro may apply transaction or service fees where applicable.",
      "Fees will be disclosed within the platform.",
    ],
  },
  {
    title: "13. Limitation of Liability",
    items: [
      "Elite Signals Pro is not liable for any direct or indirect financial losses.",
      "Users accept full responsibility for their use of the platform.",
    ],
  },
  {
    title: "14. Account Suspension & Termination",
    items: [
      "Accounts may be suspended for violation of these Terms.",
      "Funds may be withheld during investigations of suspicious activity.",
    ],
  },
  {
    title: "15. Anti-Money Laundering (AML) & KYC",
    items: [
      "Users must comply with AML regulations.",
      "Verification documents may be requested at any time.",
      "Failure to comply may result in account restriction.",
    ],
  },
  {
    title: "16. Privacy Policy",
    items: [
      "User information is handled according to our Privacy Policy.",
    ],
  },
  {
    title: "17. Amendments",
    items: [
      "Elite Signals Pro reserves the right to modify these Terms at any time.",
      "Continued use indicates acceptance of updated Terms.",
    ],
  },
  {
    title: "18. Governing Law",
    items: [
      "These Terms shall be governed by the laws of the applicable jurisdiction where Elite Signals Pro operates.",
    ],
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/auth/register"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Elite Signals Pro
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Title block */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold mb-1">Terms &amp; Conditions</h1>
          <p className="text-muted-foreground text-sm">
            Elite Signals Pro — please read carefully before using the platform.
          </p>
        </div>

        {/* Intro banner */}
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-8">
          <p className="text-sm leading-relaxed text-foreground/80">
            Welcome to Elite Signals Pro ("the Platform"). By registering, accessing, or using our services,
            you agree to comply with and be bound by these Terms and Conditions. If you do not agree,
            you must discontinue use immediately.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <div key={s.title} className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/40 px-5 py-3 border-b border-border">
                <h2 className="font-semibold text-sm">{s.title}</h2>
              </div>
              <div className="px-5 py-4 space-y-3">
                {s.intro && (
                  <p className="text-sm text-muted-foreground">{s.intro}</p>
                )}
                <ul className="space-y-2">
                  {s.items.map((item, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-foreground/80 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
                {s.footer && (
                  <p className="text-sm text-warning font-medium mt-2">{s.footer}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer agreement */}
        <div className="mt-8 border border-border rounded-xl p-5 bg-muted/30 text-sm text-muted-foreground leading-relaxed">
          By creating an account, accessing, or using Elite Signals Pro, you acknowledge that you have read,
          understood, and agreed to these Terms and Conditions.
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          © 2026 Elite Signals Pro · All rights reserved
        </p>
      </div>
    </div>
  );
}
