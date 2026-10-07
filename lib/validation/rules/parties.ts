import type { ExtractedParty, ExtractedReceiptData } from "../../ocr/schema";

export interface LabeledParty {
  party: ExtractedParty;
  /** "de origen" / "de destino", para armar explicaciones legibles. */
  label: string;
}

export function labeledParties(data: ExtractedReceiptData): LabeledParty[] {
  return [
    { party: data.sender, label: "de origen" },
    { party: data.receiver, label: "de destino" },
  ];
}
