import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out" });

  response.cookies.set("discord_user", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  response.cookies.set("discord_token", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
