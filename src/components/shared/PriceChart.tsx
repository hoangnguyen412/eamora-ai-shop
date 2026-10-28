"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { PriceHistory } from "@/types";
import { formatPrice } from "@/lib/helpers";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface PriceChartProps {
  priceData: PriceHistory;
}

export default function PriceChart({ priceData }: PriceChartProps) {
  const trendIcon = {
    down: <TrendingDown className="h-4 w-4 text-green-500" />,
    up: <TrendingUp className="h-4 w-4 text-red-500" />,
    stable: <Minus className="h-4 w-4 text-muted-foreground" />,
  };

  const trendLabel = {
    down: "Xu hướng giảm",
    up: "Xu hướng tăng",
    stable: "Ổn định",
  };

  const trendColor = {
    down: "text-green-500",
    up: "text-red-500",
    stable: "text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
          <p className="text-xs text-muted-foreground">Giá thấp nhất</p>
          <p className="text-sm font-bold text-green-600 dark:text-green-400">
            {formatPrice(priceData.lowestPrice)}
          </p>
        </div>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
          <p className="text-xs text-muted-foreground">Hiện tại</p>
          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {formatPrice(priceData.currentPrice)}
          </p>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-center">
          <p className="text-xs text-muted-foreground">Cao nhất</p>
          <p className="text-sm font-bold text-red-600 dark:text-red-400">
            {formatPrice(priceData.highestPrice)}
          </p>
        </div>
      </div>

      {/* Trend */}
      <div className={`flex items-center gap-2 ${trendColor[priceData.priceTrend]}`}>
        {trendIcon[priceData.priceTrend]}
        <span className="text-sm font-medium">{trendLabel[priceData.priceTrend]}</span>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={priceData.history}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
              className="text-xs"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v: number) =>
                `${(v / 1000000).toFixed(1)}tr`
              }
              className="text-xs"
              tick={{ fontSize: 11 }}
              width={55}
            />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Tooltip
              formatter={((value: number) => [formatPrice(value), "Giá"]) as any}
              labelFormatter={((label: string) => {
                const d = new Date(label);
                return d.toLocaleDateString("vi-VN");
              }) as any}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            />
            <ReferenceLine
              y={priceData.lowestPrice}
              stroke="#22c55e"
              strokeDasharray="5 5"
              label={{ value: "Thấp nhất", position: "right", fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="oklch(0.488 0.243 264.376)"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "oklch(0.488 0.243 264.376)" }}
              activeDot={{ r: 6, stroke: "oklch(0.488 0.243 264.376)", strokeWidth: 2, fill: "#fff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
