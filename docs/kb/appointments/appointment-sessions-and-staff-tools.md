# Appointment sessions and staff tools

CareerForce locations offer one-on-one appointments with job seekers. Staff set up an **appointment session**, a repeating schedule such as "every weekday at 10:00". CareerForce then creates individual **appointment slots** from it. Each slot can be booked by one job seeker. Staff use the tools in this doc to create schedules, manage slots and record what happened at each appointment. How job seekers book is described in [booking-an-appointment.md](booking-an-appointment.md).

## Who uses it

| Role | What they can do |
|---|---|
| Event Manager, Job Service Manager, Platform Manager | Manage appointments at any location, and cancel any booking |
| Job Service Administrator, Location Administrator | Manage appointments at the locations they're assigned to |
| Job seekers | Book slots and cancel their own bookings |

## How it works

**Creating a schedule**
1. Staff open a location's **Appointments** tab: `/group/{group}/location/{location}/location-appointments`.
2. They click **Create appointment** and fill in:
   - the repeat pattern,
   - meeting location,
   - staff member,
   - format (in person, online or phone),
   - phone numbers, video links and extra information.
3. CareerForce creates the slots, each 30 minutes long.

**Slots at the same time**
Several slots can share the same time and place, for example when several staff members are available at once. They show to job seekers as one time with several seats, and each seat can be booked once.

**Editing a single slot**
A slot normally follows its session. If staff change the meeting location, staff member, video link, extra information or status on one slot, that slot keeps its own value from then on, even when the session changes.

**Statuses**
- **Draft:** being set up, not visible to job seekers.
- **Active:** open for booking.
- **Cancelled:** no longer offered.

**Staff actions on a slot**
These buttons appear on the slot's page only when they make sense.

| Action | Shown when | What happens |
|---|---|---|
| **Add attendee** | The slot is active and not booked | Staff book the slot for a job seeker (tier 2 profile required), picking the format and an optional phone number. |
| **Cancel registration** | The slot is booked | Removes the booking after a confirmation box. |
| **Resend Confirmation** | Booked, in the future and not cancelled | Sends the job seeker their confirmation email again. |
| **Mark Attended** | The job seeker is registered | Opens a service record form pre-filled from the appointment. Saving it marks the job seeker as Attended (see [../services/service-records-and-catalog.md](../services/service-records-and-catalog.md)). |
| **Undo Attendance** | The job seeker is marked Attended | Deletes the service record and sets the booking back to Registered. |

## Business rules

- **Weekdays only:** slots are created Monday to Friday.
- **Booking horizon:** slots are created up to 32 days ahead, and job seekers can browse about 8 days ahead.
- **No past dates:** a new schedule must start in the future.
- **Shortening a schedule:** if moving the end date earlier would cancel slots that already have bookings, staff get a warning and the change is blocked.
- **Activating slots:** a Draft slot can't be made Active while its session is still Draft.
- **Late attendees:** staff can add an attendee to a slot that has already ended for up to 30 days afterwards.
- **Cancelling a session:** this does not cancel slots that are already Active.
- **Held slots:** while a job seeker is holding a slot to finish their profile, **Add attendee** is greyed out.

## Connected systems

| System | Used for |
|---|---|
| Registration service | Keeps the list of who is booked, holds slots, sends confirmation emails, and records attendance. Shared with events. |

Without the Registration service, booking, cancelling and attendance don't work.

## What admins can change

- **Session settings** (`/admin/structure/appointments/session`):
  - appointment length (default 30 minutes),
  - which services and sponsor appointments are recorded under,
  - the description.
- **Slot settings** (`/admin/structure/appointments/occurrence`):
  - the texts job seekers see while booking and cancelling,
  - which fields staff may change on a single slot.
- **All appointments:**
  - `/admin/content/appointments/appointment-session` lists every session,
  - `/admin/content/appointments/appointment-occurrence` lists every slot.

## Known issues

- **Appointment length on existing slots:** the setting's description says a new length affects only new appointments, but it also applies when an existing slot is edited.
- **Undo Attendance failures:** if the State's activity system can't delete the service record, Undo Attendance fails with "An error occurred while undoing attendance."
- **Sponsor not sent:** the sponsor is always sent to the State's activity system as "none".

---
*Built in: `appointments`, `cf_appointments`, `registration_api` modules.*
