import { describe, expect, it } from "vitest";
import {
  dayDelta,
  defaultLabel,
  formatOffset,
  hourIn,
  isValidZone,
  offsetMinutes,
  searchZones,
} from "./clocks";

describe("world clocks", () => {
  it("follows daylight saving changes", () => {
    const winter = new Date(Date.UTC(2026, 0, 15, 12));
    const summer = new Date(Date.UTC(2026, 6, 15, 12));
    expect(offsetMinutes("America/New_York", winter)).toBe(-300);
    expect(offsetMinutes("America/New_York", summer)).toBe(-240);
    expect(offsetMinutes("Europe/London", winter)).toBe(0);
    expect(offsetMinutes("Europe/London", summer)).toBe(60);
    // The southern hemisphere shifts the other way.
    expect(offsetMinutes("Australia/Sydney", winter)).toBe(660);
    expect(offsetMinutes("Australia/Sydney", summer)).toBe(600);
    expect(offsetMinutes("Asia/Kolkata", summer)).toBe(330);
  });

  it("changes offset exactly at the transition", () => {
    // US clocks spring forward at 02:00 local (07:00 UTC) on 8 March 2026.
    expect(offsetMinutes("America/New_York", new Date(Date.UTC(2026, 2, 8, 6, 59)))).toBe(-300);
    expect(offsetMinutes("America/New_York", new Date(Date.UTC(2026, 2, 8, 7, 0)))).toBe(-240);
    expect(hourIn("America/New_York", new Date(Date.UTC(2026, 2, 8, 7, 0)))).toBe(3);
  });

  it("formats offsets", () => {
    expect(formatOffset(480)).toBe("UTC+8");
    expect(formatOffset(330)).toBe("UTC+5:30");
    expect(formatOffset(-240)).toBe("UTC−4");
    expect(formatOffset(0)).toBe("UTC");
  });

  it("labels tomorrow and yesterday relative to a reference zone", () => {
    const date = new Date(Date.UTC(2026, 10, 3, 20)); // 04:00 on 4 Nov in Beijing
    expect(dayDelta("Asia/Shanghai", date, "Europe/London")).toBe(1);
    expect(dayDelta("America/Los_Angeles", date, "Asia/Shanghai")).toBe(-1);
    expect(dayDelta("Europe/Paris", date, "Europe/London")).toBe(0);
  });

  it("finds cities in either language and validates zones", () => {
    expect(searchZones("纽约", "zh-CN")[0]).toEqual({ zone: "America/New_York", label: "纽约" });
    expect(searchZones("lisbon", "en")[0]).toEqual({ zone: "Europe/Lisbon", label: "Lisbon" });
    expect(defaultLabel("Asia/Tokyo", "en")).toBe("Tokyo");
    expect(isValidZone("Mars/Olympus")).toBe(false);
  });
});
