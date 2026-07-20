import { NextResponse } from "next/server"
import { listComments } from "@/db/queries"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const comments = await listComments(id)

  return NextResponse.json({ comments })
}
