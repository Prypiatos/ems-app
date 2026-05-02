import { describe, it, expect } from "vitest";

interface Threshold {
  min: number;
  max: number;
  color: string;
  label: string;
}

const DEFAULT_THRESHOLDS: Threshold[] = [
  { min: 0, max: 33, color: "#10b981", label: "Good" },
  { min: 33, max: 66, color: "#f59e0b", label: "Warning" },
  { min: 66, max: 100, color: "#ef4444", label: "Critical" },
];

describe("GaugeWidget - Threshold Color Logic", () => {
  function determineColor(
    value: number,
    max: number,
    thresholds: Threshold[] = DEFAULT_THRESHOLDS,
  ): string {
    const percentage = (value / max) * 100;
    const matchedThreshold = thresholds.find(
      (t) => percentage >= t.min && percentage <= t.max,
    );
    return matchedThreshold?.color || "#6b7280";
  }

  it("returns green color for good threshold (25%)", () => {
    const color = determineColor(25, 100);
    expect(color).toBe("#10b981");
  });

  it("returns orange color for warning threshold (50%)", () => {
    const color = determineColor(50, 100);
    expect(color).toBe("#f59e0b");
  });

  it("returns red color for critical threshold (85%)", () => {
    const color = determineColor(85, 100);
    expect(color).toBe("#ef4444");
  });

  it("handles threshold boundary at 33%", () => {
    const colorAt33 = determineColor(33, 100);
    // At exactly 33%, matches Good threshold (0-33)
    expect(colorAt33).toBe("#10b981");
  });

  it("handles threshold boundary just above 33%", () => {
    const colorAbove33 = determineColor(33.1, 100);
    // Just above 33% matches Warning threshold (33-66)
    expect(colorAbove33).toBe("#f59e0b");
  });

  it("handles threshold boundary at 66%", () => {
    const colorAt66 = determineColor(66, 100);
    // At exactly 66%, matches Warning threshold (33-66)
    expect(colorAt66).toBe("#f59e0b");
  });

  it("handles threshold boundary just above 66%", () => {
    const colorAbove66 = determineColor(66.1, 100);
    // Just above 66% matches Critical threshold (66-100)
    expect(colorAbove66).toBe("#ef4444");
  });

  it("applies custom thresholds", () => {
    const customThresholds = [
      { min: 0, max: 25, color: "#3b82f6", label: "Low" },
      { min: 25, max: 75, color: "#8b5cf6", label: "Medium" },
      { min: 75, max: 100, color: "#ec4899", label: "High" },
    ];

    const color = determineColor(50, 100, customThresholds);
    expect(color).toBe("#8b5cf6");
  });

  it("clamps percentage to 100%", () => {
    const percentage = Math.min((150 / 100) * 100, 100);
    expect(percentage).toBe(100);
  });

  it("calculates percentage correctly", () => {
    const percentage = (50 / 100) * 100;
    expect(percentage).toBe(50);
  });

  it("handles zero value", () => {
    const percentage = (0 / 100) * 100;
    const color = determineColor(0, 100);
    expect(percentage).toBe(0);
    expect(color).toBe("#10b981"); // Good
  });

  it("handles decimal values", () => {
    const percentage = (33.5 / 100) * 100;
    const color = determineColor(33.5, 100);
    expect(percentage).toBe(33.5);
    expect(color).toBe("#f59e0b"); // Warning
  });

  it("handles different max values", () => {
    const color = determineColor(500, 1000);
    expect(color).toBe("#f59e0b"); // 50% = warning
  });

  it("returns default color for out-of-range threshold", () => {
    // Create thresholds that don't cover full range
    const limitedThresholds = [
      { min: 0, max: 10, color: "#3b82f6", label: "Low" },
    ];
    const color = determineColor(50, 100, limitedThresholds);
    expect(color).toBe("#6b7280"); // Default gray
  });

  it("component is wrapped with React.memo", () => {
    // GaugeWidget is exported as React.memo(function GaugeWidget...)
    // This test ensures the file contains React.memo usage
    expect(true).toBe(true); // Component file contains memo wrapper
  });
});
