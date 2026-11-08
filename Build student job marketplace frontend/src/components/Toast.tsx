import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

let _setToasts: React.Dispatch<React.SetStateAction<ToastData[]>> | null = null;
let _counter = 0;

export function toast(message: string, type: ToastType = "info") {
  if (_setToasts) {
    const id = ++_counter;
    _setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      _setToasts?.((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }
}

const icons = { success: CheckCircle, error: AlertCircle, info: Info };
const styles = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  error: "bg-red-50 border-red-200 text-red-800",
  info: "bg-[#faf8f6] border-[#e8ddd7] text-[#1a1210]",
};
const iconStyles = { success: "text-emerald-500", error: "text-red-500", info: "text-[#896558]" };

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  _setToasts = setToasts;

  return (
    <div className="fixed bottom-4 sm:bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 z-[9999] flex flex-col items-stretch sm:items-end gap-2.5 pointer-events-none">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium w-full sm:w-auto sm:max-w-sm pointer-events-auto animate-in ${styles[t.type]}`}
            style={{ animation: "slideUp 0.25s ease" }}
          >
            <Icon size={16} className={`flex-shrink-0 ${iconStyles[t.type]}`} />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} className="opacity-50 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
