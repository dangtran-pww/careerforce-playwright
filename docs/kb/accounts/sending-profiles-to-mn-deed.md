# Sending profiles to MN DEED

CareerForce sends account profiles to Minnesota DEED's profile system, so DEED has an up-to-date record of the people using CareerForce. Job seeker profiles are sent as they register, and staff and partner accounts are sent whenever they change. Nobody uses this directly; it runs in the background when people save their profile or when staff edit accounts.

## Who it affects

| Who | What is sent | When |
|---|---|---|
| Job seekers | Name, preferred name, email, address and the answers from their registration steps. The Social Security number only if they entered one and agreed to share it. | Each time they save a registration or profile step |
| State staff and partners | Name, email, user type (Staff, Location Partner or Training Provider), organization, primary location, whether they are a veterans' representative, and whether the account is active | When their account or profile is created or changed, and when the account is deleted (sent as no longer active) |

## How it works

**Job seekers**
1. The job seeker fills in step 1 of registration, including their Social Security number if they choose to.
2. CareerForce sends the profile to DEED. If DEED rejects the Social Security number, the job seeker sees the error on step 1 and must fix it before continuing.
3. Until the full (tier 2) profile is complete, only the step 1 and demographic answers are sent.
4. Once the full profile is complete, the whole profile is sent, and CareerForce records that the profile has been submitted.

**Staff and partners**
Every time a staff or partner account changes, its details are sent again so DEED's copy stays current. Deleting the account tells DEED it is no longer active.

**If DEED's system is down**
For staff and partner changes, and for job seeker steps after step 1, the save still goes through and the failure is logged for developers. On step 1, the job seeker sees a "temporary system failure" message.

## Business rules

- Nothing is sent for accounts marked **Exclude from activities report**.
- Pending staff and partner accounts are not sent until they become Active (see [account-states-and-expiration.md](account-states-and-expiration.md)).
- Partner profiles without a user type are not sent.
- A job seeker's Social Security number is sent only if they agreed to share it.
- CareerForce waits up to 10 seconds for DEED to respond, so a slow DEED system makes saving slower.
- The same connection is also used to pre-fill registration from other State systems (see [../job-seeker-tools/registration-prefill.md](../job-seeker-tools/registration-prefill.md)).

## Connected systems

| System | Used for |
|---|---|
| MN DEED profile system | Receives job seeker, staff and partner profiles, and checks Social Security numbers |

Sending is switched off in local and test setups by default. On hosted environments, the address of DEED's system, the access key and which kinds of profile are sent are managed in AWS settings, not in CareerForce.

## What admins can change

- **Profile data request settings** (`/admin/config/careerforce/careerforce_profile/data-request`): the address of DEED's system, access keys, and whether each kind of profile is sent.
  - On hosted environments the AWS settings override this page. Changes saved here have no effect there, and the page doesn't show the values actually in use.

## Known issues

- **Partial profiles sent during tier 2:** while a job seeker works through the tier 2 steps, each save appears to send their step 1 answers again. The intended behavior is to send nothing until tier 2 is complete.
- **Missing sign-in ID for staff:** a staff account with no linked State sign-in appears to be sent with an empty sign-in ID, instead of leaving that field out.
- **Primary location from one fixed group:** a staff member's primary location is read from their membership in one specific location group set in the code. Locations in any other group are not sent.

Each of these was found by reading the code. Verify before filing.

---
*Built in: `careerforce_profile` module.*
