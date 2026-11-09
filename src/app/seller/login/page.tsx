"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Cpu } from "lucide-react";

function SellerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, user, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestedDestination = searchParams.get("next") ?? "/seller";
  const destination = requestedDestination.startsWith("/") && !requestedDestination.startsWith("//")
    ? requestedDestination
    : "/seller";

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "seller") {
        router.replace(destination);
      } else {
        setError("Tài khoản này không phải là người bán.");
      }
    }
  }, [destination, isLoading, router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    setIsSubmitting(true);
    try {
      await signIn(email, password);
      // signIn in AuthProvider already handles session + redirect via useEffect
      // If role is not seller, the useEffect above will set error
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Không thể xác thực tài khoản.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-5 lg:items-stretch lg:px-8">
      <h1 className="sr-only">Đăng nhập tài khoản người bán</h1>
      <section className="hidden flex-col justify-between bg-foreground p-8 text-background lg:col-span-2 lg:flex">
        <div>
          <div className="mb-8 flex h-12 w-12 items-center justify-center bg-brand text-[#111315]">
            <Cpu className="h-6 w-6" />
          </div>
          <p className="font-heading text-xl font-extrabold uppercase tracking-[-0.02em]">Eamora</p>
          <h2 className="figure mt-3 text-4xl leading-[1.02]">Kênh Người Bán</h2>
          <p className="mt-4 text-sm leading-relaxed opacity-75">
            Đăng nhập để quản lý shop, sản phẩm và đơn hàng của bạn.
          </p>
        </div>
        <p className="text-xs opacity-60">Một tài khoản người bán cho các trải nghiệm bán hàng.</p>
      </section>
      <Card className="w-full border-border/70 shadow-sm lg:col-span-3">
        <CardHeader className="space-y-2 p-6 sm:p-8">
          <CardTitle>Đăng nhập người bán</CardTitle>
          <CardDescription>
            Đăng nhập bằng tài khoản người bán để tiếp tục quản lý cửa hàng của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">Mật khẩu</label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full bg-primary text-primary-foreground hover:bg-brand hover:text-[#111315]" disabled={isSubmitting || isLoading}>
              {isSubmitting ? "Đang xử lý..." : "Đăng nhập người bán"}
            </Button>
          </form>
          <p className="mt-3 text-center text-sm">
            <Link href="/" className="text-muted-foreground underline-offset-4 hover:underline">
              Quay lại cửa hàng
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SellerLoginPage() {
  return (
    <Suspense fallback={<p role="status" className="py-16 text-center text-sm text-muted-foreground">Đang tải...</p>}>
      <SellerLoginForm />
    </Suspense>
  );
}
