import { describe, expect, it } from "vitest";
import { normalizeMpesaPhone } from "../src/lib/mpesa-phone";

describe("normalizeMpesaPhone", () => {
  it.each([
    ["0712345678", "0712345678"],
    ["070 123 4567", "0701234567"],
    ["079-123-4567", "0791234567"],
    ["0102345678", "0102345678"],
    ["011 234 5678", "0112345678"],
    ["+254 712 345 678", "0712345678"],
    ["254-11-234-5678", "0112345678"],
    ["712345678", "0712345678"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeMpesaPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "25412345678", "+1 212 555 0123", "0801234567"])(
    "rejects unsupported number format %s",
    (input) => {
      expect(normalizeMpesaPhone(input)).toBeNull();
    },
  );
});
