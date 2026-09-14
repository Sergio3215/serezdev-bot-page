import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const userCookie = request.cookies.get("discord_user");

  if (!userCookie || !userCookie.value) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  try {
    const user = JSON.parse(userCookie.value);
    return NextResponse.json({ authenticated: true, user });
  } catch (err) {
    console.error("Error parsing user session cookie:", err);
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
}
