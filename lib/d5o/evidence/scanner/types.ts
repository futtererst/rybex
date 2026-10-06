export type EvidenceScanStatus = "clean" | "infected" | "scanner_unavailable" | "scan_failed";

export type EvidenceScanInput = {
  evidenceId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  bytes: Uint8Array;
  correlationId?: string;
};

export type EvidenceScanResult = {
  status: EvidenceScanStatus;
  scannedAt: string;
  scanner: string;
  detail: string;
};

export type EvidenceScanner = {
  scan(input: EvidenceScanInput): Promise<EvidenceScanResult>;
};
