# Social posts

The private `/admin/social-posts` page is a list filtered by Pending and Published. A post remains
pending until the owner marks each selected platform published. These checkboxes record manual
publication; the application does not publish to external accounts.

Ben supplies text, selects platforms and optionally attaches one image or video. Platform versions
start with his text. Existing versions remain independent when the source changes. Editing a saved
post saves automatically. Published versions must be unmarked before editing. The same framework
navigation, tabs, fields, file upload, sliders and sidebar layout serve this page. Framing composes
existing controls; it does not introduce a replacement framework component or theme.

## Media

FFmpeg and FFprobe are required on the web host, reachable in `/opt/homebrew/bin`, `/usr/local/bin`,
`/usr/bin` or `/bin`. The owner approved this dependency on 2026-09-16. Image exports are JPEG;
video exports are H.264/AAC MP4 with the selected fit/crop and explicit trim. Original bytes stay in
SQLite and are never modified. Private temporary processing files are removed after each request.
No media is put under public assets. The processor accepts JPEG, PNG, MP4/MOV and WebM signatures,
refuses other input, disables network protocols, and bounds duration, dimensions, time and output.

The page accepts one file per post, up to 100 MB and ten minutes for video. Collection bounds are
500 posts and 2 GB total source media. Capacity errors refuse new work without evicting posts.
Only one media conversion runs per web process at a time. Failed conversions can be requested again;
they have no paid effect. A preview is approximate platform appearance, not an external platform UI.

## Text policies

Reviewed on 2026-09-16. These are export checks for the supported formats, not promises about every
account or publishing surface. Facebook's 20,000-character cap is explicitly a tool limit. LinkedIn
uses a conservative 3,000 UTF-16-unit ceiling from
[LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a522483/differences-between-posting-updates-and-publishing?lang=en).
Instagram uses 2,200 UTF-16 units and a conservative five-hashtag ceiling. Its image formats here
are square, 4:5 and 16:9; video also supports 9:16. The Meta reference could not be retrieved during
this implementation (HTTP 429), so these conservative policies require rechecking before widening
support: [Instagram media reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/).
YouTube uses a 100-unit title and 5,000-byte UTF-8 description, excluding `<` and `>`, from
[YouTube's video reference](https://developers.google.com/youtube/v3/docs/videos). The vertical
Short preset caps length at three minutes, matching [YouTube Help](https://support.google.com/youtube/answer/15424877?hl=en-GB). Platform account permissions and music rights remain
outside this file preparation tool.

## Optional AI

Adapt text is an explicit paid-work admission and remains unavailable while the existing
`CAMPAIGN_GENERATION_ENABLED` gate is disabled. The web never reads the worker key or constructs a
provider. The existing worker runs the social job alongside campaign jobs using the same scoped,
fenced queue and existing Responses provider. No new model or provider is introduced.

Saved suggestions are applied manually per platform, protecting intervening edits. Identical input
returns its existing adaptation. The existing product-wide quota (30 admitted actions per ten minutes, shared with campaign work)
and 1,000 retained adaptations are hard bounds; each adaptation permits at most two provider effects
(the existing provider allows one output correction). Effects persist request identity, provider
response identity and completed output. Ambiguous requests cannot be created again by automatic
retry. The worker can reuse a completed receipt during bounded recovery; it never needs to pay
again to recover that result. These operational records do not introduce history screens.

## Storage and delivery

Migration 14 adds social posts, original media, adaptations and effects to the existing database.
It is append-only. The shared Mac mini store requires the coordinated offline maintenance flow in
`SERVER-STANDARD.md`: stop every writer, verify a backup, migrate, select compatible runtimes, then
restart. Source preparation and synthetic verification do not authorise shared-store activation.
The existing personal-Mac owner development mode remains isolated and disables paid work.

The new route inherits `/admin`, `/en/admin` and `/da/admin` robots exclusions and response headers;
its Angular route explicitly uses private SEO. API endpoints are authenticated, origin-guarded,
non-cacheable and registered before browser fallback. Revisions protect concurrent changes.
