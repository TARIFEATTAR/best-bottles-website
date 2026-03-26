# ElevenLabs Tool Configurations — Grace AI

**Updated: 2026-03-25**

These are the complete, enriched tool definitions for the Grace ElevenLabs agent.
Copy each JSON block into the ElevenLabs agent dashboard → Tools section.

> **Critical config notes for ALL tools:**
> - Data-fetching tools should have `expects_response: true` and `response_timeout_secs: 10`
> - This ensures Grace WAITS for the data before speaking (no hallucinated responses)
> - Action tools (navigation, cart, forms) can stay `expects_response: false`

---

## 1. searchCatalog (CLIENT TOOL — data lookup)

```json
{
  "type": "client",
  "name": "searchCatalog",
  "description": "Search the Best Bottles product catalog. Returns REAL products with name, SKU, capacity (ml), color, applicator type, neck thread size, and pricing (1pc and 12pc). ALWAYS call this FIRST before answering ANY product question — never guess availability from memory.\n\nThe search is intelligent: it does fuzzy matching, normalizes terms (e.g. 'fine mist' → 'sprayer', 'roll-on' → 'roller'), and has a multi-stage fallback. You don't need exact product names.\n\nResults are capped at 25 items. If a requested size doesn't exist, the response will include a WARNING with the actual available sizes — do NOT tell the customer we have a size that doesn't appear in the results.\n\nExamples:\n- searchCatalog({searchTerm: '3ml spray'})\n- searchCatalog({searchTerm: 'frosted circle 50ml', familyLimit: 'Circle'})\n- searchCatalog({searchTerm: 'amber boston round', applicatorFilter: 'Dropper'})\n- searchCatalog({searchTerm: '30ml roll-on', familyLimit: 'Cylinder'})",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 10,
  "parameters": [
    {
      "id": "searchTerm",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "Product search query — can be natural language. Examples: '3ml spray', 'frosted circle 50ml', 'amber boston round 4oz', '30ml roll-on'. The backend normalizes terms and does fuzzy matching, so you don't need exact names. Include size (ml), color, family, and/or applicator type when the customer mentions them.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    },
    {
      "id": "familyLimit",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "Optional — restrict results to a specific bottle family. Valid families: Cylinder, Elegant, Boston Round, Circle, Diva, Empire, Slim, Vial, Sleek, Tulip, Rectangle, Square. Use when the customer names a specific shape or when you need to narrow results.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": false
    },
    {
      "id": "applicatorFilter",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "Optional — filter by applicator type. Common values: 'Metal Roller Ball,Plastic Roller Ball' (for roll-on), 'Fine Mist Sprayer' (for spray), 'Dropper', 'Lotion Pump', 'Treatment Pump'. Comma-separate multiple values to include either type.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": false
    }
  ],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 2. showProducts (CLIENT TOOL — search + navigate)

```json
{
  "type": "client",
  "name": "showProducts",
  "description": "Search the catalog AND navigate the customer to the matching products on the website. Use this when the customer says 'show me', 'find me', 'I want to see', or asks to browse a category.\n\nThis tool searches the catalog, then automatically navigates the customer to either:\n- A specific product page (if there's a clear single match)\n- The catalog page filtered to matching results (if multiple matches)\n\nIMPORTANT: If the requested size doesn't exist, this tool will NOT navigate — it returns a warning with available sizes. You MUST tell the customer the exact sizes we carry and suggest the closest alternative. Never claim we have a size that the search didn't find.\n\nFor data-only lookups (answering questions without navigating), use searchCatalog instead.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 10,
  "parameters": [
    {
      "id": "query",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "What to search for — natural language product description. Include size, color, family, and applicator when mentioned by customer. Examples: '3ml spray bottle', 'frosted circle 50ml', 'amber boston round dropper'.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    },
    {
      "id": "family",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "Optional bottle family to filter by: Cylinder, Elegant, Boston Round, Circle, Diva, Empire, Slim, Vial, Sleek, Tulip, Rectangle, Square.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": false
    }
  ],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 3. getBottleComponents (CLIENT TOOL — fitment lookup)

```json
{
  "type": "client",
  "name": "getBottleComponents",
  "description": "Look up ALL compatible closures, sprayers, droppers, pumps, roller balls, and caps for a specific bottle by its SKU. Uses the bottle's neck thread size to find matching components from the fitments database.\n\nCall this for 'what fits', 'what goes with', 'what cap works with', 'compatible closures', 'matching sprayer' questions.\n\nYou MUST have the bottle's Grace SKU first — get it from searchCatalog or getCurrentPageContext if the customer is on a product page.\n\nReturns components grouped by type (e.g., caps, sprayers, droppers), each with:\n- Item name and SKU\n- Price per piece\n- Cap/closure color\n- Stock status\n\nThe bottle's thread size (e.g., 18-415, 20-410) determines which components are compatible — this is a physical fit constraint, not a preference.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 10,
  "parameters": [
    {
      "id": "bottleSku",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "The bottle's Grace SKU (e.g., 'CYL-9ML-CLR'). Get this from searchCatalog results, or from getCurrentPageContext if the customer is on a product page. Both graceSku and websiteSku formats are accepted.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    }
  ],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 4. getFamilyOverview (CLIENT TOOL — family summary)

```json
{
  "type": "client",
  "name": "getFamilyOverview",
  "description": "Get a complete overview of a bottle family — all available sizes, colors, applicator types, thread sizes, and price range.\n\nUse this when a customer asks about a family in general (e.g., 'what do you have in the Cylinder line?', 'tell me about your Boston Round bottles').\n\nReturns:\n- All available sizes (with variant counts per size)\n- All available colors\n- All applicator types offered in this family\n- All thread sizes used\n- Price range (min/max for Glass Bottle category only — Component pricing is separate)\n\nValid families: Cylinder, Elegant, Boston Round, Circle, Diva, Empire, Slim, Vial, Sleek, Tulip, Rectangle, Square.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 10,
  "parameters": [
    {
      "id": "family",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "The bottle family name. Must match exactly: Cylinder, Elegant, Boston Round, Circle, Diva, Empire, Slim, Vial, Sleek, Tulip, Rectangle, Square. Case-sensitive.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    }
  ],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 5. checkCompatibility (CLIENT TOOL — reverse thread lookup)

```json
{
  "type": "client",
  "name": "checkCompatibility",
  "description": "Reverse compatibility lookup: find which bottles accept a specific neck thread size. Use when a customer has a cap or closure and wants to know which bottles it fits.\n\nThread sizes follow the GPI (Glass Packaging Institute) format: diameter-finish (e.g., 18-415, 20-410, 24-410, 28-410). The first number is the diameter in mm, the second is the finish/height specification.\n\nReturns a list of compatible bottles with: bottle name, bottle code, family hint, and capacity in ml.\n\nCommon thread sizes in our catalog: 13-415, 15-415, 18-415, 20-410, 24-410, 28-410.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 10,
  "parameters": [
    {
      "id": "threadSize",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "The neck thread size in GPI format (e.g., '18-415', '20-410', '24-410'). Common sizes: 13-415, 15-415, 18-415, 20-410, 24-410, 28-410.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    }
  ],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 6. getCatalogStats (CLIENT TOOL — catalog overview)

```json
{
  "type": "client",
  "name": "getCatalogStats",
  "description": "Get high-level catalog statistics: total number of SKUs, total product groups, and breakdowns by family and category.\n\nUse when a customer asks 'how many bottles do you have?', 'what's in your catalog?', or 'tell me about your selection'.\n\nReturns:\n- totalVariants: total individual SKUs (~2,285)\n- totalGroups: total product groupings (~230)\n- familyCounts: how many products per family (Cylinder, Boston Round, etc.)\n- categoryCounts: how many per category (Glass Bottle, Component, etc.)\n\nNOTE: This returns product COUNTS, not live inventory/stock levels. To check stock for a specific product, use searchCatalog.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 10,
  "parameters": [],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 7. compareProducts (CLIENT TOOL — visual comparison)

```json
{
  "type": "client",
  "name": "compareProducts",
  "description": "Search for products and display a side-by-side comparison card (up to 4 products) in the chat panel. The customer can visually compare specs, pricing, and features.\n\nUse when a customer is deciding between options, asks 'which is better', 'compare these', or 'what's the difference between'.\n\nThe comparison cards show: product name, capacity, color, applicator type, thread size, and pricing.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 10,
  "parameters": [
    {
      "id": "query",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "Search query to find products to compare. Be specific — include size, color, family. Example: '30ml cylinder clear vs frosted', 'boston round 4oz amber vs clear'.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    },
    {
      "id": "family",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "Optional family filter to narrow comparison to one family.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": false
    }
  ],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 8. proposeCartAdd (CLIENT TOOL — add to cart)

```json
{
  "type": "client",
  "name": "proposeCartAdd",
  "description": "Propose adding one or more products to the customer's shopping cart. Shows a confirmation card in the chat — the customer must click 'Confirm' before items are actually added.\n\nUse when a customer says 'add this to my cart', 'I'll take it', 'order this', etc.\n\nYou MUST have the product's graceSku and itemName from a prior searchCatalog or getCurrentPageContext call. Never guess SKUs.\n\nThe confirmation card shows the product name, quantity, and price. After the customer confirms, you'll receive a message saying they confirmed.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [
    {
      "id": "products",
      "type": "array",
      "value_type": "llm_prompt",
      "description": "Array of products to add. Each item needs: { itemName: string (product name), graceSku: string (from searchCatalog), quantity: number (default 1), webPrice1pc: number (price per piece, from searchCatalog) }. Example: [{ itemName: 'Cylinder 9ml Clear', graceSku: 'CYL-9ML-CLR', quantity: 12, webPrice1pc: 0.85 }]",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    }
  ],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 9. navigateToPage (CLIENT TOOL — page navigation)

```json
{
  "type": "client",
  "name": "navigateToPage",
  "description": "Navigate the customer to any page on the Best Bottles website. Use for directing customers to product pages, the catalog, contact forms, about page, etc.\n\nFor product pages: use the slug from searchCatalog results (format: /products/slug-here). If the slug doesn't exist, the tool automatically falls back to a catalog search.\n\nFor forms: you can pre-fill form fields by passing prefillFields. Grace should collect info conversationally first, then navigate with pre-filled data.\n\nCommon paths:\n- /catalog — Product catalog\n- /products/{slug} — Specific product page\n- /contact — Contact form\n- /request-samples — Sample request form\n- /about — About Best Bottles\n- /cart — Shopping cart",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": false,
  "response_timeout_secs": 1,
  "parameters": [
    {
      "id": "path",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "The URL path to navigate to. Examples: '/catalog', '/products/cylinder-9ml-clear', '/contact', '/cart'. For product pages use the slug from searchCatalog results.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    },
    {
      "id": "title",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "A human-readable title for the destination (shown in the navigation card). Example: 'Cylinder 9ml Clear', 'Product Catalog', 'Contact Form'.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    },
    {
      "id": "description",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "Optional description shown below the title in the navigation card.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": false
    },
    {
      "id": "autoNavigate",
      "type": "boolean",
      "value_type": "llm_prompt",
      "description": "Whether to navigate automatically (true, default) or show a 'Go' button for the customer to click (false). Use false when unsure if the customer wants to leave the current page.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": false
    },
    {
      "id": "prefillFields",
      "type": "object",
      "value_type": "llm_prompt",
      "description": "Optional key-value pairs to pre-fill on the destination form page. Keys are field names (name, email, company, phone, message). Example: { name: 'John', email: 'john@example.com', company: 'Acme Inc' }.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": false
    }
  ],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 10. updateFormField (CLIENT TOOL — live form fill)

```json
{
  "type": "client",
  "name": "updateFormField",
  "description": "Fill in a single field on a live form in the chat panel, one field at a time. The customer sees each field appear in real-time as you collect their information conversationally.\n\nWorkflow:\n1. Ask the customer for their name → updateFormField({formType: 'contact', fieldName: 'name', value: 'John Smith'})\n2. Ask for email → updateFormField({formType: 'contact', fieldName: 'email', value: 'john@example.com'})\n3. Continue for each field\n4. Call submitForm when all required fields are collected\n\nAvailable form types: 'sample' (sample request), 'quote' (quote request), 'contact' (general contact), 'newsletter'.\n\nCommon field names: name, email, company, phone, message, products, quantities.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": false,
  "response_timeout_secs": 1,
  "parameters": [
    {
      "id": "formType",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "The type of form: 'sample', 'quote', 'contact', or 'newsletter'.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    },
    {
      "id": "fieldName",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "The field to fill: 'name', 'email', 'company', 'phone', 'message', 'products', or 'quantities'.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    },
    {
      "id": "value",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "The value to set for this field. Use exactly what the customer said — don't modify names, emails, or phone numbers.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    }
  ],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 11. submitForm (CLIENT TOOL — form submission)

```json
{
  "type": "client",
  "name": "submitForm",
  "description": "Submit the active form that was built using updateFormField. The email field is REQUIRED — if missing, this tool will return an error asking you to collect the email first.\n\nOnly call this after collecting all necessary information via updateFormField. The form data is sent to the backend and the customer sees a success confirmation.\n\nIf submission fails, ask the customer to try clicking the Submit button on the form themselves as a fallback.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 10,
  "parameters": [],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 12. prefillForm (CLIENT TOOL — batch form fill)

```json
{
  "type": "client",
  "name": "prefillForm",
  "description": "Pre-fill an entire form at once with multiple fields (as opposed to updateFormField which does one field at a time). Use when you've already collected all the customer's information and want to populate the form in one action.\n\nShows the pre-filled form in the chat panel for customer review before submission.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": false,
  "response_timeout_secs": 1,
  "parameters": [
    {
      "id": "formType",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "Form type: 'sample', 'quote', 'contact', or 'newsletter'.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    },
    {
      "id": "fields",
      "type": "object",
      "value_type": "llm_prompt",
      "description": "Key-value pairs of form fields to fill. Example: { name: 'John Smith', email: 'john@example.com', company: 'Acme Inc', message: 'Looking for 1000 units of 30ml cylinder bottles' }.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    }
  ],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 13. getCurrentPageContext (CLIENT TOOL — NEW — Grace's "eyes")

```json
{
  "type": "client",
  "name": "getCurrentPageContext",
  "description": "See what the customer is currently viewing on the Best Bottles website. Returns the current page type, URL, and detailed information about what's on screen.\n\nIf customer is on a product page (PDP): returns the full product details — name, family, capacity, color, thread size, applicator, SKU, and price.\nIf on the catalog: returns active filters and search terms.\nIf on the cart: confirms they're reviewing their cart.\nAlso returns the customer's current cart contents with item names, quantities, and prices.\n\nCALL THIS:\n- At the start of a conversation to understand where the customer is\n- When a customer says 'this one', 'this bottle', 'the one I'm looking at' — you need to know WHICH product they mean\n- Before suggesting compatible components — get the SKU from the product they're viewing\n- When you're unsure what context the customer is speaking from\n\nThis is your primary tool for situational awareness. Use it often.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 14. getCartContents (CLIENT TOOL — NEW — cart visibility)

```json
{
  "type": "client",
  "name": "getCartContents",
  "description": "Get the customer's current shopping cart contents. Returns each item's name, SKU, quantity, unit price, subtotal, and the overall cart total.\n\nCall this when:\n- Customer asks 'what's in my cart?', 'how much is my order?', 'did I add that?'\n- Before suggesting add-ons or compatible components for items already in cart\n- When discussing pricing or totals\n- Before helping with checkout\n\nIf the cart is empty, returns a clear message saying so — you can then help them find products.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 15. getBrowsingHistory (CLIENT TOOL — NEW — session awareness)

```json
{
  "type": "client",
  "name": "getBrowsingHistory",
  "description": "Get a list of pages and products the customer has viewed during this session. Shows timestamps, product names, families, and search terms.\n\nCall this when:\n- Customer says 'that bottle I was looking at earlier', 'go back to the one I saw before'\n- You want to make personalized recommendations based on their browsing pattern\n- Customer seems undecided and you want to reference products they've already explored\n\nAlso provides an insight summary — e.g., if the customer has been comparing products within the same family or across families.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## 16. showProductPresentation (CLIENT TOOL — NEW — multi-product showcase)

```json
{
  "type": "client",
  "name": "showProductPresentation",
  "description": "Display a curated showcase of up to 6 products as visual cards in the chat panel. Use this to present a selection of options to the customer — like a salesperson laying out bottles on a table.\n\nUse when:\n- Customer asks 'what do you recommend for fragrance?', 'show me your spray bottles'\n- You want to present multiple options after understanding their needs\n- Customer is browsing and you want to curate a selection based on their requirements\n\nDifferent from showProducts (which navigates the website) — this keeps the customer in the conversation and shows product cards directly in the chat.\n\nAfter presenting, ask which option interests them or if they'd like more details on a specific product.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "assignments": [],
  "expects_response": true,
  "response_timeout_secs": 10,
  "parameters": [
    {
      "id": "searchTerm",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "Search query for products to present. Examples: '30ml spray bottles', 'roll-on bottles for essential oils', 'frosted glass bottles'.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": true
    },
    {
      "id": "headline",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "Optional headline shown above the product cards. Example: 'Perfect bottles for your fragrance line', 'Here are our most popular spray bottles'. If omitted, a default is generated from the search term.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": false
    },
    {
      "id": "familyLimit",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "Optional family filter: Cylinder, Elegant, Boston Round, Circle, Diva, Empire, Slim, Vial, Sleek, Tulip, Rectangle, Square.",
      "dynamic_variable": "",
      "constant_value": "",
      "enum": null,
      "is_system_provided": false,
      "required": false
    }
  ],
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

---

## Summary of Changes

### Existing tools enriched:
| Tool | Key Change |
|------|-----------|
| searchCatalog | Added fuzzy matching docs, normalization info, size warning behavior, expanded family list, `expects_response: true`, `response_timeout_secs: 10` |
| showProducts | Clarified navigation vs data-only distinction, size warning behavior |
| getBottleComponents | Added thread-size fitment explanation, return format docs, dual-SKU support |
| getFamilyOverview | Added return field details, price range caveat (Glass Bottle only), valid families |
| checkCompatibility | Added GPI thread format explanation, common sizes, reverse-lookup framing |
| getCatalogStats | Clarified counts vs inventory, return structure, usage examples |
| compareProducts | Added visual card display docs, up-to-4 limit |
| proposeCartAdd | Added confirmation flow docs, required fields, array format |
| navigateToPage | Added common paths, prefillFields docs, auto-navigate explanation |
| updateFormField | Added full workflow example, field names list |
| submitForm | Added email requirement, fallback instructions |
| prefillForm | Added batch-fill distinction from updateFormField |

### New tools added:
| Tool | Purpose |
|------|---------|
| getCurrentPageContext | Grace can "see" what page the customer is on, what product they're viewing, and what's in their cart |
| getCartContents | Detailed cart read — items, quantities, prices, total |
| getBrowsingHistory | Session-level page tracking with browsing pattern insights |
| showProductPresentation | Multi-product showcase cards in chat (up to 6 products) |

### Critical config changes:
| Setting | Before | After | Why |
|---------|--------|-------|-----|
| `expects_response` | `false` (all tools) | `true` (data tools) | Grace WAITS for data before speaking — no hallucinated responses |
| `response_timeout_secs` | `1` (all tools) | `10` (data tools), `5` (context tools) | Backend queries need time to complete |
