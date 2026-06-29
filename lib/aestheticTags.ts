// Curated home-decor tag vocabulary for AI vision tagging. Each category
// groups concrete visual primitives (layout mechanics, lighting properties,
// color histograms, surface texture, material) rather than subjective style
// labels, so a vision model can ground its tag choice in checkable image
// evidence instead of a vibe. Also used to seed the gallery's manual tag
// Autocomplete suggestions.
export const AI_VISION_TAG_CATEGORIES = {
    "Global Scene & Layout": [
        "open-concept", "cluttered", "sparse", "staged", "lived-in",
        "symmetrical", "asymmetrical", "high-ceiling", "loft",
    ],
    "Design Archetype": [
        "minimalist", "maximalist", "industrial", "mid-century modern",
        "art deco", "traditional", "rustic", "bohemian", "coastal",
        "modern farmhouse", "brutalist", "shabby chic", "gothic",
        "grandmillennial", "dark academia",
    ],
    "Lighting & Luminosity": [
        "sun-drenched", "dappled light", "golden hour", "high-key",
        "low-key", "diffused lighting", "shadowplay", "backlit",
        "color capping",
    ],
    "Color Profile": [
        "warm-toned", "cool-toned", "monochrome", "high-contrast",
        "low-contrast", "jewel-toned", "pastel", "muted", "earthy",
        "saturated", "desaturated", "mixed wood tones",
    ],
    "Surface Textures": [
        "matte", "glossy", "distressed", "patinated", "polished",
        "raw", "smooth", "textured", "patterned", "woven",
    ],
    "Material Markers": [
        "natural wood", "exposed brick", "concrete", "marble", "travertine",
        "velvet", "bouclé", "linen", "leather", "rattan", "cane",
        "brass", "chrome", "matte black iron",
    ],
} as const;

export type AiVisionTagCategory = keyof typeof AI_VISION_TAG_CATEGORIES;

export const AI_VISION_TAGS: string[] = Object.values(AI_VISION_TAG_CATEGORIES).flat();

// Visual-primitive definition for each tag, fed into the auto-tagging
// prompt so the model has a concrete checklist to verify against the image
// rather than a bare word to interpret subjectively.
export const AI_VISION_TAG_DESCRIPTIONS: Record<string, string> = {
    "open-concept": "The camera frame captures a distinct lack of interior partition walls, showing a continuous flow between multiple functional zones like the kitchen, dining, or living spaces.",
    "cluttered": "A high density of distinct foreground objects, resulting in overlapping bounding boxes, intersecting lines, and negligible negative space on flat surfaces.",
    "sparse": "A high percentage of empty floor and wall pixels, minimal furniture footprint, and vast, uninterrupted fields of negative space.",
    "staged": "Rigidly manicured object placement, pristine textiles devoid of creases, zero personal artifacts, and a composition mimicking a commercial catalog shot.",
    "lived-in": "Minor visual imperfections present, such as slightly rumpled throws, off-angle pillows, or casual everyday items like an open book or a ceramic mug.",
    "symmetrical": "The left and right halves of the frame mirror one another closely in architectural structure and furniture placement.",
    "asymmetrical": "An intentionally unbalanced distribution of visual weight, form, or furniture orientation across the vertical axis of the image.",
    "high-ceiling": "The vertical wall span is significantly greater than the standard height of the furniture, often capturing an expansive upper third of a room.",
    "loft": "Features exposed structural overhead systems, soaring ceilings, and often includes a visible upper mezzanine level or large industrial window frame.",

    "minimalist": "Extreme reduction of decoration, sharp clean edges, a highly limited color palette, and a complete absence of surface ornamentation.",
    "maximalist": "A dense collision of vibrant color blocks, complex patterns, clustered artwork, and contrasting textures across the entire image field.",
    "industrial": "Presence of utilitarian elements like structural steel, rough concrete, exposed overhead ductwork, and factory-style window panes.",
    "mid-century modern": "Defined by clean geometric silhouettes, low-profile furniture anchored by tapered legs, and smooth wood surfaces like teak or walnut.",
    "art deco": "Highly geometric motifs, zig-zags, sunbursts, high-gloss lacquered finishes, and prominent metallic gold or brass decorative trims.",
    "traditional": "Classic European furniture silhouettes, ornate crown moldings, dark wood finishes, matching formal sets, and highly structured, formal balance.",
    "rustic": "Focuses heavily on raw nature, featuring rough-hewn wooden beams, unpolished stone masonry, and deeply grained, uneven wood surfaces.",
    "bohemian": "Low-slung furniture configurations, heavily layered global textiles, casual floor pillows, and a prominent density of indoor trailing plants.",
    "coastal": "A palette of crisp whites, sandy tones, and soft blues paired with light-washed woods, woven fibers, and abundant natural light.",
    "modern farmhouse": "High-contrast combinations of matte black iron fixtures against white shiplap walls, accented by rough-cut timber headers.",
    "brutalist": "Dominated by raw, unpainted, poured concrete, hard angular geometry, monolithic blocks of stone or metal, and a heavy, structural weight.",
    "shabby chic": "Features whitewashed or heavily distressed wood furniture, soft floral textile prints, and ruffles or slipcovers over vintage frames.",
    "gothic": "Dominated by pointed architectural arches, deep historical color fields, ornate black iron scrollwork, and heavy, light-absorbing fabrics.",
    "grandmillennial": "Classic floral wallpaper patterns, pleated lampshades, heirloom-style antique furniture, and detailed trim details like ruffles or tassels.",
    "dark academia": "Deep, moody color scales paired with floor-to-ceiling built-in bookshelves, vintage oil paintings, leather-bound books, and historic stone or dark millwork.",

    "sun-drenched": "High-intensity natural light beams directly entering the frame, casting sharp, bright white exposures across surfaces.",
    "dappled light": "Intricate shadow patterns cast onto walls or floors by sunlight filtering through foliage, trees, or structural slats.",
    "golden hour": "Low-angle light rays with a highly distinct warm orange, yellow, or amber color temperature, creating elongated, soft shadows.",
    "high-key": "An exceptionally bright, evenly illuminated scene with a low ratio of shadows and a highly elevated mid-tone exposure.",
    "low-key": "A dark, shadow-dominant scene featuring isolated pools of accent light, high-contrast drop-offs, and a major concentration of deep black pixels.",
    "diffused lighting": "Soft, highly uniform illumination with non-existent or barely perceptible shadow edges, typically from overcast sky windows.",
    "shadowplay": "A compositional state where structural or geometric shadows cast onto surfaces become a primary visual anchor of the photo.",
    "backlit": "The primary light source is situated directly behind the main furniture piece or architectural focal point, creating a rim-lit effect or silhouette.",
    "color capping": "A painting technique where the wall color extends continuously up and across the ceiling, creating an enveloping, uniform color boundary.",

    "warm-toned": "A dominant presence of red, orange, yellow, tan, and warm wood wavelengths in the image color histogram.",
    "cool-toned": "A dominant presence of blue, cool gray, deep green, and stark white wavelengths in the image color histogram.",
    "monochrome": "The entire scene is restricted to variations, tints, and shades of a single core color family.",
    "high-contrast": "Sharp, immediate transitions between extreme light and dark areas, or adjacent complementary color blocks.",
    "low-contrast": "Tonal values cluster tightly within a narrow mid-tone range, resulting in soft, flat transitions between shapes.",
    "jewel-toned": "Highly saturated, rich color blocks mimicking minerals, including emerald green, sapphire blue, ruby red, and amethyst purple.",
    "pastel": "Highly luminous colors with very low saturation, including mint, blush pink, soft lavender, and pale blue.",
    "muted": "Desaturated, understated tones heavily mixed with gray or brown, avoiding bright primary hues.",
    "earthy": "A palette consisting entirely of naturally occurring tones like terracotta, olive green, warm ochre, clay, and charcoal.",
    "saturated": "Exceptionally pure, vibrant colors that pop sharply from the frame with minimal gray interference.",
    "desaturated": "Color values pulled close to the grayscale axis, resulting in a washed-out, quiet color landscape.",
    "mixed wood tones": "The simultaneous presence of multiple distinct wood species or stain values, such as a pale white oak floor contrasted by a dark walnut table.",

    "matte": "Completely non-reflective surface treatments that absorb light uniformly, yielding zero specular glare.",
    "glossy": "Highly reflective, polished finishes that act as mirrors, showing clear specular light highlights and surface reflections.",
    "distressed": "Fractured, scratched, or weathered surfaces showing intentional signs of physical wear, chipping, or artificial aging.",
    "patinated": "Metal or leather surfaces showing a natural chemical or physical aging layer, characteristic of oxidation or worn seating.",
    "polished": "Smoothed down to a mirror finish, generating clean, sharp glare lines across hard planes like marble or polished steel.",
    "raw": "Materials left in an unsealed, unrefined state, showcasing original jagged grains, rough stone cuts, or uneven surfaces.",
    "smooth": "A perfectly uniform plane with zero granular disruption or visual texture.",
    "textured": "An uneven surface showing visible depth, fabric weave, or tactile variations that catch light irregularly.",
    "patterned": "Repetitive geometric, botanical, or abstract printed designs running across a fabric or wall face.",
    "woven": "Interlocking fiber matrix patterns clearly visible to the camera, typical of wicker, rattan, or thick rugs.",

    "natural wood": "Clear presentation of organic wood grain lines, knots, and growth rings on furniture or structural elements.",
    "exposed brick": "Raw, unplastered rectangular clay masonry blocks displaying variation in mortar lines and earthy red-brown hues.",
    "concrete": "Industrial gray surfaces showing subtle air pocket pitting, formwork lines, or poured aggregate details.",
    "marble": "Metamorphic rock surfaces defined by distinct, erratic mineral veining sweeping across a contrasting solid base.",
    "travertine": "Low-sheen calcareous stone characterized by natural concentric holes, pitting, and soft cream-tan tones.",
    "velvet": "A plush, tufted fabric that creates brilliant, light-catching ridges alongside deep, light-absorbing shadow folds.",
    "bouclé": "A highly looped, knotted textile giving a distinctly bumpy, curly, sheepskin-like appearance to upholstered objects.",
    "linen": "A loose, semi-irregular plain weave showing fine structural creases and slight yarn variations.",
    "leather": "Animal hide surfaces displaying natural grain textures, subtle stretching lines, or smooth, organic folds.",
    "rattan": "Solid, flexible palm stalks woven or formed into lightweight structural furniture frames.",
    "cane": "A specific open-work geometric mesh pattern woven from thin strips of rattan bark, commonly seen on chair backings.",
    "brass": "Golden-hued metallic components ranging from a dull brushed matte to a highly reflective mirror polish.",
    "chrome": "A highly reflective, perfectly silvered metallic finish displaying cold, blue-shifted mirror reflections.",
    "matte black iron": "Zero-sheen black metallic frames, window mullions, or light fixtures showing a heavy, solid profile.",
};
