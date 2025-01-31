import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useShape, preloadShape } from "@electric-sql/react"
import { useMutation } from '@tanstack/react-query'
import { Dialog } from '@headlessui/react'

const API_ROOT = import.meta.env.VITE_API

// First define the interfaces
interface Column {
  column_name: string
  data_type: string
  is_nullable: boolean
  column_default: string | null
  is_identity: boolean
}

interface TableMetadata {
  table_name: string
  columns: Column[]
}

// Then define the component
function TableEditorComponent() {
  const { tableMetadata } = Route.useLoaderData()
  const { tableName } = Route.useParams()
  const [editingCell, setEditingCell] = React.useState<{ id: any, column: string } | null>(null)
  const [isInsertModalOpen, setIsInsertModalOpen] = React.useState(false)
  const [newRowData, setNewRowData] = React.useState<Record<string, any>>({})

  const { data: rows } = useShape({ url: `${API_ROOT}/shape/${tableName}` })

  const updateMutation = useMutation({
    mutationFn: async ({ id, column, value }: { id: any, column: string, value: any }) => {
      const response = await fetch(`${API_ROOT}/tables/${tableName}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [column]: value }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update value')
      }
      const { row, txid } = await response.json()
      return { row, txid }
    },
  })

  const insertMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const response = await fetch(`${API_ROOT}/${tableName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to insert row')
      return response.json()
    },
  })

  const parseValueByType = (value: string, column: Column) => {
    console.log('Parsing value:', { value, column_type: column.data_type })

    if (value === '' && column.is_nullable) return null

    switch (column.data_type) {
      case 'boolean':
        // Handle various boolean string representations
        if (value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes') return true
        if (value.toLowerCase() === 'false' || value === '0' || value.toLowerCase() === 'no') return false
        return Boolean(value)
      case 'integer':
      case 'bigint':
        return parseInt(value, 10)
      case 'numeric':
      case 'decimal':
      case 'real':
      case 'double precision':
        return parseFloat(value)
      case 'json':
      case 'jsonb':
        try {
          return JSON.parse(value)
        } catch {
          throw new Error('Invalid JSON format')
        }
      case 'timestamp':
      case 'timestamp with time zone':
      case 'timestamp without time zone':
        return new Date(value).toISOString()
      case 'text':
      case 'character varying':
      case 'varchar':
      case 'char':
      case 'character':
        return value
      default:
        console.log('Unknown type:', column.data_type)
        return value
    }
  }

  const formatValueForDisplay = (value: any, column: Column) => {
    if (value === null || value === undefined) return ''

    switch (column.data_type) {
      case 'json':
      case 'jsonb':
        return JSON.stringify(value, null, 2)
      case 'timestamp':
      case 'timestamp with time zone':
      case 'timestamp without time zone':
        // For display in table, show local time
        return new Date(value).toLocaleString()
      default:
        return value.toString()
    }
  }

  const formatValueForEdit = (value: any, column: Column) => {
    if (value === null || value === undefined) return ''

    switch (column.data_type) {
      case 'json':
      case 'jsonb':
        return JSON.stringify(value, null, 2)
      case 'timestamp':
      case 'timestamp with time zone':
      case 'timestamp without time zone':
        // For editing, use ISO format
        return new Date(value).toISOString()
      default:
        return value.toString()
    }
  }

  const handleDoubleClick = (id: any, column: string) => {
    const column_meta = tableMetadata.columns.find(c => c.column_name === column)
    if (column_meta?.is_identity) return // Don't allow editing identity columns
    setEditingCell({ id, column })
  }

  const handleCellBlur = async (id: any, column: string, value: any) => {
    setEditingCell(null)
    const currentValue = rows.find(r => r.id === id)?.[column]
    if (value === currentValue?.toString()) return // No change

    const column_meta = tableMetadata.columns.find(c => c.column_name === column)
    if (!column_meta) return

    try {
      console.log('Updating cell:', { id, column, value, type: column_meta.data_type })
      const parsedValue = parseValueByType(value, column_meta)
      console.log('Parsed value:', parsedValue)
      await updateMutation.mutateAsync({ id, column, value: parsedValue })
    } catch (error) {
      console.error('Failed to parse value:', error)
      alert(`Invalid value for ${column_meta.data_type} type`)
    }
  }

  const handleInsert = async (e: React.FormEvent) => {
    e.preventDefault()
    await insertMutation.mutateAsync(newRowData)
    setNewRowData({})
    setIsInsertModalOpen(false)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{tableName}</h1>
        <button
          onClick={() => setIsInsertModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Insert Row
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {tableMetadata.columns.map(column => (
                <th
                  key={column.column_name}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.column_name}
                  {column.is_identity && <span className="ml-1 text-blue-500">ID</span>}
                  {column.column_default && <span className="ml-1 text-gray-400">Default</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows?.map(row => (
              <tr key={row.id}>
                {tableMetadata.columns.map(column => (
                  <td
                    key={column.column_name}
                    className="px-6 py-4 whitespace-nowrap"
                    onDoubleClick={() => handleDoubleClick(row.id, column.column_name)}
                  >
                    {editingCell?.id === row.id && editingCell?.column === column.column_name ? (
                      <input
                        type={column.data_type === 'integer' || column.data_type === 'bigint' ? 'number' : 'text'}
                        className="w-full px-2 py-1 border rounded"
                        defaultValue={formatValueForEdit(row[column.column_name], column)}
                        autoFocus
                        onBlur={(e) => handleCellBlur(row.id, column.column_name, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur()
                          }
                          if (e.key === 'Escape') {
                            setEditingCell(null)
                          }
                        }}
                      />
                    ) : (
                      <span className={column.is_identity ? 'text-blue-500' : ''}>
                        {formatValueForDisplay(row[column.column_name], column)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={isInsertModalOpen}
        onClose={() => setIsInsertModalOpen(false)}
        className="relative z-10"
      >
        {/* The backdrop */}
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        {/* Full-screen container to center the panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl">
            <Dialog.Title className="text-lg font-medium mb-4">Insert New Row</Dialog.Title>

            <form onSubmit={handleInsert}>
              {tableMetadata.columns.map(column => {
                if (column.is_identity || column.column_default) return null
                return (
                  <div key={column.column_name} className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {column.column_name}
                      {!column.is_nullable && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      required={!column.is_nullable}
                      className="w-full px-3 py-2 border rounded-md"
                      value={newRowData[column.column_name] || ''}
                      onChange={(e) => setNewRowData(prev => ({
                        ...prev,
                        [column.column_name]: e.target.value
                      }))}
                    />
                  </div>
                )
              })}

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsInsertModalOpen(false)}
                  className="px-4 py-2 text-gray-700 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Insert
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  )
}

// Finally export the route with the component
export const Route = createFileRoute('/table-editor/$tableName')({
  component: TableEditorComponent,
  loader: async ({ params }) => {
    // Get table metadata
    const response = await fetch(`${API_ROOT}/tables`)
    const { tables } = await response.json()
    const tableMetadata = tables.find((t: TableMetadata) => t.table_name === params.tableName)
    if (!tableMetadata) throw new Error(`Table ${params.tableName} not found`)

    // Preload table data
    await preloadShape({ url: `${API_ROOT}/shape/${params.tableName}` })

    return { tableMetadata }
  }
})
