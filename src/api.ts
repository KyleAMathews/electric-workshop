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

const TodoResponseSchema = z
  .object({
    todo: TodoSchema,
    txid: z.number(),
  })
  .openapi("TodoResponse");

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

const UpdateRowSchema = z
  .object({})
  .catchall(z.any())
  .openapi("UpdateRow");

const ErrorSchema = z
  .object({
    message: z.string(),
  })
  .openapi("Error");

const TableMetadataSchema = z
  .object({
    table_name: z.string(),
    columns: z.array(z.object({
      column_name: z.string(),
      data_type: z.string(),
      is_nullable: z.boolean(),
      column_default: z.string().nullable(),
      is_identity: z.boolean(),
    })),
  })
  .openapi("TableMetadata");

const TablesResponseSchema = z
  .object({
    tables: z.array(TableMetadataSchema),
  })
  .openapi("TablesResponse");

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
            schema: TodoResponseSchema,
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
      const [result] = await sql`
        WITH new_todo AS (
          INSERT INTO todos (text)
          VALUES (${text})
          RETURNING *
        )
        SELECT *, txid_current() as txid
        FROM new_todo
      `;

      const { txid, ...todo } = result;
      return c.json({ todo, txid });
    } catch (error) {
      return c.json({ message: "Failed to create todo" }, 400);
    }
  }
);

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
            schema: TodoResponseSchema,
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
      const [result] = await sql`
        WITH updated_todo AS (
          UPDATE todos
          SET completed = ${completed}
          WHERE id = ${id}
          RETURNING *
        )
        SELECT *, txid_current() as txid
        FROM updated_todo
      `;

      if (!result) {
        return c.json({ message: "Todo not found" }, 404);
      }

      const { txid, ...todo } = result;
      return c.json({ todo, txid });
    } catch (error) {
      return c.json({ message: "Failed to update todo" }, 400);
    }
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/tables/:table/:id",
    request: {
      body: {
        content: {
          "application/json": {
            schema: UpdateRowSchema,
          },
        },
      },
      params: z.object({
        id: z.string().transform((val) => parseInt(val, 10)),
        table: z.string(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              txid: z.number(),
              row: z.any(),
            }),
          },
        },
        description: "Updated row",
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
        description: "Row not found",
      },
    },
    tags: ["tables"],
  }),
  async (c) => {
    const sql = neon(c.env.DATABASE_URL)
    const { id, table } = c.req.valid("param");
    const updates = c.req.valid("json");

    try {
      // For single column updates, we can use the simpler template literal syntax
      const [[column, value]] = Object.entries(updates);
      
      const [result] = await sql(`
        WITH updated_row AS (
          UPDATE ${table}
          SET ${column} = $1
          WHERE id = $2
          RETURNING *
        )
        SELECT *, txid_current() as txid
        FROM updated_row
      `, [value, id]);

      if (!result) {
        return c.json({ message: "Row not found" }, 404);
      }

      const { txid, ...row } = result;
      return c.json({ row, txid });
    } catch (error) {
      console.error('Update error:', error);
      return c.json({ 
        message: "Failed to update row", 
        error: String(error),
        debug: {
          table,
          column: Object.keys(updates)[0],
          value: Object.values(updates)[0],
          id
        }
      }, 400);
    }
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/todos/{id}",
    request: {
      params: z.object({
        id: z.string().transform((val) => parseInt(val, 10)),
      }),
    },
    responses: {
      200: {
        description: "Deleted todo",
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
    const { id } = c.req.valid("param")

    try {
      const [result] = await sql`
        WITH deleted_todo AS (
          DELETE FROM todos
          WHERE id = ${id}
          RETURNING *, txid_current() as txid
        )
        SELECT * FROM deleted_todo
      `

      if (!result) {
        return c.json({ message: "Todo not found" }, 404)
      }

      const { txid } = result
      return c.json({ txid })
    } catch (error) {
      return c.json({ message: "Failed to delete todo" }, 400)
    }
  }
)

app.openapi(
  createRoute({
    method: "get",
    path: "/tables",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: TablesResponseSchema,
          },
        },
        description: "List of tables and their schema",
      },
      500: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Server error",
      },
    },
    tags: ["tables"],
  }),
  async (c) => {
    const sql = neon(c.env.DATABASE_URL);

    try {
      const tables = await sql`
        SELECT 
          t.table_name,
          json_agg(json_build_object(
            'column_name', c.column_name,
            'data_type', c.data_type,
            'is_nullable', c.is_nullable = 'YES',
            'column_default', c.column_default,
            'is_identity', c.is_identity = 'YES'
          )) as columns
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'public'
          AND t.table_name NOT LIKE 'atdatabases%'
        GROUP BY t.table_name
      `;

      return c.json({ tables });
    } catch (error) {
      return c.json({ message: "Failed to fetch tables" }, 500);
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
