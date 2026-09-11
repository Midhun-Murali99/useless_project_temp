"use client";

import { useEffect, useRef, useState } from "react";
import type { DetectedObject, ObjectDetection } from "@tensorflow-models/coco-ssd";

const CONFIDENCE_THRESHOLD = 0.45;
const DETECTION_INTERVAL_MS = 150;

type CameraViewProps = {
  onCapture: (image: string) => void;
  onAnalyze: (image: string, detection: DetectedObject) => void;
  onError?: (message: string) => void;
  isAnalyzing?: boolean;
};

type CameraStatus = "off" | "starting" | "active" | "error";
type DetectionStatus = "loading" | "ready" | "detecting" | "error";

function describeCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Camera permission was denied. Allow camera access in your browser and try again.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera was found on this device.";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "The camera is already in use or could not be started.";
    }
  }

  return "The camera could not be started. Check your browser and camera connection.";
}

function describeDetectionError(error: unknown): string {
  return error instanceof Error
    ? `Object detection failed: ${error.message}`
    : "Object detection failed. Refresh the page and try again.";
}

export default function CameraView({ onCapture, onAnalyze, onError, isAnalyzing = false }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<ObjectDetection | null>(null);
  const detectionFrameRef = useRef<number | null>(null);
  const detectionRunningRef = useRef(false);
  const detectionInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const lastDetectionRef = useRef(0);
  const [status, setStatus] = useState<CameraStatus>("off");
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>("loading");
  const [modelReady, setModelReady] = useState(false);
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [capturedFrame, setCapturedFrame] = useState("");
  const [error, setError] = useState("");

  function stopDetection() {
    detectionRunningRef.current = false;
    detectionInFlightRef.current = false;
    if (detectionFrameRef.current !== null) {
      cancelAnimationFrame(detectionFrameRef.current);
      detectionFrameRef.current = null;
    }
    setDetections([]);
    setSelectedIndex(null);
  }

  function stopTracks() {
    stopDetection();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "This browser does not support camera access.";
      setError(message);
      setStatus("error");
      onError?.(message);
      return;
    }

    setError("");
    setCapturedFrame("");
    setStatus("starting");
    try {
      stopTracks();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("active");
    } catch (cameraError) {
      const message = describeCameraError(cameraError);
      stopTracks();
      setError(message);
      setStatus("error");
      onError?.(message);
    }
  }

  function stopCamera() {
    stopTracks();
    setError("");
    setStatus("off");
    if (detectionStatus !== "error") setDetectionStatus("ready");
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video || status !== "active" || video.videoWidth === 0 || video.videoHeight === 0) {
      const message = "The camera frame is not ready yet. Start the camera and try again.";
      setError(message);
      onError?.(message);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      const message = "This browser could not prepare a canvas for frame capture.";
      setError(message);
      onError?.(message);
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.9);
    if (!image) {
      const message = "The camera frame could not be captured.";
      setError(message);
      onError?.(message);
      return;
    }

    setError("");
    setCapturedFrame(image);
    stopTracks();
    setStatus("off");
    onCapture(image);
  }

  function analyzeSelectedObject() {
    const video = videoRef.current;
    const detection = selectedIndex === null ? undefined : detections[selectedIndex];
    if (!video || status !== "active" || !detection) {
      const message = "Select a detected object before analyzing its doom.";
      setError(message);
      onError?.(message);
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      const message = "The camera frame is not ready yet. Start the camera and try again.";
      setError(message);
      onError?.(message);
      return;
    }

    const [x, y, width, height] = detection.bbox;
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(video.videoWidth, Math.ceil(x + width));
    const bottom = Math.min(video.videoHeight, Math.ceil(y + height));
    const cropWidth = right - left;
    const cropHeight = bottom - top;

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) ||
        cropWidth <= 0 || cropHeight <= 0) {
      const message = "The selected object has an invalid crop region.";
      setError(message);
      onError?.(message);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      const message = "This browser could not prepare a canvas for object analysis.";
      setError(message);
      onError?.(message);
      return;
    }

    context.drawImage(video, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    const image = canvas.toDataURL("image/jpeg", 0.9);
    if (!image) {
      const message = "The selected object could not be cropped.";
      setError(message);
      onError?.(message);
      return;
    }

    setError("");
    onAnalyze(image, detection);
  }

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function loadModel() {
      try {
        const [{ load }] = await Promise.all([
          import("@tensorflow-models/coco-ssd"),
          import("@tensorflow/tfjs"),
        ]);
        const model = await load({ base: "lite_mobilenet_v2" });
        if (cancelled) {
          model.dispose();
          return;
        }
        modelRef.current = model;
        setModelReady(true);
        setDetectionStatus("ready");
      } catch (modelError) {
        if (!cancelled) {
          const message = describeDetectionError(modelError);
          setDetectionStatus("error");
          setError(message);
          onError?.(message);
        }
      }
    }

    void loadModel();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      stopTracks();
      modelRef.current?.dispose();
      modelRef.current = null;
    };
  }, [onError]);

  useEffect(() => {
    if (status !== "active" || !modelReady || !modelRef.current) return;

    detectionRunningRef.current = true;
    const runDetection = async (timestamp: number) => {
      if (!detectionRunningRef.current || !mountedRef.current) return;

      if (
        timestamp - lastDetectionRef.current >= DETECTION_INTERVAL_MS &&
        !detectionInFlightRef.current
      ) {
        const video = videoRef.current;
        const model = modelRef.current;
        if (video && model && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          lastDetectionRef.current = timestamp;
          detectionInFlightRef.current = true;
          setDetectionStatus("detecting");
          try {
            const results = await model.detect(video);
            if (detectionRunningRef.current && mountedRef.current) {
              setDetections(results.filter((result) => result.score >= CONFIDENCE_THRESHOLD));
              setDetectionStatus("ready");
            }
          } catch (detectionError) {
            if (detectionRunningRef.current && mountedRef.current) {
              const message = describeDetectionError(detectionError);
              setDetectionStatus("error");
              setError(message);
              onError?.(message);
              stopDetection();
            }
          } finally {
            detectionInFlightRef.current = false;
          }
        }
      }

      if (detectionRunningRef.current) {
        detectionFrameRef.current = requestAnimationFrame((nextTimestamp) => {
          void runDetection(nextTimestamp);
        });
      }
    };

    detectionFrameRef.current = requestAnimationFrame((timestamp) => {
      void runDetection(timestamp);
    });

    return stopDetection;
  }, [modelReady, onError, status]);

  const isActive = status === "active";
  const detectionLabel =
    detectionStatus === "loading"
      ? "Loading model"
      : detectionStatus === "detecting"
        ? "Detecting"
        : detectionStatus === "error"
          ? "Error"
          : "Ready";
  const statusLabel =
    status === "starting" ? "CAMERA STARTING" : isActive ? "CAMERA ACTIVE" : "CAMERA OFF";

  return (
    <div className="space-y-4">
      <div className="scan-grid relative overflow-hidden rounded-xl border border-[#243149] bg-[#050810] shadow-comic">
        {capturedFrame && !isActive ? (
          <img
            src={capturedFrame}
            alt="Captured camera frame"
            className="aspect-video w-full object-contain bg-[#050810]"
          />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className={`aspect-video w-full object-cover ${isActive ? "block" : "hidden"}`}
          />
        )}
        {isActive && videoRef.current && (
          <div className="pointer-events-none absolute inset-0">
            {detections.map((detection, index) => {
              const [x, y, width, height] = detection.bbox;
              const videoWidth = videoRef.current?.videoWidth || 1;
              const videoHeight = videoRef.current?.videoHeight || 1;
              const isSelected = selectedIndex === index;
              return (
                <div
                  key={`${detection.class}-${index}`}
                  className={`absolute border-2 ${isSelected ? "border-[#4de4ff] shadow-[0_0_16px_rgba(77,228,255,0.8)]" : "border-[#ff3b4d]"}`}
                  style={{
                    left: `${(x / videoWidth) * 100}%`,
                    top: `${(y / videoHeight) * 100}%`,
                    width: `${(width / videoWidth) * 100}%`,
                    height: `${(height / videoHeight) * 100}%`,
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Select ${detection.class}`}
                    onClick={() => setSelectedIndex(index)}
                    className="pointer-events-auto absolute inset-0 h-full w-full cursor-pointer"
                  />
                  <span className={`absolute -top-6 left-[-2px] whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${isSelected ? "bg-[#4de4ff] text-slate-950" : "bg-[#ff3b4d]"}`}>
                    {detection.class} {Math.round(detection.score * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {!isActive && (
          <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-neutral-600">
            {status === "starting"
              ? "Opening the lens..."
              : capturedFrame
                ? ""
                : "Camera is off"}
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full border border-[#243149] bg-[#0e1422]/90 px-3 py-1 text-xs font-bold tracking-wider text-slate-200">
          <span className={`mr-2 inline-block h-2 w-2 rounded-full ${isActive ? "bg-[#4de4ff]" : "bg-slate-500"}`} />
          {capturedFrame && !isActive ? "FRAME CAPTURED" : statusLabel}
        </div>
      </div>

      <div className="grid gap-2 text-xs font-semibold text-neutral-700 sm:grid-cols-2">
        <span>Detection threshold: {Math.round(CONFIDENCE_THRESHOLD * 100)}%</span>
        <span>Detection: {detectionLabel}</span>
      </div>

      <div className="rounded-xl border border-[#243149] bg-[#0e1422] p-3">
        <p className="font-chunky text-xs uppercase tracking-wider text-[#4de4ff]">Detected Objects</p>
        {detections.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {detections.map((detection, index) => (
              <li
                key={`${detection.class}-list-${index}`}
                className={`rounded-full border px-2.5 py-1 text-xs ${selectedIndex === index ? "border-[#4de4ff] bg-[#12313b] font-semibold text-[#4de4ff]" : "border-red-900/70 bg-red-950/50 text-red-200"}`}
              >
                <button type="button" onClick={() => setSelectedIndex(index)}>
                  {detection.class} {Math.round(detection.score * 100)}%
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm font-semibold text-neutral-600">
            {isActive ? "Scanning the camera view..." : "Start the camera to scan for objects."}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {!isActive ? (
          <button
            type="button"
            onClick={startCamera}
            disabled={status === "starting"}
            className="rounded-lg border border-[#ff3b4d] bg-[#ff3b4d] px-4 py-2 font-chunky text-white transition hover:bg-[#ff5363] disabled:cursor-wait disabled:bg-slate-800"
          >
            {status === "starting" ? "Starting..." : "Start Camera"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={captureFrame}
              className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-500"
            >
              Capture Frame
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-lg border border-[#243149] bg-[#121a2b] px-4 py-2 font-chunky text-slate-200 transition hover:border-slate-500"
            >
              Stop Camera
            </button>
          </>
        )}
      </div>

      {selectedIndex !== null && detections[selectedIndex] && (
        <div className="rounded-xl border border-[#4de4ff]/40 bg-[#10232d] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#4de4ff]">Selected object</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{detections[selectedIndex].class}</p>
              <p className="text-sm text-slate-400">
                Confidence: {Math.round(detections[selectedIndex].score * 100)}%
              </p>
              <p className="text-sm text-slate-400">Doom Score: Not analyzed</p>
            </div>
            <button
              type="button"
              onClick={analyzeSelectedObject}
              disabled={isAnalyzing}
              className="rounded-lg bg-[#4de4ff] px-4 py-2 font-semibold text-slate-950 transition hover:bg-[#7eecff] disabled:cursor-wait disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Doom 💀"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
