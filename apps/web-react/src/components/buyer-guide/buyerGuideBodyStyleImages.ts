export const BUYER_GUIDE_BODY_STYLE_ASSET_ROOT = '/buyer-guide/body-styles';
export const BUYER_GUIDE_BODY_STYLE_FALLBACK = `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/vehicle-placeholder.svg`;

export const BUYER_GUIDE_BODY_STYLE_IMAGES: Record<string, string> = {
  sedan: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/sedan1.png`,
  suv: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/suv2.png`,
  coupe: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/coupe1.png`,
  truck: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/truck1.png`,
  minivan: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/minivan1.png`,
  hatchback: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/hatchback1.png`,
  electric: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/ev1.png`,
  open: `${BUYER_GUIDE_BODY_STYLE_ASSET_ROOT}/open1.png`,
};

export function buyerGuideBodyStyleImage(category: string): string {
  return BUYER_GUIDE_BODY_STYLE_IMAGES[category.toLowerCase()] || BUYER_GUIDE_BODY_STYLE_FALLBACK;
}

export function useBuyerGuideImageFallback(image: HTMLImageElement) {
  if (image.dataset.fallbackApplied === 'true') return;
  image.dataset.fallbackApplied = 'true';
  image.src = BUYER_GUIDE_BODY_STYLE_FALLBACK;
}
