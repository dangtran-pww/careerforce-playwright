# [Functional] - Header and Navigation - Test Plan

Status: implemented
Implemented test: tests/functional/site-wide/header-navigation.spec.ts

## Overview

This plan tests the parts of the page header and site navigation that every
page shares, so a break shows up everywhere, not on one feature. For now it
has one case: the "Skip to main content" link, which lets a keyboard or
screen reader user jump past the header menu (HN-1, moved from GN-4 in
[](../smoke/smoke-public-site.md)). The main menu, the header search box and
the phone menu are still checked by the Smoke suite (GN-3, SR-5 and MB-1 in
the same plan); cases for them in depth go here as they are written.

Every case runs as a visitor who isn't logged in and changes nothing, so the
plan is safe on QA, Stage and Production.

## Login

| **Every case** | Visitor, not logged in |
|---|---|

## Test cases

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| HN-1 | Skip to main content | `/` | 1. Press Tab once. 2. Press Enter. 3. Press Tab again. | 1. The "Skip to main content" link shows. 2. The page goes to the main content (`#main-content`). 3. Focus lands inside the main content, not in the header menu. |

## Good to know

- **The skip link is hidden until it has focus.** It is the first Tab stop
  on the page and only shows once Tab reaches it, so HN-1 checks that it
  shows at full size after the first Tab.

## Mobile

Every case runs on desktop (project `desktop`) and on an emulated phone
(Pixel 7, project `mobile`), and on the phone each case also checks that
the page doesn't scroll sideways.
