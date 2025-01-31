import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from "@/components/ui/button"
import { useMutation } from '@tanstack/react-query'

const API_ROOT = import.meta.env.VITE_API

interface User {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  const [name, setName] = React.useState('')
  const storedUser = localStorage.getItem('user')
  const [user, setUser] = React.useState<User | null>(storedUser ? JSON.parse(storedUser) : null)

  const updateUserMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch(`${API_ROOT}/users`, {
        method: user ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name,
          ...(user && { id: user.id })
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update user')
      }

      const newUser = await response.json()
      localStorage.setItem('user', JSON.stringify(newUser))
      return newUser
    },
    onSuccess: (newUser) => {
      setUser(newUser)
      setName('')
    },
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await updateUserMutation.mutateAsync(name)
  }

  return (
    <div className="max-w-2xl">
      <h3 className='text-2xl font-bold mb-6'>Welcome to the Electric Workshop!</h3>
      
      <div className="mt-8">
        <h4 className="text-xl mb-4">{user ? 'Update Your Name' : 'Set Your Name'}</h4>
        <form onSubmit={onSubmit} className="flex gap-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={user ? user.name : "Enter your name"}
            className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button 
            type="submit" 
            disabled={updateUserMutation.isPending}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {user ? 'Update Name' : 'Set Name'}
          </Button>
        </form>
        {user && (
          <p className="mt-4 text-sm text-gray-600">
            Your ID: {user.id}
          </p>
        )}
      </div>
    </div>
  )
}
