"use client";

import React from "react";
import dynamic from "next/dynamic";
const GaugeComponent = dynamic(() => import('react-gauge-component'), { ssr: false });

type HappinessGaugeProps = {
  value?: number; // Nilai 0–100
  label?: string;
  size?: number | string; // Diameter chart
};

export default function HappinessGauge({ value = 0, label = "", size = "100%" }: HappinessGaugeProps) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="w-full max-w-[460px]" style={{ height: size }}>
        <GaugeComponent
          type="semicircle"
          style={{ width: "100%", height: "100%" }}
          arc={{
            width: 0.3,
            padding: 0.005,
            cornerRadius: 1,
            subArcs: [
              {
                limit: 40,
                color: "#EA4228",
                showTick: true,
                tooltip: {
                  text: "Risiko Tinggi!",
                },
              },
              {
                limit: 60,
                color: "#F5CD19",
                showTick: true,
                tooltip: {
                  text: "Perlu Perhatian!",
                },
              },
              {
                limit: 80,
                color: "#5BE12C",
                showTick: true,
                tooltip: {
                  text: "Baik!",
                },
              },
              {
                color: "#3B82F6",
                tooltip: {
                  text: "Sangat Baik!",
                },
              },
            ],
          }}
          pointer={{
            color: "#345243",
            length: 0.8,
            width: 15,
            elastic: true,
          }}
          labels={{
            valueLabel: { formatTextValue: (currentValue) => String(currentValue) },
            tickLabels: {
              type: "outer",
              defaultTickValueConfig: {
                formatTextValue: (tickValue: number) => String(tickValue),
                style: { fontSize: 14 },
              },
            },
          }}
          value={value}
          minValue={1}
          maxValue={100}
        />
      </div>

      <p className="mt-2 text-center text-sm font-medium text-gray-700">
        {label || "Rata-rata Indeks Kebahagiaan Sekolah (SHI Overall)"}
      </p>
    </div>
  )
}
