# Service catalog and service records

Staff log the services they give a job seeker, such as an appointment or an event follow-up, as **service records**. Each record picks one or more **service items** from a site-wide **service catalog**. Records are sent to the State's activity system so DEED can report on them.

## Who uses it

| Role | What they can do |
|---|---|
| Job Service Administrator | Create and view service records, view the lists and record history |
| Job Service Manager | Everything above, plus edit and delete records and restore earlier versions |
| Event Manager | Manage the service catalog, create service records and edit their own records |
| Platform Manager | Everything |

The job seeker is the subject of each record. Access is also limited by location: staff generally work with records for the locations they are assigned to.

## How it works

**Pages**

| Page | Path | Notes |
|---|---|---|
| Service Catalog | `/admin/content/service-item` | The list of service items. **Add service to catalog** opens `/service-item/add`. |
| Service item | `/service-item/{id}` | Shows a **Last Recorded** date, which is the last time the item was used on a record. |
| Service Records | `/admin/content/service-record` | List of all records. Job Service Manager, Platform Manager and System Administrator only. |
| Services tab | `/user/{user}/services` | On a job seeker's account, for staff only. Hidden on your own account and on non-job-seeker accounts. |
| Add Service Record | `/user/{user}/services/service-record/add` | Titled "Add Service Record - {name}". |
| Service record | `/service-record/{id}` | Titled "Service Record - {label}", with edit, delete and revision history. |

**Adding a record**
1. Open the job seeker's **Services** tab and add a service record. Appointments offer **Mark Attended**, which opens the same form pre-filled (see [../appointments/appointment-sessions-and-staff-tools.md](../appointments/appointment-sessions-and-staff-tools.md)).
2. Choose the date, format (in person, online or phone), locations, staff member and one or more services.
3. Save. The title is set automatically to the job seeker's name and the date of service.

**The Services tab** also shows when the job seeker last used each online tool: Career Goals, Compare Skills, Employment Readiness, Interest Profiler, Job Search, Resume Builder and Skills Matcher, newest first. If the information can't be fetched it shows "No service accessed."

**Event attendance** records are created automatically when staff mark attendees at an event. They copy the event's locations, facilitator and services. See [../events/](../events/).

**Admin tools** (Platform Managers and others who administer service records)
- **Populate Service Record Activity Types** (`/admin/content/service-record/populate-activity-type`) fills in the activity type on older records that have none, and shows counts first. It can also clear every activity type, but only on non-production sites and after a confirmation.
- **Align Services on Service Records** (`/admin/content/service-record/align-service-items`) lists records with no activity type or with services that don't match their type.

## Business rules

- Every service item and record has an activity type: appointment or event.
- Service items move through Draft, Inactive and Active.
- The Services list on a new record offers only appointment items, and items with no activity type are left out. This includes records added after an event for an impromptu one-on-one.
- Service items are not allowed to be deleted unless an admin first turns on a setting.
- Records are sent to the State's activity system each time one is saved. They are not sent if the job seeker is excluded from the activities report, or if sending is switched off for the site.
- What is sent: the job seeker, date, staff member, whether that staff member is a veterans representative, center, format and the services with their codes. Appointment records are sent as attended appointments, event records as events, and stand-alone records as services.
- Deleting a record also deletes it in the State's system. If that fails, the delete is refused with "Unable to delete service record at this time." If the State's system no longer has it, the delete goes ahead.

## Connected systems

| System | Used for |
|---|---|
| State activity system (DEED/Azure profile data service) | Receives every service record for reporting. Sending is off by default and is switched on per site. See [../accounts/sending-profiles-to-mn-deed.md](../accounts/sending-profiles-to-mn-deed.md). |
| PWW Auditor | Supplies the last-used times on the Services tab. See [../platform-and-operations/](../platform-and-operations/). |

## What admins can change

- **Service item settings** (`/admin/structure/service-item`) and **service record settings** (`/admin/structure/service-record`).
- **Allow deleting service items:** off by default. The form says to turn it on only for a one-off delete, then off again.
- **Which location field decides access** to a record (currently the service location).
- **Who can do what:** through role permissions, including per-location permissions for assigned locations.

## Known issues

These are suspected from reading the code. Verify before filing.

- **Sponsor is always "none".** Appointment service records appear to always be sent to the State's activity system with the sponsor set to "none", whatever the appointment settings say. The same problem is listed in [../appointments/appointment-sessions-and-staff-tools.md](../appointments/appointment-sessions-and-staff-tools.md).
- **A failed delete in the State's system blocks local deletes.** Where sending is on, deleting a record, or using **Undo Attendance** on an appointment, appears to fail whenever the State's system returns an error.
- **The "Align Activity Types" button appears to do nothing.** It lists mismatched records, but pressing it changes none of them.
- **Event attendance records may not save cleanly.** The format on automatically created event records appears to use labels the format list doesn't accept, and these records appear not to be linked to appointments. Event attendance may also fail if an event has no catalog item.
- **Event Managers may lack a permission they appear to need.** "Edit own service record" is granted to Event Managers but may not be listed as a permission on the permissions page, so it may not be adjustable there.

---
*Built in: `cf_service` module.*
