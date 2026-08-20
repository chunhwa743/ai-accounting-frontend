"use client";

import { useState } from "react";

import type { RunMetric } from "@/lib/api/types";
import { formatDate } from "@/lib/domain/format";

/**
 * The learning curve.
 *
 * Two counts of the same thing - transactions - so they share one axis. Runs are
 * discrete events rather than points on a timeline, so they are drawn as grouped
 * bars: a line would imply values in between that do not exist.
 *
 * Colour: emerald and amber, matching what those two ideas already mean
 * everywhere else in this app. The pair validates on both the light and dark card
 * surfaces (OKLCH lightness band, chroma floor, contrast) but sits in the
 * protanopia warning band at ΔE 7.9, which is legal only with a second channel
 * carrying the same information. Hence the value printed on every bar, the
 * legend, and the table underneath - identity is never colour alone.
 */
const SERIES = {
  resolved: { color: "#059669", label: "Coded by learned rules" },
  attention: { color: "#d97706", label: "Still needed a person" },
} as const;

const VIEW = { width: 720, height: 260 };
const PAD = { top: 16, right: 12, bottom: 44, left: 44 };

export function LearningCurve({ runs }: { runs: RunMetric[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (runs.length === 0) return null;

  const plotWidth = VIEW.width - PAD.left - PAD.right;
  const plotHeight = VIEW.height - PAD.top - PAD.bottom;

  const peak = Math.max(
    1,
    ...runs.map((run) => Math.max(run.resolved_without_model, run.needs_attention)),
  );
  const yMax = niceCeiling(peak);
  const y = (value: number) => PAD.top + plotHeight - (value / yMax) * plotHeight;

  const groupWidth = plotWidth / runs.length;
  // Thin marks: bars take a little over half the group, with a 2px surface gap
  // between the pair so the two fills never touch.
  const barWidth = Math.min(28, (groupWidth - 16) / 2);
  const ticks = [0, yMax / 2, yMax];

  const hoveredRun = hovered !== null ? runs[hovered] : null;

  return (
    <figure className="m-0 space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        {Object.values(SERIES).map((series) => (
          <span key={series.label} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="size-2.5 rounded-[2px]"
              style={{ backgroundColor: series.color }}
            />
            <span className="text-muted-foreground">{series.label}</span>
          </span>
        ))}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Transactions coded by learned rules against transactions still needing a person, across ${runs.length} runs.`}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Recessive grid: hairlines behind everything, no vertical rules. */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={VIEW.width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--muted-foreground)"
                fontSize={11}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(tick)}
              </text>
            </g>
          ))}

          {runs.map((run, index) => {
            const centre = PAD.left + groupWidth * (index + 0.5);
            const left = centre - barWidth - 1;
            const right = centre + 1;
            const active = hovered === index;

            return (
              <g
                key={run.run_id}
                onMouseEnter={() => setHovered(index)}
                style={{ opacity: hovered === null || active ? 1 : 0.45 }}
              >
                {/* A generous hit target, wider than the marks themselves. */}
                <rect
                  x={PAD.left + groupWidth * index}
                  y={PAD.top}
                  width={groupWidth}
                  height={plotHeight}
                  fill="transparent"
                />

                <Bar
                  x={left}
                  width={barWidth}
                  value={run.resolved_without_model}
                  yOf={y}
                  baseline={y(0)}
                  color={SERIES.resolved.color}
                />
                <Bar
                  x={right}
                  width={barWidth}
                  value={run.needs_attention}
                  yOf={y}
                  baseline={y(0)}
                  color={SERIES.attention.color}
                />

                {/* The second channel the CVD warning band requires. */}
                <ValueLabel
                  x={left + barWidth / 2}
                  y={y(run.resolved_without_model)}
                  value={run.resolved_without_model}
                />
                <ValueLabel
                  x={right + barWidth / 2}
                  y={y(run.needs_attention)}
                  value={run.needs_attention}
                />

                <text
                  x={centre}
                  y={VIEW.height - PAD.bottom + 18}
                  textAnchor="middle"
                  fill="var(--muted-foreground)"
                  fontSize={11}
                >
                  Run {run.run_id}
                </text>
              </g>
            );
          })}

          {/* Baseline last, so bars sit on it rather than under it. */}
          <line
            x1={PAD.left}
            x2={VIEW.width - PAD.right}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--border)"
            strokeWidth={1.5}
          />
        </svg>

        {hoveredRun ? (
          <div className="bg-popover text-popover-foreground pointer-events-none absolute top-0 right-0 rounded-md border px-3 py-2 text-xs shadow-sm">
            <div className="font-medium">Run {hoveredRun.run_id}</div>
            {hoveredRun.started_at ? (
              <div className="text-muted-foreground">{formatDate(hoveredRun.started_at)}</div>
            ) : null}
            <dl className="mt-1.5 space-y-0.5">
              <Row
                color={SERIES.resolved.color}
                label={SERIES.resolved.label}
                value={hoveredRun.resolved_without_model}
              />
              <Row
                color={SERIES.attention.color}
                label={SERIES.attention.label}
                value={hoveredRun.needs_attention}
              />
            </dl>
          </div>
        ) : null}
      </div>

      <figcaption className="text-muted-foreground text-xs">
        Every transaction the left bar covers is one the model was never asked about. As the
        right bar falls, less of the month needs a person at all.
      </figcaption>
    </figure>
  );
}

function Bar({
  x,
  width,
  value,
  yOf,
  baseline,
  color,
}: {
  x: number;
  width: number;
  value: number;
  yOf: (value: number) => number;
  baseline: number;
  color: string;
}) {
  const top = yOf(value);
  const height = Math.max(0, baseline - top);
  if (height === 0) return null;

  // Rounded at the data end only; the baseline end stays square so the bar reads
  // as anchored to zero. The clip keeps the bottom corners sharp.
  return (
    <path
      d={`M ${x} ${baseline}
          L ${x} ${top + Math.min(4, height)}
          Q ${x} ${top} ${x + Math.min(4, height, width / 2)} ${top}
          L ${x + width - Math.min(4, height, width / 2)} ${top}
          Q ${x + width} ${top} ${x + width} ${top + Math.min(4, height)}
          L ${x + width} ${baseline} Z`}
      fill={color}
    />
  );
}

function ValueLabel({ x, y, value }: { x: number; y: number; value: number }) {
  if (value === 0) return null;
  return (
    <text
      x={x}
      y={y - 6}
      textAnchor="middle"
      fill="var(--foreground)"
      fontSize={11}
      fontWeight={500}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {value}
    </text>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <dt className="text-muted-foreground flex-1">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Rounds up to something an axis can be labelled with. */
function niceCeiling(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}
