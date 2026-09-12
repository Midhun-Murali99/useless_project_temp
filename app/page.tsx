"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

import CameraView from "@/components/CameraView";

type DoomPrediction = {
  prophecy: string;
  objectName: string;
  shortDescription: string;
  causeOfDeath: string;
  timeUntilDoom: string;
  lastWords: string;
  funeralNote: string;
  visualEvidence: string[];
  confidence: number;
  suggestedDoomScore: number;
};

type InputMode = "upload" | "camera";
type Theme = "dark" | "light";

const tones = ["dark", "savage", "existential", "corporate"] as const;
type Tone = (typeof tones)[number];

const loadingMessages = [
  "Consulting the void...",
  "Calculating entropy...",
  "Negotiating with fate...",
  "Inspecting the evidence...",
  "Estimating object mortality...",
];

const PREDICTION_TIMEOUT_MS = 60_000;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read the selected image"));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Unable to read the selected image"));
    reader.readAsDataURL(file);
  });
}

export default function HomePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [prediction, setPrediction] = useState<DoomPrediction | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [tone, setTone] = useState<Tone>("dark");
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [capturedImage, setCapturedImage] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("doomsday-theme");
    if (savedTheme === "light") setTheme("light");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("doomsday-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingElapsed(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setLoadingElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) return;

    const timer = window.setInterval(() => {
      setLoadingMessage((currentMessage) => {
        const currentIndex = loadingMessages.indexOf(currentMessage);
        return loadingMessages[(currentIndex + 1) % loadingMessages.length];
      });
    }, 4000);

    return () => window.clearInterval(timer);
  }, [isLoading]);

  function selectFile(nextFile: File | undefined) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    setFile(nextFile);
    setCapturedImage("");
    setPreviewUrl(URL.createObjectURL(nextFile));
    setPrediction(null);
    setError("");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  async function predictDoom(imageOverride?: string) {
    if (!imageOverride && !file && !capturedImage) {
      setError("Choose an image before asking the void for answers.");
      return;
    }

    setIsLoading(true);
    setError("");
    setPrediction(null);
    setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
    let predictionTimeout: number | undefined;

    try {
      const image = imageOverride || capturedImage || (file ? await fileToDataUrl(file) : "");
      const controller = new AbortController();
      predictionTimeout = window.setTimeout(() => controller.abort(), PREDICTION_TIMEOUT_MS);
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, tone }),
        signal: controller.signal,
      });
      const responseText = await response.text();
      let result: unknown;
      try {
        result = JSON.parse(responseText) as unknown;
      } catch {
        throw new Error(
          response.ok
            ? "The prediction service returned an invalid response."
            : `Prediction service error (${response.status}). Restart the server and try again.`,
        );
      }

      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "The prediction failed.";
        throw new Error(message);
      }

      setPrediction(result as DoomPrediction);
    } catch (requestError) {
      setError(
        requestError instanceof DOMException && requestError.name === "AbortError"
          ? "The prediction is taking too long. Please try again in a moment."
          : requestError instanceof Error
            ? requestError.message
            : "Something went wrong.",
      );
    } finally {
      if (predictionTimeout !== undefined) window.clearTimeout(predictionTimeout);
      setIsLoading(false);
    }
  }

  return (
    <main className={`min-h-screen px-4 py-8 text-slate-100 sm:px-6 sm:py-12 ${theme === "light" ? "theme-light" : ""}`}>
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 border-b border-slate-800 pb-7 sm:mb-10">
          <div className="flex items-center justify-between gap-4">
            <p className="font-chunky text-sm uppercase tracking-[0.35em] text-[#4de4ff]">DOOMSDAY / SYSTEM ONLINE</p>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-[#243149] bg-[#0e1422] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:block">
                Object intelligence
              </span>
              <button
                type="button"
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-lg border border-[#243149] bg-[#0e1422] px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-[#4de4ff] hover:text-[#4de4ff]"
              >
                {theme === "dark" ? (
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="mt-7 max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#ff3b4d]">
            Object doom predictor
          </p>
          <h1 className="font-chunky text-4xl uppercase leading-[0.95] tracking-wide sm:text-7xl">
            Everything has a destiny.
            <br />
            <span className="text-[#ff3b4d]">Unfortunately.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Show us an object. We&apos;ll identify it, inspect the evidence, and tell you how doomed it supposedly is.
          </p>
          </div>
        </header>

        <section className="rounded-2xl border-comic bg-[#0e1422]/95 p-4 shadow-comic-lg sm:p-7">
          <div className="mb-6 grid grid-cols-2 rounded-xl border-comic bg-[#070a12] p-1">
            {(["upload", "camera"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setInputMode(mode);
                  setError("");
                }}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  inputMode === mode
                    ? "bg-[#ff3b4d] text-white"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {mode === "upload" ? "Upload Image" : "Live Camera"}
              </button>
            ))}
          </div>

          {inputMode === "camera" ? (
            <CameraView
              onCapture={(image) => {
                setCapturedImage(image);
                setFile(null);
                setPrediction(null);
                setError("");
              }}
              onAnalyze={(image) => {
                void predictDoom(image);
              }}
              onError={setError}
              isAnalyzing={isLoading}
            />
          ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`scan-grid cursor-pointer rounded-xl border-comic border-dashed p-10 text-center transition ${
              isDragging
                ? "border-[#4de4ff] bg-[#142438]"
                : "border-[#243149] bg-[#0a101d] hover:border-[#4de4ff]/60"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Selected object preview"
                className="mx-auto max-h-80 rounded-lg object-contain"
              />
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#4de4ff]/60 text-2xl text-[#4de4ff]">+</div>
                <p className="font-chunky text-xl uppercase">Drop an image to begin</p>
                <p className="mt-2 text-sm text-slate-500">PNG, JPG or WEBP · Maximize the evidence</p>
              </>
            )}
            {file && <p className="mt-4 truncate text-sm text-slate-400">{file.name}</p>}
          </div>
          )}

          <button
            type="button"
            onClick={() => void predictDoom()}
            disabled={isLoading || (!file && !capturedImage)}
            className="mt-6 w-full rounded-xl border-comic border-[#ff3b4d] bg-[#ff3b4d] px-5 py-3.5 font-chunky uppercase tracking-wide text-white shadow-comic transition hover:bg-[#ff5363] disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {isLoading ? loadingMessage : "Predict Doom"}
          </button>

          {isLoading && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 flex items-center gap-3 rounded-xl border border-[#4de4ff]/40 bg-[#10232d] px-4 py-3 text-sm text-slate-200"
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#4de4ff]/30 border-t-[#4de4ff]"
              />
              <div className="min-w-0">
                <p className="font-semibold text-[#4de4ff]">Doom analysis in progress</p>
                <p className="truncate text-xs text-slate-400">
                  The oracle is examining your image... {loadingElapsed}s elapsed
                </p>
              </div>
            </div>
          )}

          <label className="mt-4 block text-sm font-bold text-slate-400">
            Prophecy tone
            <select
              value={tone}
              onChange={(event) => setTone(event.target.value as Tone)}
              disabled={isLoading}
              className="mt-2 w-full rounded-lg border-comic bg-[#070a12] px-3 py-2 text-slate-200 outline-none focus:border-[#4de4ff]"
            >
              {tones.map((toneOption) => (
                <option key={toneOption} value={toneOption}>
                  {toneOption.charAt(0).toUpperCase() + toneOption.slice(1)}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <div role="alert" className="mt-5 rounded-xl border border-red-900/80 bg-red-950/40 p-4 text-sm font-bold text-red-200">
              {error}
            </div>
          )}
        </section>

        {prediction && (
          <section className="mt-8 rounded-2xl border border-[#ff3b4d]/50 bg-[#0e1422] p-5 shadow-comic-lg sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <p className="text-sm uppercase tracking-widest text-[#4de4ff]">Subject identified</p>
                <h2 className="mt-1 font-chunky text-3xl uppercase">{prediction.objectName}</h2>
                <p className="mt-2 font-semibold text-slate-400">{prediction.shortDescription}</p>
              </div>
              <div className="rounded-xl border border-[#ff3b4d] bg-[#3a1420] px-5 py-3 text-center text-white shadow-[0_0_30px_rgba(255,59,77,0.18)]">
                <p className="text-xs uppercase tracking-wider">Doom score</p>
                <p className="font-chunky text-5xl text-[#ff3b4d]">{prediction.suggestedDoomScore}</p>
                <p className="text-xs">/ 100</p>
              </div>
            </div>

            <blockquote className="my-6 border-l-2 border-[#ff3b4d] pl-5 text-xl leading-relaxed text-slate-200">
              &ldquo;{prediction.prophecy}&rdquo;
            </blockquote>

            <div className="mb-5 rounded-xl border border-slate-800 bg-[#0a101d] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4de4ff]">
                Visual evidence
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {prediction.visualEvidence.map((evidence) => (
                  <li key={evidence} className="flex gap-2">
                    <span className="text-red-500">•</span>
                    <span>{evidence}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 border-t border-slate-800 pt-5 sm:grid-cols-2">
              <DoomDetail label="Cause of death" value={prediction.causeOfDeath} />
              <DoomDetail label="Time until doom" value={prediction.timeUntilDoom} />
              <DoomDetail label="Last words" value={`“${prediction.lastWords}”`} />
              <DoomDetail label="Funeral note" value={prediction.funeralNote} />
            </div>
            <div className="mt-5 flex gap-5 text-sm text-slate-500">
              <span>
                Oracle confidence: <strong className="text-[#4de4ff]">{prediction.confidence}%</strong>
              </span>
              <span>
                Doom score: <strong className="text-[#ff3b4d]">{prediction.suggestedDoomScore}/100</strong>
              </span>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function DoomDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#4de4ff]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}
