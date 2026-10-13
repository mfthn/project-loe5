"use client";

import { useEffect, useRef, useState } from "react";

// Stopwatch digital untuk time study (BRD Story 2.1).
// Hasilnya disimpan di input tersembunyi bernama "seconds" sehingga ikut terkirim saat form disubmit.
export function Stopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // dalam detik, bisa pecahan
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now();
    const id = setInterval(() => {
      setElapsed(baseRef.current + (performance.now() - (startRef.current ?? 0)) / 1000);
    }, 100);
    return () => {
      clearInterval(id);
      // Simpan waktu yang sudah berjalan agar bisa dilanjutkan
      if (startRef.current !== null) {
        baseRef.current += (performance.now() - startRef.current) / 1000;
        startRef.current = null;
      }
    };
  }, [running]);

  const reset = () => {
    setRunning(false);
    baseRef.current = 0;
    setElapsed(0);
  };

  return (
    <div>
      <div className="stopwatch">{elapsed.toFixed(1)} detik</div>
      <input type="hidden" name="seconds" value={elapsed.toFixed(2)} />
      <div className="row-actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn secondary" onClick={() => setRunning((r) => !r)}>
          {running ? "Jeda" : "Mulai"}
        </button>
        <button type="button" className="btn secondary" onClick={reset}>Reset</button>
      </div>
    </div>
  );
}
