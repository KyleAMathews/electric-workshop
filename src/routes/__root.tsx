import * as React from 'react'
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <div className="fixed top-0 left-0 right-0 bg-white shadow-md z-50 h-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center h-16">
            <h1 className="text-xl font-bold">Electric Workshop</h1>
          </div>
        </div>
      </div>
      
      <div className="fixed top-16 left-0 bottom-0 w-48 bg-gray-50 border-r border-gray-200">
        <nav className="p-6 flex flex-col gap-4">
          <Link
            to="/"
            className="hover:text-gray-600 text-lg"
            activeProps={{
              className: 'font-bold',
            }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>
          <Link
            to="/todos"
            className="hover:text-gray-600 text-lg"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Todos
          </Link>
        </nav>
      </div>

      <div className="ml-48 mt-16 p-6">
        <Outlet />
      </div>
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}
