"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthProvider";
import { Plus, PlusCircle } from "lucide-react";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

interface Category {
  id: string;
  name: string;
}

interface CreateProductForm {
  name: string;
  description: string;
  categoryId: string;
  brand: string;
  basePrice: string;
  stock: string;
  imageUrl: string;
}

interface CreateProductResponse {
  success: boolean;
  data?: unknown;
  message?: string;
}

export default function CreateProductPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CreateProductForm>({
    name: "",
    description: "",
    categoryId: "",
    brand: "",
    basePrice: "",
    stock: "0",
    imageUrl: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Role guard: chỉ seller mới được vào (chạy ở client-side trong useEffect)
  useEffect(() => {
    if (!user || user.role !== "seller") {
      router.push("/?error=unauthorized");
    }
  }, [user, router]);

  useEffect(() => {
    let cancelled = false;
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/categories`);
        const result = await response.json() as {
          success?: boolean;
          data?: Category[];
          message?: string;
        };
        if (!cancelled && result.success) {
          setCategories(result.data ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch categories", err);
      }
    };
    fetchCategories();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (key: keyof CreateProductForm, value: string) => {
    setForm({ ...form, [key]: value });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const basePrice = Number(form.basePrice);
      const stock = Number(form.stock);

      if (!form.name) {
        setError("Tên sản phẩm là bắt buộc.");
        setIsSaving(false);
        return;
      }
      if (!form.categoryId) {
        setError("Vui lòng chọn danh mục.");
        setIsSaving(false);
        return;
      }
      if (!Number.isFinite(basePrice) || basePrice < 0) {
        setError("Giá sản phẩm không hợp lệ.");
        setIsSaving(false);
        return;
      }
      if (!Number.isSafeInteger(stock) || stock < 0) {
        setError("Tồn kho không hợp lệ.");
        setIsSaving(false);
        return;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          categoryId: form.categoryId,
          brand: form.brand || undefined,
          basePrice,
          stock,
          imageUrl: form.imageUrl || undefined,
        }),
      });

      const result = await response.json() as CreateProductResponse;

      if (!response.ok || !result.success) {
        setError(result.message || "Không thể tạo sản phẩm.");
        setIsSaving(false);
        return;
      }

      setSuccess("Đã tạo sản phẩm thành công!");
      setForm({
        name: "",
        description: "",
        categoryId: "",
        brand: "",
        basePrice: "",
        stock: "0",
        imageUrl: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi tạo sản phẩm.");
    } finally {
      setIsSaving(false);
    }
  };

  // Chưa xác định quyền -> hiển thị loading tránh nháy
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="figure text-4xl sm:text-5xl">Thêm sản phẩm mới</h1>
          <p className="text-sm text-muted-foreground">Đăng sản phẩm đầu tiên của bạn lên sàn giao dịch.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/seller")}>
          <Plus className="h-4 w-4 mr-2" /> Về bảng điều khiển
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Lỗi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4">
          <AlertTitle>Thành công</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Thông tin sản phẩm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
              {/* Tên sản phẩm */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Tên sản phẩm</label>
                <Input
                  placeholder="Ví dụ: iPhone 15 Pro Max 256GB"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  disabled={isSaving}
                />
              </div>

              {/* Danh mục */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Danh mục</label>
                <Select
                  value={form.categoryId}
                  onValueChange={(value: string | null) => handleChange("categoryId", value ?? "")}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <SelectItem disabled key="empty">Đang tải danh mục...</SelectItem>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Thương hiệu */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Thương hiệu</label>
                <Input
                  placeholder="Ví dụ: Apple, Samsung, Xiaomi"
                  value={form.brand}
                  onChange={(e) => handleChange("brand", e.target.value)}
                  disabled={isSaving}
                />
              </div>

              {/* Giá */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Giá (VND)</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.basePrice}
                  onChange={(e) => handleChange("basePrice", e.target.value)}
                  disabled={isSaving}
                />
              </div>

              {/* Tồn kho */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Tồn kho</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.stock}
                  onChange={(e) => handleChange("stock", e.target.value)}
                  disabled={isSaving}
                />
              </div>

              {/* Ảnh */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Ảnh sản phẩm (URL)</label>
                <Input
                  type="url"
                  placeholder="https://example.com/anh-san-pham.jpg"
                  value={form.imageUrl}
                  onChange={(e) => handleChange("imageUrl", e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Mô tả */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Mô tả sản phẩm</label>
              <Textarea
                placeholder="Mô tả chi tiết sản phẩm..."
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                disabled={isSaving}
                rows={4}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/seller")}
                disabled={isSaving}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Đang tạo..." : <><PlusCircle className="h-4 w-4 mr-2" /> Tạo sản phẩm</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
