import { issuer, createSubjects, createClient } from "@openauthjs/openauth";
import { Hono } from "hono";
import { CodeUI } from "@openauthjs/openauth/ui/code";
import { Theme } from "@openauthjs/openauth/ui/theme"
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { DrizzleAuthStorage } from "./drizzle-auth-storage";
import { object, string, optional } from "valibot"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const subjects = createSubjects({
  user: object({
    userID: string(),
    email: optional(string()),
    workspaceID: string(),
  }),
})

const CUSTOM_THEME: Theme = {
  title: "Authorize with The Borderland",
  radius: "none",
  favicon: "/favicon.ico",
  logo: "/logo.png",
  // ...
}

const app = issuer({
  theme: CUSTOM_THEME,
  storage: DrizzleAuthStorage(),
  providers: {
    code: CodeProvider(
      CodeUI({
        copy: {
          code_info: "We'll send a pin code to your email"
        },
        sendCode: async (claims, code) => {
          try {
            let result = await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL,
              to: claims.email,
              subject: "Your Borderland authentication code",
              html: `
                <h1>Your authentication code</h1>
                <p>Use this code to complete your login with The Borderland:</p>
                <h2 style="font-size: 32px; letter-spacing: 8px; font-family: monospace;">${code}</h2>
                <p>This code will expire in 10 minutes.</p>
              `
            });

            if (result.error != null) {
              throw result.error.message
            }

            // console.log("=".repeat(50));
            console.log("📧 Email sent to:", claims.email);
            // console.log("🔑 Code:", code);
            // console.log("=".repeat(50));
          } catch (error) {
            console.error("Failed to send email with authentication code:", error);
            throw "Failed to send email with authentication code (please contact tech@theborderland.se)";
          }
        }
      })
    )
  },
  subjects: subjects,
  async success(ctx, value) {
    if (value.provider === "code") {
      return ctx.subject("user", {
        email: value.claims.email,
        userID: value.claims.email,
        workspaceID: "borderland"
      })
    }

    throw new Error("Unknown provider");
  }
});

const rootApp = new Hono()
rootApp.route("/", app as any)

// Serve static files
rootApp.get("/favicon.ico", () => new Response(Bun.file("assets/favicons/favicon.ico")));
rootApp.get("/logo.png", () => new Response(Bun.file("assets/logo.png")));

// Create a client for verifying tokens
const client = createClient({
  clientID: "oauth-server",
  issuer: process.env.ISSUER || "http://localhost:3000"
});

// User info endpoint
rootApp.get("/user", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.substring(7);

  try {
    // Verify the token using OpenAuth client's verify method
    const verified = await client.verify(subjects, token);

    if (verified.err) {
      console.error("Token verification error:", verified.err);
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    // Return user information in standard OIDC userinfo format
    // The 'sub' claim is required by OAuth2/OIDC
    return c.json({
      sub: verified.subject.properties.email,
      email: verified.subject.properties.email,
      userID: verified.subject.properties.email,
      workspaceID: verified.subject.properties.workspaceID,
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return c.json({ error: "Token verification failed" }, 401);
  }
});

Bun.serve({
  port: 3000,
  fetch: rootApp.fetch,
  development: {
    hmr: false,
  }
});

console.log("🚀 OAuth server running on http://localhost:3000");

