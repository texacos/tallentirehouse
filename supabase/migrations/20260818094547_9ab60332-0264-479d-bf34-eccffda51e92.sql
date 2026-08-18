UPDATE public.products SET categories = (
  SELECT array_agg(DISTINCT m) FROM (
    SELECT CASE c
      WHEN 'cotton-canvas' THEN 'fabric-by-the-metre'
      WHEN 'cotton-twill' THEN 'fabric-by-the-metre'
      WHEN 'cotton-voile' THEN 'fabric-by-the-metre'
      WHEN 'cotton-flax' THEN 'fabric-by-the-metre'
      WHEN 'cotton-cushions' THEN 'cushions'
      WHEN 'silk-cushions' THEN 'cushions'
      WHEN 'bolsters' THEN 'cushions'
      WHEN 'cushions-bolsters' THEN 'cushions'
      WHEN 'cosmetics-purses' THEN 'purses-small-accessories'
      WHEN 'travel-purses' THEN 'purses-small-accessories'
      WHEN 'shopping-bags' THEN 'bags'
      WHEN 'weekend-travel-bags' THEN 'bags'
      WHEN 'tabby-silk-stoles' THEN 'shawls-scarves'
      WHEN 'gajji-silk-stoles' THEN 'shawls-scarves'
      WHEN 'halcyon-shawls-bedthrows' THEN 'quilts-throws-bedspreads'
      WHEN 'cups' THEN 'ceramics-tableware'
      WHEN 'bowls' THEN 'ceramics-tableware'
      WHEN 'plates' THEN 'ceramics-tableware'
      WHEN 'napkins' THEN 'ceramics-tableware'
      WHEN 'placemats' THEN 'ceramics-tableware'
      WHEN 'aprons' THEN 'ceramics-tableware'
      WHEN 'men-s-shirts' THEN 'men'
      ELSE 'women'
    END AS m
    FROM unnest(products.categories) AS c
  ) t
)
WHERE categories IS NOT NULL AND array_length(categories,1) > 0;