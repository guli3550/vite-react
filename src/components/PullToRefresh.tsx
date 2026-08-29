import React from "react";
import { type Language } from "../utils/translations";

interface PullToRefreshProps {
  onRefresh: () => Promise<any>;
  children: React.ReactNode;
  language?: Language;
  disabled?: boolean;
  className?: string;
  pullText?: string;
  releaseText?: string;
  refreshingText?: string;
}

export function PullToRefresh({
  children,
}: PullToRefreshProps) {
  return <>{children}</>;
}
