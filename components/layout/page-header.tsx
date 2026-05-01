import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

interface PageHeaderProps {
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  children?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  actionLabel,
  actionHref,
  children,
}: PageHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {children}
          {actionLabel && actionHref && (
            <Button asChild size="sm">
              <Link href={actionHref}>
                <Plus className="mr-2 size-4" />
                {actionLabel}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
