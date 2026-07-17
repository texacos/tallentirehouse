-- Add weight to products and switch prices to USD (decimal)
ALTER TABLE public.products ALTER COLUMN price TYPE numeric(10,2) USING price::numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight_kg numeric(6,2) NOT NULL DEFAULT 0.5;

-- Convert existing LKR prices → USD, rounded to nearest 0.5
UPDATE public.products
   SET price = ROUND((price / 300.0) * 2) / 2.0;

-- Convert variant prices inside the JSONB array
UPDATE public.products
   SET variants = COALESCE((
     SELECT jsonb_agg(
       CASE WHEN v ? 'price'
         THEN jsonb_set(v, '{price}', to_jsonb(ROUND(((v->>'price')::numeric / 300.0) * 2) / 2.0))
         ELSE v
       END
     )
     FROM jsonb_array_elements(variants) AS v
   ), '[]'::jsonb)
 WHERE jsonb_array_length(COALESCE(variants, '[]'::jsonb)) > 0;

-- Country to shipping zone mapping
CREATE TABLE public.country_zones (
  country text PRIMARY KEY,
  zone integer NOT NULL CHECK (zone BETWEEN 1 AND 6)
);
GRANT SELECT ON public.country_zones TO anon, authenticated;
GRANT ALL ON public.country_zones TO service_role;
ALTER TABLE public.country_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Country zones are readable by everyone"
  ON public.country_zones FOR SELECT
  TO anon, authenticated
  USING (true);
CREATE POLICY "Admins manage country zones"
  ON public.country_zones FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Shipping rate table: price for a given zone up to a maximum weight
CREATE TABLE public.shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone integer NOT NULL CHECK (zone BETWEEN 1 AND 6),
  max_weight_kg numeric(6,2) NOT NULL CHECK (max_weight_kg > 0),
  price_usd numeric(10,2) NOT NULL CHECK (price_usd >= 0),
  UNIQUE (zone, max_weight_kg)
);
GRANT SELECT ON public.shipping_rates TO anon, authenticated;
GRANT ALL ON public.shipping_rates TO service_role;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shipping rates are readable by everyone"
  ON public.shipping_rates FOR SELECT
  TO anon, authenticated
  USING (true);
CREATE POLICY "Admins manage shipping rates"
  ON public.shipping_rates FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.country_zones (country, zone) VALUES
  ('ALBANIA', 5), ('ALGERIA', 6), ('AMERI.SAMOA', 6), ('ANDORA', 3), ('ANGOLA', 6),
  ('ANGUILLA', 5), ('ANTIGUA', 5), ('ARGENTINA', 5), ('ARMENIA', 5), ('ARUBA', 5),
  ('AUSTRALIA', 2), ('AUSTRIA', 4), ('AZERBAIJAN', 5), ('AZORES', 6), ('BAHAMAS', 5),
  ('BAHRAIN', 2), ('BANGLADESH', 2), ('BARBADOS', 5), ('BARBUDA', 5), ('BELGIUM', 3),
  ('BELIZE', 5), ('BENIN', 6), ('BERMUDA', 5), ('BEYLORUSSIA', 5), ('BOLIVIA', 5),
  ('BONAIRE', 5), ('BOSTWANA', 6), ('BRAZIL', 5), ('BRUNEI', 5), ('BULGARIA', 5),
  ('BURKINA FASO', 6), ('BURUNDI', 6), ('CAMAROON', 6), ('CAMBODIA', 5), ('CANADA', 3),
  ('CHAD', 6), ('CHILE', 5), ('CHINA', 3), ('COLOMBIA', 5), ('CONGO', 6),
  ('COSTA RICA', 5), ('CROATIA', 5), ('CURACAO', 5), ('CYPRUS', 4), ('CZECH', 5),
  ('DENMARK', 3), ('DJIBOUTI', 6), ('DOMINICAN', 5), ('DUBAI', 1), ('ECUADOR', 5),
  ('EGYPT', 4), ('EL-SALVADOR', 5), ('ESTONIA', 5), ('ETHIOPIA', 6), ('FAROE IS', 3),
  ('FIJI', 5), ('FINLAND', 3), ('FRANCE', 3), ('FRENCH GUYANA', 5), ('GABON', 6),
  ('GAMBIA', 6), ('GERMANY', 3), ('GHANA', 6), ('GIBRALTAR', 3), ('GREECE', 3),
  ('GREENLAND', 3), ('GRENEDINES', 5), ('GUAM', 5), ('GUATEMALA', 5), ('GUERNSEY', 3),
  ('GUINEA BISSAU', 6), ('GUYANA', 5), ('HAITI', 5), ('HONDURAS', 5), ('HONG KONG', 1),
  ('HUNGARY', 5), ('ICELAND', 3), ('INDIA', 1), ('INDONESIA', 2), ('IRAN', 4),
  ('IRELAND', 3), ('ISRAEL', 3), ('ITALY', 3), ('IVORY COST', 6), ('JAMAICA', 5),
  ('JAPAN', 3), ('JERSEY', 3), ('JORDAN', 3), ('KAZAKHSTAN', 5), ('KENYA', 6),
  ('KIRIBATI', 6), ('KOREA SOUTH', 3), ('KUWAIT', 2), ('KYRGISTAN', 5), ('LAOS', 5),
  ('LATVIA', 5), ('LEBANON', 3), ('LESOTHO', 6), ('LIBERIA', 6), ('LIECHTENSTEIN', 3),
  ('LITHUANIA', 5), ('LONDON', 3), ('LUXEMBOURG', 3), ('MACAU', 3), ('MADAGASCAR', 6),
  ('MADEIRA IS', 3), ('MALAWI', 6), ('MALAYSIA', 2), ('MALDIVES', 1), ('MALI', 6),
  ('MALTA', 3), ('MARTINIQUE', 5), ('MAURITANIA', 6), ('MAURITIUS', 6), ('MEXICO', 5),
  ('MOLDOVA', 5), ('MONACO', 3), ('MONGOLIA', 5), ('MONTSERRAT', 5), ('MOROCCO', 6),
  ('MOZAMBIQUE', 6), ('MYANMAR', 5), ('NEPAL', 4), ('NETHERLANDS', 3), ('NEVIS', 5),
  ('NEW CALEDONIA', 6), ('NEW ZEALAND', 3), ('NICARAGUA', 5), ('NIGERIA', 6), ('NOR.IRELAND', 3),
  ('NORWAY', 5), ('OMAN', 2), ('PAKISTAN', 4), ('PALAU', 4), ('PALESTINE', 4),
  ('PANAMA', 5), ('PAPUA NEW GUINEA', 6), ('PARAGUAY', 5), ('PARIS', 3), ('PERU', 5),
  ('PHILIPPINES', 2), ('PITCAIRNIS', 4), ('POLAND', 5), ('PORTUGAL', 3), ('PUERTO RICO', 5),
  ('QATAR', 2), ('REUNION ISL', 6), ('ROMANIA', 5), ('RUSSIA', 5), ('RWANDA', 6),
  ('SAMOA', 5), ('SAN MARINO', 5), ('SAUDI ARABIA', 4), ('SCOTLAND', 3), ('SEIRRA LEONE', 6),
  ('SENEGAL', 6), ('SEYCHELLES', 6), ('SINGAPORE', 1), ('SLOVAKIA', 5), ('SLOVENIA', 5),
  ('SOLOMON IS', 5), ('SOMALIA', 6), ('SOUTH AFRICA', 5), ('SPAIN', 3), ('ST EUSTATIUS', 5),
  ('ST KITTS', 5), ('ST MAARTEN', 5), ('ST VINCENT', 5), ('SUDAN', 6), ('SURINAM', 5),
  ('SWAZILAND', 6), ('SWEDEN', 3), ('SWITZERLAND', 3), ('SYRIA', 4), ('TAIWAN', 3),
  ('TAJIKISTAN', 5), ('TANZANIA', 6), ('THAILAND', 3), ('TOGO', 6), ('TONGA', 5),
  ('TORTOLA', 5), ('TRANSIKEI', 6), ('TRINIDAD', 5), ('TUNISIA', 6), ('TURKEY', 3),
  ('TURKMENISTAN', 5), ('TURKS', 5), ('TUVALU', 6), ('U.A.E', 2), ('UGANDA', 6),
  ('UK', 3), ('UKRAIN', 5), ('URUGUAY', 5), ('US VIRGIN ISL', 5), ('USA', 3),
  ('UZBEKISTAN', 5), ('VANUATU', 5), ('VATICAN CITY', 3), ('VIETNAM', 4), ('WALES', 3),
  ('WEST BANK', 4), ('YEMEN', 4), ('ZAIRE', 6), ('ZIMBABWE', 6);

INSERT INTO public.shipping_rates (zone, max_weight_kg, price_usd) VALUES
  (1,0.5,25),(1,1,30),(1,1.5,35),(1,2,40),(1,2.5,45),(1,3,50),(1,3.5,55),(1,4,60),(1,4.5,65),(1,5,70),
  (1,5.5,75),(1,6,80),(1,6.5,85),(1,7,90),(1,7.5,95),(1,8,100),(1,8.5,104),(1,9,109),(1,9.5,114),(1,10,119),
  (1,10.5,124),(1,11,129),(1,11.5,134),(1,12,139),(1,12.5,144),(1,13,149),(1,13.5,154),(1,14,159),(1,14.5,164),(1,15,169),
  (1,15.5,174),(1,16,179),(1,16.5,184),(1,17,189),(1,17.5,193),(1,18,198),(1,18.5,203),(1,19,208),(1,19.5,213),(1,20,218),
  (1,20.5,223),(1,21,228),(1,21.5,233),(1,22,238),(1,22.5,243),(1,23,248),(1,23.5,253),(1,24,258),(1,24.5,263),(1,25,268),
  (2,0.5,32),(2,1,38),(2,1.5,44),(2,2,50),(2,2.5,56),(2,3,62),(2,3.5,69),(2,4,75),(2,4.5,81),(2,5,87),
  (2,5.5,93),(2,6,100),(2,6.5,106),(2,7,112),(2,7.5,118),(2,8,124),(2,8.5,130),(2,9,137),(2,9.5,143),(2,10,149),
  (2,10.5,155),(2,11,161),(2,11.5,168),(2,12,174),(2,12.5,180),(2,13,186),(2,13.5,192),(2,14,198),(2,14.5,205),(2,15,211),
  (2,15.5,217),(2,16,223),(2,16.5,229),(2,17,236),(2,17.5,242),(2,18,248),(2,18.5,254),(2,19,260),(2,19.5,266),(2,20,273),
  (2,20.5,279),(2,21,285),(2,21.5,291),(2,22,297),(2,22.5,304),(2,23,310),(2,23.5,316),(2,24,322),(2,24.5,328),(2,25,334),
  (3,0.5,35),(3,1,43),(3,1.5,50),(3,2,57),(3,2.5,65),(3,3,72),(3,3.5,80),(3,4,87),(3,4.5,95),(3,5,102),
  (3,5.5,109),(3,6,117),(3,6.5,124),(3,7,132),(3,7.5,139),(3,8,147),(3,8.5,154),(3,9,161),(3,9.5,169),(3,10,176),
  (3,10.5,184),(3,11,191),(3,11.5,198),(3,12,206),(3,12.5,213),(3,13,221),(3,13.5,228),(3,14,236),(3,14.5,243),(3,15,250),
  (3,15.5,258),(3,16,265),(3,16.5,273),(3,17,280),(3,17.5,287),(3,18,295),(3,18.5,302),(3,19,310),(3,19.5,317),(3,20,325),
  (3,20.5,332),(3,21,339),(3,21.5,347),(3,22,354),(3,22.5,362),(3,23,369),(3,23.5,376),(3,24,384),(3,24.5,391),(3,25,399),
  (4,0.5,35),(4,1,41),(4,1.5,48),(4,2,54),(4,2.5,60),(4,3,66),(4,3.5,72),(4,4,79),(4,4.5,85),(4,5,91),
  (4,5.5,97),(4,6,103),(4,6.5,109),(4,7,116),(4,7.5,122),(4,8,128),(4,8.5,134),(4,9,140),(4,9.5,147),(4,10,153),
  (4,10.5,159),(4,11,165),(4,11.5,171),(4,12,177),(4,12.5,184),(4,13,190),(4,13.5,196),(4,14,202),(4,14.5,208),(4,15,215),
  (4,15.5,221),(4,16,227),(4,16.5,233),(4,17,239),(4,17.5,245),(4,18,252),(4,18.5,258),(4,19,264),(4,19.5,270),(4,20,276),
  (4,20.5,283),(4,21,289),(4,21.5,295),(4,22,301),(4,22.5,307),(4,23,313),(4,23.5,320),(4,24,326),(4,24.5,332),(4,25,338),
  (5,0.5,48),(5,1,57),(5,1.5,67),(5,2,77),(5,2.5,87),(5,3,97),(5,3.5,107),(5,4,117),(5,4.5,127),(5,5,137),
  (5,5.5,147),(5,6,156),(5,6.5,166),(5,7,176),(5,7.5,186),(5,8,196),(5,8.5,206),(5,9,216),(5,9.5,226),(5,10,236),
  (5,10.5,245),(5,11,255),(5,11.5,265),(5,12,275),(5,12.5,285),(5,13,295),(5,13.5,305),(5,14,315),(5,14.5,325),(5,15,334),
  (5,15.5,344),(5,16,354),(5,16.5,364),(5,17,374),(5,17.5,384),(5,18,394),(5,18.5,404),(5,19,414),(5,19.5,423),(5,20,433),
  (5,20.5,443),(5,21,453),(5,21.5,463),(5,22,473),(5,22.5,483),(5,23,493),(5,23.5,503),(5,24,512),(5,24.5,522),(5,25,532),
  (6,0.5,54),(6,1,64),(6,1.5,74),(6,2,83),(6,2.5,93),(6,3,103),(6,3.5,113),(6,4,123),(6,4.5,133),(6,5,143),
  (6,5.5,153),(6,6,163),(6,6.5,172),(6,7,182),(6,7.5,192),(6,8,202),(6,8.5,212),(6,9,222),(6,9.5,232),(6,10,242),
  (6,10.5,252),(6,11,261),(6,11.5,271),(6,12,281),(6,12.5,291),(6,13,301),(6,13.5,311),(6,14,321),(6,14.5,331),(6,15,341),
  (6,15.5,351),(6,16,360),(6,16.5,370),(6,17,380),(6,17.5,390),(6,18,400),(6,18.5,410),(6,19,420),(6,19.5,430),(6,20,440),
  (6,20.5,449),(6,21,459),(6,21.5,469),(6,22,479),(6,22.5,489),(6,23,499),(6,23.5,509),(6,24,519),(6,24.5,529),(6,25,538);