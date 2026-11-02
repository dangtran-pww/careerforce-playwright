# Employment Readiness Assessment (quizer)

A 12-question self-assessment at `/employment-readiness/take`. As the user picks an answer, a recommendation appears under the question. "Printable Version" opens a printable results page in a new tab. It is built on `quizer`, our own small framework for configurable quizzes stored as config entities. `employment_readiness` provides the quiz handler, route and permission.

## What users see
- `/employment-readiness/take`: the title is the quiz title ("Employment Readiness Assessment"), followed by instructions (quiz `intro`) and the questions grouped into five sections: About You, Computer and Basic Skills, Job Search Skills, Occupational Skills, Essential Work Skills. Every question is a radio list (`options` plugin).
- When an option is chosen, JS fetches `/quiz/employment_readiness_assessment/response/{question_id}?value={answer}` and shows "Recommendation based on your selection:" with the configured response text.
- **Printable Version:** the form has `target="_blank"`, so submitting opens a new tab with a full HTML page (theme suggestion `html__printable_page`). It shows the results intro, then each answered question with its number, text, chosen answer and recommendation, grouped by section. Empty sections are hidden.
- Who can use it: anonymous and authenticated users (permission `can take employment readiness assessment` is granted to both in `config/sync`).

## How it works
1. `QuizController::takeQuiz()` builds `UseQuizForm` with redirects disabled.
   - If the form was submitted with no errors and the handler implements `QuizWithResultsHandlerInterface`, it returns `buildResults()` (here a full `HtmlResponse`).
   - Otherwise it returns the form.
2. `EmploymentReadinessAssessment::buildQuiz()`:
   - For authenticated users it invokes `hook_employment_readiness_load` (counted by stenographer recorder `job_seeker_tools`).
   - It places each question plugin's element in its section, and attaches question JS settings and the job seeker tools tracker ([job-seeker-tools-tracker.md](job-seeker-tools-tracker.md)).
3. **Validation (`QuizHandlerBase::validateQuiz`):** `OptionsQuestion::validateAnswer()` returns an error only when the value is not one of the configured option keys. There are no "wrong" answers.
4. **`fetchResponse()`:** returns 404 for an unknown question, an empty value or an invalid answer. Otherwise it returns `{"response": "<rendered html>"}` as a `CacheableJsonResponse`, varying by route and `value` query arg and tagged with the quiz config.
5. **Question config:** each question is `{plugin, section, config: {question, description, options: {<key>: {answer, response: {value, format}}}}}`. Answer order follows the admin table drag weights.

`allow_live_answers: TRUE` in `employment_readiness.quizer.yml` is not read by any code. The live-response JS runs regardless.

## External services and integrations
None. Usage counting goes through stenographer (see [job-seeker-tools-tracker.md](job-seeker-tools-tracker.md)).

## Configuration and permissions
- Edit the assessment at `admin/structure/quizer/employment_readiness_assessment/edit`. It is linked from the CareerForce config menu as "Employment Readiness Assessment". Add a question at `admin/structure/quizer/employment_readiness_assessment/add/options`; edit one at `…/edit/{question_id}`. These need entity `update` access, which comes from the admin permission `administer quizer quizzes` (`site_admin`).
- `can take employment readiness assessment`: anonymous and authenticated.
- Quiz content is config (`quizer.quiz.employment_readiness_assessment`). Edits made in the UI must be exported, or the next config import will revert them.

## Related
- [job-seeker-tools-tracker.md](job-seeker-tools-tracker.md)
- `../content-authoring/` (the `/employment-readiness` info page linked from the intro has no route in custom code, so it appears to be regular content)
