import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ProductCard from "@/components/shared/ProductCard";
import mockData from "@/mocks/db.json";
import { Product } from "@/types";

const colors = [
  { name: "Primary", token: "--primary", value: "var(--primary)" },
  { name: "Secondary", token: "--secondary", value: "var(--secondary)" },
  { name: "Background", token: "--background", value: "var(--background)" },
  { name: "Foreground", token: "--foreground", value: "var(--foreground)" },
  { name: "Muted", token: "--muted", value: "var(--muted)" },
  { name: "Accent", token: "--accent", value: "var(--accent)" },
  { name: "Success", token: "--success", value: "var(--success)" },
  { name: "Warning", token: "--warning", value: "var(--warning)" },
  { name: "Destructive", token: "--destructive", value: "var(--destructive)" },
  { name: "Border", token: "--border", value: "var(--border)" },
];

const sampleProduct = mockData.products[0] as unknown as Product;

export default function StyleguidePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
      <header className="border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          TechAI Shop / Design System
        </p>
        <h1 className="mt-3 text-3xl font-bold">Styleguide</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Tokens and shared interface components currently used across the storefront.
        </p>
      </header>

      <section aria-labelledby="colors-heading" className="space-y-5">
        <div>
          <h2 id="colors-heading" className="text-xl font-semibold">Color tokens</h2>
          <p className="mt-1 text-sm text-muted-foreground">Semantic colors adapt to the active theme.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {colors.map((color) => (
            <div key={color.token} className="overflow-hidden rounded-lg border border-border bg-card">
              <div
                className="h-20 border-b border-border"
                style={{ backgroundColor: color.value }}
                aria-label={`${color.name} color swatch`}
              />
              <div className="p-3">
                <p className="text-sm font-medium">{color.name}</p>
                <code className="text-xs text-muted-foreground">{color.token}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="type-heading" className="space-y-5">
        <div>
          <h2 id="type-heading" className="text-xl font-semibold">Typography</h2>
          <p className="mt-1 text-sm text-muted-foreground">Inter with a compact hierarchy for product browsing.</p>
        </div>
        <div className="space-y-4 border-y border-border py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[32px] leading-10 font-bold">Display heading</p>
            <code className="text-xs text-muted-foreground">32 / 40 · Bold</code>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-2xl leading-8 font-bold">Page title</p>
            <code className="text-xs text-muted-foreground">24 / 32 · Bold</code>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xl leading-7 font-semibold">Section title</p>
            <code className="text-xs text-muted-foreground">20 / 28 · Semibold</code>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-base leading-6">Body text for product descriptions and forms.</p>
            <code className="text-xs text-muted-foreground">16 / 24 · Regular</code>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm leading-5 text-muted-foreground">Supporting text and secondary information.</p>
            <code className="text-xs text-muted-foreground">14 / 20 · Regular</code>
          </div>
        </div>
      </section>

      <section aria-labelledby="components-heading" className="space-y-5">
        <div>
          <h2 id="components-heading" className="text-xl font-semibold">Components</h2>
          <p className="mt-1 text-sm text-muted-foreground">Shared primitives and their semantic variants.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Buttons and badges</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Form controls</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="styleguide-input" className="text-sm font-medium">Text input</label>
                <Input id="styleguide-input" placeholder="Search products" />
              </div>
              <div className="space-y-2">
                <label htmlFor="styleguide-textarea" className="text-sm font-medium">Message</label>
                <Textarea id="styleguide-textarea" placeholder="Write a short message" rows={3} />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="product-card-heading" className="space-y-5">
        <div>
          <h2 id="product-card-heading" className="text-xl font-semibold">Product card</h2>
          <p className="mt-1 text-sm text-muted-foreground">Shared commerce component with sample catalog data.</p>
        </div>
        <div className="w-full max-w-xs">
          <ProductCard product={sampleProduct} />
        </div>
      </section>
    </div>
  );
}