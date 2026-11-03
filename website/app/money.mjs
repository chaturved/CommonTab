export function parseAmount(value) {
  const text = String(value).trim();
  if (!/^(?:\d{1,10})(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents <= 100_000_000_000 ? cents : null;
}

export function parsePercentage(value) {
  const text = String(value).trim();
  if (!/^(?:\d{1,3})(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return basisPoints <= 10_000 ? basisPoints : null;
}

export function splitBill(billCents, tipBasisPoints, people) {
  if (!Number.isSafeInteger(billCents) || billCents < 0 || billCents > 100_000_000_000 ||
      !Number.isInteger(tipBasisPoints) || tipBasisPoints < 0 || tipBasisPoints > 10_000 ||
      !Number.isInteger(people) || people < 1 || people > 20) {
    throw new RangeError("Invalid bill, tip, or people count");
  }

  const tipCents = Math.floor((billCents * tipBasisPoints + 5_000) / 10_000);
  const distribute = (cents) => Array.from({ length: people }, (_, index) =>
    Math.floor(cents / people) + (index < cents % people ? 1 : 0));
  const billShares = distribute(billCents);
  const tipShares = distribute(tipCents);
  return {
    billCents,
    tipCents,
    totalCents: billCents + tipCents,
    shares: billShares.map((bill, index) => bill + tipShares[index]),
  };
}
