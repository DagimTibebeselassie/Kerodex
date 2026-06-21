export const BUYER_GUIDE_BODY_STYLE_ASSET_ROOT = '/assets';
export const BUYER_GUIDE_BODY_STYLE_FALLBACK = '/buyer-guide/body-styles/vehicle-placeholder.svg';

export const BUYER_GUIDE_BODY_STYLE_IMAGES: Record<string, string> = {
  sedan: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/sedan1.webp`,
  suv: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/suv2.webp`,
  coupe: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/coupe1.webp`,
  truck: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/truck1.webp`,
  minivan: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/minivan1.webp`,
  hatchback: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/hatchback1.webp`,
  electric: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/ev1.webp`,
  open: '',
};

export function buyerGuideBodyStyleImage(category: string): string {
  return BUYER_GUIDE_BODY_STYLE_IMAGES[category.toLowerCase()] || BUYER_GUIDE_BODY_STYLE_FALLBACK;
}

export function useBuyerGuideImageFallback(image: HTMLImageElement) {
  if (image.dataset.fallbackApplied === 'true') return;
  image.dataset.fallbackApplied = 'true';
  image.src = BUYER_GUIDE_BODY_STYLE_FALLBACK;
}
