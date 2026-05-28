const SECTION_MAP: Record<string, string[]> = {
  Produce: [
    "apple", "banana", "orange", "grape", "strawberry", "blueberry", "spinach", "kale",
    "lettuce", "tomato", "onion", "garlic", "pepper", "carrot", "broccoli", "cucumber",
    "zucchini", "lemon", "lime", "avocado", "potato", "mushroom", "celery", "asparagus",
    "mango", "pineapple", "peach", "plum", "pear", "cherry", "raspberry", "blackberry",
    "herbs", "basil", "cilantro", "parsley", "mint", "arugula", "ginger", "jalapeño",
    "cabbage", "beets", "radish", "scallion", "shallot", "eggplant", "artichoke",
    "fennel", "leek", "endive", "chard", "kiwi", "papaya", "pomegranate",
  ],
  Dairy: [
    "milk", "cheese", "yogurt", "butter", "cream", "sour cream", "cottage cheese",
    "brie", "cheddar", "mozzarella", "parmesan", "feta", "gouda", "eggs", "kefir",
    "ricotta", "halloumi", "cream cheese", "half and half", "whipped cream",
  ],
  Meat: [
    "chicken", "beef", "pork", "turkey", "salmon", "tuna", "shrimp", "lamb",
    "steak", "ground", "sausage", "bacon", "ham", "fish", "cod", "tilapia",
    "crab", "scallops", "lobster", "duck", "veal", "bison", "venison", "anchovy",
    "sardine", "mackerel", "halibut", "mahi", "snapper", "catfish",
  ],
  Frozen: [
    "frozen", "ice cream", "edamame", "waffle", "sorbet", "gelato",
  ],
  Pantry: [
    "rice", "pasta", "flour", "sugar", "salt", "oil", "olive oil", "vinegar",
    "sauce", "canned", "beans", "lentils", "oats", "bread", "crackers", "cereal",
    "honey", "maple syrup", "soy sauce", "hot sauce", "ketchup", "mustard", "mayo",
    "spices", "seasoning", "broth", "stock", "noodles", "quinoa", "couscous",
    "breadcrumbs", "cornstarch", "baking powder", "baking soda", "yeast",
    "vanilla", "cocoa", "chocolate chips", "tomato paste", "salsa", "tahini",
    "peanut butter", "jam", "jelly", "tortilla", "pita", "panko",
  ],
  Snacks: [
    "chips", "popcorn", "nuts", "almonds", "cashews", "peanuts", "granola",
    "protein bar", "trail mix", "dried fruit", "pretzels", "cookies", "chocolate",
    "candy", "gummies", "crackers", "jerky", "rice cake",
  ],
  Beverages: [
    "juice", "sparkling water", "coffee", "tea", "kombucha", "soda", "wine",
    "beer", "almond milk", "oat milk", "coconut milk", "coconut water", "lemonade",
    "sports drink", "energy drink", "cider",
  ],
};

export function assignGrocerySection(name: string): string {
  const lower = name.toLowerCase();
  for (const [section, keywords] of Object.entries(SECTION_MAP)) {
    if (keywords.some((kw) => lower.includes(kw))) return section;
  }
  return "Other";
}

export const GROCERY_SECTIONS = ["Produce", "Dairy", "Meat", "Frozen", "Pantry", "Snacks", "Beverages", "Other"];
