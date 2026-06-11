const crypto = require("crypto");

const OCR_PROVIDER = "aws_textract";
const MAINTENANCE_KEYWORDS = [
  "oil change",
  "brake",
  "tire",
  "alignment",
  "inspection",
  "service",
  "repair",
  "maintenance",
  "mileage",
  "vin",
  "invoice",
  "labor",
  "parts",
  "dealership",
  "mechanic"
];
const TITLE_BRANDING_TERMS = ["salvage", "rebuilt", "junk", "flood", "lemon", "clean"];

class TextractError extends Error {
  constructor(message, { status = 500, code = "textract_error", detail = "" } = {}) {
    super(message);
    this.name = "TextractError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function config() {
  const region = process.env.TEXTRACT_AWS_REGION || process.env.AWS_REGION || process.env.S3_REGION || "";
  const accessKeyId = process.env.TEXTRACT_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.TEXTRACT_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "";
  if (!region || !accessKeyId || !secretAccessKey) return null;
  return { region, accessKeyId, secretAccessKey };
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function signHeaders({ region, accessKeyId, secretAccessKey }, target, payload) {
  const host = `textract.${region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/textract/aws4_request`;
  const canonicalHeaders = [
    "content-type:application/x-amz-json-1.1",
    `host:${host}`,
    `x-amz-date:${amzDate}`,
    `x-amz-target:${target}`
  ].join("\n") + "\n";
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256(payload)
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join("\n");
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "textract");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  return {
    host,
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-date": amzDate,
      "x-amz-target": target,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    }
  };
}

async function callTextract(target, body) {
  const cfg = config();
  if (!cfg) {
    throw new TextractError("AWS Textract credentials are missing.", {
      status: 503,
      code: "missing_textract_credentials"
    });
  }
  const payload = JSON.stringify(body);
  const signed = signHeaders(cfg, target, payload);
  const response = await fetch(`https://${signed.host}/`, {
    method: "POST",
    headers: signed.headers,
    body: payload
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new TextractError("AWS Textract request failed.", {
      status: response.status >= 500 ? 502 : response.status,
      code: "textract_request_failed",
      detail: JSON.stringify(data)
    });
  }
  return data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractLines(blocks = []) {
  return blocks
    .filter((block) => block.BlockType === "LINE" && block.Text)
    .map((block) => block.Text)
    .join("\n");
}

async function extractTextFromS3({ bucket, key }) {
  const result = await extractTextFromS3WithMetadata({ bucket, key });
  return result.text;
}

async function extractTextFromS3WithMetadata({ bucket, key }) {
  const start = await callTextract("Textract.StartDocumentTextDetection", {
    DocumentLocation: {
      S3Object: { Bucket: bucket, Name: key }
    }
  });
  const jobId = start.JobId;
  if (!jobId) {
    throw new TextractError("AWS Textract did not return a job id.", { code: "textract_job_missing" });
  }

  let nextToken = "";
  let pageCount = 0;
  let blockCount = 0;
  const metadata = {
    jobId,
    jobStatus: "IN_PROGRESS",
    pages: 0,
    blocks: 0,
    startedAt: new Date().toISOString(),
    completedAt: ""
  };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(Number(process.env.TEXTRACT_POLL_INTERVAL_MS || 1500));
    const result = await callTextract("Textract.GetDocumentTextDetection", {
      JobId: jobId,
      ...(nextToken ? { NextToken: nextToken } : {})
    });
    metadata.jobStatus = result.JobStatus || metadata.jobStatus;
    if (result.JobStatus === "FAILED") {
      throw new TextractError("AWS Textract OCR job failed.", { code: "textract_job_failed", detail: JSON.stringify(result) });
    }
    if (result.JobStatus === "SUCCEEDED") {
      const blocks = result.Blocks || [];
      pageCount += blocks.filter((block) => block.BlockType === "PAGE").length;
      blockCount += blocks.length;
      let text = extractLines(blocks);
      nextToken = result.NextToken || "";
      while (nextToken) {
        const page = await callTextract("Textract.GetDocumentTextDetection", { JobId: jobId, NextToken: nextToken });
        const pageBlocks = page.Blocks || [];
        pageCount += pageBlocks.filter((block) => block.BlockType === "PAGE").length;
        blockCount += pageBlocks.length;
        text += `\n${extractLines(pageBlocks)}`;
        nextToken = page.NextToken || "";
      }
      metadata.jobStatus = "SUCCEEDED";
      metadata.pages = pageCount || result.DocumentMetadata?.Pages || 0;
      metadata.blocks = blockCount;
      metadata.completedAt = new Date().toISOString();
      return { text: text.trim(), metadata };
    }
  }
  throw new TextractError("AWS Textract OCR job is still processing.", { code: "textract_job_timeout" });
}

function matchedKeywords(text, keywords = MAINTENANCE_KEYWORDS) {
  const lower = String(text || "").toLowerCase();
  return keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
}

function extractVins(text) {
  return Array.from(new Set(String(text || "").toUpperCase().match(/[A-HJ-NPR-Z0-9]{17}/g) || []));
}

function classifyMaintenance(text) {
  const matches = matchedKeywords(text);
  if (matches.length >= 2) return { status: "looks_like_maintenance_record", matchedKeywords: matches };
  if (matches.length === 1 || String(text || "").trim().length > 30) return { status: "needs_review", matchedKeywords: matches };
  return { status: "rejected_unrelated", matchedKeywords: matches };
}

function classifyTitle(text, listing = {}) {
  const lower = String(text || "").toLowerCase();
  const vins = extractVins(text);
  const listingVin = String(listing.vin || "").toUpperCase();
  const branding = matchedKeywords(text, TITLE_BRANDING_TERMS);
  const titleSignals = ["title", "certificate of title", "vehicle identification", "odometer", "lienholder"].filter((term) => lower.includes(term));
  const vehicleMatches = [listing.year, listing.make, listing.model]
    .filter(Boolean)
    .filter((value) => lower.includes(String(value).toLowerCase()));
  const keywords = Array.from(new Set([...branding, ...titleSignals, ...vehicleMatches.map(String)]));

  if (listingVin && vins.includes(listingVin)) {
    return { status: "title_vin_matches_listing", matchedKeywords: keywords, extractedVins: vins, titleBrandingTerms: branding };
  }
  if (listingVin && vins.length > 0 && !vins.includes(listingVin)) {
    return { status: "title_vin_mismatch", matchedKeywords: keywords, extractedVins: vins, titleBrandingTerms: branding };
  }
  return { status: "title_needs_review", matchedKeywords: keywords, extractedVins: vins, titleBrandingTerms: branding };
}

function classifyDocument(documentType, text, listing) {
  if (documentType === "title") return classifyTitle(text, listing);
  return classifyMaintenance(text);
}

async function processDocument(document, listing, { bucket }) {
  const startedAt = new Date().toISOString();
  const documentType = document.document_type || document.documentType || "maintenance";
  try {
    const ocr = await extractTextFromS3WithMetadata({ bucket, key: document.s3Key });
    const text = ocr.text;
    const classification = classifyDocument(documentType, text, listing);
    return {
      ...document,
      extracted_text: text,
      extractedText: text,
      matched_keywords: classification.matchedKeywords || [],
      matchedKeywords: classification.matchedKeywords || [],
      document_check_status: classification.status,
      documentCheckStatus: classification.status,
      extractedVins: classification.extractedVins || [],
      titleBrandingTerms: classification.titleBrandingTerms || [],
      ocr_provider: OCR_PROVIDER,
      ocrProvider: OCR_PROVIDER,
      ocr_processed_at: startedAt,
      ocrProcessedAt: startedAt,
      ocr_status: "processed",
      ocrStatus: "processed",
      textract_job_id: ocr.metadata.jobId,
      textractJobId: ocr.metadata.jobId,
      textract_job_status: ocr.metadata.jobStatus,
      textractJobStatus: ocr.metadata.jobStatus,
      textract_metadata: ocr.metadata,
      textractMetadata: ocr.metadata
    };
  } catch (error) {
    console.error("[textract] OCR failed", {
      listingId: listing.id,
      documentId: document.id,
      documentType: document.document_type || document.documentType,
      error: error.message
    });
    return {
      ...document,
      matched_keywords: [],
      matchedKeywords: [],
      document_check_status: documentType === "title" ? "title_needs_review" : "needs_review",
      documentCheckStatus: documentType === "title" ? "title_needs_review" : "needs_review",
      ocr_provider: OCR_PROVIDER,
      ocrProvider: OCR_PROVIDER,
      ocr_error: error.message,
      ocrError: error.message,
      ocr_processed_at: startedAt,
      ocrProcessedAt: startedAt,
      ocr_status: "manual_review",
      ocrStatus: "manual_review",
      textract_job_status: error.code || "ocr_pending_manual_review",
      textractJobStatus: error.code || "ocr_pending_manual_review",
      textract_metadata: {
        status: error.code || "ocr_pending_manual_review",
        message: error.message,
        detail: error.detail || "",
        processedAt: startedAt
      },
      textractMetadata: {
        status: error.code || "ocr_pending_manual_review",
        message: error.message,
        detail: error.detail || "",
        processedAt: startedAt
      }
    };
  }
}

module.exports = {
  MAINTENANCE_KEYWORDS,
  OCR_PROVIDER,
  classifyDocument,
  config,
  extractVins,
  extractTextFromS3,
  extractTextFromS3WithMetadata,
  processDocument
};
