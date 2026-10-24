# Guide image generation — 3 October 2026

Built-in Imagegen was used for all 20 guide covers. The initial eight images were rejected for excessive HDR-like detail and gold colour. They were not selected for use. Revised images follow [the photographic directive](PHOTOGRAPHY-STYLE.md) and its saved reference. The first eight scenes were softened with that reference; the remaining scenes were generated with the natural-camera direction below, with targeted optical or physical corrections where needed. Real case-study photographs remain unchanged.

Final assets are under `public/assets/images/guides/`. Every guide's index card, recommendation card, hero and Open Graph preview uses the same dedicated asset. WebP conversion uses quality 85 with no sharpening, grading or other pixel treatment. Original generated PNGs remain at the recorded paths. This is an internal provenance record; these illustrative photographs do not document customer installations.

## New-scene direction

Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation.

## Final selections and prompts

### build

- Asset: `public/assets/images/guides/build.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-c54834ed-b6c1-4e2f-86d0-ba3b54de8702.png`
- Subject: Building a nature pool yourself. A modest private garden in the middle of a careful pool build: an excavated shallow shelf and deeper basin lined with neatly laid dark flexible liner, rounded stones stacked safely beside it, a shovel and wheelbarrow set aside. Ground-level three-quarter overview shows the real scale and unfinished construction. No people or exposed electrical equipment. Attractive useful documentary view, not a disaster site.

Final prompt:

Use case: style-transfer. EDIT IMAGE 1; IMAGE 2 is the approved photography STYLE reference only. Preserve image 1 subject, composition, aspect ratio and meaningful objects. Do not import people or location from image 2. Remove the artificial HDR rendering substantially. A normal unprocessed single-exposure candid photograph with camera sharpening off. Soft natural daylight, restrained neutral colour, no golden cast. Lower local microcontrast greatly; foliage, timber and stone have gentle optical detail, not etched texture. Real shadows lose detail rather than being lifted. Bright highlights can wash out. Keep the meaningful subject in gentle focus with believable distance-based falloff, background recognisable, no heavy blur or portrait halos. Natural water reflections, no glowing water. No tone mapping, cinematic grading, oversharpening, artificial grain, haze, vignettes or glossy advertising effect. Preserve anatomy and physical plausibility. No added text or marks. Output wide 3:2.

### difference

- Asset: `public/assets/images/guides/difference.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-1e2c743c-6897-442c-a81b-b19af233105a.png`
- Subject: Natural versus conventional pool. One coherent garden scene of a finished RECTANGULAR natural swimming pool: a clearly defined straight swimming edge and a visibly separate planted gravel filtration area beside it. Timber transition between the two areas. Water naturally dark blue-green rather than luminous turquoise. The contrast between formal swimming area and planted biological edge is the meaningful subject. No split screen, no text, no people.

Final prompt:

EDIT IMAGE 1, the pool photograph. Image 2 is the approved photographic style reference; image 3 is a real customer photograph supplied ONLY to calibrate believable ordinary optical rendering, never copy that customer's setting. Preserve image 1's exact pool design, planting and wide 3:2 composition. Correct its synthetic HDR / tone-mapped appearance VERY SUBSTANTIALLY. Render as an unprocessed single-exposure photograph from a normal camera, HDR disabled, sharpening and clarity disabled. Remove the golden cast and high local contrast. Midtone leaves and stone must become naturally soft tonal masses instead of individually etched details. Keep genuine optical detail at the meaningful pool edge but no crisp microtexture everywhere. Allow the back garden to fall into deep simple shadow with LESS visible detail and let a few bright highlights wash out. Do not brighten shadows or recover highlights. Gentle focus separation, still recognisable garden and water ripples; no blur wash, heavy bokeh, fog, artificial grain or vignette. Muted ordinary greens, neutral grey timber, believable dark water, no glowing yellow foliage or jewel-like saturation. Natural daylight, not golden-hour advertising. The requested correction must be plainly visible versus image 1: softer, less polished and much less processed. No text, watermark or new objects.

### varma-upp-naturpool

- Asset: `public/assets/images/guides/varma-upp-naturpool.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-f25a5f46-6696-475a-a6c0-cbb7c91b0e38.png`
- Subject: Heating a nature pool. A quiet Nordic garden in early autumn with a natural swimming pool visible beyond a modest UNBRANDED outdoor pool heat pump. The recognisable compact metal heat pump with one realistic circular fan grille stands dry on a proper slab, sheltered by planting but with clear ventilation space. Camera at waist height; equipment right of frame and water left. Closed intact casing, no wires, no labels, no invented pipes or steam. Warm morning light on amber leaves, cool water reflections.

Final prompt:

Use case: style-transfer. EDIT IMAGE 1; IMAGE 2 is the approved photography STYLE reference only. Preserve image 1 subject, composition, aspect ratio and meaningful objects. Do not import people or location from image 2. Remove the artificial HDR rendering substantially. A normal unprocessed single-exposure candid photograph with camera sharpening off. Soft natural daylight, restrained neutral colour, no golden cast. Lower local microcontrast greatly; foliage, timber and stone have gentle optical detail, not etched texture. Real shadows lose detail rather than being lifted. Bright highlights can wash out. Keep the meaningful subject in gentle focus with believable distance-based falloff, background recognisable, no heavy blur or portrait halos. Natural water reflections, no glowing water. No tone mapping, cinematic grading, oversharpening, artificial grain, haze, vignettes or glossy advertising effect. Preserve anatomy and physical plausibility. No added text or marks. Output wide 3:2. Ensure clear open ventilation space around the heat pump.

### din-naturpool-skotsel-efter-installation

- Asset: `public/assets/images/guides/din-naturpool-skotsel-efter-installation.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-0816f40d-2d7b-44f2-b32c-cd832f1e5858.png`
- Subject: A care checklist after installation. Close documentary view of a long-handled leaf skimmer net lifting just a few autumn leaves from a natural swimming pool beside a timber deck. Only one adult's naturally positioned hand and forearm holding the handle from frame edge; no face. Net and water contact physically plausible, several droplets, recognisable planting behind. Calm routine maintenance, clean cared-for water, no dramatic algae or litter.

Final prompt:

Use case: style-transfer. EDIT IMAGE 1; IMAGE 2 is the approved photography STYLE reference only. Preserve image 1 subject, composition, aspect ratio and meaningful objects. Do not import people or location from image 2. Remove the artificial HDR rendering substantially. A normal unprocessed single-exposure candid photograph with camera sharpening off. Soft natural daylight, restrained neutral colour, no golden cast. Lower local microcontrast greatly; foliage, timber and stone have gentle optical detail, not etched texture. Real shadows lose detail rather than being lifted. Bright highlights can wash out. Keep the meaningful subject in gentle focus with believable distance-based falloff, background recognisable, no heavy blur or portrait halos. Natural water reflections, no glowing water. No tone mapping, cinematic grading, oversharpening, artificial grain, haze, vignettes or glossy advertising effect. Preserve anatomy and physical plausibility. No added text or marks. Output wide 3:2.

### hur-mycket-plats-behover-en-naturpool

- Asset: `public/assets/images/guides/hur-mycket-plats-behover-en-naturpool.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-cbf3462d-9c87-4130-ab07-4e4c363dd57a.png`
- Subject: How much space does a nature pool need? Modest Swedish back garden before construction, a broad lawn between house and irregular shrubs with a clear pool footprint marked by a low taut builder's string around four short wooden pegs. A yellow open-reel measuring tape stretches across the width, lying on grass. Show the entire proposed footprint and usable garden around it from a slightly raised ground-level viewpoint. No numbers, paperwork, people or swimming pool yet. Avoid exaggerated enormous estate.

Final prompt:

Use case: style-transfer. EDIT IMAGE 1; IMAGE 2 is the approved photography STYLE reference only. Preserve image 1 subject, composition, aspect ratio and meaningful objects. Do not import people or location from image 2. Remove the artificial HDR rendering substantially. A normal unprocessed single-exposure candid photograph with camera sharpening off. Soft natural daylight, restrained neutral colour, no golden cast. Lower local microcontrast greatly; foliage, timber and stone have gentle optical detail, not etched texture. Real shadows lose detail rather than being lifted. Bright highlights can wash out. Keep the meaningful subject in gentle focus with believable distance-based falloff, background recognisable, no heavy blur or portrait halos. Natural water reflections, no glowing water. No tone mapping, cinematic grading, oversharpening, artificial grain, haze, vignettes or glossy advertising effect. Preserve anatomy and physical plausibility. No added text or marks. Output wide 3:2.

### skotsel-av-naturpool-under-aret

- Asset: `public/assets/images/guides/skotsel-av-naturpool-under-aret.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-b5052f43-c0f8-42a0-89aa-4726e73227c5.png`
- Subject: Nature pool care through the four seasons. One single autumn scene at a cared-for natural pool: adult gardener seen naturally from behind at one side rolling a loose leaf net onto a simple timber pole before stretching it over water. Golden birch leaves, some bare branches, a small leaf basket and gloves nearby. Practical preparation in cool October daylight, no winter snow collage or four-panels. Pool water visible and recognisable, plausible net texture, no child.

Final prompt:

Use case: style-transfer. EDIT IMAGE 1; IMAGE 2 is the approved photography STYLE reference only. Preserve image 1 subject, composition, aspect ratio and meaningful objects. Do not import people or location from image 2. Remove the artificial HDR rendering substantially. A normal unprocessed single-exposure candid photograph with camera sharpening off. Soft natural daylight, restrained neutral colour, no golden cast. Lower local microcontrast greatly; foliage, timber and stone have gentle optical detail, not etched texture. Real shadows lose detail rather than being lifted. Bright highlights can wash out. Keep the meaningful subject in gentle focus with believable distance-based falloff, background recognisable, no heavy blur or portrait halos. Natural water reflections, no glowing water. No tone mapping, cinematic grading, oversharpening, artificial grain, haze, vignettes or glossy advertising effect. Preserve anatomy and physical plausibility. No added text or marks. Output wide 3:2.

### naturpool-fran-forsta-samtal-till-bad

- Asset: `public/assets/images/guides/naturpool-fran-forsta-samtal-till-bad.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-1392c9c3-7b34-4398-b7ea-aa9ec396387a.png`
- Subject: From first conversation to a nature pool. Two adults, homeowner and garden designer, candidly discussing a proposed pool in a modest garden. They stand beside a simple picnic table with one large unlabelled site sketch on it. One points at the open lawn, the other listens, no camera-facing smiles. Natural early-stage site visit, intact lawn before construction, tape measure on table, no brands, no readable lettering.

Final prompt:

Use case: style-transfer. EDIT IMAGE 1; IMAGE 2 is the approved photography STYLE reference only. Preserve image 1 subject, composition, aspect ratio and meaningful objects. Do not import people or location from image 2. Remove the artificial HDR rendering substantially. A normal unprocessed single-exposure candid photograph with camera sharpening off. Soft natural daylight, restrained neutral colour, no golden cast. Lower local microcontrast greatly; foliage, timber and stone have gentle optical detail, not etched texture. Real shadows lose detail rather than being lifted. Bright highlights can wash out. Keep the meaningful subject in gentle focus with believable distance-based falloff, background recognisable, no heavy blur or portrait halos. Natural water reflections, no glowing water. No tone mapping, cinematic grading, oversharpening, artificial grain, haze, vignettes or glossy advertising effect. Preserve anatomy and physical plausibility. No added text or marks. Output wide 3:2.

### naturpool-i-sodra-sverige

- Asset: `public/assets/images/guides/naturpool-i-sodra-sverige.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-0b76b3b7-74aa-4d3e-9f71-fcc784202f62.png`
- Subject: Nature pools in southern Sweden. Wide landscape photo of a small natural swimming pond settled into a SOUTHERN SWEDISH rural garden: low red-painted cottage only subtly in distance, gently rolling fields, beech hedge, local rounded stone margins, wildflower grasses, a simple timber stepping deck. Ordinary domestic scale, no people, no cliffs, no alpine landscape, no coastal resort. Broad depth of field, bright slightly hazy Scandinavian summer afternoon.

Final prompt:

Use case: style-transfer. EDIT IMAGE 1; IMAGE 2 is the approved photography STYLE reference only. Preserve image 1 subject, composition, aspect ratio and meaningful objects. Do not import people or location from image 2. Remove the artificial HDR rendering substantially. A normal unprocessed single-exposure candid photograph with camera sharpening off. Soft natural daylight, restrained neutral colour, no golden cast. Lower local microcontrast greatly; foliage, timber and stone have gentle optical detail, not etched texture. Real shadows lose detail rather than being lifted. Bright highlights can wash out. Keep the meaningful subject in gentle focus with believable distance-based falloff, background recognisable, no heavy blur or portrait halos. Natural water reflections, no glowing water. No tone mapping, cinematic grading, oversharpening, artificial grain, haze, vignettes or glossy advertising effect. Preserve anatomy and physical plausibility. No added text or marks. Output wide 3:2.

### naturpool-sakerhet-och-tillstand

- Asset: `public/assets/images/guides/naturpool-sakerhet-och-tillstand.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-bd552efa-973f-4714-8eca-a3035f7ed68f.png`
- Subject: Closed simple vertical timber garden pool gate with a high latch, unclimbable vertical fence continuing on both sides, clear paved path beyond to a modest natural swimming pool. Focus on closed gate and access planning. No children or people. Gate tall enough to convey controlled access without claiming regulatory certification. Modern ordinary Swedish suburban garden, pale rendered house.

Final prompt:

Use case: style-transfer. EDIT IMAGE 1; IMAGE 2 is the approved photography STYLE reference only. Preserve image 1 subject, composition, aspect ratio and meaningful objects. Do not import people or location from image 2. Remove the artificial HDR rendering substantially. A normal unprocessed single-exposure candid photograph with camera sharpening off. Soft natural daylight, restrained neutral colour, no golden cast. Lower local microcontrast greatly; foliage, timber and stone have gentle optical detail, not etched texture. Real shadows lose detail rather than being lifted. Bright highlights can wash out. Keep the meaningful subject in gentle focus with believable distance-based falloff, background recognisable, no heavy blur or portrait halos. Natural water reflections, no glowing water. No tone mapping, cinematic grading, oversharpening, artificial grain, haze, vignettes or glossy advertising effect. Preserve anatomy and physical plausibility. No added text or marks. Output wide 3:2. Narrow every gate slat gap to approximately 3cm and keep the tall gate closed with its high latch.

### vad-kostar-det-att-aga-en-naturpool

- Asset: `public/assets/images/guides/vad-kostar-det-att-aga-en-naturpool.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-c7dc34e6-fb4d-41a1-9393-7865904cd4c5.png`
- Subject: Simple everyday garden table with open notebook, plain calculator with unlit display and a pencil. Softly visible small swimming pond beyond, surrounded by grasses and a modest whitewashed house. Pool ownership budget concept. No readable words or digits, no money, no people. Focus on notebook with pool still recognisable.

Final prompt:

Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation.
SUBJECT: Simple everyday garden table with open notebook, plain calculator with unlit display and a pencil. Softly visible small swimming pond beyond, surrounded by grasses and a modest whitewashed house. Pool ownership budget concept. No readable words or digits, no money, no people. Focus on notebook with pool still recognisable.

### 5-common-problems-installing-a-nature-pool

- Asset: `public/assets/images/guides/5-common-problems-installing-a-nature-pool.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-6ef9402b-4a0a-43c0-912c-eb991056073e.png`
- Subject: A handful of fallen leaves gathered near a pool skimmer intake in a stone edge; a slightly overhanging shrub and leafy garden reflected in the natural swimming water. Ground-level close view communicates planning for leaf load and circulation. Water clean and cared for. No fish, equipment wires, people, filth, text or dramatic disaster.

Final prompt:

Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation.
SUBJECT: A handful of fallen leaves gathered near a pool skimmer intake in a stone edge; a slightly overhanging shrub and leafy garden reflected in the natural swimming water. Ground-level close view communicates planning for leaf load and circulation. Water clean and cared for. No fish, equipment wires, people, filth, text or dramatic disaster.

### pool-conversions

- Asset: `public/assets/images/guides/pool-conversions.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-865de615-6c54-4cd0-b2a2-1ab4eebfc325.png`
- Subject: Existing conventional rectangular garden pool with grey coping and ordinary deck, viewed from one corner. An adjacent accessible dry maintenance inspection hatch is open revealing only simple intact filter housing and closed pipes, no wiring or dangerous exposed parts. Sparse grass border leaves room to adapt filtration. No people, no demolition, no before-after split. A practical pool conversion assessment.

Final prompt:

Use case: style-transfer. EDIT IMAGE 1; IMAGE 2 is the approved photography STYLE reference only. Preserve image 1 subject, composition, aspect ratio and meaningful objects. Do not import people or location from image 2. Remove the artificial HDR rendering substantially. A normal unprocessed single-exposure candid photograph with camera sharpening off. Soft natural daylight, restrained neutral colour, no golden cast. Lower local microcontrast greatly; foliage, timber and stone have gentle optical detail, not etched texture. Real shadows lose detail rather than being lifted. Bright highlights can wash out. Keep the meaningful subject in gentle focus with believable distance-based falloff, background recognisable, no heavy blur or portrait halos. Natural water reflections, no glowing water. No tone mapping, cinematic grading, oversharpening, artificial grain, haze, vignettes or glossy advertising effect. Preserve anatomy and physical plausibility. No added text or marks. Output wide 3:2. Reduce crunchy surface texture even more on stones, grass, leaves and wood. Make the dark tree and hedge masses in the far background simple and optically soft, with lost detail. This should visibly look less processed.

### sports-stars-natural-ponds

- Asset: `public/assets/images/guides/sports-stars-natural-ponds.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-5f1249a3-4222-44b6-a6f3-405b522a2800.png`
- Subject: A towel casually draped on a chair beside sturdy pool-entry steps and a simple handrail leading into a dark natural swimming pond on a cool early autumn morning. Ordinary sheltered Nordic garden. No ice or mist or snow or people. Focus on safe convenient entry and calm water; understated early morning daylight.

Final prompt:

Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation.
SUBJECT: A towel casually draped on a chair beside sturdy pool-entry steps and a simple handrail leading into a dark natural swimming pond on a cool early autumn morning. Ordinary sheltered Nordic garden. No ice or mist or snow or people. Focus on safe convenient entry and calm water; understated early morning daylight.

### can-i-use-water-storage-solutions-when-traditional-wells-arent-an-option

- Asset: `public/assets/images/guides/can-i-use-water-storage-solutions-when-traditional-wells-arent-an-option.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-6244e7e2-3d28-4665-948c-a1c13aff45f5.png`
- Subject: Rainwater collection in a compact Nordic garden. A simple covered dark rain barrel connected to a shed downpipe with a small tap near the base, watering can placed alongside. A recently wet garden path and plants, soft daylight after rain. Clearly a covered storage vessel not drinking water. No branding, diagrams, words or people.

Final prompt:

Use case: precise-object-edit. Preserve this photograph's composition, garden, light, colours and soft natural optical treatment. Fix only the downpipe connection: the dark shed downpipe should enter a snug round fitting in the barrel lid so rain flows INTO the covered barrel, rather than onto a closed lid. Keep the barrel covered, tap and watering can unchanged. No text or extra objects. Wide 3:2.

### creating-harmony-intergrating-water-features-with-your-landscape

- Asset: `public/assets/images/guides/creating-harmony-intergrating-water-features-with-your-landscape.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-870f5b34-b2d5-4065-8a5c-f6505ebd6f2c.png`
- Subject: Informal curving gravel garden path connecting a small sitting area to an irregular pond. Irregular mixed planting and naturally weathered wood bench, modest brown brick house partly visible. Human-sized ordinary Scandinavian garden. Broad landscape, pond belongs to the garden rather than dominating it. No people or symmetrical estate garden.

Final prompt:

Use case: style-transfer. EDIT IMAGE 1; IMAGE 2 is the approved photography STYLE reference only. Preserve image 1 subject, composition, aspect ratio and meaningful objects. Do not import people or location from image 2. Remove the artificial HDR rendering substantially. A normal unprocessed single-exposure candid photograph with camera sharpening off. Soft natural daylight, restrained neutral colour, no golden cast. Lower local microcontrast greatly; foliage, timber and stone have gentle optical detail, not etched texture. Real shadows lose detail rather than being lifted. Bright highlights can wash out. Keep the meaningful subject in gentle focus with believable distance-based falloff, background recognisable, no heavy blur or portrait halos. Natural water reflections, no glowing water. No tone mapping, cinematic grading, oversharpening, artificial grain, haze, vignettes or glossy advertising effect. Preserve anatomy and physical plausibility. No added text or marks. Output wide 3:2. Reduce crunchy surface texture even more on stones, grass, leaves and wood. Make the dark tree and hedge masses in the far background simple and optically soft, with lost detail. This should visibly look less processed.

### small-features-for-small-spaces

- Asset: `public/assets/images/guides/small-features-for-small-spaces.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-30ae2317-f36c-4e64-b74e-0d15e1ea0b72.png`
- Subject: A very small enclosed courtyard with one chair and a compact gently bubbling stone water bowl among two planted pots and climbing foliage. Realistic domestic dimensions, weathered pale brick walls, no grand pool, no waterfall, no theatrical mist. Intimate but recognisable space under soft daylight.

Final prompt:

Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation.
SUBJECT: A very small enclosed courtyard with one chair and a compact gently bubbling stone water bowl among two planted pots and climbing foliage. Realistic domestic dimensions, weathered pale brick walls, no grand pool, no waterfall, no theatrical mist. Intimate but recognisable space under soft daylight.

### algae-control-and-maintenance-tips

- Asset: `public/assets/images/guides/algae-control-and-maintenance-tips.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-8de0e4ab-52de-4412-b564-5a47838e9709.png`
- Subject: Close documentary detail of a modest strand of green filamentous algae attached to a submerged stone at a garden pond margin. Water clear enough to see the stone and a few algae threads, nearby reeds softly recognisable. Useful restrained maintenance image, no filthy pond or slime fantasy or glowing colour. Natural cool reflected daylight.

Final prompt:

Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation.
SUBJECT: Close documentary detail of a modest strand of green filamentous algae attached to a submerged stone at a garden pond margin. Water clear enough to see the stone and a few algae threads, nearby reeds softly recognisable. Useful restrained maintenance image, no filthy pond or slime fantasy or glowing colour. Natural cool reflected daylight.

### how-filtering-works-with-nature-pools

- Asset: `public/assets/images/guides/how-filtering-works-with-nature-pools.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-0de0bb9b-facc-4f01-8565-a3928f464898.png`
- Subject: Close view along a shallow planted gravel filtration bed beside a natural swimming pool. Gently flowing water among rounded gravel and aquatic stems, a small plain outflow at the far end. Camera close to waterline, meaningful focus on clean water crossing gravel. No swimmingpool landscape reprise, diagrams, glowing water, people or equipment labels.

Final prompt:

Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation.
SUBJECT: Close view along a shallow planted gravel filtration bed beside a natural swimming pool. Gently flowing water among rounded gravel and aquatic stems, a small plain outflow at the far end. Camera close to waterline, meaningful focus on clean water crossing gravel. No swimmingpool landscape reprise, diagrams, glowing water, people or equipment labels.

### why-you-should-get-a-natural-pool

- Asset: `public/assets/images/guides/why-you-should-get-a-natural-pool.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-9ff16d42-b3ed-4a8f-b5f5-b6f62bb69c58.png`
- Subject: Candid two ordinary adults having a relaxed breakfast at a small garden table near their natural swimming pool after a swim. One towel over a chair, casual clothing, relaxed gesture passing a cup, nobody looks at the camera. Different people and garden than any reference. Modest red brick home, mixed planting. Gentle midmorning daylight, not luxurious resort advertising.

Final prompt:

Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation.
SUBJECT: Candid two ordinary adults having a relaxed breakfast at a small garden table near their natural swimming pool after a swim. One towel over a chair, casual clothing, relaxed gesture passing a cup, nobody looks at the camera. Different people and garden than any reference. Modest red brick home, mixed planting. Gentle midmorning daylight, not luxurious resort advertising.

### how-faunapoolen-helps-golf-clubs-manage-ponds-lakes-and-streams

- Asset: `public/assets/images/guides/how-faunapoolen-helps-golf-clubs-manage-ponds-lakes-and-streams.webp`
- Selected original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-9e438622-7eb9-4e02-a113-7bf2b67c26a1.png`
- Subject: Groundskeeper in practical plain work clothes inspecting the planted bank of a modest golf-course pond. Fairway visible beyond with one tiny distant flag, rough grasses along water. Person crouches on dry firm ground looking at reeds, no dangerous reach or brand logos. Everyday overcast outdoor management photograph, no posed golfer or sparkling luxury course.

Final prompt:

Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation.
SUBJECT: Groundskeeper in practical plain work clothes inspecting the planted bank of a modest golf-course pond. Fairway visible beyond with one tiny distant flag, rough grasses along water. Person crouches on dry firm ground looking at reeds, no dangerous reach or brand logos. Everyday overcast outdoor management photograph, no posed golfer or sparkling luxury course.

## In-article photographs — 3 October 2026

Generated nine new, guide-only photographs with the built-in Imagegen tool. The subjects follow the adjacent section: construction materials, water roles and maintenance access on a golf course, fountain pump access, and five stages of pool conversion. These replace unrelated in-article photographs in English, Swedish and Danish (26 image positions). The Danish DIY article historically has no inline image and retains that structure.

Original supplier and case-study assets remain untouched. Generated scenes are explanatory imagery, never installation evidence. Captions and alt text describe the visible subject and are localized. Output was encoded as WebP at quality 85 without colour, sharpening or blur processing.

### build-materials

- Saved asset: `public/assets/images/guides/inline/build-materials.webp`
- Original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-98e9a508-ebd0-4521-83f1-5fa63ffb3869.png`
- Dimensions: 1536 × 1024

Prompt:

> Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation. Keep texture especially gentle: no crisp-everywhere gravel or etched foliage. Prioritise soft overcast or open-shade daylight, natural restrained saturation and shadows with real lost detail. Wide 1536x1024 composition.
> SUBJECT: A practical nature pool construction budget: roll of dark waterproof pond liner, a few open sacks of rounded gravel and one small unbranded circulation pump laid out on a dry workbench beside a partly excavated garden pool. A simple notebook at one corner, no legible writing. Materials are meaningful focus, ordinary private garden softly recognisable beyond. No people, power connections or glossy product staging.

### golf-water-role

- Saved asset: `public/assets/images/guides/inline/golf-water-role.webp`
- Original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-e7504efb-daa7-423a-9098-5709200a60d2.png`
- Dimensions: 1536 × 1024

Prompt:

> Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation. Keep texture especially gentle: no crisp-everywhere gravel or etched foliage. Prioritise soft overcast or open-shade daylight, natural restrained saturation and shadows with real lost detail. Wide 1536x1024 composition.
> SUBJECT: Wide ordinary Swedish golf course pond, with open fairway beyond and a small connected drainage channel entering through grasses at one side. Natural water level and mixed planted margins, overcast daylight. Useful context for mapping water bodies and flows on a course. No golfer, dramatic scenery, giant boulders or resort setting.

### golf-maintenance-access

- Saved asset: `public/assets/images/guides/inline/golf-maintenance-access.webp`
- Original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-2eafd564-f121-488a-9fc7-ff6ee253fed3.png`
- Dimensions: 1536 × 1024

Prompt:

> Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation. Keep texture especially gentle: no crisp-everywhere gravel or etched foliage. Prioritise soft overcast or open-shade daylight, natural restrained saturation and shadows with real lost detail. Wide 1536x1024 composition.
> SUBJECT: A narrow firm gravel maintenance path along a golf-course pond. A small unbranded groundskeeping utility cart parked on dry path well back from water, low mixed reeds at bank, fairway beyond. Shows practical equipment access and protection of the bank. No people, logos, dramatic landscaping or earthworks.

### fountain-pump-access

- Saved asset: `public/assets/images/guides/inline/fountain-pump-access.webp`
- Original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-bde87793-ee21-4afc-ab9f-bd807e6780a4.png`
- Dimensions: 1536 × 1024

Prompt:

> Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation. Keep texture especially gentle: no crisp-everywhere gravel or etched foliage. Prioritise soft overcast or open-shade daylight, natural restrained saturation and shadows with real lost detail. Wide 1536x1024 composition.
> SUBJECT: Small freestanding stone bowl fountain in a modest planted courtyard beside a bench. At its base, a discreet dry service box has its lid lifted aside, showing a simple closed pump housing and intact water pipes. Plumbing believable, no exposed electrical wires. Main subject is practical access alongside fountain, not a diagram or exploded view.

### conversion-existing-shell

- Saved asset: `public/assets/images/guides/inline/conversion-existing-shell.webp`
- Original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-165f2e30-583c-4c26-beb9-186bcd8b7f83.png`
- Dimensions: 1448 × 1086

Prompt:

> undefined
> SUBJECT: Close three-quarter view of one corner of an existing conventional garden swimming pool: older grey concrete coping with a fine weathered surface crack above waterline, slightly faded blue lining, ordinary planting behind. Pool still clean and cared for, no grime or neglected green water. Documentary condition inspection, no people.

### conversion-filter-space

- Saved asset: `public/assets/images/guides/inline/conversion-filter-space.webp`
- Original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-5fdac498-af37-42e8-9046-d2e40c7b7ad9.png`
- Dimensions: 1536 × 1024

Prompt:

> undefined
> SUBJECT: A conventional rectangular garden pool beside an open grass strip marked out for a future filtration area with low wooden stakes and a measuring tape. Show spatial relationship of water and spare garden ground, enough practical access around the planned area. No people, diagrams, text or equipment hallucinations.

### conversion-retained-steps

- Saved asset: `public/assets/images/guides/inline/conversion-retained-steps.webp`
- Original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-d2b34857-8a76-4b17-aa30-bd170d170679.png`
- Dimensions: 1536 × 1024

Prompt:

> undefined
> SUBJECT: Detailed view of existing broad pool entry steps and intact handrail, grey coping and adjacent paving on a conventional rectangular garden pool. A simple closed skimmer cover visible at edge. Focus on existing elements being assessed for reuse; no demolition or maintenance hatch duplicate of guide hero. Soft neutral daylight, no people.

### conversion-site-access

- Saved asset: `public/assets/images/guides/inline/conversion-site-access.webp`
- Original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-7636d3e9-f0ea-44e8-83c4-5853a4228836.png`
- Dimensions: 1448 × 1086

Prompt:

> undefined
> SUBJECT: A small unbranded compact excavator parked safely on temporary ground protection boards in a modest garden, a narrow open timber side gate behind, edge of an existing swimming pool just visible beyond the path. Machinery off, nobody operating it. Shows access and ground protection as cost factors. Ordinary tidy site, no giant landscaping equipment.

### conversion-water-check

- Saved asset: `public/assets/images/guides/inline/conversion-water-check.webp`
- Original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-c1ca699e-0d7d-493f-962c-373a9114b8ff.png`
- Dimensions: 1536 × 1024

Prompt:

> Use case: photorealistic-natural. Create one wide 3:2 photograph for an informative garden guide. Subject below. Natural, ordinary candid photography with gentle optical rendering like an unprocessed camera photograph, HDR disabled. Soft daylight with real dark shadow areas, neutral restrained colours. No golden-hour treatment. Gentle detail in the important subject, background softens naturally but remains recognisable, no etched microtextures or sharp-everywhere foliage. Normal single exposure can lose shadow detail and wash out bright highlights. Do not tone-map or lift all shadows. No enhanced clarity, local contrast, oversharpening, glossy advertising, cinematic grading, artificial grain, lens vignetting, glowing water, heavy blur, text, logos or watermark. Attractive and cared-for ordinary gardens, incidental imperfections. Avoid the recurring black timber house and giant granite boulder motif; every scene should be its own place. No evidence claim about any real customer installation. Keep texture especially gentle: no crisp-everywhere gravel or etched foliage. Prioritise soft overcast or open-shade daylight, natural restrained saturation and shadows with real lost detail. Wide 1536x1024 composition.
> SUBJECT: Close candid detail of an adult hand holding a plain small clear water-sample container just above a natural swimming pool edge, with clean clear water inside. Other hand rests naturally on dry coping. No numbers, results, labels, brands or laboratory fantasy. Focus on collection of a sample as one part of commissioning, reeds and water softly recognisable behind. Plausible hands and reflections.

## Nature pool buying guide — 3 October 2026

Two original photographs generated with built-in Imagegen for the price guide. The cover also owns the index thumbnail, related card and Open Graph image. The in-article detail illustrates the material and planting choices discussed beside it. Both were reviewed for restrained colour, optical softness and plausible reflections. WebP encoding at quality 85 only; no sharpening or colour processing. Neither image claims to document a specific installation.

### naturpool-pris

- Saved: `public/assets/images/guides/naturpool-pris.webp`
- Original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-9039147c-ef8f-4439-9dbf-c62ca7d48642.png`
- Prompt:

> Use case: photorealistic-natural. Create one landscape 1536x1024 editorial photograph for a Swedish nature-pool buying guide. A modest beautifully composed natural swimming pool in an ordinary lived-in southern Swedish garden, viewed slightly obliquely from the patio: modest stone coping, clear dark reflective water with natural ripples, an adjacent planted shallow edge, shrubs and a light grey rendered cottage glimpsed in the distance. A simple chair and towel quietly suggest daily use, no people. Visually explain a whole pool with edges and garden space, not a giant luxury estate. Available open-shade daylight, neutral restrained colour, authentic single-exposure camera look. Gentle optical detail and a slightly softer recognisable background, real dark shadows that lose detail and occasional pale highlights. Absolutely no HDR, tone mapping, shadow recovery, etched foliage, clarity, enhanced local contrast, oversharpening, glowing turquoise water, golden cinematic grading, artificial grain, or heavy bokeh. Informal framing, appealing but unstyled and not perfectly manicured. No text, logos, watermarks, diagrams or price labels. This is explanatory editorial imagery, no claim of a customer installation.

### price-stone-and-planting

- Saved: `public/assets/images/guides/inline/price-stone-and-planting.webp`
- Original: `/Users/wolfie/.codex/generated_images/01a10173-999d-7471-8a0c-8107ef256a8b/exec-d333e494-f93b-49db-9bdd-9ebeae0d9773.png`
- Prompt:

> Use case: photorealistic-natural. Create one landscape 1536x1024 candid editorial photograph illustrating material choices and the pool edge in a nature-pool price guide. Close but informal view of a believable natural swimming pool edge: a few broad pale grey natural stone slabs form the coping, with varied modest rounded stones at a nearby shallow planted corner; green aquatic leaves, a small patch of flowering irises, plain surrounding garden path and reflective water. No huge dramatic boulders, no construction diagram, no people. Focus on the meeting of stone, plants and water, background garden gently softer but still recognisable. Soft available overcast daylight, restrained neutral colour, ordinary single-exposure camera photograph with real dark shadows, gentle optical detail. Absolutely no HDR, tone mapping, shadow lifting everywhere, local contrast enhancement, crunchy stone textures, etched leaves, excessive sharpening, luminous water, cinematic grading, artificial grain, heavy bokeh. Materials look cared for with incidental natural weathering. No text, price labels, logos or watermark. Explanatory imagery, not documentary evidence of a specific completed project.
