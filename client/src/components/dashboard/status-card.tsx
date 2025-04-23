import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatusCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  trend?: {
    value: string;
    label: string;
    timeframe?: string;
    isPositive: boolean;
  };
  isLoading?: boolean;
}

export default function StatusCard({
  title,
  value,
  icon,
  iconBg,
  iconColor,
  borderColor,
  trend,
  isLoading = false
}: StatusCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden border-l-4", borderColor)}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <Skeleton className="h-4 w-28 mb-2" />
              <Skeleton className="h-8 w-12" />
            </div>
            <Skeleton className={cn("h-10 w-10 rounded-md", iconBg)} />
          </div>
          <div className="mt-3">
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={cn("overflow-hidden border-l-4", borderColor)}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <h3 className="mt-1 text-2xl font-semibold text-gray-800">{value}</h3>
          </div>
          <div className={cn("p-2 rounded-md", iconBg)}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
        
        {trend && (
          <div className="mt-3 flex items-center text-sm">
            <span className={cn(
              "font-medium flex items-center",
              trend.isPositive ? "text-green-500" : "text-red-500"
            )}>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mr-1" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d={trend.isPositive 
                    ? "M5 10l7-7m0 0l7 7m-7-7v18" 
                    : "M19 14l-7 7m0 0l-7-7m7 7V3"
                  } 
                />
              </svg>
              {trend.value} {trend.label}
            </span>
            {trend.timeframe && (
              <span className="text-gray-500 ml-2">{trend.timeframe}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
