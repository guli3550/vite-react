import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  transliterateCyrillicToUzbekLatin,
  matchUzbekistanRegionAndDistrict,
  formatResolvedAddressLine,
  extractExactCheckoutAddress,
} from "../src/utils/uzbekistanGeocoding.ts";

test("transliterateCyrillicToUzbekLatin converts Russian/Uzbek Cyrillic street & city names cleanly", () => {
  assert.equal(transliterateCyrillicToUzbekLatin("ул. Амира Темура"), "Amira Temura");
  assert.equal(transliterateCyrillicToUzbekLatin("Ўзбекистон"), "O‘zbekiston");
  assert.equal(transliterateCyrillicToUzbekLatin("Чиланзарский район"), "Chilanzarskiy rayon");
});

test("matchUzbekistanRegionAndDistrict resolves Cyrillic Tashkent district and Fergana cities", () => {
  const chilonzor = matchUzbekistanRegionAndDistrict(
    "город Ташкент",
    "Чиланзарский район",
    "Ташкент",
    41.275,
    69.205,
  );
  assert.equal(chilonzor.region, "Toshkent sh.");
  assert.equal(chilonzor.district, "Chilonzor tumani");

  const kokand = matchUzbekistanRegionAndDistrict(
    "Ферганская область",
    "",
    "Коканд",
    40.528,
    70.942,
  );
  assert.equal(kokand.region, "Farg‘ona vil.");
  assert.equal(kokand.district, "Qo‘qon sh.");

  const yaypan = matchUzbekistanRegionAndDistrict(
    "Ферганская область",
    "Узбекистанский район",
    "Яйпан",
    40.376,
    70.818,
  );
  assert.equal(yaypan.region, "Farg‘ona vil.");
  assert.equal(yaypan.district, "O‘zbekiston tumani");
});

test("extractExactCheckoutAddress returns 100% synced region, district, street, house, and formattedAddress", () => {
  const resolved = extractExactCheckoutAddress(
    {
      state: "Ташкент",
      city_district: "Юнусабадский район",
      road: "ул. Амира Темура",
      house_number: "дом 107Б",
    },
    41.3385,
    69.2846,
    "nominatim",
  );

  assert.equal(resolved.region, "Toshkent sh.");
  assert.equal(resolved.district, "Yunusobod tumani");
  assert.equal(resolved.street, "Amira Temura");
  assert.equal(resolved.house, "107B");
  assert.equal(
    resolved.formattedAddress,
    formatResolvedAddressLine(resolved),
  );
  assert.equal(
    resolved.formattedAddress,
    "Toshkent sh., Yunusobod tumani, Amira Temura, 107B-uy",
  );
});

test("extractExactCheckoutAddress clears house and street when moved to a point without building metadata", () => {
  const barePoint = extractExactCheckoutAddress(
    {
      state: "Самаркандская область",
      city: "Самарканд",
    },
    39.6542,
    66.9597,
    "nominatim",
  );

  assert.equal(barePoint.region, "Samarqand vil.");
  assert.equal(barePoint.district, "Samarqand sh.");
  assert.equal(barePoint.street, "");
  assert.equal(barePoint.house, "");
  assert.equal(barePoint.formattedAddress, "Samarqand vil., Samarqand sh.");
});

test("CheckoutView keeps map closed by default until #checkout-location-btn is clicked", () => {
  const checkoutSource = fs.readFileSync(
    path.resolve("src/components/CheckoutView.tsx"),
    "utf8",
  );

  // Must start hidden
  assert.match(checkoutSource, /const \[isMapOpen, setIsMapOpen\] = useState\(false\);/);
  // Must gate rendering on isMapOpen
  assert.match(checkoutSource, /\{isMapOpen && \(/);
  // Clicking the detect/re-detect location button opens the map and triggers detection
  assert.match(checkoutSource, /id="checkout-location-btn"[\s\S]*?setIsMapOpen\(true\);\s*requestLocation\(\);/);
  // Old GPS map copy removed
  assert.doesNotMatch(checkoutSource, /3D Aniq Joylashuv Xaritasi/);
  assert.doesNotMatch(checkoutSource, /GPS Faol/);
});
