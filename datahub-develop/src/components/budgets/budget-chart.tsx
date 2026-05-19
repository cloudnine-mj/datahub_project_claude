"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface BudgetChartProps {
  data: {
    name: string;
    total: number;
    used: number;
  }[];
}

export function BudgetChart({ data }: BudgetChartProps) {
  const maxAmount = Math.max(...data.map(d => d.total), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>예산 vs 사용액</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {data.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(item.used)} / {formatCurrency(item.total)}
                  </span>
                </div>
                <div className="relative h-6 bg-gray-100 rounded">
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-200 rounded"
                    style={{ width: `${(item.total / maxAmount) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-600 rounded"
                    style={{ width: `${(item.used / maxAmount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
