import { NextResponse } from "next/server";
import { db } from "@/server/corsair";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { verifyJwt } from "@/lib/jwt";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Verify reset token
    const decoded = verifyJwt(token);
    if (!decoded || decoded.purpose !== "password-reset" || !decoded.email) {
      return NextResponse.json(
        { error: "The password reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const email = decoded.email.toLowerCase().trim();

    // Verify user exists in database
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .then((rows) => rows[0]);

    if (!user) {
      return NextResponse.json(
        { error: "User account no longer exists" },
        { status: 404 }
      );
    }

    // Hash new password
    const passwordHash = hashPassword(password);

    // Update password in database
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email));

    return NextResponse.json({
      success: true,
      message: "Your password has been successfully updated. You can now log in.",
    });
  } catch (error: any) {
    console.error("Reset password API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
