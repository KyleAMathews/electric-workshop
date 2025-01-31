import * as React from 'react'
import { useShape } from "@electric-sql/react"

// D3's Category10 colors for consistent avatar colors
const schemeCategory10 = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
]

// Hash function for UUIDs to get consistent colors
function hashUUID(uuid: string): number {
  return uuid.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)
}

// Get a consistent color for a UUID
function getColorForUUID(uuid: string): string {
  const hash = Math.abs(hashUUID(uuid))
  return schemeCategory10[hash % schemeCategory10.length]
}

interface User {
  id: string
  name: string
  created_at: string
  updated_at: string
}

const usersShape = {
  url: `${import.meta.env.VITE_API}/shape/users`
}

interface AvatarProps {
  userId: string
  size?: number
}

export const Avatar = React.memo(function Avatar({ userId, size = 32 }: AvatarProps) {
  const { data: users = [] } = useShape<User>(usersShape)
  const user = users.find(u => u.id === userId)

  if (!user) return null

  const backgroundColor = getColorForUUID(userId)
  const fontSize = Math.max(Math.floor(size / 2), 8)

  return (
    <div
      className="rounded-full text-white flex items-center justify-center font-medium"
      style={{
        width: size,
        height: size,
        backgroundColor,
        fontSize,
      }}
    >
      {user.name[0].toUpperCase()}
    </div>
  )
}, (prevProps, nextProps) => {
  return prevProps.userId === nextProps.userId && prevProps.size === nextProps.size
})
