import { NextRequest, NextResponse } from "next/server";
import { getAllRfqs, createRfq } from "@/core/store";

export async function GET() {
    const rfqs = getAllRfqs();
    return NextResponse.json(rfqs);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { customerName, subject, rawText } = body;

        if (!customerName || !subject || !rawText) {
            return NextResponse.json(
                { error: "Missing required fields: customerName, subject, rawText" },
                { status: 400 }
            );
        }

        const rfq = createRfq({ customerName, subject, rawText });
        return NextResponse.json(rfq, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
}
