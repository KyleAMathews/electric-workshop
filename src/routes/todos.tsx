import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useShape, preloadShape } from "@electric-sql/react"
import { useMutation, useQueryClient, useMutationState } from '@tanstack/react-query'
const API_ROOT = import.meta.env.VITE_API

interface Todo {
  id: number
  text: string
  completed: boolean
  created_at?: string
  updated_at?: string
}

interface StreamMessage {
  offset: string
  value: Partial<Todo>
  key: string
  headers: {
    relation: string[]
    operation: string
    txid?: number
    control?: string
  }
}

const todoShape = {
  url: `${API_ROOT}/shape/todos`
}

export const Route = createFileRoute('/todos')({
  component: TodosComponent,
  loader: async () => {
    await preloadShape(todoShape)
    return null
  }
})

function TodosComponent() {
  const [newTodoText, setNewTodoText] = React.useState('')
  const { data: todos, stream } = useShape<Todo>(todoShape)
  const queryClient = useQueryClient()

  const waitForTxid = React.useCallback(async (expectedTxid: number) => {
    console.log('Waiting for txid:', expectedTxid)
    let unsubscribe: (() => void) | undefined

    try {
      return await new Promise<void>((resolve, reject) => {
        const seenTxids = new Set<number>()

        unsubscribe = stream.subscribe((messages: StreamMessage[]) => {
          console.log('Received stream messages:', messages)
          for (const message of messages) {
            const txid = message.headers?.txid
            if (txid) {
              console.log('Found txid in message:', txid)
              seenTxids.add(txid)
              unsubscribe()
              resolve()
            }
          }
        })
      })
    } finally {
      unsubscribe?.()
    }
  }, [stream])

  const toggleTodoMutation = useMutation({
    gcTime: 0,
    scope: { id: 'todos' },
    mutationKey: ['toggle-todo'],
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      // Start collecting txids
      const seenTxids = new Set<number>()
      let unsubscribe: (() => void) | undefined

      try {
        unsubscribe = stream.subscribe((messages: StreamMessage[]) => {
          console.log('Toggle - Received stream messages:', messages)
          for (const message of messages) {
            const txid = message.headers.txid
            if (txid) {
              console.log('Toggle - Found txid in message:', txid)
              seenTxids.add(txid)
            }
          }
        })

        const response = await fetch(`${API_ROOT}/todos/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ completed }),
        })

        if (!response.ok) {
          throw new Error('Failed to update todo')
        }

        const { txid, todo } = await response.json()
        console.log('Toggle - Received response with txid:', txid)

        // Check if we've already seen this txid
        if (!seenTxids.has(txid)) {
          console.log('Toggle - Waiting for txid:', txid)
          // If not, wait for it
          await waitForTxid(txid)
        } else {
          console.log('Toggle - Already seen txid:', txid)
        }

        console.log('Toggle - Transaction synced:', txid)
        return todo
      } finally {
        unsubscribe?.()
      }
    },
    onMutate: ({ id, completed }) => {
      // Return optimistic todo
      const existingTodo = todos?.find(t => t.id === id)
      if (!existingTodo) return

      return {
        ...existingTodo,
        completed
      }
    }
  })

  const addTodoMutation = useMutation({
    gcTime: 0,
    scope: { id: 'todos' },
    mutationKey: ['add-todo'],
    mutationFn: async (text: string) => {
      // Start collecting txids
      const seenTxids = new Set<number>()
      let unsubscribe: (() => void) | undefined

      try {
        unsubscribe = stream.subscribe((messages: StreamMessage[]) => {
          console.log('Add - Received stream messages:', messages)
          for (const message of messages) {
            const txid = message.headers.txid
            if (txid) {
              console.log('Add - Found txid in message:', txid)
              seenTxids.add(txid)
            }
          }
        })

        const response = await fetch(`${API_ROOT}/todos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        })

        if (!response.ok) {
          throw new Error('Failed to create todo')
        }

        const { txid, todo } = await response.json()
        console.log('Add - Received response with txid:', txid)

        // Check if we've already seen this txid
        if (!seenTxids.has(txid)) {
          console.log('Add - Waiting for txid:', txid)
          // If not, wait for it
          await waitForTxid(txid)
        } else {
          console.log('Add - Already seen txid:', txid)
        }

        console.log('Add - Transaction synced:', txid)
        return todo
      } finally {
        unsubscribe?.()
      }
    },
    onMutate: (text) => {
      // Return optimistic todo
      return {
        id: Date.now(), // temporary ID
        text,
        completed: false,
      }
    }
  })

  const deleteTodoMutation = useMutation({
    gcTime: 0,
    scope: { id: 'todos' },
    mutationKey: ['delete-todo'],
    mutationFn: async (id: number) => {
      const response = await fetch(`${API_ROOT}/todos/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete todo')
      }

      const { txid } = await response.json()
      console.log('Delete - Received response with txid:', txid)
      await waitForTxid(txid)
      return id
    },
    onMutate: (id) => {
      // Return the ID for optimistic update
      return id
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        old?.filter(todo => todo.id !== id) || []
      )
    }
  })

  const toggleTodo = async (id: number) => {
    const todo = todos?.find(t => t.id === id)
    if (!todo) return

    await toggleTodoMutation.mutateAsync({
      id,
      completed: !todo.completed,
    })
    console.log(`done with toggleTodo`)
  }

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodoText.trim()) return
    setNewTodoText('')

    await addTodoMutation.mutateAsync(newTodoText)
  }

  // Merge data from shape & optimistic data from mutations
  const todosMap = new Map<number, Todo>()

  // Add base todos
  todos.forEach(todo => {
    todosMap.set(todo.id, todo)
  })

  // Add optimistic todos
  const optimisticTodos = useMutationState({
    filters: { status: 'pending' },
    select: (mutation) => mutation.state.context as Todo,
  })
  optimisticTodos.forEach(todo => {
    if (todo) {
      todosMap.set(todo.id, { ...todosMap.get(todo.id), ...todo })
    }
  })

  const mergedTodos = Array.from(todosMap.values()).filter(todo => {
    // Filter out todos being deleted
    const isBeingDeleted = deleteTodoMutation.isPending &&
      deleteTodoMutation.variables === todo.id
    return !isBeingDeleted
  }).filter(obj => Object.keys(obj).length > 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Todo List</h1>

      <form onSubmit={addTodo} className="mb-6 flex gap-4">
        <input
          type="text"
          value={newTodoText}
          onChange={e => setNewTodoText(e.target.value)}
          placeholder="Add a new todo"
          className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add Todo
        </button>
      </form>

      <ul className="space-y-3">
        {mergedTodos.map(todo => (
          <li
            key={todo.id}
            className="flex items-center gap-3 p-3 bg-white rounded shadow-sm group hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
              className="h-5 w-5 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className={todo.completed ? 'line-through text-gray-500' : ''}>
              {todo.text}
            </span>
            <button
              onClick={() => deleteTodoMutation.mutate(todo.id)}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 font-bold text-lg"
              aria-label="Delete todo"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
