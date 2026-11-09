import dashboardSource from "../../../../../packages/clinic-web/src/ClinicDashboard.tsx?raw";
import s03Routes from "../../../../../examples/session-03/src/adaptor/primary/web/routes.ts?raw";
import s04Errors from "../../../../../examples/session-04/src/useCase/errors.ts?raw";
import s04PersistenceError from "../../../../../examples/session-04/src/adaptor/secondary/sqlite/appointmentPersistenceError.ts?raw";
import s04Routes from "../../../../../examples/session-04/src/adaptor/primary/web/routes.ts?raw";
import s04UseCase from "../../../../../examples/session-04/src/useCase/startExamination.ts?raw";
import solutionApp from "../../../../../examples/session-04-solution/src/app.ts?raw";
import solutionErrors from "../../../../../examples/session-04-solution/src/useCase/errors.ts?raw";
import solutionRoutes from "../../../../../examples/session-04-solution/src/adaptor/primary/web/routes.ts?raw";
import solutionUseCase from "../../../../../examples/session-04-solution/src/useCase/startExamination.ts?raw";
import handlerSource from "../../sessions/solutions/session-04-start-examination-handler.ts.txt?raw";
import { quote } from "../../sessions/reference-quote";

export const paths = {
  s03Routes: "examples/session-03/src/adaptor/primary/web/routes.ts",
  s04Routes: "examples/session-04/src/adaptor/primary/web/routes.ts",
  s04UseCase: "examples/session-04/src/useCase/startExamination.ts",
  solutionErrors: "examples/session-04-solution/src/useCase/errors.ts",
  solutionUseCase: "examples/session-04-solution/src/useCase/startExamination.ts",
  solutionRoutes: "examples/session-04-solution/src/adaptor/primary/web/routes.ts",
  solutionApp: "examples/session-04-solution/src/app.ts",
} as const;

export const routeBefore = quote(s03Routes, 111, 126, "StartExaminationInput.parse");

export const routeAfterInput = quote(s04Routes, 75, 78, "StartExaminationInput.parse");
export const routeAfterCall = quote(s04Routes, 80, 86, "startExamination({");
export const routeAfter = `${routeAfterInput}\n${routeAfterCall}`;
export const routeCatch = quote(s04Routes, 88, 93, "} catch (error) {");

export const useCaseBody = quote(s04UseCase, 17, 29, "const appointment = ensureAppointmentFound(");

export const throwNotFound = quote(s04Errors, 9, 9, "throw new Error");
export const throwInvalidState = quote(s04Errors, 19, 19, "throw new Error");
export const throwPersistence = quote(s04PersistenceError, 8, 8, "super(");

export const errorTypes = quote(solutionErrors, 6, 16, "export type AppointmentNotFound");
export const ensureFound = quote(solutionErrors, 18, 24, "export const ensureAppointmentFound");
export const ensureCheckedIn = quote(solutionErrors, 26, 31, "export const ensureCheckedIn");

export const pipelineBody = quote(solutionUseCase, 29, 44, "ensureAppointmentFound(");
export const pipelineResultType = quote(solutionUseCase, 28, 28, "(input: StartExaminationInput)");

export const noticeTable = quote(solutionRoutes, 24, 31, "type StartExaminationNoticeCode");
export const noticeSwitch = quote(solutionRoutes, 40, 47, "switch (error.kind)");
export const matchCall = quote(handlerSource, 14, 21, "return result.match");
export const onErrorLine = quote(solutionApp, 34, 34, "app.onError");

export const noticeMessage = (kind: "InvalidAppointmentState" | "AppointmentNotFound"): string => {
  const found = new RegExp(`${kind}: "([^"]+)"`).exec(dashboardSource);
  if (found === null || found[1] === undefined) throw new Error(`お知らせの文言が見つかりません: ${kind}`);
  return found[1];
};

export const isErrPipeline = `const startExamination =
  (deps: Dependencies) =>
  (input: StartExaminationInput): Result<
    InExamination,
    StartExaminationError
  > => {
    const found = ensureAppointmentFound(
      deps.resolver.resolveById(input.appointmentId),
      input.appointmentId,
    );
    if (found.isErr()) {
      return err(found.error);
    }

    const checkedIn = ensureCheckedIn(found.value);
    if (checkedIn.isErr()) {
      return err(checkedIn.error);
    }

    const next = transitionToInExamination(
      checkedIn.value,
      input.veterinarianId,
      input.examinationStartedAt,
    );
    deps.store.save(next);
    return ok(next);
  };`;

export const pipelineFull = quote(solutionUseCase, 26, 44, "export const startExamination");
