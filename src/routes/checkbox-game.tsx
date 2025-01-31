import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useShape, preloadShape } from "@electric-sql/react"
import { Avatar } from '../components/avatar'
import { useMutation, useMutationState } from '@tanstack/react-query'

const API_ROOT = import.meta.env.VITE_API

interface CheckboxState {
  id: number
  checked: boolean
  user_id: string | null
  created_at: string
  updated_at: string
}

interface Group {
  size: number
  score: number
}

interface UserStats {
  user_id: string
  name: string
  score: number
  groups: Group[]
}

interface CheckboxStats {
  total_checked: number
  user_stats: UserStats[]
}

interface User {
  id: string
  name: string
}

const checkboxShape = {
  url: `${API_ROOT}/shape/checkboxes`
}

const usersShape = {
  url: `${API_ROOT}/shape/users`
}

// Convert checkbox ID to x,y coordinates (id goes from 1-1000)
function getCoordinates(id: number): [number, number] {
  return [
    (id - 1) % 50, // x
    Math.floor((id - 1) / 50) // y
  ]
}

// Check if two checkboxes are adjacent
function areAdjacent(id1: number, id2: number): boolean {
  const [x1, y1] = getCoordinates(id1)
  const [x2, y2] = getCoordinates(id2)

  return (
    (Math.abs(x1 - x2) === 1 && y1 === y2) || // horizontally adjacent
    (Math.abs(y1 - y2) === 1 && x1 === x2)    // vertically adjacent
  )
}

// Find all connected components using depth-first search
function findConnectedComponents(checkboxes: CheckboxState[]): Map<string, number[][]> {
  const checkedBoxes = checkboxes.filter(c => c.checked && c.user_id)
  const visited = new Set<number>()
  const userGroups = new Map<string, number[][]>()

  for (const box of checkedBoxes) {
    if (visited.has(box.id) || !box.user_id) continue

    const component: number[] = []
    const stack = [box.id]

    while (stack.length > 0) {
      const currentId = stack.pop()!
      if (visited.has(currentId)) continue

      visited.add(currentId)
      component.push(currentId)

      // Find adjacent boxes owned by the same user
      const adjacentBoxes = checkedBoxes.filter(b =>
        !visited.has(b.id) &&
        b.user_id === box.user_id &&
        areAdjacent(currentId, b.id)
      )

      stack.push(...adjacentBoxes.map(b => b.id))
    }

    if (!userGroups.has(box.user_id)) {
      userGroups.set(box.user_id, [])
    }
    userGroups.get(box.user_id)!.push(component)
  }

  return userGroups
}

// Calculate score for a group size using exponential growth
function calculateGroupScore(size: number): number {
  return Math.floor(Math.pow(size, 1.5))
}

// Calculate stats from current checkbox state
function calculateStats(checkboxes: CheckboxState[], users: Map<string, string>): CheckboxStats {
  const userGroups = findConnectedComponents(checkboxes)
  const user_stats: UserStats[] = []

  for (const [userId, groups] of userGroups.entries()) {
    const userName = users.get(userId) || 'Unknown'
    const userGroups = groups.map(group => ({
      size: group.length,
      score: calculateGroupScore(group.length)
    }))

    user_stats.push({
      user_id: userId,
      name: userName,
      score: userGroups.reduce((sum, g) => sum + g.score, 0),
      groups: userGroups
    })
  }

  return {
    total_checked: checkboxes.filter(c => c.checked).length,
    user_stats
  }
}

// D3's Category10 colors for consistent avatar colors
const schemeCategory10 = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
];

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

const getUserColor = (userId: string) => {
  return getColorForUUID(userId)
}

// Memoized checkbox button component
const CheckboxButton = React.memo(function CheckboxButton({
  checkbox,
  owner,
  onToggle,
}: {
  checkbox: CheckboxState
  owner: User | undefined
  onToggle: (id: number) => void
}) {
  const backgroundColor = checkbox.checked && owner ? getColorForUUID(owner.id) : 'white'

  return (
    <button
      onClick={() => onToggle(checkbox.id)}
      className={`
        w-5 h-5 border rounded relative transition-all transform
        border-gray-300 text-white flex items-center justify-center text-xs font-medium
        hover:opacity-80 hover:scale-105
      `}
      style={{
        backgroundColor,
      }}
    >
      {checkbox.checked && owner && owner.name[0].toUpperCase()}
    </button>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.checkbox.checked === nextProps.checkbox.checked &&
    prevProps.checkbox.user_id === nextProps.checkbox.user_id &&
    prevProps.owner?.id === nextProps.owner?.id
  )
})

function CheckboxGameComponent() {
  const { data: checkboxes = [], stream } = useShape<CheckboxState>(checkboxShape)
  const { data: users = [] } = useShape<User>(usersShape)
  const storedUser = localStorage.getItem('user')
  const user = storedUser ? JSON.parse(storedUser) : null

  // Create a map of user IDs to users for efficient lookup
  const userMap = React.useMemo(() => {
    return new Map(users.map(u => [u.id, u]))
  }, [users])

  // Merge data from shape & optimistic data from mutations
  const checkboxMap = new Map<number, CheckboxState>()

  // Add base checkboxes
  checkboxes.forEach(checkbox => {
    checkboxMap.set(checkbox.id, checkbox)
  })

  // Add optimistic checkboxes
  const optimisticCheckboxes = useMutationState({
    filters: { status: 'pending' },
    select: (mutation) => mutation.state.context as CheckboxState,
  })

  optimisticCheckboxes.forEach(checkbox => {
    if (checkbox) {
      // For optimistic checkboxes, update the existing one
      checkboxMap.set(checkbox.id, { ...checkboxMap.get(checkbox.id), ...checkbox })
    }
  })

  const mergedCheckboxes = Array.from(checkboxMap.values())
    .filter(obj => Object.keys(obj).length > 0)
    .sort((a, b) => a.id - b.id)

  // Wait for a specific transaction ID to appear in the stream
  const waitForTxid = React.useCallback(async (expectedTxid: number) => {
    let unsubscribe: (() => void) | undefined

    try {
      return await new Promise<void>((resolve, reject) => {
        unsubscribe = stream.subscribe((messages: any[]) => {
          for (const message of messages) {
            const txid = message.headers?.txid
            if (txid === expectedTxid) {
              unsubscribe?.()
              resolve()
              return
            }
          }
        })
      })
    } finally {
      unsubscribe?.()
    }
  }, [stream])

  const toggleCheckboxMutation = useMutation({
    gcTime: 0,
    mutationKey: ['toggle-checkbox'],
    mutationFn: async (id: number) => {
      // Start collecting txids
      const seenTxids = new Set<number>()
      let unsubscribe: (() => void) | undefined

      try {
        unsubscribe = stream.subscribe((messages: any[]) => {
          for (const message of messages) {
            const txid = message.headers?.txid
            if (txid) {
              seenTxids.add(txid)
            }
          }
        })

        const response = await fetch(`${API_ROOT}/checkboxes/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to toggle checkbox')
        }

        const { txid } = await response.json()

        // If we haven't seen this txid in the stream yet, wait for it
        if (!seenTxids.has(txid)) {
          await waitForTxid(txid)
        }

        return { id, txid }
      } finally {
        unsubscribe?.()
      }
    },
    onMutate: (id: number) => {
      const checkbox = mergedCheckboxes.find(c => c.id === id)
      if (!checkbox || !user) return

      // Return optimistic checkbox state
      const newState = checkbox.checked && checkbox.user_id === user.id
        ? { checked: false, user_id: null }
        : { checked: true, user_id: user.id }

      return {
        ...checkbox,
        ...newState,
        updated_at: new Date().toISOString(),
      }
    }
  })

  const renderCount = React.useRef(0)
  const prevCheckboxes = React.useRef<CheckboxState[]>([])

  // Track what changed in checkboxes
  React.useEffect(() => {
    if (prevCheckboxes.current.length > 0) {
      const changes = mergedCheckboxes.filter((checkbox, i) => {
        const prev = prevCheckboxes.current[i]
        return prev && (
          prev.checked !== checkbox.checked ||
          prev.user_id !== checkbox.user_id
        )
      })
      if (changes.length > 0) {
        console.log('Changed checkboxes:', changes)
      }
    }
    prevCheckboxes.current = mergedCheckboxes
  }, [mergedCheckboxes])

  // Debug log for renders
  React.useEffect(() => {
    renderCount.current++
    console.group(`Render #${renderCount.current}`)
    console.time('Total render time')
    console.log(`Total checkboxes: ${mergedCheckboxes.length}`)
    console.log(`Total users: ${users.length}`)
    return () => {
      console.timeEnd('Total render time')
      console.groupEnd()
    }
  })

  // Calculate stats from current state
  const stats = React.useMemo(() => {
    console.time('Stats calculation')
    const result = calculateStats(mergedCheckboxes, new Map(users.map(u => [u.id, u.name])))
    console.timeEnd('Stats calculation')
    return result
  }, [mergedCheckboxes, users])

  // If no user is set, redirect to home
  if (!user) {
    return (
      <div className="max-w-2xl p-6">
        <h3 className="text-xl mb-4">Please set your name first</h3>
        <a href="/" className="text-blue-500 hover:text-blue-600">Go to home page</a>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">1000 Checkbox Game</h1>
      <p className="mb-8 text-gray-600">
        A multiplayer game where players compete to create connected groups of checkboxes.
        The larger your connected groups, the more points you earn! Points are calculated using
        an exponential formula: group_size^1.5
      </p>

      {/* Game grid */}
      <div className="mb-8">
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: 'repeat(50, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(20, minmax(0, 1fr))',
          }}
        >
          {mergedCheckboxes.map((checkbox) => (
            <CheckboxButton
              key={checkbox.id}
              checkbox={checkbox}
              owner={userMap.get(checkbox.user_id || '')}
              onToggle={() => toggleCheckboxMutation.mutateAsync(checkbox.id)}
            />
          ))}
        </div>
      </div>

      {/* Stats panel */}
      {stats && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Game Stats</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <p className="text-gray-600">Total Boxes Checked</p>
                  <p className="text-3xl font-bold">{stats.total_checked} / 1000</p>
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${(stats.total_checked / 1000) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Leaderboard</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.user_stats
                  .sort((a, b) => b.score - a.score)
                  .map((userStat) => (
                    <div
                      key={userStat.user_id}
                      className="bg-gray-50 p-4 rounded-lg"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar userId={userStat.user_id} size={32} />
                        <div className="flex-1">
                          <p className="font-medium">
                            {userStat.name}
                            {userStat.user_id === user.id && ' (You)'}
                          </p>
                          <p className="text-2xl font-bold text-blue-600">
                            {userStat.score} points
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p className="font-medium mb-2">Groups:</p>
                        <div className="grid grid-cols-3 gap-2">
                          {userStat.groups
                            .sort((a, b) => b.size - a.size)
                            .map((group, i) => (
                              <div
                                key={i}
                                className="bg-white p-2 rounded text-center"
                              >
                                <p className="font-medium text-gray-900">
                                  {group.size} boxes
                                </p>
                                <p className="text-xs text-gray-500">
                                  {group.score} pts
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const Route = createFileRoute('/checkbox-game')({
  component: CheckboxGameComponent,
  loader: async () => {
    await preloadShape(checkboxShape)
    await preloadShape(usersShape)
    return null
  }
})
