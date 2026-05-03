'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import useSWR from 'swr'
import {
  Building2,
  LayoutDashboard,
  Settings,
  LogOut,
  Mail,
  Plus,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { ObraWithAccess, ObraColaborador } from '@/lib/types'

interface AppSidebarProps {
  user: User
}

const fetcher = async (url: string) => {
  const supabase = createClient()
  
  if (url === '/obras') {
    const { data: ownedObras } = await supabase
      .from('obras')
      .select('*')
      .order('created_at', { ascending: false })
    
    const { data: collaborations } = await supabase
      .from('obra_colaboradores')
      .select('obra_id, obras(*)')
      .eq('estado', 'aceptada')
    
    const owned = (ownedObras || []).map((obra) => ({
      ...obra,
      es_propietario: true,
    }))
    
    const shared = (collaborations || [])
      .filter((c) => c.obras)
      .map((c) => ({
        ...(c.obras as unknown as ObraWithAccess),
        es_propietario: false,
      }))
    
    return [...owned, ...shared] as ObraWithAccess[]
  }
  
  if (url === '/invitaciones') {
    const { data } = await supabase
      .from('obra_colaboradores')
      .select('*')
      .eq('estado', 'pendiente')
    return data || []
  }
  
  return []
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  const { data: obras = [] } = useSWR<ObraWithAccess[]>('/obras', fetcher)
  const { data: invitaciones = [] } = useSWR<ObraColaborador[]>('/invitaciones', fetcher)
  
  const pendingCount = invitaciones.length
  
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const userInitials = user.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U'

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/obras">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Avance de Obra</span>
                  <span className="text-xs text-sidebar-foreground/70">Gestion de construccion</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarSeparator />
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/obras'}>
                  <Link href="/obras">
                    <LayoutDashboard className="size-4" />
                    <span>Mis Obras</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/invitaciones'}>
                  <Link href="/invitaciones">
                    <Mail className="size-4" />
                    <span>Invitaciones</span>
                  </Link>
                </SidebarMenuButton>
                {pendingCount > 0 && (
                  <SidebarMenuBadge className="bg-primary text-primary-foreground">
                    {pendingCount}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Obras Recientes</SidebarGroupLabel>
          <SidebarGroupAction asChild title="Nueva Obra">
            <Link href="/obras/nueva">
              <Plus className="size-4" />
              <span className="sr-only">Nueva Obra</span>
            </Link>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {obras.slice(0, 5).map((obra) => (
                <SidebarMenuItem key={obra.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(`/obras/${obra.id}`)}
                  >
                    <Link href={`/obras/${obra.id}`}>
                      {obra.es_propietario ? (
                        <Building2 className="size-4" />
                      ) : (
                        <Users className="size-4" />
                      )}
                      <span className="truncate">{obra.nombre}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {obras.length === 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/obras/nueva" className="text-muted-foreground">
                      <Plus className="size-4" />
                      <span>Crear primera obra</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-medium truncate max-w-[140px]">{user.email}</span>
                    <span className="text-xs text-sidebar-foreground/70">Mi cuenta</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem disabled>
                  <Settings className="mr-2 size-4" />
                  <span>Configuración</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 size-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
