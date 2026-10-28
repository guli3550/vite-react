export type ReelStatus = "active" | "draft" | "inactive";

export interface ReelComment {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
}

export interface ReelItem {
  id: string;
  videoUrl: string;
  posterUrl: string;
  caption: string;
  musicTitle?: string;
  author: {
    name: string;
    username: string;
    avatar: string;
    verified?: boolean;
  };
  productId?: number | string;
  productName?: string;
  productPrice?: number;
  productImage?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  isLiked: boolean;
  status: ReelStatus;
  createdAt: string;
  comments: ReelComment[];
}

export interface ReelFormData {
  id?: string;
  caption: string;
  videoUrl: string;
  posterUrl: string;
  musicTitle?: string;
  productId?: string | number;
  status: ReelStatus;
}
