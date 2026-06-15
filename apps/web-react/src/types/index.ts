export interface Vehicle {
  id: string;
  userId: string;
  make: string;
  model: string;
  trim?: string;
  year: number;
  price: number;
  mileage: number;
  location: string;
  description: string;
  images: string[];
  status: 'available' | 'active' | 'sold' | 'pending_verification' | 'verification_in_progress' | 'draft' | string;
  createdAt: string;
  vin?: string;
  lat?: number;
  lng?: number;
  title?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  drivetrain?: string;
  exteriorColor?: string;
  color?: string;
  badges?: string[];
  features?: string[];
  titleStatus?: string;
  accidentHistory?: string;
  ownerCount?: string;
  maintenanceNames?: string[];
  titleDocument?: ListingDocument;
  maintenanceRecords?: Array<{
    id?: string;
    name: string;
    type?: string;
    date?: string;
    notes?: string;
  } & ListingDocument>;
  historyHighlights?: string[];
  historyTimeline?: Array<{
    id?: string;
    date?: string;
    title?: string;
    notes?: string;
  }>;
  listingAccuracyCertified?: boolean;
  listingAccuracyVersion?: string;
  listingAccuracyCertifiedAt?: string;
  listingAccuracyCertifiedIp?: string;
  marketCheckVin?: Record<string, unknown>;
  marketValue?: number | null;
  marketValueMsrp?: number | null;
  marketValueDate?: string;
  marketValueRadius?: number;
  marketValueComparableCount?: number;
  marketValueSource?: string;
  marketCheckDecodeError?: string;
  verificationStatus?: string;
  photoChallengeVerified?: boolean;
  livePhotoVerified?: boolean;
  challengeCodeVerified?: boolean;
  photoChallengeCode?: string;
  challengeCode?: string;
  photoChallengeProofImage?: string;
  photoChallengeCompletedAt?: string;
  vehiclePresenceVerified?: boolean;
  sellerNotification?: string;
  vehiclePresence?: {
    verification_code?: string;
    verificationCode?: string;
    generated_at?: string;
    generatedAt?: string;
    expires_at?: string;
    expiresAt?: string;
    verification_photo_url?: string;
    verificationPhotoUrl?: string;
    verification_status?: string;
    verificationStatus?: string;
    verified_at?: string;
    verifiedAt?: string;
    confidence?: number;
    analysisProvider?: string;
    analysisReason?: string;
  };
  inspectionVerified?: boolean;
  seller?: {
    id?: string;
    name?: string;
    initials?: string;
    verified?: boolean;
    responseTime?: string;
    responseRate?: number;
    phoneVerified?: boolean;
    completedSales?: number;
    memberSince?: string;
    rating?: number | null;
    reviewCount?: number;
  };
}

export interface ListingDocument {
  document_type?: string;
  documentType?: string;
  file_url?: string;
  fileUrl?: string;
  s3Key?: string;
  extracted_text?: string;
  extractedText?: string;
  matched_keywords?: string[];
  matchedKeywords?: string[];
  document_check_status?: string;
  documentCheckStatus?: string;
  ocr_provider?: string;
  ocrProvider?: string;
  ocr_processed_at?: string;
  ocrProcessedAt?: string;
  ocr_error?: string;
  ocrError?: string;
  ocr_status?: string;
  ocrStatus?: string;
  extractedVins?: string[];
  titleBrandingTerms?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  vehicleId: string;
  content: string;
  createdAt: string;
  scamRiskScore?: number;
  scamFlags?: string[];
  moderationStatus?: 'clear' | 'needs_review' | 'high_risk';
}

export interface SavedVehicle {
  id: string;
  userId: string;
  vehicleId: string;
  createdAt: string;
}
