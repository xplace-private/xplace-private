import { createFileRoute } from '@tanstack/react-router'

import { HomeRoute } from '../home-route'

export const Route = createFileRoute('/home')({
  component: HomeRoute,
})
