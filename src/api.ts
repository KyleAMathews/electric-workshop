import { z, createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { neon } from '@neondatabase/serverless';

function getOrigin(url: string): string | null {
  try {
    // If the URL doesn't have a protocol, add https://
    if (!url.startsWith(`http://`) && !url.startsWith(`https://`)) {
      url = `https://` + url;
    }

    const urlObject = new URL(url);
    return urlObject.origin;
  } catch (error) {
    return null;
  }
}

// Define schemas for our API
const TodoSchema = z
  .object({
    id: z.number(),
    text: z.string(),
    completed: z.boolean(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .openapi("Todo");

const CreateTodoSchema = z
  .object({
    text: z.string().min(1),
  })
  .openapi("CreateTodo");

const UpdateTodoSchema = z
  .object({
    completed: z.boolean(),
  })
  .openapi("UpdateTodo");

const ErrorSchema = z
  .object({
    message: z.string(),
  })
  .openapi("Error");

// Create OpenAPI Hono app
export const app = new OpenAPIHono();

// Add CORS middleware
app.use("*", cors());

app.openapi(
  createRoute({
    method: "post",
    path: "/todos",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateTodoSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TodoSchema,
          },
        },
        description: "Created todo",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Invalid request",
      },
    },
    tags: ["todos"],
  }),
  async (c) => {
    const sql = neon(c.env.DATABASE_URL)
    const { text } = c.req.valid("json");

    try {
      const [newTodo] = await sql`
        INSERT INTO todos (text)
        VALUES (${text})
        RETURNING *
      `;

      return c.json(newTodo);
    } catch (error) {
      return c.json({ message: "Failed to create todo" }, 400);
    }
  }
);

// Add PATCH endpoint for updating todo completion status
app.openapi(
  createRoute({
    method: "patch",
    path: "/todos/:id",
    request: {
      body: {
        content: {
          "application/json": {
            schema: UpdateTodoSchema,
          },
        },
      },
      params: z.object({
        id: z.string().transform((val) => parseInt(val, 10)),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TodoSchema,
          },
        },
        description: "Updated todo",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Invalid request",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Todo not found",
      },
    },
    tags: ["todos"],
  }),
  async (c) => {
    const sql = neon(c.env.DATABASE_URL)
    const { id } = c.req.valid("param");
    const { completed } = c.req.valid("json");

    try {
      const [updatedTodo] = await sql`
        UPDATE todos
        SET completed = ${completed}
        WHERE id = ${id}
        RETURNING *
      `;

      if (!updatedTodo) {
        return c.json({ message: "Todo not found" }, 404);
      }

      return c.json(updatedTodo);
    } catch (error) {
      return c.json({ message: "Failed to update todo" }, 400);
    }
  }
);

// Add OpenAPI documentation
app.doc("/", {
  info: {
    title: "Todo API",
    version: "v1",
  },
  openapi: "3.0.0",
});

const shapesToProxy = [
  {
    table: `todos`,
    description: `All the todos`,
  },
] as const;

shapesToProxy.forEach((shape) => {
  app.openapi(
    createRoute({
      method: `get`,
      path: `/shape/${shape.table}`,
      responses: {
        200: {
          description: shape.description,
        },
      },
    }),
    async (c) => {
      return proxyToAdminElectric(
        c.req.raw,
        c.env.ELECTRIC_URL,
        shape.table,
        c,
      );
    },
  );
});

async function proxyToAdminElectric(
  request: Request,
  adminElectricUrl: string,
  table: string,
  c,
) {
  const originUrl = new URL(`${getOrigin(adminElectricUrl)}/v1/shape`);

  const url = new URL(request.url);
  url.searchParams.forEach((value, key) => {
    originUrl.searchParams.set(key, value);
  });

  originUrl.searchParams.set(`table`, table);
  originUrl.searchParams.set(`source_id`, c.env.ELECTRIC_SOURCE_ID);
  originUrl.searchParams.set(`source_secret`, c.env.ELECTRIC_SOURCE_SECRET);

  // Create a copy of the original headers to include in the fetch to the upstream.
  const requestClone = new Request(request);
  const headersClone = new Headers(requestClone.headers);

  console.log(`Fetching shape from Admin Electric: ${originUrl.toString()}`);

  const response = await fetch(originUrl.toString(), {
    headers: headersClone,
    cf: { cacheEverything: true },
  });

  return response;
}

export default app;
