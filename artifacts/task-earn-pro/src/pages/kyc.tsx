import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useSubmitKyc, useUploadKycDocuments } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import {
  User, Calendar, Globe, Phone, CreditCard,
  ChevronRight, ChevronLeft, Loader2, ShieldCheck,
  CheckCircle, ExternalLink, Upload, Camera, ImageIcon,
  FileText, X, AlertCircle,
} from "lucide-react";

const COUNTRIES = [
  "Kenya","Uganda","Tanzania","Rwanda","Nigeria","Ghana","South Africa",
  "Ethiopia","Egypt","Morocco","Senegal","Zimbabwe","Zambia","Botswana",
  "United States","United Kingdom","Canada","Australia","India","Other",
];

const DOCUMENT_TYPES = [
  { value: "national_id",       label: "National ID Card" },
  { value: "passport",          label: "Passport" },
  { value: "drivers_license",   label: "Driver's License" },
  { value: "voters_card",       label: "Voter's Card" },
];

type Method = "live" | "upload" | null;

interface FormData {
  fullName: string;
  dateOfBirth: string;
  country: string;
  phoneNumber: string;
  nationalId: string;
}

// Compress and convert image file → base64 data URI (max 900px, quality 0.8)
async function compressImage(file: File, maxPx = 900, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function KycPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Flow state
  const [method, setMethod] = useState<Method>(null);
  const [step, setStep] = useState(1);          // 1=info, 2=review, 3=photos (upload only), 4=done
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0].value);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage]   = useState<string | null>(null);
  const [imgError, setImgError] = useState("");
  const [compressing, setCompressing] = useState(false);

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef  = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>({
    fullName:    user?.name ?? "",
    dateOfBirth: "",
    country:     "Kenya",
    phoneNumber: "",
    nationalId:  "",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const submitMutation = useSubmitKyc();
  const uploadMutation = useUploadKycDocuments();

  const set = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(f => ({ ...f, [field]: e.target.value }));
      setErrors(er => ({ ...er, [field]: undefined }));
    };

  const validateInfo = (): boolean => {
    const errs: Partial<FormData> = {};
    if (!form.fullName.trim() || form.fullName.trim().split(" ").length < 2)
      errs.fullName = "Enter your full legal name (first & last)";
    if (!form.dateOfBirth) errs.dateOfBirth = "Date of birth is required";
    else {
      const age = (Date.now() - new Date(form.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 18) errs.dateOfBirth = "You must be at least 18 years old";
    }
    if (!form.country)           errs.country     = "Select your country";
    if (!form.phoneNumber.trim()) errs.phoneNumber = "Phone number is required";
    if (!form.nationalId.trim())  errs.nationalId  = "National ID / Passport number is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleImagePick = async (side: "front" | "back", file: File) => {
    setImgError("");
    if (!file.type.startsWith("image/")) { setImgError("Please select an image file."); return; }
    if (file.size > 15 * 1024 * 1024)   { setImgError("File too large. Max 15 MB."); return; }
    setCompressing(true);
    try {
      const b64 = await compressImage(file);
      if (side === "front") setFrontImage(b64);
      else                  setBackImage(b64);
    } catch {
      setImgError("Could not process image. Try another file.");
    } finally {
      setCompressing(false);
    }
  };

  // ── Submit: Live (Didit) ─────────────────────────────────────────────────────
  const handleLiveSubmit = () => {
    submitMutation.mutate({ data: form }, {
      onSuccess: (data) => { window.location.href = data.url; },
    });
  };

  // ── Submit: Manual Upload ────────────────────────────────────────────────────
  const handleUploadSubmit = () => {
    if (!frontImage) { setImgError("Front image of your ID is required."); return; }
    uploadMutation.mutate(
      { data: { ...form, documentType: docType, frontIdImage: frontImage, backIdImage: backImage ?? undefined } },
      { onSuccess: () => setStep(4) },
    );
  };

  const totalSteps = method === "upload" ? 4 : 3;
  const stepLabels = method === "upload"
    ? ["Personal Info", "Review", "Upload Photos", "Done"]
    : ["Personal Info", "Review", "Verify"];

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (step > 1)          setStep(s => s - 1);
            else if (method)       setMethod(null);
            else                   setLocation("/profile");
          }}
          className="p-2 rounded-lg hover:bg-muted"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Identity Verification</h1>
          <p className="text-xs text-muted-foreground">One-time verification · Required for withdrawals</p>
        </div>
      </div>

      {/* ══════════ METHOD PICKER ══════════ */}
      {!method && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4" /> This is a one-time process
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Once verified and approved by our team, you'll be able to withdraw funds at any time — no repeat checks.
            </p>
          </div>

          <p className="text-sm font-semibold text-center text-muted-foreground">Choose how to verify</p>

          <button
            onClick={() => setMethod("live")}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Live Verification</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Take a live selfie and photo of your ID using your camera. Fastest method — verified by AI in minutes.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>

          <button
            onClick={() => setMethod("upload")}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border hover:border-primary/30 hover:bg-muted/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Upload ID Photos</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Don't have your ID card nearby? Upload photos from your gallery. Reviewed manually by our team within 24h.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>
        </div>
      )}

      {/* Progress bar (after method chosen) */}
      {method && step < totalSteps && (
        <div className="flex items-center gap-1.5">
          {stepLabels.slice(0, -1).map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-colors ${
                step > i + 1 ? "bg-emerald-500 text-white" :
                step === i + 1 ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <div className="flex-1 mx-1">
                <p className={`text-[10px] font-medium ${step === i + 1 ? "text-primary" : "text-muted-foreground"}`}>{label}</p>
              </div>
              {i < stepLabels.length - 2 && (
                <div className={`h-0.5 w-4 rounded ${step > i + 1 ? "bg-emerald-500" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══════════ STEP 1: Personal Info ══════════ */}
      {method && step === 1 && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm">Personal Information</p>
          </div>

          <div>
            <Label>Full Legal Name *</Label>
            <Input placeholder="As it appears on your ID" value={form.fullName} onChange={set("fullName")}
              className={errors.fullName ? "border-destructive" : ""} />
            {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName}</p>}
          </div>

          <div>
            <Label className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date of Birth *</Label>
            <Input type="date"
              max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split("T")[0]}
              value={form.dateOfBirth} onChange={set("dateOfBirth")}
              className={errors.dateOfBirth ? "border-destructive" : ""} />
            {errors.dateOfBirth && <p className="text-xs text-destructive mt-1">{errors.dateOfBirth}</p>}
          </div>

          <div>
            <Label className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> Country *</Label>
            <select value={form.country} onChange={set("country")}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <Label className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone Number *</Label>
            <Input type="tel" placeholder="e.g. +254712345678" value={form.phoneNumber} onChange={set("phoneNumber")}
              className={errors.phoneNumber ? "border-destructive" : ""} />
            {errors.phoneNumber && <p className="text-xs text-destructive mt-1">{errors.phoneNumber}</p>}
          </div>

          <div>
            <Label className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> National ID / Passport Number *</Label>
            <Input placeholder="Enter your ID or passport number" value={form.nationalId} onChange={set("nationalId")}
              className={errors.nationalId ? "border-destructive" : ""} />
            {errors.nationalId && <p className="text-xs text-destructive mt-1">{errors.nationalId}</p>}
          </div>

          <Button className="w-full" onClick={() => { if (validateInfo()) setStep(2); }}>
            Continue <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ══════════ STEP 2: Review ══════════ */}
      {method && step === 2 && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <p className="font-semibold text-sm">Review Your Information</p>
            {[
              { label: "Full Name",            value: form.fullName },
              { label: "Date of Birth",         value: form.dateOfBirth },
              { label: "Country",               value: form.country },
              { label: "Phone",                 value: form.phoneNumber },
              { label: "National ID / Passport",value: form.nationalId },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>

          {method === "live" && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 space-y-2">
              <p className="font-semibold text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> What happens next
              </p>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1.5">
                <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Take a photo of your ID card (front & back)</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Complete a short liveness check (blink, smile)</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Our admin reviews and approves within 24h</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Takes ~2 minutes · Powered by Didit</li>
              </ul>
            </div>
          )}

          {method === "upload" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-2">
              <p className="font-semibold text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Next: Upload ID photos
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1.5">
                <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Upload clear photos of your ID from your gallery</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Front side required · Back side recommended</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Reviewed by our admin team within 24 hours</li>
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Edit
            </Button>
            {method === "live" ? (
              <Button className="flex-1" onClick={handleLiveSubmit} disabled={submitMutation.isPending}>
                {submitMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Starting…</>
                  : <><ExternalLink className="w-4 h-4 mr-2" />Start Verification</>}
              </Button>
            ) : (
              <Button className="flex-1" onClick={() => setStep(3)}>
                Next: Upload Photos <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
          {submitMutation.isError && (
            <p className="text-xs text-destructive text-center">
              {(submitMutation.error as any)?.data?.error ?? "Failed to start. Please try again."}
            </p>
          )}
        </div>
      )}

      {/* ══════════ STEP 3: Photo Upload (upload method only) ══════════ */}
      {method === "upload" && step === 3 && (
        <div className="space-y-4">
          {/* Document type picker */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Document Type</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DOCUMENT_TYPES.map(dt => (
                <button key={dt.value} onClick={() => setDocType(dt.value)}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                    docType === dt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}>
                  {dt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Front image */}
          <ImageUploadCard
            label="Front of ID *"
            hint="Must be clearly visible and not blurry"
            image={frontImage}
            inputRef={frontRef}
            onClear={() => setFrontImage(null)}
            onChange={f => handleImagePick("front", f)}
          />

          {/* Back image */}
          <ImageUploadCard
            label="Back of ID (Recommended)"
            hint="Optional but helps speed up review"
            image={backImage}
            inputRef={backRef}
            onClear={() => setBackImage(null)}
            onChange={f => handleImagePick("back", f)}
          />

          {compressing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Compressing image…
            </div>
          )}

          {imgError && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400">{imgError}</p>
            </div>
          )}

          <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-medium">Tips for a clear photo:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Lay the ID flat on a light-coloured surface</li>
              <li>• Ensure all text and the photo on the ID are readable</li>
              <li>• Avoid glare or shadows covering the ID</li>
              <li>• All four corners of the ID must be visible</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button className="flex-1" onClick={handleUploadSubmit}
              disabled={!frontImage || compressing || uploadMutation.isPending}>
              {uploadMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</>
                : <><Upload className="w-4 h-4 mr-2" />Submit for Review</>}
            </Button>
          </div>

          {uploadMutation.isError && (
            <p className="text-xs text-destructive text-center">
              {(uploadMutation.error as any)?.data?.error ?? "Failed to submit. Please try again."}
            </p>
          )}
        </div>
      )}

      {/* ══════════ STEP 4: Done (upload) / Step 3: Redirecting (live) ══════════ */}
      {method === "upload" && step === 4 && (
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center animate-in zoom-in duration-300">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Documents Submitted!</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
              Our team will review your ID photos within 24 hours. You'll be notified once approved.
            </p>
          </div>
          <div className="bg-muted/50 rounded-2xl p-4 w-full max-w-xs space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Personal info recorded</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>ID photos uploaded securely</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Loader2 className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-muted-foreground">Pending admin review (up to 24h)</span>
            </div>
          </div>
          <Button className="w-full max-w-xs" onClick={() => setLocation("/profile")}>
            Back to Profile
          </Button>
        </div>
      )}

      {method === "live" && step === 3 && (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <p className="font-semibold">Redirecting to verification…</p>
          <p className="text-sm text-muted-foreground text-center">
            You'll be taken to our secure verification partner. Complete the steps and return here.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Reusable image upload card ────────────────────────────────────────────────
interface ImageUploadCardProps {
  label: string;
  hint: string;
  image: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onClear: () => void;
  onChange: (file: File) => void;
}

function ImageUploadCard({ label, hint, image, inputRef, onClear, onChange }: ImageUploadCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {image ? (
        <div className="relative">
          <img src={image} alt={label} className="w-full rounded-xl object-cover max-h-48 border border-border" />
          <button onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2.5 hover:border-primary/50 hover:bg-muted/30 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Tap to select photo</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP · max 15 MB</p>
          </div>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ""; }} />
    </div>
  );
}
