import { useEffect, useState } from "react";
import { Link } from "wouter";
import { upload as uploadBlob } from "@vercel/blob/client";
import { ArrowLeft, Camera, Clock3, FileImage, Loader2, ShieldCheck, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetKycStatus, useUploadKycDocuments } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type IdDocumentType = "alien_id" | "national_id" | "passport" | "driving_license";
type ImageSide = "front" | "back" | "selfie";

function fileError(file: File | null, label: string) {
  if (!file) return `Choose or take a ${label} image.`;
  if (!IMAGE_TYPES.has(file.type)) return "Upload a JPG, PNG, or WebP image.";
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) return "Each image must be 5 MB or smaller.";
  return null;
}

function safeFilename(name: string) {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "identity-document";
}

export default function KycPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: kyc, isLoading } = useGetKycStatus({
    query: { queryKey: ["kycStatus"], enabled: !!user, refetchInterval: 15_000 },
  });
  const submitMutation = useUploadKycDocuments();
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState("");
  const [nationality, setNationality] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [documentType, setDocumentType] = useState<IdDocumentType>("national_id");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user?.name) setFullName((current) => current || user.name);
  }, [user?.name]);

  const status = kyc?.kycStatus ?? "none";
  const submissionStatus = kyc?.submission?.kycStatus;
  const isApproved = status === "approved";
  const isUnderReview = (status === "pending" && !!kyc?.submission) || submissionStatus === "pending_review";
  const uploadDocument = async (file: File, side: ImageSide) => {
    if (!user?.id) throw new Error("Sign in again before uploading your document.");
    const pathname = `uploads/kyc/${user.id}/${crypto.randomUUID()}-${side}-${safeFilename(file.name)}`;
    const uploaded = await uploadBlob(pathname, file, {
      access: "private",
      contentType: file.type,
      handleUploadUrl: "/api/kyc/upload-url",
      clientPayload: JSON.stringify({
        side,
        name: file.name,
        size: file.size,
        contentType: file.type,
      }),
      headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
    });
    return `/objects/${uploaded.pathname}`;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!consent) {
      toast({ title: "Consent required", description: "Please agree to identity verification before continuing.", variant: "destructive" });
      return;
    }
    const frontError = fileError(frontFile, "front");
    const backError = documentType !== "passport" || backFile ? fileError(backFile, "back") : null;
    const selfieError = fileError(selfieFile, "selfie");
    if (frontError || backError || selfieError) {
      toast({ title: "Check your identity images", description: frontError ?? backError ?? selfieError ?? undefined, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const frontIdPath = await uploadDocument(frontFile!, "front");
      const backIdPath = backFile ? await uploadDocument(backFile, "back") : null;
      const selfieImagePath = await uploadDocument(selfieFile!, "selfie");
      submitMutation.mutate({
        data: {
          fullName: fullName.trim(),
          dateOfBirth,
          country: country.trim(),
          nationality: nationality.trim(),
          phoneNumber: phoneNumber.trim(),
          nationalId: nationalId.trim(),
          documentType,
          frontIdPath,
          backIdPath,
          selfieImagePath,
        },
      }, {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: ["kycStatus"] });
          setFrontFile(null);
          setBackFile(null);
          setSelfieFile(null);
          setConsent(false);
          toast({ title: "Identity details submitted", description: "Status: Under review." });
        },
        onError: (error) => {
          const detail = (error as { data?: { error?: string }; message?: string }).data?.error
            ?? (error as { message?: string }).message
            ?? "Please try again.";
          toast({ title: "Could not submit details", description: detail, variant: "destructive" });
        },
        onSettled: () => setUploading(false),
      });
    } catch (error) {
      setUploading(false);
      toast({
        title: "Document upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const busy = uploading || submitMutation.isPending;

  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 pb-24 pt-5 sm:pt-8">
      <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            {isApproved ? <ShieldCheck className="h-6 w-6" /> : <FileImage className="h-6 w-6" />}
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-2xl">Identity verification</h1>
            <p className="mt-1 text-sm text-muted-foreground">Required before you can request a withdrawal.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="h-28 animate-pulse rounded-xl bg-muted" aria-label="Loading verification status" />
        ) : isApproved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Identity verified</p>
            <p className="mt-1 text-sm">Your account is ready to request withdrawals.</p>
          </div>
        ) : isUnderReview ? (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="flex items-center gap-2 font-semibold"><Clock3 className="h-4 w-4" /> Under review</p>
            <p className="mt-1 text-sm">You’ll see an update here when the check is complete.</p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {kyc?.submission?.rejectionReason && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                <strong>Update needed.</strong> {kyc.submission.rejectionReason}
              </div>
            )}

            <div>
              <Label htmlFor="kyc-full-name">Full legal name</Label>
              <Input id="kyc-full-name" autoComplete="name" maxLength={120} required value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="kyc-date-of-birth">Date of birth</Label>
                <Input id="kyc-date-of-birth" type="date" required value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="kyc-nationality">Nationality</Label>
                <Input id="kyc-nationality" autoComplete="country-name" maxLength={80} required value={nationality} onChange={(event) => setNationality(event.target.value)} placeholder="Your nationality" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="kyc-country">Country of document</Label>
                <Input id="kyc-country" autoComplete="country-name" maxLength={80} required value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Issuing country" />
              </div>
              <div>
                <Label htmlFor="kyc-phone">Phone number</Label>
                <Input id="kyc-phone" autoComplete="tel" type="tel" maxLength={32} required value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Include country code" />
              </div>
              <div>
                <Label htmlFor="kyc-document-type">Document type</Label>
                <select id="kyc-document-type" required value={documentType} onChange={(event) => setDocumentType(event.target.value as IdDocumentType)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="alien_id">Alien ID card</option>
                  <option value="national_id">National ID</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="kyc-id-number">Document number</Label>
              <Input id="kyc-id-number" maxLength={100} required value={nationalId} onChange={(event) => setNationalId(event.target.value)} autoComplete="off" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="kyc-front-image">Front image</Label>
                <Input id="kyc-front-image" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required onChange={(event) => setFrontFile(event.target.files?.[0] ?? null)} />
                <p className="mt-1 text-xs text-muted-foreground">Take a photo or choose a JPG, PNG, or WebP · up to 5 MB</p>
              </div>
              <div>
                <Label htmlFor="kyc-back-image">Back image {documentType === "passport" ? "(optional)" : "(required)"}</Label>
                <Input id="kyc-back-image" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required={documentType !== "passport"} onChange={(event) => setBackFile(event.target.files?.[0] ?? null)} />
                <p className="mt-1 text-xs text-muted-foreground">{documentType === "passport" ? "Not required for passports" : "Take a photo or choose an image · up to 5 MB"}</p>
              </div>
            </div>
            <div>
              <Label htmlFor="kyc-selfie-image">Selfie</Label>
              <Input id="kyc-selfie-image" type="file" accept="image/jpeg,image/png,image/webp" capture="user" required onChange={(event) => setSelfieFile(event.target.files?.[0] ?? null)} />
              <p className="mt-1 text-xs text-muted-foreground">Take a selfie or choose a clear face photo · JPG, PNG, or WebP · up to 5 MB</p>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
              <Camera className="mt-0.5 h-4 w-4 shrink-0" />
              <p>On a phone, choose the camera option to take each photo now, or pick an existing image.</p>
              </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-sm leading-5">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
              <span>I consent to storing and checking these documents for identity verification and withdrawal access.</span>
            </label>
            <p className="text-xs leading-5 text-muted-foreground">Your images are stored privately and opened only by authenticated administrators for verification. Submit your own valid identity document.</p>

            <Button type="submit" className="w-full" disabled={busy || !consent}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : <><Upload className="mr-2 h-4 w-4" />Submit identity details</>}
            </Button>
          </form>
        )}
      </section>

      <Link href="/wallet" className="block">
        <Button variant="outline" className="w-full">Back to wallet</Button>
      </Link>
    </main>
  );
}
