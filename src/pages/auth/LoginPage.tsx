import { useState } from 'react';
// useAtom yerine useAtomValue ve useSetAtom import edin
import { useAtomValue, useSetAtom } from 'jotai';
import { loginAtom, authStateAtom } from '@/store/auth';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
});

type FormValues = z.infer<typeof formSchema>;

const LoginPage = () => {
  // authStateAtom'dan değeri okuyun
  const { isLoading, error } = useAtomValue(authStateAtom);
  // loginAtom'dan sadece setter fonksiyonunu alın
  const login = useSetAtom(loginAtom);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    // login fonksiyonunu doğrudan çağırın
    await login({ email: values.email, password: values.password });
  };

  return (
    <Card className="w-full max-w-sm mx-auto"> {/* Kartı ortalamak ve boyutlandırmak için eklendi */}
      <CardHeader>
        <CardTitle>Giriş Yap</CardTitle>
        <CardDescription>KOSGEB CRM sistemine erişmek için giriş yapın</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-posta</FormLabel>
                  <FormControl>
                    <Input placeholder="ornek@firma.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Şifre</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent text-xs" // Buton stilini düzelttim
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? 'Gizle' : 'Göster'}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Giriş Yapılıyor... {/* Nokta ekledim */}
                </>
              ) : (
                'Giriş Yap'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Kullanıcı hesabınız yok mu? Sistem yöneticinize başvurun.
        </p>
      </CardFooter>
    </Card>
  );
};

export default LoginPage;