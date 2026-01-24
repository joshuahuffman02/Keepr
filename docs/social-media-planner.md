# Social Media Planner (no external AI)

Internal module to plan social content without posting directly to platforms. Suggestions are rule-based using campground data (occupancy, events, deals, seasonality, simple history) — no paid AI APIs.

## Capabilities

- Calendar: month/week/list views, drag/drop-ready list, parking lot, auto-slot helper, platform tags (FB/IG/TikTok/Email/Blog), statuses (draft/scheduled/needs image/needs approval/ready), filters by category.
- Post builder: tone presets (short/funny/warm/promo/story) applied locally, hashtags, image prompts, notes, attachments via URLs, template apply.
- Suggestions: refreshable ideas for occupancy, deals, events, seasonal, historical, plus weekly bundles every Monday 7am via cron.
- Weekly ideas: 3-post bundle (promo/engagement/behind-the-scenes) with cadence (Tue/Thu/Sat starter).
- Template library: content types and styles (clean promo, story vertical, photo+quote, carousel outline, comparison, countdowns) with hashtag sets and fill-ins.
- Content bank: photos/videos/logos/design elements/branded captions with tags; suggestions prioritize these assets.
- Reporting: posts/templates counts, open suggestions, manual performance inputs (reach/likes/comments/shares/saves).
- Strategy & alerts: monthly/annual plan, hero content, top ideas; opportunity alerts (weather, occupancy, events, deals, reviews, inactivity, inventory).

## Rule-based signals (examples)

- Occupancy: >85% upcoming → countdown/cabin push; <40% holiday window → spotlight availability.
- Events: low signups → reminder; approaching event → teaser/behind-the-scenes.
- Deals: active promotions with low usage → carousel explainer.
- Seasonal: Halloween build-up in October; pool opening in June.

## Endpoints (Nest)

- `/social-planner/posts|templates|assets|suggestions|weekly|strategies|alerts|performance|reports` — guarded by JWT; see controller for payloads. Cron: Monday 7am weekly ideas.

## Frontend entry points

- `/social-planner` overview with tiles; subpages for calendar, builder, suggestions, weekly, templates, content bank, reports, and strategy/alerts.
