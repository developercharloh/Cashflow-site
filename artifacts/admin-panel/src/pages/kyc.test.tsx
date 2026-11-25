import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KYC from "./kyc";

const cleanupEndpoint = "/api/kyc/admin/uploads/cleanup";
const cleanupHistoryEndpoint = "/api/kyc/admin/uploads/cleanup/history";
const privateObjectPath = "uploads/kyc/7/private-id.jpg";

let cleanupPayload: unknown;
let cleanupStatus: number;
let cleanupHistoryPayload: unknown;
let mockFetch: ReturnType<typeof vi.fn>;

function cleanupRequests() {
  return mockFetch.mock.calls.filter(([input]) => String(input) === cleanupEndpoint);
}

function previewPayload(eligible: number) {
  return {
    dryRun: true,
    cutoff: "2025-01-03T12:00:00.000Z",
    scanned: 10,
    olderThanCutoff: 3,
    referenced: 1,
    eligible,
    deleted: 0,
    pages: 1,
    hasMore: false,
    privatePath: privateObjectPath,
  };
}

beforeEach(() => {
  cleanupPayload = previewPayload(2);
  cleanupStatus = 200;
  cleanupHistoryPayload = [];
  mockFetch = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === cleanupEndpoint) {
      return new Response(JSON.stringify(cleanupPayload), {
        status: cleanupStatus,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(input) === cleanupHistoryEndpoint) {
      return new Response(JSON.stringify(cleanupHistoryPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("KYC upload cleanup safety", () => {
  it("shows administrator, cutoff, mode, and aggregate counts without rendering object paths", async () => {
    cleanupHistoryPayload = [{
      id: 9,
      ranAt: "2025-01-03T12:00:00.000Z",
      adminId: 1,
      cutoff: "2025-01-02T12:00:00.000Z",
      mode: "deletion",
      scanned: 20,
      olderThanCutoff: 8,
      referenced: 3,
      eligible: 5,
      deleted: 5,
      pages: 1,
      hasMore: false,
      privatePath: privateObjectPath,
    }];
    const { container } = render(<KYC />);

    expect(await screen.findByText(/Deletion ·/)).toBeTruthy();
    expect(container.textContent).toContain("Administrator #1");
    expect(container.textContent).toContain("Scanned");
    expect(container.textContent).toContain("20");
    expect(container.textContent).toContain("Deleted");
    expect(container.textContent).not.toContain(privateObjectPath);
    expect(mockFetch).toHaveBeenCalledWith(cleanupHistoryEndpoint, expect.anything());
  });

  it("previews with dryRun=true and does not delete until separately confirmed", async () => {
    const { container } = render(<KYC />);

    fireEvent.click(screen.getByRole("button", { name: "Preview cleanup" }));
    await screen.findByText("Eligible to delete");

    expect(cleanupRequests()).toHaveLength(1);
    expect(JSON.parse(cleanupRequests()[0]?.[1]?.body as string)).toEqual({ dryRun: true });
    expect(screen.getByRole("button", { name: /Review deletion of 2 uploads/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirm and delete/ })).toBeNull();
    expect(container.textContent).not.toContain(privateObjectPath);
  });

  it("requires eligible preview results and a second explicit confirmation", async () => {
    render(<KYC />);

    cleanupPayload = previewPayload(0);
    fireEvent.click(screen.getByRole("button", { name: "Preview cleanup" }));
    await screen.findByText("Eligible to delete");
    expect(screen.queryByRole("button", { name: /Review deletion/ })).toBeNull();
    expect(cleanupRequests()).toHaveLength(1);

    cleanupPayload = previewPayload(2);
    fireEvent.click(screen.getByRole("button", { name: "Preview cleanup" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Review deletion of 2 uploads/ })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Confirm and delete/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Review deletion of 2 uploads/ }));
    const confirmButton = screen.getByRole("button", { name: /Confirm and delete 2 uploads/ });
    expect(cleanupRequests()).toHaveLength(2);

    fireEvent.click(confirmButton);
    await waitFor(() => expect(cleanupRequests()).toHaveLength(3));
    expect(JSON.parse(cleanupRequests()[2]?.[1]?.body as string)).toEqual({ dryRun: false });
  });

  it("never displays private object paths from cleanup errors", async () => {
    cleanupStatus = 500;
    cleanupPayload = { error: `Unable to process ${privateObjectPath}` };
    const { container } = render(<KYC />);

    fireEvent.click(screen.getByRole("button", { name: "Preview cleanup" }));
    const error = await screen.findByRole("alert");

    expect(error.textContent).toContain("The cleanup request failed.");
    expect(container.textContent).not.toContain(privateObjectPath);
    expect(cleanupRequests()).toHaveLength(1);
    expect(JSON.parse(cleanupRequests()[0]?.[1]?.body as string)).toEqual({ dryRun: true });
  });
});
