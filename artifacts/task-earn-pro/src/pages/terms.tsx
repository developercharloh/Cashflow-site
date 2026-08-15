import { Link } from "wouter";
import { CircleDollarSign, ArrowLeft } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Eligibility",
    items: [
      "Users must be at least 18 years old or have parental or guardian consent where permitted by applicable law.",
      "Users must provide accurate, complete, and truthful information during registration and verification.",
      "Only one account per individual is permitted unless explicitly authorized by Task Earn Pro.",
    ],
  },
  {
    title: "2. Account Registration and Security",
    items: [
      "Users are responsible for maintaining the confidentiality of their account credentials.",
      "Users are responsible for all activities conducted under their accounts.",
      "Sharing, selling, transferring, or allowing others to use your account is prohibited.",
      "Task Earn Pro reserves the right to suspend or terminate accounts found to contain false, misleading, or fraudulent information.",
    ],
  },
  {
    title: "3. Services Provided",
    intro: "Task Earn Pro may provide users with opportunities to participate in:",
    items: [
      "Daily Check-In Rewards",
      "AI Training Tasks",
      "Data Categorization",
      "Text Annotation",
      "Questionnaires and Surveys",
      "Sentence Arrangement Tasks",
      "Product Review Analysis",
      "Trading Platform Activities",
      "Digital Gaming Activities",
      "Promotional Campaigns",
      "Referral Programs",
      "Other earning opportunities introduced by Task Earn Pro",
    ],
    footer: "Participation in any activity does not guarantee earnings or rewards.",
  },
  {
    title: "4. Task Completion and Reward Rules",
    items: [
      "Rewards are granted only after successful validation and approval of completed tasks.",
      "Certain tasks may require 100% accuracy to qualify for rewards.",
      "Incorrect, incomplete, duplicate, manipulated, or fraudulent submissions may be rejected without compensation.",
      "Task Earn Pro reserves the sole right to determine whether a task qualifies for reward issuance.",
    ],
  },
  {
    title: "5. Trading Platform Disclaimer",
    items: [
      "Trading activities involve financial risk.",
      "Users participate in trading-related activities at their own risk.",
      "Task Earn Pro does not guarantee profits, returns, or successful trading outcomes.",
      "Users are solely responsible for any financial decisions they make.",
      "Task Earn Pro shall not be liable for trading losses incurred by users.",
    ],
  },
  {
    title: "6. Digital Gaming Disclaimer",
    items: [
      "Digital gaming activities are intended for entertainment and reward purposes only.",
      "Participation does not guarantee winnings or rewards.",
      "Users must comply with all applicable laws relating to online gaming in their jurisdiction.",
      "Any attempt to manipulate, exploit, or cheat gaming systems may result in immediate account termination.",
    ],
  },
  {
    title: "7. Identity Verification (KYC)",
    intro: "To prevent fraud and comply with regulatory requirements, users may be required to complete identity verification, including:",
    items: [
      "Government-issued identification verification",
      "Selfie verification",
      "Facial recognition verification",
      "Liveness video verification",
      "Additional verification checks when necessary",
    ],
    footer: "Failure to complete KYC requirements may result in restrictions on account functionality, rewards, or withdrawals.",
  },
  {
    title: "8. Earnings, Rewards, and Bonuses",
    items: [
      "Earnings, bonuses, and rewards are subject to verification before approval.",
      "Welcome bonuses, referral bonuses, promotional rewards, and task rewards may be modified or discontinued at any time.",
      "Rewards obtained through fraud, abuse, system manipulation, or violation of these Terms may be revoked.",
    ],
  },
  {
    title: "9. Withdrawals",
    items: [
      "Users must meet the minimum withdrawal threshold before submitting withdrawal requests.",
      "Withdrawal requests may undergo manual or automated review.",
      "Processing times may vary depending on payment providers and verification status.",
      "Task Earn Pro reserves the right to delay, reject, or reverse withdrawals where suspicious activity is detected.",
    ],
  },
  {
    title: "10. Prohibited Activities",
    intro: "Users are strictly prohibited from:",
    items: [
      "Creating multiple accounts",
      "Using bots, scripts, automation software, or artificial methods to complete tasks",
      "Providing false information",
      "Manipulating surveys, tasks, games, or trading systems",
      "Exploiting bugs or platform vulnerabilities",
      "Engaging in fraudulent, illegal, abusive, or deceptive activities",
      "Circumventing security measures or KYC requirements",
    ],
  },
  {
    title: "11. Fraud Prevention",
    intro: "Task Earn Pro actively monitors platform activity for fraud, abuse, and suspicious behavior. Accounts may be suspended, restricted, or terminated if fraud is suspected, including but not limited to:",
    items: [
      "Multiple account creation",
      "Identity fraud",
      "Fake verification documents",
      "Automated task completion",
      "Referral abuse",
      "Payment fraud",
    ],
  },
  {
    title: "12. Account Suspension and Termination",
    intro: "Task Earn Pro reserves the right to suspend, restrict, or permanently terminate accounts at its sole discretion where:",
    items: [
      "These Terms are violated",
      "Fraudulent activity is detected",
      "False information is provided",
      "Security risks arise",
      "Legal or regulatory obligations require action",
    ],
    footer: "Users whose accounts are terminated may forfeit pending earnings, rewards, and platform privileges where permitted by law.",
  },
  {
    title: "13. Intellectual Property",
    items: [
      "All platform content, software, trademarks, logos, graphics, text, designs, and intellectual property remain the exclusive property of Task Earn Pro and its licensors.",
      "No content may be copied, reproduced, distributed, or modified without written permission.",
    ],
  },
  {
    title: "14. Privacy",
    intro: "By using Task Earn Pro, users consent to the collection, processing, storage, and use of personal information for:",
    items: [
      "Account management",
      "Identity verification",
      "Fraud prevention",
      "Reward processing",
      "Customer support",
      "Legal compliance",
    ],
  },
  {
    title: "15. Limitation of Liability",
    intro: 'Task Earn Pro is provided on an "AS IS" and "AS AVAILABLE" basis. To the fullest extent permitted by law, Task Earn Pro shall not be liable for:',
    items: [
      "Financial losses",
      "Trading losses",
      "Gaming losses",
      "Loss of earnings",
      "Service interruptions",
      "Technical failures",
      "Third-party payment delays",
      "Unauthorized account access resulting from user negligence",
    ],
  },
  {
    title: "16. Modification of Services",
    items: [
      "Task Earn Pro may modify, suspend, restrict, or discontinue any feature, reward system, game, task category, trading activity, or service without prior notice.",
    ],
  },
  {
    title: "17. Amendments to These Terms",
    items: [
      "Task Earn Pro reserves the right to update these Terms and Conditions at any time.",
      "Continued use of the platform following any update constitutes acceptance of the revised Terms.",
    ],
  },
  {
    title: "18. Governing Law",
    items: [
      "These Terms and Conditions shall be governed by and interpreted in accordance with the laws of Kenya.",
    ],
  },
  {
    title: "19. Contact Information",
    items: [
      "For questions, complaints, or support inquiries, contact Task Earn Pro Support at: support@taskearnpro.com",
    ],
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <CircleDollarSign className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm">TaskEarn Pro</span>
          </div>
          <Link href="/auth/register"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Title block */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold mb-2">Terms and Conditions</h1>
          <p className="text-muted-foreground text-sm">Effective Date: June 2026</p>
        </div>

        {/* Intro */}
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mb-8">
          <p className="text-sm leading-relaxed text-foreground/80">
            Welcome to Task Earn Pro. By accessing, registering, or using our platform, you agree to comply with
            and be legally bound by these Terms and Conditions. If you do not agree with any part of these Terms,
            you must discontinue use of the platform immediately.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
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
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-foreground/80 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
                {s.footer && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mt-2">{s.footer}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer agreement */}
        <div className="mt-8 border border-border rounded-xl p-5 bg-muted/30 text-sm text-muted-foreground leading-relaxed">
          By creating an account, accessing, or using Task Earn Pro, you acknowledge that you have read, understood,
          and agreed to these Terms and Conditions.
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          © 2026 TaskEarn Pro · support@taskearnpro.com
        </p>
      </div>
    </div>
  );
}
