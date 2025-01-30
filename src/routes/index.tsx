import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from "@/components/ui/button"

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div>
      <h3 className='text-xl'>Welcome to the Electric Workshop!</h3>
    </div>
  )
}
