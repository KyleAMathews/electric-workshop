/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as TodosImport } from './routes/todos'
import { Route as IndexImport } from './routes/index'

// Create/Update Routes

const TodosRoute = TodosImport.update({
  id: '/todos',
  path: '/todos',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/todos': {
      id: '/todos'
      path: '/todos'
      fullPath: '/todos'
      preLoaderRoute: typeof TodosImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/todos': typeof TodosRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/todos': typeof TodosRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/todos': typeof TodosRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/todos'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/todos'
  id: '__root__' | '/' | '/todos'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  TodosRoute: typeof TodosRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  TodosRoute: TodosRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/todos"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/todos": {
      "filePath": "todos.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
