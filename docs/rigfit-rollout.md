# Rig-Fit Rollout Guide

Scope: Enforce RV compatibility in availability (staff + public) using rigType and rigLength.

Behavior

- Availability endpoints accept `rigType` and `rigLength`; non-compatible sites are excluded/locked.
- Tent/cabin/car are treated as non-RV and bypass length checks; RV types require RV sites and must not exceed `rigMaxLength`.
- Holds and blackout/reservation conflicts already exclude sites separately.

Manual checks

- Query availability with an RV length > site rigMaxLength → site is absent/locked.
- Query with tent/cabin → sites remain.
- With hold present, site should be locked regardless of rig fit.
- Public booking fetch uses guest equipment to filter; admin availability honors rig fields.

Rollout/flags

- No flag wired; if needed, guard rig filtering behind config and default on.
- Monitor availability volume and error logs for BadRequest on invalid dates; rig checks are non-throwing (filter only).

Testing ideas

- Unit: rig compatibility helper (RV vs tent, length over max).
- Integration: availability excludes held and overlength sites; includes compatible ones.
- E2E: public booking with overlength RV shows no sites; lowering length shows sites.
