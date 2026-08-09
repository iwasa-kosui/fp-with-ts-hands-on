import type { ServiceCode } from "../../../../domain/appointment/serviceCode.js";

export const servicePresentation = (serviceCode: ServiceCode): string => {
  switch (serviceCode) {
    case "GeneralConsultation": return "一般診療";
    case "FollowUpVisit": return "再診";
    case "Vaccination": return "予防接種";
    case "ExaminationOrProcedure": return "検査・処置";
    default: return serviceCode satisfies never;
  }
};
