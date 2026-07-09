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
  return process.env.DEMO_LOGIN_ENABLED === "true";
}

function getDemoCredentials() {
  return {
    email: process.env.DEMO_USER_EMAIL ?? process.env.SEED_USER_EMAIL ?? "demo@thread.dev",
    password: process.env.DEMO_USER_PASSWORD ?? process.env.SEED_DEMO_PASSWORD ?? "DemoPass123!",
  };
}

/**
 * Auto-seed the demo user and workspace data when the account does not exist.
 * This prevents demo-login failures on fresh or unseeded deployments.
 */
async function ensureDemoUserSeeded(email: string, password: string) {
  const { db, eq } = await import("@repo/database");
  const { usersTable } = await import("@repo/database/schema");
  const { hashPassword } = await import("@repo/services/auth/password");
  const { threadMailCacheTable } = await import("@repo/database/schema");
  const { threadQueueItemsTable } = await import("@repo/database/schema");

  // Check if user already exists
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);
  if (existing) return; // Already seeded

  const passwordHash = await hashPassword(password);

  const [user] = await db
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
    .returning({ id: usersTable.id });

  if (!user) return;

  // Seed demo mail cache
  try {
    const { DEMO_MAIL_FIXTURES } = await import("@repo/database/scripts/demo-seed-data");
    for (const fixture of DEMO_MAIL_FIXTURES) {
      const lastMessageAt = new Date(Date.now() - fixture.hoursAgo * 3_600_000);
      const labelIds = ["INBOX", ...(fixture.starred ? ["STARRED"] : [])];
      await db
        .insert(threadMailCacheTable)
        .values({
          id: `${user.id}:${fixture.threadId}`,
          userId: user.id,
          threadId: fixture.threadId,
          subject: fixture.subject,
          fromName: fixture.fromName,
          fromAddress: fixture.fromAddress,
          snippet: fixture.body,
          lastMessageAt,
          messageCount: 1,
          unread: fixture.unread,
          labelIds,
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }
  } catch {
    // Mail cache seeding is best-effort; don't block sign-in.
  }

  // Seed demo queue items
  try {
    const { buildDemoQueueFixtures } = await import("@repo/database/scripts/demo-seed-data");
    const fixtures = buildDemoQueueFixtures();
    for (const fixture of fixtures) {
      await db
        .insert(threadQueueItemsTable)
        .values({
          userId: user.id,
          kind: fixture.kind,
          title: fixture.title,
          preview: fixture.preview,
          payload: fixture.payload,
          status: fixture.status,
          resolvedAt: fixture.status === "pending" ? null : new Date(),
        })
        .onConflictDoNothing();
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
    .query(async () => userService.getAuthenticationMethods()),

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
        const { turnstileToken, ...signUpInput } = input;
        void turnstileToken;
        return await authService.signUp(signUpInput);
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
        const { turnstileToken, ...signInInput } = input;
        void turnstileToken;
        return await authService.signIn(signInInput, ctx.res);
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
      try {
        if (!isDemoLoginEnabled()) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Demo login is not enabled." });
        }
        const { email, password } = getDemoCredentials();

        try {
          return await authService.signIn({ email, password }, ctx.res);
        } catch {
          // Account may not exist yet — auto-seed the demo user on first visit.
          await ensureDemoUserSeeded(email, password);
          return await authService.signIn({ email, password }, ctx.res);
        }
      } catch (error) {
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
    .input(zodUndefinedModel)
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
