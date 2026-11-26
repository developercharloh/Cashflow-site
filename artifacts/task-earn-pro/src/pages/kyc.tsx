import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { upload as uploadBlob } from "@vercel/blob/client";
import { ArrowLeft, Camera, CheckCircle2, Clock3, FileImage, Loader2, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetKycStatus, useUploadKycDocuments } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 4.5 * 1024 * 1024;
const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2400;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type IdDocumentType = "alien_id" | "national_id" | "passport" | "driving_license";
type ImageSide = "front" | "back" | "selfie";

function fileError(file: File | null, label: string) {
  if (!file) return label === "selfie" ? "Take a selfie with your camera." : `Add the ${label} document photo.`;
  if (!IMAGE_TYPES.has(file.type)) return "Upload a JPG, PNG, or WebP image.";
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) return "The optimized image must be 5 MB or smaller.";
  return null;
}

function jpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("This image could not be optimized. Please try another photo.")),
      "image/jpeg",
      quality,
    );
  });
}

async function decodeImage(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap as CanvasImageSource,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Fall back to an image element on browsers that cannot decode this format as a bitmap.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This image could not be opened. Please choose another photo."));
      element.src = url;
    });
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function compressImage(file: File) {
  if (!IMAGE_TYPES.has(file.type)) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size < 1 || file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 25 MB so it can be optimized.");
  }

  const image = await decodeImage(file);
  try {
    if (!image.width || !image.height) throw new Error("This image has invalid dimensions.");
    let scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
    const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.44];

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image optimization is unavailable in this browser.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image.source, 0, 0, width, height);

      let optimized: Blob | null = null;
      for (const quality of qualities) {
        optimized = await jpegBlob(canvas, quality);
        if (optimized.size <= TARGET_IMAGE_BYTES) break;
      }

      if (optimized && optimized.size <= MAX_IMAGE_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "identity-image";
        return new File([optimized], `${baseName}-optimized.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
      scale *= 0.8;
    }
    throw new Error("This image could not be reduced to the 5 MB upload limit. Please retake the photo.");
  } finally {
    image.dispose();
  }
}

function safeFilename(name: string) {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "identity-document";
}

function imageSizeLabel(size: number) {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
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
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [compressingImages, setCompressingImages] = useState(0);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const frontCameraInput = useRef<HTMLInputElement>(null);
  const frontFileInput = useRef<HTMLInputElement>(null);
  const backCameraInput = useRef<HTMLInputElement>(null);
  const backFileInput = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (user?.name) setFullName((current) => current || user.name);
  }, [user?.name]);

  useEffect(() => {
    if (!selfieFile) {
      setSelfiePreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(selfieFile);
    setSelfiePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selfieFile]);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !cameraStream.current) return;
    videoRef.current.srcObject = cameraStream.current;
    void videoRef.current.play().catch(() => {
      setCameraError("The camera preview could not start. Close it and try again.");
    });
  }, [cameraOpen]);

  useEffect(() => () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const status = kyc?.kycStatus ?? "none";
  const submissionStatus = kyc?.submission?.kycStatus;
  const isApproved = status === "approved";
  const isUnderReview = (status === "pending" && !!kyc?.submission) || submissionStatus === "pending_review";
  const setImageFile = (side: "front" | "back", file: File | null) => {
    if (side === "front") setFrontFile(file);
    else setBackFile(file);
  };
  const handleImageSelection = async (file: File | null, side: "front" | "back") => {
    if (!file) return;
    setImageFile(side, null);
    setCompressingImages((count) => count + 1);
    try {
      const optimized = await compressImage(file);
      setImageFile(side, optimized);
    } catch (error) {
      toast({
        title: "Could not prepare the photo",
        description: error instanceof Error ? error.message : "Choose another image and try again.",
        variant: "destructive",
      });
    } finally {
      setCompressingImages((count) => Math.max(0, count - 1));
    }
  };
  const stopSelfieCamera = () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    setCameraOpen(false);
  };
  const openSelfieCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera capture is not available in this browser. Open this page in a browser with camera access.");
      return;
    }
    try {
      cameraStream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" } },
        audio: false,
      });
      setCameraOpen(true);
    } catch {
      setCameraError("Allow camera access in your browser, then try taking the selfie again.");
    }
  };
  const captureSelfie = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("The camera is still starting. Wait a moment and try again.");
      return;
    }

    setCameraError("");
    setCompressingImages((count) => count + 1);
    try {
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Camera capture is unavailable in this browser.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photo = await jpegBlob(canvas, 0.9);
      const rawSelfie = new File([photo], "camera-selfie.jpg", { type: "image/jpeg" });
      setSelfieFile(await compressImage(rawSelfie));
      stopSelfieCamera();
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Could not capture the selfie. Please try again.");
    } finally {
      setCompressingImages((count) => Math.max(0, count - 1));
    }
  };
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

  const busy = uploading || submitMutation.isPending || compressingImages > 0;

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
              {([
                { side: "front" as const, title: "Front of document", cameraInput: frontCameraInput, fileInput: frontFileInput, file: frontFile },
                { side: "back" as const, title: `Back of document${documentType === "passport" ? " (optional)" : ""}`, cameraInput: backCameraInput, fileInput: backFileInput, file: backFile },
              ]).map(({ side, title, cameraInput, fileInput, file }) => (
                <div key={side} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                  <Label>{title}</Label>
                  <input
                    ref={cameraInput}
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    tabIndex={-1}
                    aria-label={`Take ${side} document photo`}
                    onChange={(event) => {
                      const selected = event.currentTarget.files?.[0] ?? null;
                      event.currentTarget.value = "";
                      void handleImageSelection(selected, side);
                    }}
                  />
                  <input
                    ref={fileInput}
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    tabIndex={-1}
                    aria-label={`Choose ${side} document image`}
                    onChange={(event) => {
                      const selected = event.currentTarget.files?.[0] ?? null;
                      event.currentTarget.value = "";
                      void handleImageSelection(selected, side);
                    }}
                  />
                  <div className="rounded-lg border border-dashed border-border bg-background p-3">
                    {file ? (
                      <p className="mb-3 flex items-center gap-2 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Photo optimized · {imageSizeLabel(file.size)}
                      </p>
                    ) : (
                      <p className="mb-3 text-xs text-muted-foreground">
                        {compressingImages > 0 ? "Optimizing photo…" : "No photo added yet"}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" className="gap-1.5 px-2 text-xs" disabled={busy} onClick={() => cameraInput.current?.click()}>
                        <Camera className="h-4 w-4" /> Take photo
                      </Button>
                      <Button type="button" variant="outline" className="gap-1.5 px-2 text-xs" disabled={busy} onClick={() => fileInput.current?.click()}>
                        <Upload className="h-4 w-4" /> Choose image
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-3" aria-label="Selfie camera capture">
              <div>
                <Label>Selfie taken with camera</Label>
                <p className="mt-1 text-xs text-muted-foreground">Use the front-facing camera. Gallery uploads are not accepted for the selfie.</p>
              </div>
              {cameraOpen ? (
                <div className="space-y-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="aspect-[4/3] w-full rounded-xl bg-black object-cover"
                    aria-label="Live selfie camera preview"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" onClick={() => void captureSelfie()} disabled={busy} className="gap-2">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      Capture selfie
                    </Button>
                    <Button type="button" variant="outline" onClick={stopSelfieCamera} className="gap-2">
                      Close camera
                    </Button>
                  </div>
                </div>
              ) : selfieFile && selfiePreviewUrl ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-xl border border-emerald-200 bg-black">
                    <img src={selfiePreviewUrl} alt="Captured selfie preview" className="aspect-[4/3] w-full object-cover" />
                  </div>
                  <p className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Selfie captured and optimized · {imageSizeLabel(selfieFile.size)}
                  </p>
                  <Button type="button" variant="outline" className="w-full gap-2" disabled={busy} onClick={() => void openSelfieCamera()}>
                    <RotateCcw className="h-4 w-4" /> Retake selfie
                  </Button>
                </div>
              ) : (
                <Button type="button" className="w-full gap-2" disabled={busy} onClick={() => void openSelfieCamera()}>
                  <Camera className="h-4 w-4" /> Open front camera
                </Button>
              )}
              {cameraError && <p role="alert" className="text-sm text-destructive">{cameraError}</p>}
            </section>

            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
              <FileImage className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Document photos and the camera selfie are automatically resized and compressed to fit the 5 MB upload limit.</p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-sm leading-5">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
              <span>I consent to storing and checking these documents for identity verification and withdrawal access.</span>
            </label>
            <p className="text-xs leading-5 text-muted-foreground">Your images are stored privately and opened only by authenticated administrators for verification. Submit your own valid identity document.</p>

            <Button type="submit" className="w-full" disabled={busy || !consent || cameraOpen}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing photos…</> : <><Upload className="mr-2 h-4 w-4" />Submit identity details</>}
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
