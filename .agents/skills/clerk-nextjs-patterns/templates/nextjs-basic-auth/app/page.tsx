import { auth } from '@clerk/nextjs/server'

export default async function Home() {
  await auth.protect()
  return <h1>Home</h1>
}
