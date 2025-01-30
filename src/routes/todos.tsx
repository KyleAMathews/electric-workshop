import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useShape, preloadShape } from "@electric-sql/react"
import { useMutation, useQueryClient } from '@tanstack/react-query'
const API_ROOT = import.meta.env.VITE_API

type Todo = {
  id: number
  text: string
  completed: boolean
  created_at?: string
  updated_at?: string
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
  const { data: todos } = useShape<Todo>(todoShape)
  const queryClient = useQueryClient()

  const toggleTodoMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
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
      return response.json()
    },
    onSuccess: () => {
      // Invalidate the shape to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ['shape', 'todos'] })
    },
  })

  const addTodoMutation = useMutation({
    mutationFn: async (text: string) => {
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
      return response.json()
    },
    onSuccess: () => {
      // Invalidate the shape to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ['shape', 'todos'] })
    },
  })

  const toggleTodo = async (id: number) => {
    const todo = todos?.find(t => t.id === id)
    if (!todo) return

    await toggleTodoMutation.mutateAsync({
      id,
      completed: !todo.completed,
    })
  }

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodoText.trim()) return

    await addTodoMutation.mutateAsync(newTodoText)
    setNewTodoText('')
  }

  if (!todos) {
    return <div>Loading...</div>
  }

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
          disabled={addTodoMutation.isPending}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          disabled={addTodoMutation.isPending}
        >
          {addTodoMutation.isPending ? 'Adding...' : 'Add Todo'}
        </button>
      </form>

      <ul className="space-y-3">
        {todos.map(todo => (
          <li
            key={todo.id}
            className="flex items-center gap-3 p-3 bg-white rounded shadow-sm"
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
              className="h-5 w-5 rounded border-gray-300 focus:ring-blue-500"
              disabled={toggleTodoMutation.isPending}
            />
            <span className={todo.completed ? 'line-through text-gray-500' : ''}>
              {todo.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
