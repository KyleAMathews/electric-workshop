import * as React from 'react'
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const API_ROOT = import.meta.env.VITE_API

interface TableMetadata {
  table_name: string
  columns: Array<{
    column_name: string
    data_type: string
    is_nullable: boolean
    column_default: string | null
    is_identity: boolean
  }>
}

export const Route = createRootRoute({
  component: RootComponent,
  loader: async () => {
    const response = await fetch(`${API_ROOT}/tables`)
    const { tables } = await response.json()
    return { tables }
  }
})

// Create a client
const queryClient = new QueryClient()

function RootComponent() {
  const { tables } = Route.useLoaderData()

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-gray-100 border-r">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Navigation</h2>

            <div className="space-y-2">
              <Link
                to="/"
                className="block px-4 py-2 rounded hover:bg-gray-200"
                activeProps={{ className: 'block px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600' }}
              >
                Home
              </Link>
              <Link
                to="/todos"
                className="block px-4 py-2 rounded hover:bg-gray-200"
                activeProps={{ className: 'block px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600' }}
              >
                Todos
              </Link>
              <Link
                to="/checkbox-game"
                className="block px-4 py-2 rounded hover:bg-gray-200"
                activeProps={{ className: 'block px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600' }}
              >
                Checkbox Game
              </Link>
              <Link
                to="/visual-poller"
                className="block px-4 py-2 rounded hover:bg-gray-200"
                activeProps={{ className: 'block px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600' }}
              >
                Visual Poller
              </Link>

              <div className="mt-6">
                <h3 className="px-4 text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Tables
                </h3>
                {tables?.map((table: TableMetadata) => (
                  <Link
                    key={table.table_name}
                    to="/table-editor/$tableName"
                    params={{ tableName: table.table_name }}
                    className="block px-4 py-2 rounded hover:bg-gray-200"
                    activeProps={{ className: 'block px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600' }}
                  >
                    {table.table_name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
      <TanStackRouterDevtools position="bottom-right" />
    </QueryClientProvider>
  )
}
