ALTER TABLE "kyc_submissions"
  ADD COLUMN IF NOT EXISTS "nationality" text,
  ADD COLUMN IF NOT EXISTS "selfie_image_url" text;
