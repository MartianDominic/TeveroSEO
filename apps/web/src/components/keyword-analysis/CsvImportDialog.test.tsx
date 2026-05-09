/**
 * Tests for CsvImportDialog Component
 * Phase 84-01 Task 4: CSV import dialog frontend
 *
 * TDD RED: Tests written before implementation.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Import the component (will fail until implemented)
import { CsvImportDialog } from "./CsvImportDialog";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("CsvImportDialog", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnImportComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders dialog when open", () => {
      render(
        <CsvImportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onImportComplete={mockOnImportComplete}
        />
      );

      expect(screen.getByText(/import csv/i)).toBeInTheDocument();
    });

    it("does not render when closed", () => {
      render(
        <CsvImportDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          onImportComplete={mockOnImportComplete}
        />
      );

      expect(screen.queryByText(/import csv/i)).not.toBeInTheDocument();
    });
  });

  describe("step 1: upload", () => {
    it("shows drag and drop zone", () => {
      render(
        <CsvImportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onImportComplete={mockOnImportComplete}
        />
      );

      expect(screen.getByText(/drag.*drop/i)).toBeInTheDocument();
    });

    it("shows file input for CSV files", () => {
      render(
        <CsvImportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onImportComplete={mockOnImportComplete}
        />
      );

      const input = screen.getByTestId("csv-file-input");
      expect(input).toHaveAttribute("accept", ".csv");
    });

    it("shows file size limit (10MB)", () => {
      render(
        <CsvImportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onImportComplete={mockOnImportComplete}
        />
      );

      expect(screen.getByText(/10.*mb/i)).toBeInTheDocument();
    });
  });

  describe("step 2: preview", () => {
    it("shows detected format badge after file upload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              format: "ahrefs",
              detectedColumns: [
                { sourceColumn: "Keyword", targetField: "keyword" },
                { sourceColumn: "Volume", targetField: "volume" },
              ],
              sampleRows: [{ Keyword: "test keyword", Volume: "100" }],
              totalRows: 50,
            },
          }),
      });

      render(
        <CsvImportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onImportComplete={mockOnImportComplete}
        />
      );

      // Simulate file selection
      const file = new File(["keyword,volume\ntest,100"], "keywords.csv", {
        type: "text/csv",
      });
      const input = screen.getByTestId("csv-file-input");
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/ahrefs/i)).toBeInTheDocument();
      });
    });

    it("shows sample rows in preview table", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              format: "generic",
              detectedColumns: [
                { sourceColumn: "Keyword", targetField: "keyword" },
              ],
              sampleRows: [
                { Keyword: "sample keyword 1" },
                { Keyword: "sample keyword 2" },
              ],
              totalRows: 100,
            },
          }),
      });

      render(
        <CsvImportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onImportComplete={mockOnImportComplete}
        />
      );

      const file = new File(["keyword\ntest"], "keywords.csv", {
        type: "text/csv",
      });
      const input = screen.getByTestId("csv-file-input");
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("sample keyword 1")).toBeInTheDocument();
      });
    });

    it("shows total row count", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              format: "generic",
              detectedColumns: [],
              sampleRows: [],
              totalRows: 1234,
            },
          }),
      });

      render(
        <CsvImportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onImportComplete={mockOnImportComplete}
        />
      );

      const file = new File(["keyword\ntest"], "keywords.csv", {
        type: "text/csv",
      });
      const input = screen.getByTestId("csv-file-input");
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        // Check specifically for the row count display (not the button)
        expect(screen.getByText(/1,234 rows/)).toBeInTheDocument();
      });
    });
  });

  describe("step 3: results", () => {
    it("shows import progress during import", async () => {
      // Setup preview response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              format: "generic",
              detectedColumns: [
                { sourceColumn: "Keyword", targetField: "keyword" },
              ],
              sampleRows: [{ Keyword: "test" }],
              totalRows: 10,
            },
          }),
      });

      render(
        <CsvImportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onImportComplete={mockOnImportComplete}
        />
      );

      // Upload file
      const file = new File(["keyword\ntest"], "keywords.csv", {
        type: "text/csv",
      });
      const input = screen.getByTestId("csv-file-input");
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/import/i)).toBeInTheDocument();
      });

      // Start slow import
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () =>
                    Promise.resolve({
                      success: true,
                      data: { imported: 10, skipped: 0, errors: [] },
                    }),
                }),
              100
            )
          )
      );

      // Click import button
      const importButton = screen.getByRole("button", { name: /import/i });
      fireEvent.click(importButton);

      // Should show progress indicator
      await waitFor(() => {
        expect(screen.getByText(/importing/i)).toBeInTheDocument();
      });
    });

    it("shows results summary after import", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                format: "generic",
                detectedColumns: [
                  { sourceColumn: "Keyword", targetField: "keyword" },
                ],
                sampleRows: [{ Keyword: "test" }],
                totalRows: 100,
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                imported: 95,
                skipped: 5,
                errors: [],
              },
            }),
        });

      render(
        <CsvImportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onImportComplete={mockOnImportComplete}
        />
      );

      const file = new File(["keyword\ntest"], "keywords.csv", {
        type: "text/csv",
      });
      const input = screen.getByTestId("csv-file-input");
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
      });

      const importButton = screen.getByRole("button", { name: /import/i });
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(screen.getByText(/95/)).toBeInTheDocument();
        // The skipped count and label are in separate elements
        expect(screen.getByText("5")).toBeInTheDocument();
        expect(screen.getByText(/skipped/i)).toBeInTheDocument();
      });
    });

    it("calls onImportComplete with imported keywords", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                format: "generic",
                detectedColumns: [],
                sampleRows: [],
                totalRows: 10,
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                imported: 10,
                skipped: 0,
                errors: [],
                keywords: [{ keyword: "imported keyword" }],
              },
            }),
        });

      render(
        <CsvImportDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onImportComplete={mockOnImportComplete}
        />
      );

      const file = new File(["keyword\ntest"], "keywords.csv", {
        type: "text/csv",
      });
      const input = screen.getByTestId("csv-file-input");
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
      });

      const importButton = screen.getByRole("button", { name: /import/i });
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(mockOnImportComplete).toHaveBeenCalled();
      });
    });
  });
});
