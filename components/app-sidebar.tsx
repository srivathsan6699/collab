"use client"

import { UserButton } from "@clerk/nextjs"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent>
        <SidebarGroup />
        <SidebarGroup />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={({ className }) => (
                <UserButton
                  showName
                  appearance={{
                    elements: {
                      rootBox: "flex w-full",
                      userButtonTrigger: className,
                      userButtonBox: "min-w-0 flex-row-reverse justify-end gap-2",
                      userButtonAvatarBox: "size-8 rounded-lg",
                      userButtonOuterIdentifier:
                        "truncate ps-0 text-sm font-medium text-inherit",
                    },
                  }}
                />
              )}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
