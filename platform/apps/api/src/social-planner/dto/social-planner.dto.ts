import {
  Prisma,
  SocialAlertCategory,
  SocialAssetType,
  SocialContentCategory,
  SocialPlatform,
  SocialPostStatus,
  SocialSuggestionStatus,
  SocialSuggestionType,
  SocialTemplateStyle,
} from "@prisma/client";

export interface CreatePostDto {
  campgroundId: string;
  title: string;
  platform: SocialPlatform;
  status?: SocialPostStatus;
  category?: SocialContentCategory;
  scheduledFor?: Date | string | null;
  publishedFor?: Date | string | null;
  caption?: string | null;
  hashtags?: string[];
  imagePrompt?: string | null;
  notes?: string | null;
  templateId?: string | null;
  assetUrls?: string[];
  tags?: string[];
  ideaParkingLot?: boolean;
  suggestionId?: string | null;
}

export type UpdatePostDto = Partial<CreatePostDto>;

export interface CreateTemplateDto {
  campgroundId: string;
  name: string;
  summary?: string | null;
  category?: SocialContentCategory | null;
  style?: SocialTemplateStyle | null;
  defaultCaption?: string | null;
  captionFillIns?: string | null;
  imageGuidance?: string | null;
  hashtagSet?: string[];
  bestTime?: string | null;
}

export type UpdateTemplateDto = Partial<CreateTemplateDto>;

export interface CreateAssetDto {
  campgroundId: string;
  title: string;
  type: SocialAssetType;
  url: string;
  tags?: string[];
  notes?: string | null;
  uploadedById?: string | null;
}

export type UpdateAssetDto = Partial<CreateAssetDto>;

export interface CreateSuggestionDto {
  campgroundId: string;
  type: SocialSuggestionType;
  message: string;
  status?: SocialSuggestionStatus;
  category?: SocialContentCategory | null;
  platform?: SocialPlatform | null;
  proposedDate?: Date | string | null;
  opportunityAt?: Date | string | null;
  postId?: string | null;
  reason?: Record<string, unknown>;
}

export interface UpdateSuggestionStatusDto {
  status: SocialSuggestionStatus;
  postId?: string | null;
}

export interface CreateStrategyDto {
  campgroundId: string;
  month: Date | string;
  annual?: boolean;
  plan: Prisma.InputJsonValue;
}

export interface CreateAlertDto {
  campgroundId: string;
  category: SocialAlertCategory;
  message: string;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}

export interface PerformanceInputDto {
  campgroundId: string;
  postId?: string | null;
  likes?: number | null;
  reach?: number | null;
  comments?: number | null;
  saves?: number | null;
  shares?: number | null;
  notes?: string | null;
  recordedAt?: Date | string | null;
}
