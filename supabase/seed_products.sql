-- GULI demo catalog seed.
-- Run AFTER commerce_schema.sql. Safe to re-run: existing names are updated.

insert into public.products
(name, category, description, price, old_price, image, images, sizes, colors, rating, reviews, stock, featured, active, sort_order)
values
('Elegant Lace Bra', 'Byustgalter', 'Nafis dantelli, kundalik va maxsus kunlar uchun qulay model.', 129000, 169000, 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=85', '[]', '["S","M","L","XL"]', '["Qora","Oq","Bej"]', 4.8, 124, 25, true, true, 1),
('Silk Comfort Set', 'Komplektlar', 'Yumshoq matoli, nafis va qulay komplekt.', 189000, 249000, 'https://images.unsplash.com/photo-1583743814966-8936f37f4678?auto=format&fit=crop&w=900&q=85', '[]', '["S","M","L"]', '["Qora","Qizil","Pushti"]', 4.9, 86, 18, true, true, 2),
('Soft Home Set', 'Uy kiyimlari', 'Uyda qulaylik va nafislik uchun yengil komplekt.', 159000, 199000, 'https://images.unsplash.com/photo-1566206091558-7f218b696731?auto=format&fit=crop&w=900&q=85', '[]', '["S","M","L","XL"]', '["Pushti","Bej"]', 4.7, 61, 20, true, true, 3),
('Classic Brief', 'Trusik', 'Minimal dizaynli, yumshoq va kundalik foydalanishga mos model.', 59000, 79000, 'https://images.unsplash.com/photo-1617331140180-e8262094733a?auto=format&fit=crop&w=900&q=85', '[]', '["S","M","L","XL"]', '["Qora","Oq","Bej"]', 4.8, 73, 40, false, true, 4),
('Premium Night Set', 'Sexy lingerie', 'Maxsus kechalar uchun premium nafis model.', 219000, 279000, 'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=900&q=85', '[]', '["S","M","L"]', '["Qora","Qizil"]', 4.9, 49, 12, true, true, 5)
on conflict do nothing;
