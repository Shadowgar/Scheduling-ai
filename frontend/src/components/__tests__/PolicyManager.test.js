import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PolicyManager from "../PolicyManager";

// Mock apiFetch
jest.mock("../../utils/api", () => ({
  apiFetch: jest.fn(),
  API_BASE_URL: "http://localhost:5000"
}));

describe("PolicyManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("accessToken", "test-token");
  });

  it("renders policy table and allows sorting (expected use)", async () => {
    const { apiFetch } = require("../../utils/api");
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 1,
          filename: "PolicyA.pdf",
          file_type: "PDF",
          uploaded_at: "2025-04-12T12:00:00Z",
          status: "Indexed",
          chunk_count: 5,
          error_message: ""
        },
        {
          id: 2,
          filename: "PolicyB.docx",
          file_type: "DOCX",
          uploaded_at: "2025-04-11T10:00:00Z",
          status: "Error",
          chunk_count: 0,
          error_message: "Failed to extract text"
        }
      ]
    });

    render(<PolicyManager />);
    expect(await screen.findByText("PolicyA.pdf")).toBeInTheDocument();
    expect(screen.getByText("PolicyB.docx")).toBeInTheDocument();
    expect(screen.getByText("Indexed")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();

    // Sort by Chunks
    fireEvent.click(screen.getByText("Chunks"));
    // Should still show both rows
    expect(screen.getByText("PolicyA.pdf")).toBeInTheDocument();
    expect(screen.getByText("PolicyB.docx")).toBeInTheDocument();
  });

  it("filters policies by search (edge case)", async () => {
    const { apiFetch } = require("../../utils/api");
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 1,
          filename: "PolicyA.pdf",
          file_type: "PDF",
          uploaded_at: "2025-04-12T12:00:00Z",
          status: "Indexed",
          chunk_count: 5,
          error_message: ""
        }
      ]
    });

    render(<PolicyManager />);
    expect(await screen.findByText("PolicyA.pdf")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "docx" }
    });
    // Should not find any DOCX
    expect(screen.queryByText("PolicyA.pdf")).not.toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "notfound" }
    });
    expect(screen.queryByText("PolicyA.pdf")).toBeNull();
  });

  it("shows error on failed fetch (failure case)", async () => {
    const { apiFetch } = require("../../utils/api");
    apiFetch.mockResolvedValueOnce({
      ok: false
    });

    render(<PolicyManager />);
    expect(await screen.findByText(/error fetching policies/i)).toBeInTheDocument();
  });
});
