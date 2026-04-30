/**
 * Proxy route for invoice payment API.
 * Phase 54-05: Checkout Widget + E2E Testing
 *
 * Forwards requests to open-seo-main API.
 * Handles both GET (fetch details) and POST (create session).
 */
import { NextRequest, NextResponse } from "next/server";

const OPEN_SEO_API_URL = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const res = await fetch(`${OPEN_SEO_API_URL}/api/invoices/${id}/pay`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to connect to payment service" },
      { status: 502 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    const res = await fetch(`${OPEN_SEO_API_URL}/api/invoices/${id}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-Proto": request.headers.get("x-forwarded-proto") || "https",
        Host: request.headers.get("host") || "localhost:3000",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to connect to payment service" },
      { status: 502 }
    );
  }
}
