export type StartupPhase = "boot" | "cache" | "banners" | "products";

export interface StartupProgressState {
  progress: number;
  label: string;
  phases: Record<StartupPhase, boolean>;
}

const DEFAULT_PHASE_LABELS: Record<StartupPhase, string> = {
  boot: "Ilova ishga tushmoqda...",
  cache: "Do‘kon tayyorlanmoqda...",
  banners: "Katalog yuklanmoqda...",
  products: "Mahsulotlar tayyorlanmoqda...",
};

const READY_LABEL = "Guli Market'ga xush kelibsiz!";

const INITIAL_PHASES = (): Record<StartupPhase, boolean> => ({
  boot: false,
  cache: false,
  banners: false,
  products: false,
});

let state: StartupProgressState = {
  progress: 0,
  label: DEFAULT_PHASE_LABELS.boot,
  phases: INITIAL_PHASES(),
};

function syncWindowState() {
  if (typeof window === "undefined") return;
  (window as Window & { __guliStartupState?: StartupProgressState }).__guliStartupState = {
    progress: state.progress,
    label: state.label,
    phases: { ...state.phases },
  };
}

function emitProgress() {
  syncWindowState();
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("guli_startup_progress", {
        detail: {
          progress: state.progress,
          label: state.label,
        },
      }),
    );
  } catch {
    // CustomEvent dispatch should never break non-DOM environments
  }
}

export function getStartupProgressState(): StartupProgressState {
  return {
    progress: state.progress,
    label: state.label,
    phases: { ...state.phases },
  };
}

export function reportStartupProgress(progress: number, label?: string): StartupProgressState {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const nextProgress = Math.max(state.progress, clamped);
  const nextLabel =
    nextProgress >= 100
      ? READY_LABEL
      : label && label.trim()
        ? label.trim()
        : state.label;

  state = {
    ...state,
    progress: nextProgress,
    label: nextLabel,
  };
  emitProgress();
  return getStartupProgressState();
}

export function markStartupPhase(phase: StartupPhase, customLabel?: string): StartupProgressState {
  const nextPhases: Record<StartupPhase, boolean> = {
    ...state.phases,
    [phase]: true,
  };
  if (phase === "banners" || phase === "products") {
    nextPhases.boot = true;
    nextPhases.cache = true;
  } else if (phase === "cache") {
    nextPhases.boot = true;
  }

  let computedProgress = state.progress;
  let computedLabel = customLabel?.trim() || state.label;

  if (nextPhases.banners && nextPhases.products) {
    computedProgress = 100;
    computedLabel = READY_LABEL;
  } else if (nextPhases.products) {
    computedProgress = Math.max(computedProgress, 84);
    computedLabel = customLabel?.trim() || DEFAULT_PHASE_LABELS.products;
  } else if (nextPhases.banners) {
    computedProgress = Math.max(computedProgress, 66);
    computedLabel = customLabel?.trim() || DEFAULT_PHASE_LABELS.banners;
  } else if (nextPhases.cache) {
    computedProgress = Math.max(computedProgress, 40);
    computedLabel = customLabel?.trim() || DEFAULT_PHASE_LABELS.cache;
  } else if (nextPhases.boot) {
    computedProgress = Math.max(computedProgress, 18);
    computedLabel = customLabel?.trim() || DEFAULT_PHASE_LABELS.boot;
  }

  state = {
    progress: Math.max(state.progress, Math.min(100, computedProgress)),
    label: state.progress >= 100 ? READY_LABEL : computedLabel,
    phases: nextPhases,
  };
  emitProgress();
  return getStartupProgressState();
}

/**
 * Pure interpolation helper driving the splash progress bar.
 * Moves smoothly toward real backend milestones while gently trickling up to a
 * ceiling slightly ahead of the active milestone so slow networks visibly animate
 * without falsely claiming 100% before initial storefront data arrives.
 */
export function computeNextSplashProgress(displayed: number, targetMilestone: number): number {
  const safeDisplayed = Math.max(0, Math.min(100, Number.isFinite(displayed) ? displayed : 0));
  const safeTarget = Math.max(0, Math.min(100, Number.isFinite(targetMilestone) ? targetMilestone : 0));

  if (safeTarget >= 100) {
    if (safeDisplayed >= 99.6) return 100;
    const step = Math.max(3.6, (100 - safeDisplayed) * 0.34);
    return Math.min(100, Math.round((safeDisplayed + step) * 10) / 10);
  }

  // Catch up smoothly to real reported milestone first
  if (safeDisplayed < safeTarget) {
    const gap = safeTarget - safeDisplayed;
    const step = Math.max(1.8, gap * 0.28);
    return Math.min(safeTarget, Math.round((safeDisplayed + step) * 10) / 10);
  }

  // Gentle sub-step trickle while waiting on the next milestone, capped below 93%
  const trickleCeiling = Math.min(93, Math.max(36, safeTarget + 18));
  if (safeDisplayed >= trickleCeiling) {
    return safeDisplayed;
  }

  const remaining = trickleCeiling - safeDisplayed;
  const microStep = Math.max(0.18, remaining * 0.045);
  return Math.min(trickleCeiling, Math.round((safeDisplayed + microStep) * 10) / 10);
}

export function resetStartupProgressForTest(): void {
  state = {
    progress: 0,
    label: DEFAULT_PHASE_LABELS.boot,
    phases: INITIAL_PHASES(),
  };
  syncWindowState();
}
