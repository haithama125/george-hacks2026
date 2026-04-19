"use client";

import { useState } from "react";

type ParsedLab = {
  key: string;
  label: string;
  value: number | string | null;
  unit: string | null;
  referenceRange: string | null;
  flag: "low" | "normal" | "high" | "abnormal" | "unknown";
  sourceText: string | null;
};

type LabReportResponse = {
  reportId: string;
  status: "text_extracted" | "parsed";
  fileName: string;
  storageUrl?: string;
  textLength: number;
  likelyScanned: boolean;
  textPreview: string;
  parsedLabs: ParsedLab[] | null;
  parseWarnings: string[];
  errorMessage?: string | null;
};

function formatLabValue(lab: ParsedLab) {
  if (lab.value === null || lab.value === "") {
    return "No value";
  }

  return `${lab.value}${lab.unit ? ` ${lab.unit}` : ""}`;
}

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [report, setReport] = useState<LabReportResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;

    if (!selectedFile) {
      setFile(null);
      setError("");
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setFile(null);
      setError("Please upload a PDF file only.");
      return;
    }

    setFile(selectedFile);
    setError("");
    setSubmitError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim() || !file) return;

    setIsUploading(true);
    setSubmitError("");
    setReport(null);

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("file", file);

    try {
      const response = await fetch("/api/lab-reports", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as LabReportResponse & { error?: string };

      if (!response.ok) {
        setSubmitError(payload.error ?? "Upload failed.");
        return;
      }

      setReport(payload);
    } catch {
      setSubmitError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleParse = async () => {
    if (!report) return;

    setIsParsing(true);
    setSubmitError("");

    try {
      const response = await fetch(`/api/lab-reports/${report.reportId}/parse`, {
        method: "POST",
      });

      const payload = (await response.json()) as LabReportResponse & { error?: string };

      if (!response.ok) {
        setSubmitError(payload.error ?? "Parsing failed.");
        return;
      }

      setReport((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          status: payload.status,
          parsedLabs: payload.parsedLabs,
          parseWarnings: payload.parseWarnings,
        };
      });
    } catch {
      setSubmitError("Parsing failed. Please try again.");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="rounded-2xl border bg-white p-8 shadow-md">
          <h1 className="mb-2 text-center text-2xl font-bold">Get Started</h1>
          <p className="mb-6 text-center text-sm text-gray-600">
          Enter your name and upload your bloodwork report as a PDF.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <div>
              <label htmlFor="pdf" className="mb-2 block text-sm font-medium">
                Bloodwork PDF
              </label>
              <input
                id="pdf"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="w-full rounded-lg border px-4 py-3"
              />

              <p className="mt-2 text-xs text-gray-500">
                Server upload mode is capped at 4MB so it stays deployable on Vercel.
              </p>

              {file && <p className="mt-2 text-sm text-green-600">Selected: {file.name}</p>}

              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            {submitError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>}

            <button
              type="submit"
              disabled={!name.trim() || !file || isUploading}
              className="w-full rounded-lg bg-black py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? "Uploading and extracting..." : "Upload and extract text"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border bg-white p-8 shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Lab Report Processing</h2>
              <p className="mt-2 text-sm text-gray-600">
                Upload stores the PDF in Vercel Blob, extracts text on the server, and saves the result in MongoDB.
              </p>
            </div>

            {report ? (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                {report.status.replace("_", " ")}
              </span>
            ) : null}
          </div>

          {!report ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
              Your extracted text preview and parsed lab values will appear here after upload.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">File</p>
                  <p className="mt-2 text-sm font-medium text-gray-900">{report.fileName}</p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Extracted Text</p>
                  <p className="mt-2 text-sm font-medium text-gray-900">{report.textLength.toLocaleString()} characters</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {report.likelyScanned ? "Likely scanned PDF" : "Looks like text-based PDF"}
                  </p>
                </div>
              </div>

              {report.parseWarnings.length > 0 ? (
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                  {report.parseWarnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Text Preview</h3>
                  {report.status !== "parsed" ? (
                    <button
                      type="button"
                      onClick={handleParse}
                      disabled={isParsing || report.textLength === 0}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isParsing ? "Parsing with Gemini..." : "Parse with Gemini"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 rounded-2xl bg-gray-950 p-4 text-sm leading-6 text-gray-100">
                  {report.textPreview || "No text extracted from the PDF."}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Parsed Labs</h3>

                {!report.parsedLabs || report.parsedLabs.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
                    No parsed lab values yet.
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {report.parsedLabs.map((lab) => (
                      <article key={lab.key} className="rounded-2xl border bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-gray-900">{lab.label}</h4>
                            <p className="mt-1 text-sm text-gray-600">{formatLabValue(lab)}</p>
                            {lab.referenceRange ? (
                              <p className="mt-1 text-sm text-gray-500">Reference range: {lab.referenceRange}</p>
                            ) : null}
                          </div>

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                            {lab.flag}
                          </span>
                        </div>

                        {lab.sourceText ? <p className="mt-3 text-sm text-gray-600">Source: {lab.sourceText}</p> : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
