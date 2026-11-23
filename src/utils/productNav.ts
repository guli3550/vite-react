export interface NavigableProduct {
  id: number | string;
}

export function resolveSwipedProduct<T extends NavigableProduct>(params: {
  queue: T[];
  currentProductId: number | string | undefined;
  diffX: number;
  diffY: number;
  timeDiff: number;
  minDistanceX?: number;
}): { product: T; index: number; total: number } | null {
  const {
    queue,
    currentProductId,
    diffX,
    diffY,
    timeDiff,
    minDistanceX = 48,
  } = params;

  if (!Array.isArray(queue) || queue.length <= 1) return null;
  if (currentProductId === undefined || currentProductId === null) return null;

  const absX = Math.abs(diffX);
  const absY = Math.abs(diffY);
  if (absX < minDistanceX || absX <= absY * 1.25 || timeDiff >= 750) {
    return null;
  }

  const currentIndex = queue.findIndex(
    (item) => String(item.id) === String(currentProductId),
  );
  if (currentIndex === -1) return null;

  const targetIndex =
    diffX < 0
      ? Math.min(queue.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);

  if (targetIndex === currentIndex) return null;

  return {
    product: queue[targetIndex],
    index: targetIndex,
    total: queue.length,
  };
}
