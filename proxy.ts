import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl
  if (pathname !== "/" && pathname !== "/welcome") return

  // Signed-out visitors see the landing page at /, signed-in people their
  // dashboard; /welcome is only ever reached through that rewrite
  const { isAuthenticated } = await auth()
  if (pathname === "/" && !isAuthenticated)
    return NextResponse.rewrite(new URL("/welcome", req.url))
  if (pathname === "/welcome" && isAuthenticated)
    return NextResponse.redirect(new URL("/", req.url))
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
