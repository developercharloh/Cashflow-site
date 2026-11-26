import { describe, expect, it } from "vitest";
import { getTaskLibraryTemplate, TASK_LIBRARY } from "../src/data/task-library";

describe("original task library", () => {
  it("contains a broad, reusable catalog with unique template IDs", () => {
    expect(TASK_LIBRARY.length).toBeGreaterThanOrEqual(36);
    expect(new Set(TASK_LIBRARY.map((template) => template.id)).size).toBe(TASK_LIBRARY.length);
    expect(TASK_LIBRARY.every((template) =>
      template.title.trim() &&
      template.description.trim() &&
      template.instructions.trim() &&
      template.reviewGuide.trim()
    )).toBe(true);
  });

  it("includes engineering and computer science under Academic Writing", () => {
    const academicTemplates = TASK_LIBRARY.filter((template) => template.category === "Academic Writing");
    expect(academicTemplates.filter((template) => template.title.startsWith("Engineering:")).length).toBeGreaterThanOrEqual(6);
    expect(academicTemplates.filter((template) => template.title.startsWith("Computer science:")).length).toBeGreaterThanOrEqual(6);
  });

  it("keeps every listed template publishable by ID", () => {
    for (const template of TASK_LIBRARY) {
      expect(getTaskLibraryTemplate(template.id)).toEqual(template);
    }
  });
});
