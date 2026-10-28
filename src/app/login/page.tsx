"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Cpu } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, user, isLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestedDestination = searchParams.get("next") ?? "/";
  const destination = requestedDestination.startsWith("/") && !requestedDestination.startsWith("//")
    ? requestedDestination
    : "/";

  useEffect(() => {
    if (!isLoading && user) router.replace(destination);
  }, [destination, isLoading, router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (mode === "register" && password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      router.replace(destination);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Không thể xác thực tài khoản.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-5 lg:items-stretch lg:px-8">
      <section className="hidden flex-col justify-between rounded-2xl bg-gradient-to-br from-primary/10 via-background to-violet-500/10 p-8 lg:col-span-2 lg:flex">
        <div>
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-lg shadow-primary/20">
            <Cpu className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-primary">TechAI Shop</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight">Mua sắm công nghệ theo cách của bạn.</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Đăng nhập để quản lý đơn hàng, lưu sản phẩm yêu thích và theo dõi giá.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Một tài khoản buyer cho các trải nghiệm mua sắm.</p>
      </section>
      <Card className="w-full border-border/70 shadow-sm lg:col-span-3">
        <CardHeader className="space-y-2 p-6 sm:p-8">
          <p className="text-sm font-medium text-primary">Chào mừng bạn</p>
          <CardTitle>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản buyer"}</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Đăng nhập bằng tài khoản TechAI Shop để tiếp tục."
              : "Tạo tài khoản buyer để đặt hàng và quản lý đơn mua."}
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
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "register" ? 8 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ít nhất 8 ký tự"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full bg-gradient-brand text-white hover:opacity-90" disabled={isSubmitting || isLoading}>
              {isSubmitting
                ? "Đang xử lý..."
                : mode === "login"
                  ? "Đăng nhập"
                  : "Tạo tài khoản"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setError("");
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              {mode === "login" ? "Đăng ký buyer" : "Đăng nhập"}
            </button>
          </p>
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

export default function LoginPage() {
  return (
    <Suspense fallback={<p role="status" className="py-16 text-center text-sm text-muted-foreground">Đang tải...</p>}>
      <LoginForm />
    </Suspense>
  );
}
