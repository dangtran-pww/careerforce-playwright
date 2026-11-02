# Booking an appointment

Job seekers can book a one-on-one appointment with CareerForce staff. They search for open times near them, choose how to meet (in person, online or by phone), say what they'd like to discuss, and book. Job seekers who haven't finished their full profile are asked to complete it first, and their chosen time is held for them while they do.

## Who uses it

- **Anyone** can search for appointments.
- **Job seekers** can book. Partner and staff accounts see a message saying they can't.

## How it works

**1. Search** (`/connect-careerforce/schedule-an-appointment`)
- **Filters:** location and distance (10–100 miles), and format.
- **Dates:** a week view, Monday to Friday. On a weekend it opens on the next Monday.
- **Results:** grouped by location, with a button for each open time.
- **What's hidden:** booked and past times.

**2. Booking page** (`/appointments/{id}/booking`, login required)
What the job seeker sees depends on their situation:

| Situation | What they see |
|---|---|
| Not a job seeker | "No permission" message |
| Already booked at this time | Message with a link to their account |
| Held by someone else | "Reserved by another user, retry after {time}" |
| All seats at this time are taken | "Full" message |
| Profile not complete (below tier 2) | **Continue Booking** button. See step 3. |
| Ready to book | The booking form. See step 4. |

**3. Finishing the profile first**
1. The job seeker clicks **Continue Booking**.
2. The time is held for them for 15 minutes.
3. They complete the next profile step, then return to the booking page to finish.
4. Profile tiers are described in [../job-seeker-tools/job-seeker-registration-and-profile.md](../job-seeker-tools/job-seeker-registration-and-profile.md).

**4. The booking form**
- **Format:** in person, online or phone.
- **Phone number:** required only for phone appointments.
- **Topics:** up to 3 from a list, plus "Other" with a short description.

**5. Booked**
- The job seeker lands on **Your Appointment is Booked!** and receives a confirmation email.
- If several seats are open at the same time, CareerForce books one that offers the chosen format.

**6. Managing their bookings**
- **My Events & Appointments** (`/user/{user}/events_appointments`) lists upcoming appointments, with a print version.
- Past appointments are at `/user/{user}/past_events_appointments`.
- Job seekers can cancel from there.

## Business rules

- Only job seekers can book, and they need a completed tier 2 profile.
- A held time is kept for 15 minutes.
- At most 3 topics; "Other" is limited to 200 characters.
- Phone numbers must be 10 digits, for example `555-555-5555`.
- The success page is only shown to the person who booked. Anyone else is sent to the search page or their own appointments.
- Ended or inactive slots can't be booked.

## Connected systems

| System | Used for |
|---|---|
| Registration service | Checks which times are free, holds and books times, cancels bookings, lists a job seeker's appointments, and sends confirmation emails. |
| Site search | Powers the appointment search page. |

## What admins can change

- **Booking messages** (`/admin/structure/appointments/occurrence`):
  - instructions,
  - button labels,
  - the messages for no permission, full, already booked and reserved,
  - how long a time is held (default 15 minutes).
- **Topic list:** the "Booking appointment topic" taxonomy. Event Managers and Platform Managers can edit it.
- **Email templates:** managed in the Registration service settings (see [../events/](../events/)).

## Known issues

- **Held times may not block other job seekers.** A time held by one job seeker appears not to stop others from booking it, so the "reserved by another user" message may not show as described.
- **"Other" topic escaping:** text typed into "Other" is stored with special characters escaped. For example, `&` becomes `&amp;`.

---
*Built in: `cf_appointments`, `appointments`, `registration_api` modules.*
