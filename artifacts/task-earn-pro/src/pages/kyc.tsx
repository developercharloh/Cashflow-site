import { useState } from "react";
import { useLocation } from "wouter";
import { useSubmitKyc } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import {
  User, Calendar, Globe, Phone, CreditCard,
  ChevronRight, ChevronLeft, Loader2, ShieldCheck,
  CheckCircle, ExternalLink,
} from "lucide-react";

const COUNTRIES = [
  "Kenya","Uganda","Tanzania","Rwanda","Nigeria","Ghana","South Africa",
  "Ethiopia","Egypt","Morocco","Senegal","Zimbabwe","Zambia","Botswana",
  "United States","United Kingdom","Canada","Australia","India","Other",
];

const STEPS = [
  { id: 1, label: "Personal Info" },
  { id: 2, label: "Review" },
  { id: 3, label: "Verify" },
];

interface FormData {
  fullName: string;
  dateOfBirth: string;
  country: string;
  phoneNumber: string;
  nationalId: string;
}

export default function KycPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    fullName: user?.name ?? "",
    dateOfBirth: "",
    country: "Kenya",
    phoneNumber: "",
    nationalId: "",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const submitMutation = useSubmitKyc();

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  const validateStep1 = (): boolean => {
    const errs: Partial<FormData> = {};
    if (!form.fullName.trim() || form.fullName.trim().split(" ").length < 2) errs.fullName = "Enter your full legal name (first & last)";
    if (!form.dateOfBirth) errs.dateOfBirth = "Date of birth is required";
    else {
      const dob = new Date(form.dateOfBirth);
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 18) errs.dateOfBirth = "You must be at least 18 years old";
    }
    if (!form.country) errs.country = "Select your country";
    if (!form.phoneNumber.trim()) errs.phoneNumber = "Phone number is required";
    if (!form.nationalId.trim()) errs.nationalId = "National ID / Passport number is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = () => {
    submitMutation.mutate({ data: form }, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    });
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : setLocation("/profile")} className="p-2 rounded-lg hover:bg-muted">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Identity Verification</h1>
          <p className="text-xs text-muted-foreground">Required for withdrawals</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-colors ${
              step > s.id ? "bg-emerald-500 text-white" :
              step === s.id ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            }`}>
              {step > s.id ? <CheckCircle className="w-4 h-4" /> : s.id}
            </div>
            <div className="flex-1 mx-1">
              <p className={`text-[10px] font-medium ${step === s.id ? "text-primary" : "text-muted-foreground"}`}>{s.label}</p>
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 w-4 rounded ${step > s.id ? "bg-emerald-500" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Personal Information ── */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm">Personal Information</p>
          </div>

          <div>
            <Label>Full Legal Name *</Label>
            <Input
              placeholder="As it appears on your ID"
              value={form.fullName}
              onChange={set("fullName")}
              className={errors.fullName ? "border-destructive" : ""}
            />
            {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName}</p>}
          </div>

          <div>
            <Label className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date of Birth *</Label>
            <Input
              type="date"
              max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split("T")[0]}
              value={form.dateOfBirth}
              onChange={set("dateOfBirth")}
              className={errors.dateOfBirth ? "border-destructive" : ""}
            />
            {errors.dateOfBirth && <p className="text-xs text-destructive mt-1">{errors.dateOfBirth}</p>}
          </div>

          <div>
            <Label className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> Country *</Label>
            <select
              value={form.country}
              onChange={set("country")}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <Label className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone Number *</Label>
            <Input
              type="tel"
              placeholder="e.g. +254712345678"
              value={form.phoneNumber}
              onChange={set("phoneNumber")}
              className={errors.phoneNumber ? "border-destructive" : ""}
            />
            {errors.phoneNumber && <p className="text-xs text-destructive mt-1">{errors.phoneNumber}</p>}
          </div>

          <div>
            <Label className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> National ID / Passport Number *</Label>
            <Input
              placeholder="Enter your ID or passport number"
              value={form.nationalId}
              onChange={set("nationalId")}
              className={errors.nationalId ? "border-destructive" : ""}
            />
            {errors.nationalId && <p className="text-xs text-destructive mt-1">{errors.nationalId}</p>}
          </div>

          <Button className="w-full" onClick={handleNext}>
            Continue <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <p className="font-semibold text-sm">Review Your Information</p>
            {[
              { label: "Full Name", value: form.fullName },
              { label: "Date of Birth", value: form.dateOfBirth },
              { label: "Country", value: form.country },
              { label: "Phone", value: form.phoneNumber },
              { label: "National ID / Passport", value: form.nationalId },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 space-y-2">
            <p className="font-semibold text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> What happens next
            </p>
            <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1.5">
              <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Upload your National ID or Passport</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Complete a short liveness video (blink, smile, turn head)</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Face matched against your document</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Takes ~2 minutes · Powered by Didit</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Edit
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={submitMutation.isPending}>
              {submitMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Starting…</>
                : <><ExternalLink className="w-4 h-4 mr-2" />Start Verification</>}
            </Button>
          </div>
          {submitMutation.isError && (
            <p className="text-xs text-destructive text-center">
              {(submitMutation.error as any)?.data?.error ?? "Failed to start. Please try again."}
            </p>
          )}
        </div>
      )}

      {/* ── Step 3: Redirecting ── */}
      {step === 3 && (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <p className="font-semibold">Redirecting to verification…</p>
          <p className="text-sm text-muted-foreground text-center">You'll be taken to our secure verification partner. Complete the steps and return here.</p>
        </div>
      )}
    </div>
  );
}
