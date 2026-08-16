DELETE FROM public.product_revisions
WHERE product_id IN (
  SELECT id FROM public.products
  WHERE NOT (categories && ARRAY['cotton-canvas','cotton-twill','cotton-voile','cotton-flax','cosmetics-purses','travel-purses','shopping-bags','weekend-travel-bags'])
);

DELETE FROM public.products
WHERE NOT (categories && ARRAY['cotton-canvas','cotton-twill','cotton-voile','cotton-flax','cosmetics-purses','travel-purses','shopping-bags','weekend-travel-bags']);