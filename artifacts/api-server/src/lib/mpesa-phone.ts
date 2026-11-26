const MPESA_LOCAL_PHONE_PATTERN = /^0[17]\d{8}$/;

export function normalizeMpesaPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const localNumber = digits.startsWith("254")
    ? `0${digits.slice(3)}`
    : digits.startsWith("0")
      ? digits
      : `0${digits}`;

  return MPESA_LOCAL_PHONE_PATTERN.test(localNumber) ? localNumber : null;
}
