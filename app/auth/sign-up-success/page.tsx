import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, MailCheck } from 'lucide-react'

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold text-foreground">Avance de Obra</span>
        </div>
        <Card>
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-2">
              <MailCheck className="w-12 h-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Revisa tu email</CardTitle>
            <CardDescription>
              Te enviamos un link de confirmacion. Confirma tu cuenta para poder ingresar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/auth/login">Ir al login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
