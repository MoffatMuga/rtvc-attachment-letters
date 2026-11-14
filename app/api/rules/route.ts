import { publicRules } from "@/lib/rules";

export async function GET() {
  return Response.json(publicRules());
}
