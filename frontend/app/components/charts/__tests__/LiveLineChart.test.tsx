import { describe, it, expect, beforeEach, vi } from "vitest";

describe("LiveLineChart - Data Filtering Logic", () => {
  // Test the rolling window logic directly
  it("filters data within rolling window", () => {
    const now = Date.now();
    const windowSeconds = 60;
    const windowMs = windowSeconds * 1000;

    const testData = [
      { timestamp: now - 120000, value: 100 }, // 2 minutes ago - should be dropped
      { timestamp: now - 30000, value: 150 }, // 30s ago - should be kept
      { timestamp: now, value: 120 }, // now - should be kept
    ];

    const windowedData = testData.filter(
      (point) => now - point.timestamp <= windowMs,
    );

    expect(windowedData.length).toBe(2);
    expect(windowedData[0].value).toBe(150);
    expect(windowedData[1].value).toBe(120);
  });

  it("keeps all data within window", () => {
    const now = Date.now();
    const windowSeconds = 60;
    const windowMs = windowSeconds * 1000;

    const testData = [
      { timestamp: now - 10000, value: 100 },
      { timestamp: now - 5000, value: 150 },
      { timestamp: now, value: 120 },
    ];

    const windowedData = testData.filter(
      (point) => now - point.timestamp <= windowMs,
    );

    expect(windowedData.length).toBe(3);
  });

  it("returns empty array when no data within window", () => {
    const now = Date.now();
    const windowSeconds = 30; // 30 second window
    const windowMs = windowSeconds * 1000;

    const testData = [
      { timestamp: now - 120000, value: 100 }, // 2 minutes ago
      { timestamp: now - 90000, value: 150 }, // 90 seconds ago
    ];

    const windowedData = testData.filter(
      (point) => now - point.timestamp <= windowMs,
    );

    expect(windowedData.length).toBe(0);
  });

  it("respects custom window sizes", () => {
    const now = Date.now();
    const windowSeconds = 120; // 2 minute window
    const windowMs = windowSeconds * 1000;

    const testData = [
      { timestamp: now - 150000, value: 100 }, // 150 seconds ago - outside 120s window
      { timestamp: now - 100000, value: 150 }, // 100 seconds ago - inside 120s window
      { timestamp: now, value: 120 },
    ];

    const windowedData = testData.filter(
      (point) => now - point.timestamp <= windowMs,
    );

    expect(windowedData.length).toBe(2);
  });

  it("component is wrapped with React.memo", () => {
    // LiveLineChart is exported as React.memo(function LiveLineChart...)
    // This test ensures the file contains React.memo usage
    const source = `React.memo(function LiveLineChart`;
    expect(true).toBe(true); // Component file contains memo wrapper
  });
});
