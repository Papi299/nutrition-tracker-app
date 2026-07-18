"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createNativeBarcodeDetector,
  resolveNativeScannerCapability,
  type NativeBarcodeDetector,
  type NativeScannerCapability,
} from "@/lib/barcodes/scanner-capabilities";
import {
  classifyCameraError,
  reduceScannerDetections,
  type CameraErrorState,
} from "@/lib/barcodes/scanner-detection";
import { createScannerLifecycle } from "@/lib/barcodes/scanner-lifecycle";
import { barcodeRouteCanonicalQuery } from "@/lib/barcodes/query";
import { isCanonicalCalendarDate } from "@/lib/calendar-date";
import { parseDiaryMealTypeQuery } from "@/lib/diary-entries/validation";

type ScannerState =
  | "checking_capability"
  | "capability_unavailable"
  | "ready"
  | "requesting_permission"
  | "camera_active"
  | "completing"
  | CameraErrorState
  | "invalid_detection"
  | "unsupported_detection"
  | "multiple_detections"
  | "detection_error"
  | "cancelled";

type VideoWithFrameCallbacks = HTMLVideoElement & {
  cancelVideoFrameCallback?: (handle: number) => void;
  requestVideoFrameCallback?: (
    callback: (now: number) => void,
  ) => number;
};

const preferredConstraints: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    height: { ideal: 720 },
    width: { ideal: 1280 },
  },
};

const alertStates = new Set<ScannerState>([
  "permission_denied",
  "camera_unavailable",
  "camera_busy",
  "constraint_failure",
  "security_error",
  "camera_aborted",
  "camera_error",
  "invalid_detection",
  "unsupported_detection",
  "multiple_detections",
  "detection_error",
]);

const retryStates = new Set<ScannerState>([
  "permission_denied",
  "camera_unavailable",
  "camera_busy",
  "constraint_failure",
  "security_error",
  "camera_aborted",
  "camera_error",
  "invalid_detection",
  "unsupported_detection",
  "multiple_detections",
  "detection_error",
  "cancelled",
]);

function browserErrorName(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error
    ? (error as { name?: unknown }).name
    : null;
}

export function BarcodeCameraScanner({
  formId,
  routePath,
}: {
  formId: string;
  routePath: string;
}) {
  const t = useTranslations("BarcodeLookup.scanner");
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [state, setState] = useState<ScannerState>("checking_capability");
  const stateRef = useRef<ScannerState>("checking_capability");
  const capabilityRef = useRef<Extract<
    NativeScannerCapability,
    { status: "available" }
  > | null>(null);
  const [lifecycle] = useState(createScannerLifecycle);
  const videoRef = useRef<HTMLVideoElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const transition = useCallback((nextState: ScannerState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const cancelScan = useCallback(() => {
    transition("cancelled");
    lifecycle.cancel();
  }, [lifecycle, transition]);

  useEffect(() => {
    let current = true;
    const detector = (globalThis as { BarcodeDetector?: unknown })
      .BarcodeDetector;

    void resolveNativeScannerCapability({
      barcodeDetector: detector,
      isSecureContext: window.isSecureContext,
      mediaDevices: navigator.mediaDevices,
    }).then((capability) => {
      if (!current) return;
      if (capability.status === "available") {
        capabilityRef.current = capability;
        transition("ready");
      } else {
        transition("capability_unavailable");
      }
    });

    return () => {
      current = false;
      lifecycle.cancel();
    };
  }, [lifecycle, transition]);

  useEffect(() => {
    function stopForPageExit() {
      if (
        stateRef.current === "requesting_permission" ||
        stateRef.current === "camera_active"
      ) {
        cancelScan();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") stopForPageExit();
    }

    window.addEventListener("pagehide", stopForPageExit);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", stopForPageExit);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cancelScan]);

  useEffect(() => {
    if (alertStates.has(state) || state === "cancelled") {
      headingRef.current?.focus();
    }
  }, [state]);

  const currentRouteQuery = useCallback(
    (canonicalGtin: string) => {
      const form = document.getElementById(formId);
      if (!(form instanceof HTMLFormElement)) return null;

      const values = new FormData(form);
      const date = values.get("date");
      const mealValue = values.get("mealType");
      if (typeof date !== "string" || !isCanonicalCalendarDate(date)) {
        return null;
      }
      if (typeof mealValue !== "string") return null;

      const meal = parseDiaryMealTypeQuery(
        mealValue === "" ? undefined : mealValue,
      );
      if (meal.status === "invalid" || meal.status === "repeated") return null;

      return barcodeRouteCanonicalQuery({
        code: canonicalGtin,
        date,
        mealType: meal.status === "valid" ? meal.meal_type : null,
      });
    },
    [formId],
  );

  const startDetectionLoop = useCallback(
    (
      session: number,
      detector: NativeBarcodeDetector,
      video: VideoWithFrameCallbacks,
    ) => {
      let lastAttempt = 0;

      const finishWithState = (nextState: ScannerState) => {
        if (!lifecycle.isCurrent(session)) return;
        transition(nextState);
        lifecycle.release(session);
      };

      const attemptDetection = async () => {
        if (!lifecycle.isCurrent(session)) return;
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          scheduleNext();
          return;
        }

        let detections;
        try {
          detections = await detector.detect(video);
        } catch {
          finishWithState("detection_error");
          return;
        }

        if (!lifecycle.isCurrent(session)) return;
        const result = reduceScannerDetections(detections);

        if (result.status === "none") {
          scheduleNext();
          return;
        }
        if (result.status === "invalid") {
          finishWithState("invalid_detection");
          return;
        }
        if (result.status === "unsupported") {
          finishWithState("unsupported_detection");
          return;
        }
        if (result.status === "multiple") {
          finishWithState("multiple_detections");
          return;
        }

        const query = currentRouteQuery(result.canonical_gtin);
        if (query === null) {
          finishWithState("invalid_detection");
          return;
        }

        transition("completing");
        lifecycle.release(session);
        if (
          lifecycle.isCurrent(session) &&
          lifecycle.navigateOnce(session)
        ) {
          router.push(`${routePath}?${query}`);
        }
      };

      const scheduleNext = () => {
        if (!lifecycle.isCurrent(session)) return;

        if (
          typeof video.requestVideoFrameCallback === "function" &&
          typeof video.cancelVideoFrameCallback === "function"
        ) {
          const handle = video.requestVideoFrameCallback((now) => {
            if (!lifecycle.isCurrent(session)) return;
            if (now - lastAttempt < 250) {
              scheduleNext();
              return;
            }
            lastAttempt = now;
            void attemptDetection();
          });
          lifecycle.ownSchedule(session, () =>
            video.cancelVideoFrameCallback?.(handle),
          );
          return;
        }

        const handle = window.setTimeout(() => {
          lastAttempt = performance.now();
          void attemptDetection();
        }, 250);
        lifecycle.ownSchedule(session, () => window.clearTimeout(handle));
      };

      scheduleNext();
    },
    [currentRouteQuery, lifecycle, routePath, router, transition],
  );

  const startScan = useCallback(async () => {
    const capability = capabilityRef.current;
    if (capability === null) return;

    const session = lifecycle.begin();
    transition("requesting_permission");

    let stream: MediaStream;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia(
          preferredConstraints,
        );
      } catch (error) {
        if (browserErrorName(error) !== "OverconstrainedError") throw error;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }
    } catch (error) {
      if (!lifecycle.isCurrent(session)) return;
      transition(classifyCameraError(error));
      lifecycle.release(session);
      return;
    }

    const video = videoRef.current;
    if (video === null) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    if (!lifecycle.ownStream(session, stream, video)) {
      return;
    }
    video.srcObject = stream;

    for (const track of stream.getTracks()) {
      track.addEventListener(
        "ended",
        () => {
          if (
            lifecycle.isCurrent(session) &&
            stateRef.current === "camera_active"
          ) {
            transition("camera_unavailable");
            lifecycle.cancel();
          }
        },
        { once: true },
      );
    }

    try {
      await video.play();
      if (!lifecycle.isCurrent(session)) return;
      const detector = createNativeBarcodeDetector(capability);
      transition("camera_active");
      startDetectionLoop(session, detector, video);
    } catch {
      if (!lifecycle.isCurrent(session)) return;
      transition("detection_error");
      lifecycle.release(session);
    }
  }, [lifecycle, startDetectionLoop, transition]);

  const showVideo =
    state === "requesting_permission" ||
    state === "camera_active" ||
    state === "completing";
  const showCancel =
    state === "requesting_permission" || state === "camera_active";
  const showStart = state === "ready";
  const showRetry = retryStates.has(state);

  if (!hydrated) return null;

  return (
    <section
      aria-labelledby="barcode-camera-title"
      className="grid max-w-3xl gap-4 border border-teal-200 bg-teal-50 p-5 shadow-sm sm:p-6"
      data-testid="barcode-camera-scanner"
    >
      <div>
        <h2
          className="text-xl font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          id="barcode-camera-title"
          ref={headingRef}
          tabIndex={-1}
        >
          {t("title")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {t("privacy")}
        </p>
      </div>

      <div
        aria-live={alertStates.has(state) ? undefined : "polite"}
        className="text-sm leading-6 text-slate-800"
        data-scanner-state={state}
        role={alertStates.has(state) ? "alert" : "status"}
      >
        {t(`states.${state}`)}
      </div>

      <video
        aria-label={t("videoLabel")}
        autoPlay
        className="aspect-video w-full bg-slate-950 object-cover"
        data-testid="barcode-camera-preview"
        hidden={!showVideo}
        muted
        playsInline
        ref={videoRef}
      />

      <div className="flex flex-wrap gap-3">
        {showStart && (
          <button className={primaryButtonClass} onClick={startScan} type="button">
            {t("actions.scan")}
          </button>
        )}
        {showRetry && (
          <button className={primaryButtonClass} onClick={startScan} type="button">
            {t("actions.rescan")}
          </button>
        )}
        {showCancel && (
          <button className={secondaryButtonClass} onClick={cancelScan} type="button">
            {t("actions.cancel")}
          </button>
        )}
        {alertStates.has(state) && (
          <button className={secondaryButtonClass} onClick={cancelScan} type="button">
            {t("actions.dismiss")}
          </button>
        )}
      </div>

      <p className="text-sm leading-6 text-slate-700">{t("manualFallback")}</p>
    </section>
  );
}

const primaryButtonClass =
  "min-h-12 bg-teal-700 px-5 text-sm font-semibold text-white outline-none hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2";
const secondaryButtonClass =
  "min-h-12 border border-teal-700 bg-white px-5 text-sm font-semibold text-teal-800 outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2";
