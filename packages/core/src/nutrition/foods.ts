/**
 * Built-in German food database (per 100 g / 100 ml).
 *
 * Values are rounded averages from typical German product labels and the
 * German nutrient database (BLS) – they are *reference values*, not exact
 * measurements of a specific product. Branded products are looked up via
 * Open Food Facts (barcode / search). Mixed dishes (Döner, Pizza, …) are
 * flagged as estimates because recipes vary a lot.
 */
import type { FoodItem } from '../types';
import { normalize } from '../training/exercises';

type Row = [slug: string, name: string, category: string, kcal: number, protein: number, carbs: number, fat: number, fiber: number, servings: string, tags: string];

const ROWS: Row[] = [
  // Milchprodukte & Eier
  ['ei', 'Hühnerei', 'Eier & Milchprodukte', 143, 12.6, 0.7, 9.5, 0, '1 Ei (M):55|2 Eier (M):110|3 Eier (M):165', 'vegetarian egg'],
  ['eiklar', 'Eiklar', 'Eier & Milchprodukte', 48, 10.9, 0.7, 0.2, 0, '1 Eiklar:33', 'vegetarian egg'],
  ['ruehrei', 'Rührei (mit Milch & Butter)', 'Eier & Milchprodukte', 170, 11, 1.5, 13.5, 0, 'Portion aus 2 Eiern:130|Portion aus 3 Eiern:190', 'vegetarian egg milk estimate'],
  ['magerquark', 'Magerquark', 'Eier & Milchprodukte', 67, 12, 4, 0.3, 0, '1 Becher:250|1 EL:30', 'vegetarian milk'],
  ['quark-20', 'Speisequark 20 %', 'Eier & Milchprodukte', 109, 12.5, 3.5, 5.1, 0, '1 Becher:250', 'vegetarian milk'],
  ['skyr', 'Skyr natur', 'Eier & Milchprodukte', 63, 11, 4, 0.2, 0, '1 Becher:450|1 Portion:150', 'vegetarian milk'],
  ['griech-joghurt', 'Griechischer Joghurt 10 %', 'Eier & Milchprodukte', 125, 5, 4, 10, 0, '1 Portion:150', 'vegetarian milk'],
  ['joghurt-35', 'Naturjoghurt 3,5 %', 'Eier & Milchprodukte', 64, 3.8, 4.5, 3.5, 0, '1 Becher:150|1 Portion:200', 'vegetarian milk'],
  ['joghurt-15', 'Naturjoghurt 1,5 %', 'Eier & Milchprodukte', 48, 4, 4.8, 1.5, 0, '1 Becher:150|1 Portion:200', 'vegetarian milk'],
  ['joghurt-01', 'Magerjoghurt 0,1 %', 'Eier & Milchprodukte', 35, 4.5, 4, 0.1, 0, '1 Becher:150', 'vegetarian milk'],
  ['milch-15', 'Milch 1,5 %', 'Eier & Milchprodukte', 47, 3.4, 4.9, 1.5, 0, '1 Glas (200 ml):206|Schuss für Kaffee:30', 'vegetarian milk'],
  ['milch-35', 'Vollmilch 3,5 %', 'Eier & Milchprodukte', 64, 3.3, 4.8, 3.5, 0, '1 Glas (200 ml):206', 'vegetarian milk'],
  ['buttermilch', 'Buttermilch', 'Eier & Milchprodukte', 36, 3.3, 4, 0.5, 0, '1 Glas (250 ml):255', 'vegetarian milk'],
  ['kefir', 'Kefir 1,5 %', 'Eier & Milchprodukte', 45, 3.4, 4.2, 1.5, 0, '1 Becher (500 ml):510', 'vegetarian milk'],
  ['huettenkaese', 'Körniger Frischkäse (Hüttenkäse)', 'Eier & Milchprodukte', 98, 12.3, 2.7, 4.3, 0, '1 Becher:200', 'vegetarian milk'],
  ['gouda', 'Gouda (45 % Fett i. Tr.)', 'Eier & Milchprodukte', 350, 25, 0, 27.5, 0, '1 Scheibe:20|2 Scheiben:40', 'vegetarian milk'],
  ['emmentaler', 'Emmentaler', 'Eier & Milchprodukte', 380, 28, 0, 29.5, 0, '1 Scheibe:20', 'vegetarian milk'],
  ['mozzarella', 'Mozzarella', 'Eier & Milchprodukte', 247, 18, 1, 19, 0, '1 Kugel:125', 'vegetarian milk'],
  ['mozzarella-light', 'Mozzarella light', 'Eier & Milchprodukte', 165, 19, 1, 9.5, 0, '1 Kugel:125', 'vegetarian milk'],
  ['feta', 'Feta', 'Eier & Milchprodukte', 270, 16.7, 0.5, 22.5, 0, '1 Packung:200|Portion:50', 'vegetarian milk'],
  ['harzer', 'Harzer Käse', 'Eier & Milchprodukte', 112, 27, 0, 0.5, 0, '1 Rolle:200|Portion:50', 'vegetarian milk'],
  ['frischkaese', 'Frischkäse Doppelrahmstufe', 'Eier & Milchprodukte', 250, 5.5, 3, 24, 0, '1 EL:20|Portion für 1 Brötchen:30', 'vegetarian milk'],
  ['frischkaese-light', 'Frischkäse light (körnig/leicht)', 'Eier & Milchprodukte', 135, 11, 4, 8.3, 0, '1 EL:20', 'vegetarian milk'],
  ['butter', 'Butter', 'Fette & Öle', 741, 0.7, 0.6, 83.2, 0, '1 TL:5|Portion für 1 Brot:10', 'vegetarian milk'],
  ['sahne', 'Schlagsahne 30 %', 'Eier & Milchprodukte', 300, 2.4, 3.2, 30.5, 0, '1 EL:15|1 Becher:200', 'vegetarian milk'],
  ['protein-pudding', 'Proteinpudding (Durchschnitt)', 'Eier & Milchprodukte', 80, 10, 7, 1.5, 0, '1 Becher:200', 'vegetarian milk'],

  // Fleisch, Wurst, Fisch
  ['haehnchenbrust', 'Hähnchenbrustfilet (roh)', 'Fleisch & Fisch', 105, 23.5, 0, 1.1, 0, '1 Filet:150|Portion:200', 'meat'],
  ['haehnchenbrust-gegart', 'Hähnchenbrust (gegart)', 'Fleisch & Fisch', 155, 30, 0, 3.9, 0, 'Portion:150', 'meat'],
  ['putenbrust', 'Putenbrust (roh)', 'Fleisch & Fisch', 105, 24, 0, 1, 0, 'Portion:150', 'meat'],
  ['rinderhack', 'Rinderhackfleisch (roh, ca. 17 % Fett)', 'Fleisch & Fisch', 230, 19.5, 0, 17, 0, 'Packung:500|Portion:125', 'meat'],
  ['rinderhack-mager', 'Rinderhackfleisch mager (5 % Fett)', 'Fleisch & Fisch', 128, 21, 0, 5, 0, 'Packung:400|Portion:125', 'meat'],
  ['hack-gemischt', 'Gemischtes Hackfleisch (roh)', 'Fleisch & Fisch', 260, 18, 0, 21, 0, 'Packung:500|Portion:125', 'meat'],
  ['rindersteak', 'Rindersteak Hüfte (roh)', 'Fleisch & Fisch', 124, 22, 0, 4, 0, '1 Steak:200', 'meat'],
  ['schweinefilet', 'Schweinefilet (roh)', 'Fleisch & Fisch', 108, 21.5, 0, 2, 0, 'Portion:150', 'meat'],
  ['schnitzel', 'Schnitzel (Schwein, paniert, gebraten)', 'Fleisch & Fisch', 230, 19, 9, 13, 0.5, '1 Schnitzel:180', 'meat gluten egg'],
  ['kochschinken', 'Kochschinken', 'Wurst & Aufschnitt', 112, 19.5, 1, 3.3, 0, '1 Scheibe:20|Portion:50', 'meat'],
  ['haehnchenaufschnitt', 'Hähnchenbrust-Aufschnitt', 'Wurst & Aufschnitt', 104, 21, 1.5, 1.5, 0, '1 Scheibe:15|Packung:100', 'meat'],
  ['salami', 'Salami', 'Wurst & Aufschnitt', 374, 21, 0.5, 32, 0, '1 Scheibe:8|Portion:30', 'meat'],
  ['bratwurst', 'Bratwurst', 'Wurst & Aufschnitt', 299, 13.5, 0.5, 27, 0, '1 Wurst:100', 'meat'],
  ['wiener', 'Wiener Würstchen', 'Wurst & Aufschnitt', 272, 12.5, 0.5, 24.5, 0, '1 Würstchen:50|Paar:100', 'meat'],
  ['leberkaese', 'Leberkäse', 'Wurst & Aufschnitt', 295, 12, 1, 27, 0, '1 Scheibe:120', 'meat'],
  ['lachs', 'Lachsfilet (roh)', 'Fleisch & Fisch', 202, 20, 0, 13.5, 0, '1 Filet:125', 'fish'],
  ['thunfisch-dose', 'Thunfisch naturell (abgetropft)', 'Fleisch & Fisch', 112, 25.5, 0, 1, 0, '1 Dose (abgetropft):150|halbe Dose:75', 'fish'],
  ['seelachs', 'Alaska-Seelachsfilet', 'Fleisch & Fisch', 80, 18, 0, 0.9, 0, '1 Filet:100', 'fish'],
  ['kabeljau', 'Kabeljaufilet', 'Fleisch & Fisch', 77, 17.7, 0, 0.6, 0, '1 Filet:150', 'fish'],
  ['garnelen', 'Garnelen (roh)', 'Fleisch & Fisch', 85, 20, 0, 0.5, 0, 'Portion:150', 'fish crustaceans'],

  // Vegetarische Proteinquellen
  ['tofu', 'Tofu natur', 'Pflanzliches Protein', 125, 13, 1.5, 7.5, 1, '1 Block:200|Portion:100', 'vegan soy'],
  ['tofu-raeuchertofu', 'Räuchertofu', 'Pflanzliches Protein', 150, 16, 2, 8.5, 1, '1 Block:175', 'vegan soy'],
  ['tempeh', 'Tempeh', 'Pflanzliches Protein', 200, 20, 7.6, 10.8, 5, '1 Packung:200|Portion:100', 'vegan soy'],
  ['seitan', 'Seitan', 'Pflanzliches Protein', 120, 25, 4, 1.5, 0.5, 'Portion:100', 'vegan gluten'],
  ['linsen-rot', 'Rote Linsen (roh)', 'Hülsenfrüchte', 340, 24, 50, 1.5, 11, 'Portion (roh):70', 'vegan'],
  ['kichererbsen', 'Kichererbsen (Dose, abgetropft)', 'Hülsenfrüchte', 120, 7, 15, 2.5, 5, '1 Dose (abgetropft):240|Portion:120', 'vegan'],
  ['kidneybohnen', 'Kidneybohnen (Dose, abgetropft)', 'Hülsenfrüchte', 90, 6.5, 12, 0.5, 6, '1 Dose (abgetropft):250', 'vegan'],
  ['erbsen', 'Erbsen (TK)', 'Gemüse', 78, 5.4, 10, 0.4, 5, 'Portion:150', 'vegan'],
  ['edamame', 'Edamame', 'Hülsenfrüchte', 125, 11, 7, 5, 5, 'Portion:100', 'vegan soy'],

  // Getreide & Beilagen
  ['haferflocken', 'Haferflocken', 'Getreide & Beilagen', 372, 13.5, 58.7, 7, 10, 'Portion:50|Große Portion:80|1 EL:10', 'vegan gluten'],
  ['reis', 'Reis (roh)', 'Getreide & Beilagen', 350, 7, 78, 0.6, 1.4, 'Portion (roh):75|Kochbeutel:125', 'vegan'],
  ['reis-gekocht', 'Reis (gekocht)', 'Getreide & Beilagen', 130, 2.7, 28, 0.3, 0.4, 'Portion:200', 'vegan'],
  ['basmati', 'Basmatireis (roh)', 'Getreide & Beilagen', 355, 8.5, 78, 0.8, 1, 'Portion (roh):75', 'vegan'],
  ['nudeln', 'Nudeln Hartweizen (roh)', 'Getreide & Beilagen', 355, 12.5, 71, 1.5, 3, 'Portion (roh):100|Kleine Portion (roh):75', 'vegan gluten'],
  ['nudeln-gekocht', 'Nudeln (gekocht)', 'Getreide & Beilagen', 150, 5, 30, 0.9, 1.5, 'Portion:250', 'vegan gluten'],
  ['vollkornnudeln', 'Vollkornnudeln (roh)', 'Getreide & Beilagen', 348, 13.5, 64, 2.5, 8, 'Portion (roh):100', 'vegan gluten'],
  ['kartoffeln', 'Kartoffeln (gekocht)', 'Getreide & Beilagen', 72, 2, 15.6, 0.1, 2, '1 mittelgroße:100|Portion:250', 'vegan'],
  ['suesskartoffel', 'Süßkartoffel', 'Getreide & Beilagen', 86, 1.6, 20, 0.1, 3, '1 Stück:250', 'vegan'],
  ['pommes', 'Pommes frites (zubereitet)', 'Getreide & Beilagen', 290, 3.4, 36, 14.5, 3.5, 'Kleine Portion:120|Große Portion:200', 'vegan estimate'],
  ['couscous', 'Couscous (roh)', 'Getreide & Beilagen', 354, 12.5, 72, 1.8, 5, 'Portion (roh):70', 'vegan gluten'],
  ['bulgur', 'Bulgur (roh)', 'Getreide & Beilagen', 350, 12, 70, 1.5, 8, 'Portion (roh):70', 'vegan gluten'],
  ['quinoa', 'Quinoa (roh)', 'Getreide & Beilagen', 360, 14, 60, 6, 7, 'Portion (roh):70', 'vegan'],
  ['vollkornbrot', 'Vollkornbrot', 'Brot & Backwaren', 210, 7, 38, 1.5, 8, '1 Scheibe:50|2 Scheiben:100', 'vegan gluten'],
  ['mischbrot', 'Weizenmischbrot', 'Brot & Backwaren', 240, 7.5, 47, 1.6, 4, '1 Scheibe:45', 'vegan gluten'],
  ['broetchen', 'Brötchen (Weizen)', 'Brot & Backwaren', 268, 8.5, 54, 1.5, 3, '1 Brötchen:60', 'vegan gluten'],
  ['vollkornbroetchen', 'Vollkornbrötchen', 'Brot & Backwaren', 240, 9, 42, 3, 7, '1 Brötchen:75', 'vegan gluten'],
  ['brezel', 'Laugenbrezel', 'Brot & Backwaren', 262, 8, 53, 1.5, 2.5, '1 Brezel:85', 'vegan gluten'],
  ['toast', 'Toastbrot', 'Brot & Backwaren', 260, 8, 48, 4, 3, '1 Scheibe:25', 'vegetarian gluten'],
  ['knaeckebrot', 'Knäckebrot (Roggen)', 'Brot & Backwaren', 330, 9.5, 60, 1.8, 16, '1 Scheibe:10', 'vegan gluten'],
  ['reiswaffeln', 'Reiswaffeln', 'Brot & Backwaren', 385, 8, 80, 2.8, 3, '1 Waffel:8', 'vegan'],
  ['wrap', 'Weizentortilla (Wrap)', 'Brot & Backwaren', 305, 8.5, 52, 7, 3, '1 Wrap:62', 'vegan gluten'],
  ['cornflakes', 'Cornflakes', 'Frühstück', 380, 7, 84, 0.9, 3, 'Portion:40', 'vegan'],
  ['muesli', 'Müsli ohne Zuckerzusatz', 'Frühstück', 360, 10, 60, 7, 8, 'Portion:60', 'vegan gluten nuts'],
  ['muesliriegel', 'Müsliriegel', 'Snacks & Süßes', 400, 6, 65, 12, 5, '1 Riegel:25', 'vegetarian gluten'],

  // Gemüse
  ['brokkoli', 'Brokkoli', 'Gemüse', 34, 3.3, 2.7, 0.2, 3, 'Portion:200', 'vegan'],
  ['tomate', 'Tomate', 'Gemüse', 18, 0.9, 2.6, 0.2, 1.2, '1 Tomate:80|Portion:150', 'vegan'],
  ['gurke', 'Salatgurke', 'Gemüse', 12, 0.6, 1.8, 0.2, 0.5, 'halbe Gurke:200|Portion:100', 'vegan'],
  ['paprika', 'Paprika rot', 'Gemüse', 33, 1, 5.3, 0.3, 3.5, '1 Paprika:150', 'vegan'],
  ['karotte', 'Karotte', 'Gemüse', 38, 0.9, 6.7, 0.2, 3.6, '1 Karotte:80', 'vegan'],
  ['spinat', 'Blattspinat', 'Gemüse', 24, 2.9, 1.6, 0.4, 2.6, 'Portion:150', 'vegan'],
  ['salat', 'Blattsalat (Eisberg)', 'Gemüse', 14, 0.9, 2, 0.2, 1.2, 'Portion:80', 'vegan'],
  ['zucchini', 'Zucchini', 'Gemüse', 19, 1.6, 2.2, 0.4, 1.1, '1 Zucchini:250', 'vegan'],
  ['zwiebel', 'Zwiebel', 'Gemüse', 36, 1.2, 7, 0.2, 1.8, '1 Zwiebel:70', 'vegan'],
  ['champignons', 'Champignons', 'Gemüse', 22, 3.1, 0.6, 0.3, 2, 'Portion:150', 'vegan'],
  ['blumenkohl', 'Blumenkohl', 'Gemüse', 27, 2.4, 2.5, 0.3, 2.4, 'Portion:200', 'vegan'],
  ['mais', 'Mais (Dose, abgetropft)', 'Gemüse', 80, 2.9, 13, 1.2, 3, '1 kleine Dose:140', 'vegan'],
  ['avocado', 'Avocado', 'Gemüse', 160, 2, 1.8, 14.7, 6.7, 'halbe Avocado:70|1 Avocado:140', 'vegan'],
  ['gemuesemischung', 'Gemüsemischung (TK)', 'Gemüse', 40, 2.3, 5.5, 0.4, 3, 'Portion:200', 'vegan'],

  // Obst
  ['apfel', 'Apfel', 'Obst', 54, 0.3, 12, 0.2, 2.4, '1 Apfel:150', 'vegan'],
  ['banane', 'Banane', 'Obst', 90, 1.1, 20, 0.2, 2, '1 Banane (ohne Schale):120', 'vegan'],
  ['heidelbeeren', 'Heidelbeeren', 'Obst', 45, 0.7, 7.4, 0.6, 4.9, 'Portion:125', 'vegan'],
  ['erdbeeren', 'Erdbeeren', 'Obst', 33, 0.8, 5.5, 0.4, 2, 'Portion:200', 'vegan'],
  ['beeren-tk', 'Beerenmischung (TK)', 'Obst', 41, 0.9, 6.5, 0.4, 4, 'Portion:100', 'vegan'],
  ['orange', 'Orange', 'Obst', 44, 1, 8.3, 0.2, 2.2, '1 Orange:180', 'vegan'],
  ['weintrauben', 'Weintrauben', 'Obst', 70, 0.7, 15.6, 0.3, 1.5, 'Portion:125', 'vegan'],
  ['kiwi', 'Kiwi', 'Obst', 52, 1, 9, 0.6, 3, '1 Kiwi:75', 'vegan'],
  ['mango', 'Mango', 'Obst', 62, 0.6, 13, 0.4, 1.7, 'halbe Mango:150', 'vegan'],
  ['rosinen', 'Rosinen', 'Obst', 295, 2.5, 68, 0.6, 4, '1 EL:15', 'vegan'],
  ['datteln', 'Datteln (getrocknet)', 'Obst', 288, 2, 65, 0.4, 8, '1 Dattel:8', 'vegan'],

  // Nüsse & Fette
  ['mandeln', 'Mandeln', 'Nüsse & Samen', 600, 21, 5.7, 52, 12.5, 'Handvoll:30', 'vegan nuts'],
  ['walnuesse', 'Walnüsse', 'Nüsse & Samen', 680, 15, 6.3, 66, 6, 'Handvoll:30', 'vegan nuts'],
  ['cashews', 'Cashewkerne', 'Nüsse & Samen', 585, 18, 30, 44, 3, 'Handvoll:30', 'vegan nuts'],
  ['erdnuesse', 'Erdnüsse (geröstet)', 'Nüsse & Samen', 590, 25, 8, 49, 8, 'Handvoll:30', 'vegan peanuts'],
  ['erdnussbutter', 'Erdnussbutter (100 % Erdnuss)', 'Nüsse & Samen', 615, 25, 12, 50, 6.5, '1 EL:15|1 TL:7', 'vegan peanuts'],
  ['chiasamen', 'Chiasamen', 'Nüsse & Samen', 450, 17, 8, 31, 34, '1 EL:12', 'vegan'],
  ['leinsamen', 'Leinsamen (geschrotet)', 'Nüsse & Samen', 530, 24, 2, 42, 27, '1 EL:10', 'vegan'],
  ['olivenoel', 'Olivenöl', 'Fette & Öle', 900, 0, 0, 100, 0, '1 EL:10|1 TL:4', 'vegan'],
  ['rapsoel', 'Rapsöl', 'Fette & Öle', 900, 0, 0, 100, 0, '1 EL:10|1 TL:4', 'vegan'],
  ['kokosoel', 'Kokosöl', 'Fette & Öle', 900, 0, 0, 100, 0, '1 EL:10', 'vegan'],

  // Supplements & Snacks
  ['whey', 'Whey Proteinpulver (Durchschnitt)', 'Supplements', 377, 75, 8, 5, 0, '1 Messlöffel:30', 'vegetarian milk'],
  ['protein-vegan', 'Veganes Proteinpulver (Erbse/Reis)', 'Supplements', 375, 72, 6, 7, 3, '1 Messlöffel:30', 'vegan'],
  ['proteinriegel', 'Proteinriegel (Durchschnitt)', 'Supplements', 372, 32, 30, 12, 8, '1 Riegel:60|1 Riegel (45 g):45', 'vegetarian milk estimate'],
  ['zartbitter', 'Zartbitterschokolade 70 %', 'Snacks & Süßes', 568, 9, 33, 42, 11, '1 Rippe:10|Halbe Tafel:50', 'vegetarian'],
  ['vollmilchschokolade', 'Vollmilchschokolade', 'Snacks & Süßes', 535, 6.5, 56, 31, 2, '1 Rippe:12|Halbe Tafel:50', 'vegetarian milk'],
  ['gummibaerchen', 'Fruchtgummi', 'Snacks & Süßes', 343, 6.9, 77, 0.1, 0, 'Handvoll:25|Tüte:200', ''],
  ['chips', 'Kartoffelchips', 'Snacks & Süßes', 538, 6, 50, 34, 4, 'Portion:30|Tüte:175', 'vegan'],
  ['nussnougatcreme', 'Nuss-Nougat-Creme', 'Snacks & Süßes', 533, 6.3, 57.5, 30.9, 3, '1 TL:10|Portion für 1 Brot:15', 'vegetarian milk nuts'],
  ['honig', 'Honig', 'Aufstriche & Saucen', 302, 0.4, 75, 0, 0, '1 TL:8|1 EL:20', 'vegetarian'],
  ['marmelade', 'Konfitüre', 'Aufstriche & Saucen', 243, 0.4, 60, 0.1, 1, '1 TL:10|Portion für 1 Brötchen:20', 'vegan'],
  ['zucker', 'Zucker', 'Aufstriche & Saucen', 400, 0, 100, 0, 0, '1 TL:5', 'vegan'],
  ['ketchup', 'Ketchup', 'Aufstriche & Saucen', 105, 1.2, 24, 0.3, 0.5, '1 EL:15', 'vegan'],
  ['mayonnaise', 'Mayonnaise 80 %', 'Aufstriche & Saucen', 735, 1, 2, 80, 0, '1 EL:15', 'vegetarian egg'],
  ['pesto', 'Pesto Genovese', 'Aufstriche & Saucen', 500, 5, 6, 50, 2, '1 EL:15|Portion:50', 'vegetarian milk nuts'],
  ['hummus', 'Hummus', 'Aufstriche & Saucen', 280, 7, 12, 21.5, 5, '1 EL:20|Portion:50', 'vegan sesame'],

  // Getränke
  ['kaffee', 'Kaffee schwarz', 'Getränke', 2, 0.2, 0.3, 0, 0, '1 Tasse:200', 'vegan'],
  ['latte', 'Latte Macchiato (Vollmilch, ungesüßt)', 'Getränke', 42, 2.3, 3.3, 2.2, 0, '1 Glas:300', 'vegetarian milk estimate'],
  ['hafermilch', 'Haferdrink natur', 'Getränke', 42, 0.3, 6.7, 1.5, 0.8, '1 Glas (200 ml):200|Schuss für Kaffee:30', 'vegan gluten'],
  ['sojadrink', 'Sojadrink ungesüßt', 'Getränke', 33, 3.3, 0.2, 1.8, 0.6, '1 Glas (200 ml):200', 'vegan soy'],
  ['orangensaft', 'Orangensaft', 'Getränke', 43, 0.7, 9.5, 0.2, 0.2, '1 Glas (200 ml):200', 'vegan'],
  ['apfelsaft', 'Apfelsaft', 'Getränke', 44, 0.1, 10.5, 0.1, 0, '1 Glas (200 ml):200', 'vegan'],
  ['apfelschorle', 'Apfelschorle', 'Getränke', 24, 0, 5.7, 0, 0, '1 Flasche (0,5 l):500|1 Glas:250', 'vegan'],
  ['cola', 'Cola', 'Getränke', 42, 0, 10.6, 0, 0, '1 Dose (0,33 l):330|1 Flasche (0,5 l):500', 'vegan'],
  ['cola-zero', 'Cola Zero', 'Getränke', 0.3, 0, 0, 0, 0, '1 Dose (0,33 l):330|1 Flasche (0,5 l):500', 'vegan'],
  ['bier', 'Bier (Pils)', 'Getränke', 42, 0.5, 3, 0, 0, '1 Flasche (0,5 l):500|1 Glas (0,3 l):300', 'vegan gluten alcohol'],
  ['rotwein', 'Rotwein', 'Getränke', 83, 0.1, 2.6, 0, 0, '1 Glas (0,2 l):200', 'vegan alcohol'],

  // Gerichte (Schätzwerte)
  ['doener', 'Döner Kebab (Brot, Fleisch, Salat, Soße)', 'Gerichte', 215, 11, 20, 10, 1.5, '1 Döner:400', 'meat gluten milk estimate'],
  ['pizza-margherita', 'Pizza Margherita', 'Gerichte', 235, 9.5, 31, 8, 2, '1 Pizza:350|halbe Pizza:175', 'vegetarian gluten milk estimate'],
  ['currywurst', 'Currywurst mit Soße', 'Gerichte', 235, 10, 8, 18, 0.5, '1 Portion:200', 'meat estimate'],
  ['spaghetti-bolo', 'Spaghetti Bolognese', 'Gerichte', 150, 7.5, 18, 5, 1.5, '1 Teller:400', 'meat gluten estimate'],
  ['kartoffelsalat', 'Kartoffelsalat (mit Mayonnaise)', 'Gerichte', 150, 1.8, 13, 10, 1.5, 'Portion:200', 'vegetarian egg estimate'],
  ['chili-con-carne', 'Chili con Carne', 'Gerichte', 110, 8, 9, 4.5, 3, '1 Teller:350', 'meat estimate'],
  ['gemuese-curry', 'Gemüsecurry mit Kokosmilch', 'Gerichte', 95, 2.5, 7, 6.5, 2.5, '1 Teller:350', 'vegan estimate'],
];

function toFood(r: Row): FoodItem {
  const [slug, name, category, kcal, protein, carbs, fat, fiber, servings, tags] = r;
  const tagList = tags.split(' ').filter(Boolean);
  return {
    ref: `builtin:${slug}`,
    name,
    brand: null,
    barcode: null,
    category,
    kcal_100: kcal,
    protein_100: protein,
    carbs_100: carbs,
    fat_100: fat,
    fiber_100: fiber,
    sugar_100: null,
    salt_100: null,
    servings: servings
      .split('|')
      .filter(Boolean)
      .map((s) => {
        const idx = s.lastIndexOf(':');
        return { label: s.slice(0, idx), grams: Number(s.slice(idx + 1)) };
      }),
    source: 'builtin',
    is_estimate: tagList.includes('estimate'),
    tags: tagList.filter((t) => t !== 'estimate'),
  };
}

export const FOODS: FoodItem[] = ROWS.map(toFood);
export const FOOD_MAP: Record<string, FoodItem> = Object.fromEntries(FOODS.map((f) => [f.ref, f]));

export const ALLERGEN_LABELS_DE: Record<string, string> = {
  gluten: 'Gluten',
  milk: 'Milch/Laktose',
  egg: 'Ei',
  nuts: 'Schalenfrüchte (Nüsse)',
  peanuts: 'Erdnüsse',
  soy: 'Soja',
  fish: 'Fisch',
  crustaceans: 'Krebstiere',
  sesame: 'Sesam',
};

/** Allergen / diet conflicts of a food with the user's profile. */
export function foodWarnings(food: Pick<FoodItem, 'tags'>, profile: { diet_type: string; allergies: string[]; intolerances: string[] }): string[] {
  const tags = food.tags ?? [];
  const out: string[] = [];
  for (const a of [...profile.allergies, ...profile.intolerances]) {
    const key = a === 'lactose' ? 'milk' : a;
    if (tags.includes(key)) out.push(`Enthält ${ALLERGEN_LABELS_DE[key] ?? a}`);
  }
  if (profile.diet_type === 'vegan' && !tags.includes('vegan') && tags.length) out.push('Nicht vegan');
  if (profile.diet_type === 'vegetarian' && (tags.includes('meat') || tags.includes('fish'))) out.push('Nicht vegetarisch');
  if (profile.diet_type === 'pescetarian' && tags.includes('meat')) out.push('Enthält Fleisch');
  return out;
}

export function searchFoods(list: FoodItem[], query: string, limit = 30): FoodItem[] {
  const q = normalize(query);
  if (!q) return list.slice(0, limit);
  const words = q.split(' ').filter(Boolean);
  return list
    .map((f) => {
      const n = normalize(f.name);
      const hay = `${n} ${normalize(f.brand ?? '')} ${normalize(f.category ?? '')}`;
      let score = 0;
      if (n === q) score = 5;
      else if (n.startsWith(q)) score = 4;
      else if (n.split(' ').some((w) => w.startsWith(q))) score = 3;
      else if (hay.includes(q)) score = 2;
      else if (words.every((w) => hay.includes(w))) score = 1;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length)
    .slice(0, limit)
    .map((x) => x.f);
}
