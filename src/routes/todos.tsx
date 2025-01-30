import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'

interface Todo {
  id: number
  text: string
  completed: boolean
}

export const Route = createFileRoute('/todos')({
  component: TodosComponent,
})

function TodosComponent() {
  const [todos, setTodos] = React.useState<Todo[]>([
    { id: 1, text: 'Learn about Electric SQL', completed: true },
    { id: 2, text: 'Build a todo app', completed: false },
    { id: 3, text: 'Connect to Electric backend', completed: false },
  ])
  const [newTodoText, setNewTodoText] = React.useState('')

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodoText.trim()) return

    setTodos([
      ...todos,
      {
        id: Math.max(...todos.map(t => t.id)) + 1,
        text: newTodoText,
        completed: false
      }
    ])
    setNewTodoText('')
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
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add Todo
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
