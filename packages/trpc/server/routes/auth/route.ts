import {
  authUserSchema,
  messageOutputSchema,
  signInOutputSchema,
  signUpOutputSchema,
} from "@repo/services/auth/model";
import {
  forgotPasswordInputSchema,
  resetPasswordInputBaseSchema,
  sendVerificationEmailAgainInputSchema,
  setupProfileInputSchema,
  signInInputSchema,
  signUpInputBaseSchema,
  toggle2FAInputSchema,
  verify2FAInputSchema,
  verifyEmailInputSchema,
  verifyOtpInputSchema,
} from "@repo/services/auth/dtos";
import { assertTurnstileToken, getClientIp } from "@repo/services/auth/turnstile";

import { TRPCError } from "@trpc/server";

import { z, zodUndefinedModel } from "../../schema";
import { userService, authService } from "../../services";
import { getAuthenticationMethodOutputSchema } from "@repo/services/user/model";
import { mapAuthError, protectedProcedure, publicProcedure, router, verifiedProcedure } from "../../trpc";
import { generatePath } from "../../utils/path-generator";

const TAGS = ["Authentication"];
const getPath = generatePath("/authentication");

function isDemoLoginEnabled() {
  return (process.env.DEMO_LOGIN_ENABLED ?? "true") === "true";
}

function getDemoCredentials() {
  return {
    email: process.env.DEMO_USER_EMAIL ?? process.env.SEED_USER_EMAIL ?? "demo@mailos.dev",
    password: process.env.DEMO_USER_PASSWORD ?? process.env.SEED_DEMO_PASSWORD ?? "DemoPass123!",
  };
}

async function queryWithRetry<T>(fn: () => Promise<T>, retries = 8, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (attempt >= retries - 1) throw err;
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    return queryWithRetry(fn, retries, attempt + 1);
  }
}

/**
 * Auto-seed the demo user and workspace data when the account does not exist.
 * This prevents demo-login failures on fresh or unseeded deployments.
 */
async function ensureDemoUserSeeded(email: string, password: string) {
  const { db, eq } = await import("@repo/database");
  const { usersTable } = await import("@repo/database/schema");
  const { hashPassword, verifyPassword } = await import("@repo/services/auth/password");
  const { threadMailCacheTable } = await import("@repo/database/schema");
  const { threadQueueItemsTable } = await import("@repo/database/schema");

  // Check if user already exists
  const [existing] = await queryWithRetry(() =>
    db
      .select({
        id: usersTable.id,
        passwordHash: usersTable.passwordHash,
        emailVerified: usersTable.emailVerified,
      })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1)
  );

  if (existing) {
    const matches = await verifyPassword(password, existing.passwordHash);
    if (!matches || !existing.emailVerified) {
      const passwordHash = await hashPassword(password);
      await db
        .update(usersTable)
        .set({ passwordHash, emailVerified: true })
        .where(eq(usersTable.id, existing.id));
    }
  } else {
    const passwordHash = await hashPassword(password);

    try {
      await db
        .insert(usersTable)
        .values({
          fullName: "Thread Demo",
          email: email.toLowerCase().trim(),
          passwordHash,
          authProvider: "local",
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpire: null,
          role: "user",
          tokenVersion: "0",
          autoApproveEmail: false,
          autoApproveAgentEmail: false,
          autoApproveCalendar: false,
        })
        .onConflictDoNothing();
    } catch {
      // Concurrently created by another worker
    }
  }

  // Seed demo mail cache
  try {
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);
    if (!user) return;

    const { DEMO_MAIL_FIXTURES } = await import("@repo/database/scripts/demo-seed-data");
    const mailRows = DEMO_MAIL_FIXTURES.map((fixture) => ({
      id: `${user.id}:${fixture.threadId}`,
      userId: user.id,
      threadId: fixture.threadId,
      subject: fixture.subject,
      fromName: fixture.fromName,
      fromAddress: fixture.fromAddress,
      snippet: fixture.body,
      lastMessageAt: new Date(Date.now() - fixture.hoursAgo * 3_600_000),
      messageCount: 1,
      unread: fixture.unread,
      labelIds: ["INBOX", ...(fixture.starred ? ["STARRED"] : [])],
      updatedAt: new Date(),
    }));
    if (mailRows.length > 0) {
      await db.insert(threadMailCacheTable).values(mailRows).onConflictDoNothing();
    }
  } catch {
    // Mail cache seeding is best-effort; don't block sign-in.
  }

  // Seed demo queue items
  try {
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);
    if (!user) return;

    const { buildDemoQueueFixtures } = await import("@repo/database/scripts/demo-seed-data");
    const fixtures = buildDemoQueueFixtures();
    const queueRows = fixtures.map((fixture) => ({
      userId: user.id,
      kind: fixture.kind,
      title: fixture.title,
      preview: fixture.preview,
      payload: fixture.payload,
      status: fixture.status,
      resolvedAt: fixture.status === "pending" ? null : new Date(),
    }));
    if (queueRows.length > 0) {
      await db.insert(threadQueueItemsTable).values(queueRows).onConflictDoNothing();
    }
  } catch {
    // Queue seeding is best-effort; don't block sign-in.
  }
}

export const authRouter = router({
  getSupportedAuthenticationProviders: publicProcedure
    .meta({ openapi: { method: "GET", path: getPath("/supported-providers"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(z.readonly(z.array(getAuthenticationMethodOutputSchema)))
    .query(() => userService.getAuthenticationMethods()),

  signUp: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/sign-up"), tags: TAGS } })
    .input(signUpInputBaseSchema)
    .output(signUpOutputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        if (input.password !== input.confirmPassword) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Passwords do not match" });
        }
        await assertTurnstileToken(input.turnstileToken, getClientIp(ctx.req));
        return await authService.signUp(input);
      } catch (error) {
        mapAuthError(error);
      }
    }),

  signIn: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/sign-in"), tags: TAGS } })
    .input(signInInputSchema)
    .output(signInOutputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        await assertTurnstileToken(input.turnstileToken, getClientIp(ctx.req));
        return await authService.signIn(input, ctx.res);
      } catch (error) {
        mapAuthError(error);
      }
    }),

  /** One-click demo login — skips Turnstile; gated by DEMO_LOGIN_ENABLED on the API. */
  demoSignIn: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/demo-sign-in"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(signInOutputSchema)
    .mutation(async ({ ctx }) => {
      console.log("[DEBUG demoSignIn] 1. Started demoSignIn mutation");
      try {
        if (!isDemoLoginEnabled()) {
          console.log("[DEBUG demoSignIn] Demo login disabled");
          throw new TRPCError({ code: "FORBIDDEN", message: "Demo login is not enabled." });
        }
        const { email, password } = getDemoCredentials();
        console.log("[DEBUG demoSignIn] 2. Got credentials:", email);
        const { cacheDelete } = await import("@repo/services/cache/kv-store");
        console.log("[DEBUG demoSignIn] 3. Imported kv-store");
        await cacheDelete(`auth_lock:${email.toLowerCase().trim()}`);
        console.log("[DEBUG demoSignIn] 4. Deleted auth_lock key");

        await ensureDemoUserSeeded(email, password);
        console.log("[DEBUG demoSignIn] 5. ensureDemoUserSeeded completed");
        const res = await authService.signIn({ email, password }, ctx.res);
        console.log("[DEBUG demoSignIn] 6. authService.signIn completed successfully");
        return res;
      } catch (error) {
        console.error("[DEBUG demoSignIn] ERROR caught in demoSignIn:", error);
        mapAuthError(error);
      }
    }),

  verify2FA: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/verify-2fa"), tags: TAGS } })
    .input(verify2FAInputSchema)
    .output(authUserSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await authService.verify2FA(input, ctx.res);
      } catch (error) {
        mapAuthError(error);
      }
    }),

  logout: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/logout"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(messageOutputSchema)
    .mutation(({ ctx }) => authService.logout(ctx.req, ctx.res)),

  refresh: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/refresh"), tags: TAGS } })
    .input(zodUndefinedModel)
    .output(authUserSchema)
    .mutation(async ({ ctx }) => {
      try {
        return await authService.refreshAccessToken(ctx.req, ctx.res);
      } catch (error) {
        mapAuthError(error);
      }
    }),

  me: protectedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/me"), tags: TAGS, protect: true } })
    .input(z.looseObject({}).optional())
    .output(authUserSchema)
    .query(({ ctx }) => ctx.user),

  forgotPassword: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/forgot-password"), tags: TAGS } })
    .input(forgotPasswordInputSchema)
    .output(messageOutputSchema)
    .mutation(async ({ input }) => {
      try {
        return await authService.forgotPassword(input);
      } catch (error) {
        mapAuthError(error);
      }
    }),

  verifyOtp: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/verify-otp"), tags: TAGS } })
    .input(verifyOtpInputSchema)
    .output(messageOutputSchema)
    .mutation(async ({ input }) => {
      try {
        return await authService.verifyOtp(input);
      } catch (error) {
        mapAuthError(error);
      }
    }),

  resetPassword: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/reset-password"), tags: TAGS } })
    .input(resetPasswordInputBaseSchema)
    .output(messageOutputSchema)
    .mutation(async ({ input }) => {
      try {
        if (!input.otp && !input.token) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "OTP or reset token is required" });
        }
        return await authService.resetPassword(input);
      } catch (error) {
        mapAuthError(error);
      }
    }),

  verifyEmail: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/verify-email"), tags: TAGS } })
    .input(verifyEmailInputSchema)
    .output(authUserSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await authService.verifyEmail(input, ctx.res);
      } catch (error) {
        mapAuthError(error);
      }
    }),

  sendVerificationEmailAgain: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/send-verification-email-again"), tags: TAGS } })
    .input(sendVerificationEmailAgainInputSchema)
    .output(messageOutputSchema)
    .mutation(async ({ input }) => {
      try {
        return await authService.sendVerificationEmailAgain(input);
      } catch (error) {
        mapAuthError(error);
      }
    }),

  sendVerificationAgain: protectedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/send-verification-again"), tags: TAGS, protect: true } })
    .input(zodUndefinedModel)
    .output(messageOutputSchema)
    .mutation(async ({ ctx }) => {
      try {
        return await authService.sendVerificationAgain(ctx.user.id);
      } catch (error) {
        mapAuthError(error);
      }
    }),

  toggle2FA: verifiedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/toggle-2fa"), tags: TAGS, protect: true } })
    .input(toggle2FAInputSchema)
    .output(
      z.object({
        message: z.string(),
        twoFactorEnabled: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await authService.toggle2FA(ctx.user.id, input.enabled);
      } catch (error) {
        mapAuthError(error);
      }
    }),

  setupProfile: verifiedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/setup-profile"), tags: TAGS, protect: true } })
    .input(setupProfileInputSchema)
    .output(authUserSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await authService.setupProfile(ctx.user.id, input.displayName);
      } catch (error) {
        mapAuthError(error);
      }
    }),
});
