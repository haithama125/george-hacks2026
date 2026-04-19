import { put } from "@vercel/blob";
import { PDFParse } from "pdf-parse";
import { getData } from "pdf-parse/worker";

import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

PDFParse.setWorker(getData());

function sanitizeFilename(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "") || "report.pdf";
}

function getTextPreview(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 300);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const name = formData.get("name");
    const file = formData.get("file");

    if (typeof name !== "string" || !name.trim()) {
      return Response.json({ error: "Please enter your name." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return Response.json({ error: "Please upload a PDF file." }, { status: 400 });
    }

    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "Please upload a PDF file only." }, { status: 400 });
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json({ error: "Please upload a PDF under 4MB." }, { status: 400 });
    }

    const blob = await put(`lab-reports/${Date.now()}-${sanitizeFilename(file.name)}`, file, {
      access: "private",
      addRandomSuffix: true,
      contentType: file.type,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    await parser.destroy();

    const extractedText = textResult.text.trim();
    const textLength = extractedText.length;
    const likelyScanned = textLength < 200;
    const now = new Date();

    const document = {
      name: name.trim(),
      status: "text_extracted" as const,
      fileName: file.name,
      mimeType: "application/pdf" as const,
      sizeBytes: file.size,
      storageProvider: "vercel-blob" as const,
      storageKey: blob.pathname,
      storageUrl: blob.url,
      extractedText,
      textLength,
      likelyScanned,
      parsedLabs: null,
      parseWarnings: likelyScanned
        ? ["The extracted PDF text is very short. This report may be scanned, so parsing quality may be limited without OCR."]
        : [],
      geminiModel: null,
      geminiRawResponse: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDatabase();
    const result = await db.collection("labReports").insertOne(document);

    return Response.json({
      reportId: result.insertedId.toString(),
      status: document.status,
      fileName: document.fileName,
      storageUrl: document.storageUrl,
      textLength: document.textLength,
      likelyScanned: document.likelyScanned,
      textPreview: getTextPreview(document.extractedText),
      parsedLabs: null,
      parseWarnings: document.parseWarnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload and process the PDF.";

    return Response.json({ error: message }, { status: 500 });
  }
}
