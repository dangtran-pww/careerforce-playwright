# Event registration, waitlist and cancellation (job seeker)

Logged-in job seekers (profile type `career_seeker`) register for an event
occurrence in two steps. First a seat is **reserved**, then the user confirms
on a "Confirm Your Registration" page, choosing In-Person or Online for hybrid
events. Users without a complete Tier 2 profile are sent through profile
completion in between. When an event is full, **veterans** with a Tier 2
profile can join a **waitlist**. Registered users can cancel from the event
page. Drupal does not store any of this: every registration lives in the
external Registration API (see [registration-api-integration.md](registration-api-integration.md)).

## What users see

| Path | Page (Page Manager id) | Purpose |
|---|---|---|
| `/events/event-occurrence/{id}` | occurrence `full` display | Register / Continue Registration / Cancel Registration buttons; Join Waitlist; status messages |
| `/events/event-occurrence/{id}/registration` | `event_registration` ("Confirm Your Registration") | Complete Registration (format choice for hybrid), Finish Setting Up My Account |
| `/events/event-occurrence/{id}/registration-success` | `event_registration_success` | Confirmation |
| `/events/event-occurrence/{id}/waitlist` | `event_waitlist` ("Confirm Joining Waitlist") | Format choice for hybrid waitlist |
| `/events/event-occurrence/{id}/waitlist-success` | `event_waitlist_success` ("Waitlist Confirmed") | Confirmation |
| `/events/event-occurrence/{id}/cancel-registration` | form `CancelRegistrationConfirmForm` | Cancel confirmation, opened in a modal |
| `/user/{user}/events_appointments` | `my_events_appointments` | Dashboard of upcoming and past events and appointments (see [my-events-dashboard-and-printing.md](my-events-dashboard-and-printing.md)) |

Button labels come from `happenings.settings:registration_actions.plugins.*.button_text`:

| Plugin id | Button | Shown when (`isApplicable()`) |
|---|---|---|
| `cf_registration` | Register | Authenticated career seeker, not registered, no reservation, event not full |
| `cf_continue_registration` | Continue Registration | Career seeker who already holds a reservation |
| `cf_happenings_cancel_registration` | Cancel Registration | User has `cancel own happenings_occurrence registration` and is Registered |
| `cf_registration_confirmation` | Complete Registration | User holds a reservation; otherwise only when the event is not full and the user is **not** Tier 2 (see gotchas) |
| `cf_registration_finish_account` | Finish Setting Up My Account | Authenticated user who is not Tier 2 |
| `cf_join_waitlist` | Join Waitlist | Not on the `/waitlist` page; Tier 2 veteran; event full; not already waitlisted or registered |
| `cf_join_waitlist_confirmation` | Confirm Joining Waitlist | On the `/waitlist` page, same eligibility |
| `cf_waitlist_finish_account` | Continue Registration and Join Waitlist | Career seeker, event full, veteran, not Tier 2 |

Which plugins are enabled where (block `happenings_registration_actions`
placed in Layout Builder, `config/sync/core.entity_view_display.happenings_occurrence.happenings_occurrence.*.yml`):
- `full` (detail page): block 1 = Continue Registration, Register, Cancel
  Registration; block 2 = Waitlist Finish Account; block 3 = Join Waitlist.
- `registration`: Complete Registration; Finish Setting Up My Account; Join
  Waitlist.
- `waitlist`: Confirm Joining Waitlist.

Message blocks:
- **Event Registration Status Message** (`cf_happenings_registration_status_message`, on `full`):
  `registration.user_registered_text` for registered users;
  `registration.user_reserved_text` (token-replaced) for users holding a
  reservation.
- **Event Full Message** (`cf_happenings_event_full_message`, on `full` and
  `registration`): `registration.event_full_text` when the event is full and
  the user is not waitlisted. Default text: "This event is full! CareerForce
  offers priority service to Veterans…".
- **Waitlist Dashboard Link** (`happenings_waitlist_dashboard_link`, on `full`):
  `registration.waitlist_status_text` plus a "My Dashboard" button for
  waitlisted users.
- The `/registration` page title changes to **Join Waitlist** or **Event
  Full** when the event is full and the user has no reservation
  (`RegistrationConfirmationTitleCallback`).

## How it works

### Register (reserve, then confirm)

1. On the detail page the user clicks **Register** (`Registration::execute()`).
   If they hold no reservation yet, it calls
   `OccurrenceRegistrationService::register($occurrence, $user, isReservation: TRUE, ['formatTypes' => []])`
   (`POST /Registration/register`).
2. If the user's `profile_status` is Tier 2, they are redirected to
   `<current path>/registration`. Otherwise
   `ProfileTierHelper::setTier($user, 2, TRUE)` sets a temporary Tier 2
   target and the user goes to `careerforce_profile.register.form` (the next
   profile step) with `?destination=<path>/registration` and the warning
   "Please complete your profile to continue registering for events."
3. On `/registration`, **Complete Registration** (`RegistrationConfirmation::execute()`)
   calls `register()` again with `isReservation: FALSE` and `formatTypes`:
   the radio choice for hybrid events ("How will you be attending this
   event?" In-Person/Online, mapped to `InPerson`/`Online`), otherwise the
   single format of the event. On success it redirects to `/registration-success`.
4. If the API says the occurrence is unknown (error 1001), `register()` first
   pushes the occurrence (`notifyCreated()`) and retries once.

Messages for API errors are in `RegistrationServiceBase::register()`:
3001 "You are already registered for this session…", 3003 "…This session is
already full.", 3002/3004 "…This session is no longer available.", 3005
"This … is already being held for you.".

**Reservation lifetime.** `cf_happenings.settings:happenings_occurrence.event_reservation_duration`
(15 minutes) is used only to compute the
`reservation_end_time` token (registration date + duration) shown in the
"reserved" message. The code reviewed does not expire reservations itself;
the Registration API appears to do that (inferred).

### "Full" calculation

`OccurrenceRegistrationService::isRegistrationFull()` reads
`field_seats_available` on the occurrence. `0` or empty means unlimited (never
full). Otherwise: Registered + Waitlisted >= seats means full. For a user
**without** a reservation, other users' Reserved seats count too. For a user
**with** a reservation, they do not. Results are cached per request in the
service.

### Waitlist (veterans only)

- Eligibility (`JoinWaitlistActionTrait::isEligibleForWaitlist()`):
  authenticated, Tier 2, `UserProfileService::isVeteran()`, event full, not
  already waitlisted or registered.
- **Join Waitlist** on the detail page: for hybrid events, redirect to
  `/waitlist` to pick a format; otherwise call `doWaitlist()`
  (`POST /Registration/waitlist`) right away and go to `/waitlist-success`.
- `/waitlist` shows `registration.waitlist_note_text` and, for hybrid, the
  format radios; **Confirm Joining Waitlist** calls `doWaitlist()`.
- Non-Tier-2 veterans see **Continue Registration and Join Waitlist**
  (`WaitlistFinishAccount`), which sends them to profile completion with
  `destination` set to the detail page.

### Page guards

`HappeningsRegistrationSubscriber` runs on `KernelEvents::REQUEST`
(priority 30) for the four routes (also when Page Manager overrides them). It
reads the current user's statuses for the occurrence and redirects:

| Page | Stays if | Otherwise |
|---|---|---|
| `/registration` | Reserved or Waitlisted | Canceled/Attended → My Events dashboard; anything else → detail page |
| `/registration-success` | Registered | Reserved/Waitlisted → `/registration`; Canceled/Attended → dashboard; else detail |
| `/waitlist` | Event full (and none of the below) | Attended/Waitlisted → dashboard; Reserved → `/registration`; Registered → detail |
| `/waitlist-success` | Waitlisted | Attended → dashboard; Reserved → `/registration`; else detail |

Note that `/registration` keeps users who have **no** registration out, so a
user must hold a reservation (or be waitlisted) to reach it.

### Login and profile tiers

`CareerForceProfileSubscriber` registers `happenings.occurrence_registration_confirmation`,
`entity.happenings_occurrence.canonical` (and the appointment booking route)
as Tier 2 routes. When a career seeker logs in with an occurrence page as the
destination, `careerforce_profile` sets the temporary Tier 2 target, and the
subscriber rewrites the destination to that occurrence's `/registration` page.

### Cancel

The **Cancel Registration** button is a link that opens
`/events/event-occurrence/{id}/cancel-registration` in a 700px modal. Route
access (`CancelRegistrationConfirmForm::access()`, uncacheable) requires the
`cancel own happenings_occurrence registration` permission and a current
Registered status; otherwise it is forbidden. Submitting calls
`cancelAttendeeRegistration()` (`DELETE /Registration/Event/{id}/user/{uid}/cancel-registration`),
shows "Your registration has been cancelled.", and redirects to
`cf_happenings.settings:happenings_occurrence.cancel_registration.redirect_route`
(the My Events dashboard) with the current user's ID. The question, description
and Yes/No texts are configurable on the Occurrence settings form.

### Caching

The actions block and the status message block are `max-age 0`. API reads are
cached only per request (`RegistrationServiceBase::$cachedRegistrations`).
`doRegister()` invalidates the occurrence's cache tags after each
registration change. `EventFullMessageBlock` and `AdditionalTimesBlock` are
cached by occurrence and config tags, and their output depends on the current
user's reservation (inferred risk: a cached "full" state may be shown to a
user who holds a reservation).

## External services and integrations

- Registration API calls: `register` (reserve and confirm), `waitlist`,
  `get registrations` (status checks on every page view),
  `cancel-registration`. See [registration-api-integration.md](registration-api-integration.md).
- Audit hooks `event_register`, `event_waitlist` and `event_cancel` are
  invoked when the Stenographer recorder service is available. A reservation
  (`isReservation: TRUE`) is not audited.

## Configuration and permissions

- Message texts (`happenings.settings:registration.*`): edited on the
  Occurrence settings form `/admin/structure/events/event-occurrence`
  ("Registration Form Messages"), added by `cf_happenings` `FormHooks`.
- Button texts: `happenings.settings:registration_actions.plugins.*.button_text`
  (config only; no form was found for them).
- Enabling plugins per page: Layout Builder block configuration on the
  occurrence view displays.
- Permissions: `cancel own happenings_occurrence registration` (job seekers),
  `view happenings_occurrence` (route access for the four pages).

## Related

- [registration-api-integration.md](registration-api-integration.md)
- [event-attendee-management.md](event-attendee-management.md)
- [my-events-dashboard-and-printing.md](my-events-dashboard-and-printing.md)
- [event-search-and-detail-pages.md](event-search-and-detail-pages.md)
- ../accounts/ (profile tiers, `careerforce_profile`, veteran field)
- ../appointments/ (appointment booking uses the same API service base)
