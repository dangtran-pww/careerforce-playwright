# [Suite] - Site-wide

Checks the features that appear on every page rather than belonging to
one feature: the header, main menu and footer, site search, translation,
the 404 page, the inactivity logout and other shared parts of the site.
So far it has the header and navigation plan and the auto logout plan.

**Order:** 7

## Plans

Every plan is safe on Production. Header and navigation runs as a
visitor; auto logout needs the `admin` login.

| Plan | Projects |
|---|---|
| functional-site-wide-header-navigation | (default) |
| functional-site-wide-auto-logout | desktop |
