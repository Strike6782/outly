"use client";

import {
  createContext,
  useReducer,
  useRef,
  useCallback,
  useEffect,
  useContext,
  type ReactNode,
} from "react";
import type {
  Toast,
  ToastType,
  ToastAction,
  ToastState,
  UseToastReturn,
} from "@/types";
import { ToastContainer } from "@/components/ToastContainer";

// ─── Constants ───

export const MAX_VISIBLE_TOASTS = 5;

export const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 5000,
  info: 5000,
  error: 8000,
  warning: 8000,
};

// ─── Reducer ───

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "ADD_TOAST": {
      const toasts = [...state.toasts, action.payload];
      // Enforce max visible: evict oldest non-exiting if exceeded
      const nonExiting = toasts.filter((t) => !t.isExiting);
      if (nonExiting.length > MAX_VISIBLE_TOASTS) {
        const oldest = nonExiting[0];
        return {
          toasts: toasts.map((t) =>
            t.id === oldest.id ? { ...t, isExiting: true } : t
          ),
        };
      }
      return { toasts };
    }

    case "DISMISS_TOAST": {
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.payload.id ? { ...t, isExiting: true } : t
        ),
      };
    }

    case "REMOVE_TOAST": {
      return {
        toasts: state.toasts.filter((t) => t.id !== action.payload.id),
      };
    }

    case "PAUSE_TOAST": {
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.payload.id ? { ...t, isPaused: true } : t
        ),
      };
    }

    case "RESUME_TOAST": {
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.payload.id
            ? { ...t, isPaused: false, remainingTime: action.payload.remainingTime }
            : t
        ),
      };
    }

    case "START_EXIT": {
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.payload.id ? { ...t, isExiting: true } : t
        ),
      };
    }

    default:
      return state;
  }
}

// ─── Context ───

interface ToastContextValue {
  addToast: (type: ToastType, message: string, options?: { duration?: number; title?: string }) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── ID Generation ───

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

// ─── Provider ───

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pauseTimestampsRef = useRef<Map<string, number>>(new Map());

  const startTimer = useCallback((id: string, duration: number) => {
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      timersRef.current.delete(id);
      dispatch({ type: "START_EXIT", payload: { id } });
    }, duration);

    timersRef.current.set(id, timer);
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, options?: { duration?: number; title?: string }): string => {
      // Silently ignore empty messages
      if (!message || message.trim() === "") return "";

      const id = generateId();
      const duration = options?.duration ?? DEFAULT_DURATIONS[type];

      const toast: Toast = {
        id,
        type,
        message,
        title: options?.title,
        duration,
        createdAt: Date.now(),
        isPaused: false,
        remainingTime: duration,
        isExiting: false,
      };

      dispatch({ type: "ADD_TOAST", payload: toast });
      startTimer(id, duration);

      return id;
    },
    [startTimer]
  );

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    dispatch({ type: "START_EXIT", payload: { id } });
  }, []);

  const pauseToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    pauseTimestampsRef.current.set(id, Date.now());
    dispatch({ type: "PAUSE_TOAST", payload: { id } });
  }, []);

  const resumeToast = useCallback(
    (id: string) => {
      const toast = state.toasts.find((t) => t.id === id);
      if (!toast) return;

      const pausedAt = pauseTimestampsRef.current.get(id);
      const elapsed = pausedAt ? Date.now() - pausedAt : 0;
      const remaining = Math.max(toast.remainingTime - elapsed, 0);

      pauseTimestampsRef.current.delete(id);
      dispatch({ type: "RESUME_TOAST", payload: { id, remainingTime: remaining } });

      if (remaining > 0) {
        startTimer(id, remaining);
      } else {
        dispatch({ type: "START_EXIT", payload: { id } });
      }
    },
    [state.toasts, startTimer]
  );

  const handleExitComplete = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    pauseTimestampsRef.current.delete(id);
    dispatch({ type: "REMOVE_TOAST", payload: { id } });
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, dismissToast }}>
      {children}
      <ToastContainer
        toasts={state.toasts}
        onDismiss={dismissToast}
        onPause={pauseToast}
        onResume={resumeToast}
        onExitComplete={handleExitComplete}
      />
    </ToastContext.Provider>
  );
}

// ─── Hook ───

export function useToast(): UseToastReturn {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
