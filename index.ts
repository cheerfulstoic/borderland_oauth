import { issuer, createSubjects, createClient } from "@openauthjs/openauth";
import { Hono } from "hono";
import { CodeUI } from "@openauthjs/openauth/ui/code";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { object, string, optional } from "valibot"

const ALLOWED_USERS = [
  {
    uuid: "a1b2c3d4-e5f6-4789-a012-bcdef0123456",
    email: "alice@example.com",
  },
  {
    uuid: "b2c3d4e5-f6a7-4890-b123-cdef01234567",
    email: "bob@example.com",
  },
  {
    uuid: "c3d4e5f6-a7b8-4901-c234-def012345678",
    email: "charlie@example.com",
  },
  {
    uuid: "d4e5f6a7-b8c9-4012-d345-ef0123456789",
    email: "diana@example.com",
  },
];

// Lookup user by email
// TODO: Replace with database lookup
async function findUserByEmail(email: string): Promise<{ uuid: string; email: string } | null> {
  return ALLOWED_USERS.find(u => u.email === email) || null;
}

const subjects = createSubjects({
  user: object({
    userID: string(),
    email: optional(string()),
    workspaceID: string(),
  }),
})

const app = issuer({
  storage: MemoryStorage(),
  providers: {
    code: CodeProvider(
      CodeUI({
        copy: {
          code_info: "We'll send a pin code to your email"
        },
        sendCode: async (claims, code) => {
          const user = await findUserByEmail(claims.email);
          if (!user) {
            throw new Error("Email not authorized");
          }
          console.log("=".repeat(50));
          console.log("📧 Email:", claims.email);
          console.log("🔑 Code:", code);
          console.log("=".repeat(50));
        }
      })
    )
  },
  subjects: subjects,
  async success(ctx, value) {
    if (value.provider === "code") {
      const user = await findUserByEmail(value.claims.email);
      if (!user) {
        throw new Error("User not found");
      }

      return ctx.subject("user", {
        userID: user.uuid,
        email: user.email,
        workspaceID: "borderland"
      })
    }

    throw new Error("Unknown provider");
  }
});

const rootApp = new Hono()
rootApp.route("/", app as any)

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
      sub: verified.subject.properties.userID,
      email: verified.subject.properties.email,
      userID: verified.subject.properties.userID,
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

