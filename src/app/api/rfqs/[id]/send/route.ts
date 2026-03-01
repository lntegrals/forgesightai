import { NextRequest, NextResponse } from "next/server";
import { getRfq, updateRfq, appendAudit } from "@/core/store";
import { RFQStatus, Actor, AuditAction } from "@/core/types";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const rfq = getRfq(id);
    if (!rfq) {
        return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    let emailData = {
        to: "",
        subject: `Quote for ${rfq.subject}`,
        body: "",
    };

    try {
        const body = await request.json();
        emailData = { ...emailData, ...body };
    } catch {
        // Use defaults
    }

    updateRfq(id, {
        status: RFQStatus.SENT,
    });

    appendAudit(id, {
        at: new Date().toISOString(),
        actor: Actor.USER,
        action: AuditAction.EMAIL_SENT,
        detail: JSON.stringify({
            to: emailData.to,
            subject: emailData.subject,
            bodyLength: emailData.body.length,
            simulatedAt: new Date().toISOString(),
        }),
    });

    const updated = getRfq(id);
    return NextResponse.json({
        ...updated,
        emailSent: {
            to: emailData.to,
            subject: emailData.subject,
            sentAt: new Date().toISOString(),
            status: "SIMULATED",
        },
    });
}
