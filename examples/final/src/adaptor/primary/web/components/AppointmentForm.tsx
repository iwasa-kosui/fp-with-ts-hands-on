import { Link, useForm } from "@inertiajs/react";
import { useState } from "react";

import { ServiceCode, ServiceMenu, type ServiceCode as ServiceCodeValue } from "../../../../domain/appointment/serviceCode.js";
import { buttonClassName } from "./Button.js";
import { FormField } from "./FormField.js";
import type { FieldErrors } from "../pageProps.js";

export type AppointmentOwnerOption = Readonly<{ ownerId: string; name: string }>;
export type AppointmentPetOption = Readonly<{ petId: string; ownerId: string; name: string }>;
export type AppointmentVeterinarianOption = Readonly<{ veterinarianId: string; name: string }>;
export type AppointmentFormValues = Readonly<{
  ownerId: string;
  petId: string;
  scheduledAt: string;
  serviceCode: ServiceCodeValue;
  durationMinutes: string;
  assignedVeterinarianId: string;
  reason: string;
  receptionNote: string;
  expectedVersion: string;
}>;

const serviceOptions = [
  ["GeneralConsultation", "一般診療"],
  ["FollowUpVisit", "再診"],
  ["Vaccination", "予防接種"],
  ["ExaminationOrProcedure", "検査・処置"],
] as const satisfies readonly (readonly [ServiceCodeValue, string])[];

export const suggestedDurationAfterServiceChange = (
  serviceCode: ServiceCodeValue,
  durationManuallyChanged: boolean,
  currentDuration: number,
): number => durationManuallyChanged
  ? currentDuration
  : ServiceMenu.defaultDuration(serviceCode);

export const toAppointmentTimestamp = (localDateTime: string): string => {
  if (localDateTime === "") return "";
  const timestamp = new Date(localDateTime);
  return Number.isNaN(timestamp.valueOf()) ? localDateTime : timestamp.toISOString();
};

export const toLocalAppointmentDateTime = (timestamp: string): string => {
  const value = new Date(timestamp);
  if (Number.isNaN(value.valueOf())) return timestamp;
  const local = new Date(value.valueOf() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

type Props = Readonly<{
  action: string;
  ariaLabel?: string;
  backHref: string;
  errors: FieldErrors;
  initialValues?: Partial<AppointmentFormValues>;
  immutablePetAndService?: boolean;
  method: "post" | "put";
  mode: "Reserved" | "WalkIn";
  owners: readonly AppointmentOwnerOption[];
  pets: readonly AppointmentPetOption[];
  submitLabel: string;
  veterinarians: readonly AppointmentVeterinarianOption[];
}>;

export const AppointmentForm = (props: Props) => {
  const form = useForm<AppointmentFormValues>({
    ownerId: props.initialValues?.ownerId ?? "",
    petId: props.initialValues?.petId ?? "",
    scheduledAt: props.initialValues?.scheduledAt ?? "",
    serviceCode: props.initialValues?.serviceCode ?? "GeneralConsultation",
    durationMinutes: props.initialValues?.durationMinutes ?? "30",
    assignedVeterinarianId: props.initialValues?.assignedVeterinarianId ?? "",
    reason: props.initialValues?.reason ?? "",
    receptionNote: props.initialValues?.receptionNote ?? "",
    expectedVersion: props.initialValues?.expectedVersion ?? "",
  });
  const [durationManuallyChanged, setDurationManuallyChanged] = useState(false);
  const availablePets = props.pets.filter((pet) => pet.ownerId === form.data.ownerId);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    form.transform((data) => ({
      ...data,
      ...(props.mode === "Reserved"
        ? { scheduledAt: toAppointmentTimestamp(data.scheduledAt) }
        : { scheduledAt: "" }),
    }));
    form[props.method](props.action, { forceFormData: true });
  };
  return (
    <form aria-label={props.ariaLabel ?? props.submitLabel} className="form-stack" onSubmit={submit}>
      {form.data.expectedVersion === "" ? null : (
        <input name="expectedVersion" type="hidden" value={form.data.expectedVersion} />
      )}
      <FormField {...(props.errors.ownerId === undefined ? {} : { error: props.errors.ownerId })} field="ownerId" label="飼い主">
        <select aria-describedby={props.errors.ownerId === undefined ? undefined : "ownerId-error"} aria-invalid={props.errors.ownerId === undefined ? undefined : true} id="ownerId" name="ownerId" onChange={(event) => { form.setData("ownerId", event.target.value); form.setData("petId", ""); }} value={form.data.ownerId}>
          <option value="">選択してください</option>
          {props.owners.map((owner) => <option key={owner.ownerId} value={owner.ownerId}>{owner.name}</option>)}
        </select>
      </FormField>
      <FormField {...(props.errors.petId === undefined ? {} : { error: props.errors.petId })} field="petId" label="ペット">
        <select aria-describedby={props.errors.petId === undefined ? undefined : "petId-error"} aria-invalid={props.errors.petId === undefined ? undefined : true} disabled={form.data.ownerId === "" || props.immutablePetAndService} id="petId" name="petId" onChange={(event) => form.setData("petId", event.target.value)} value={form.data.petId}>
          <option value="">選択してください</option>
          {availablePets.map((pet) => <option key={pet.petId} value={pet.petId}>{pet.name}</option>)}
        </select>
      </FormField>
      {props.mode === "Reserved" ? (
        <FormField {...(props.errors.scheduledAt === undefined ? {} : { error: props.errors.scheduledAt })} field="scheduledAt" label="予約日時">
          <input aria-describedby={props.errors.scheduledAt === undefined ? undefined : "scheduledAt-error"} aria-invalid={props.errors.scheduledAt === undefined ? undefined : true} id="scheduledAt" name="scheduledAt" onChange={(event) => form.setData("scheduledAt", event.target.value)} step="60" type="datetime-local" value={form.data.scheduledAt} />
        </FormField>
      ) : null}
      <FormField {...(props.errors.serviceCode === undefined ? {} : { error: props.errors.serviceCode })} field="serviceCode" label="診療メニュー">
        <select aria-describedby={props.errors.serviceCode === undefined ? undefined : "serviceCode-error"} aria-invalid={props.errors.serviceCode === undefined ? undefined : true} disabled={props.immutablePetAndService} id="serviceCode" name="serviceCode" onChange={(event) => {
          const serviceCode = ServiceCode.schema.parse(event.target.value);
          form.setData("serviceCode", serviceCode);
          form.setData("durationMinutes", String(suggestedDurationAfterServiceChange(serviceCode, durationManuallyChanged, Number(form.data.durationMinutes))));
        }} value={form.data.serviceCode}>
          {serviceOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </FormField>
      <FormField {...(props.errors.durationMinutes === undefined ? {} : { error: props.errors.durationMinutes })} field="durationMinutes" label="所要時間">
        <select aria-describedby={props.errors.durationMinutes === undefined ? undefined : "durationMinutes-error"} aria-invalid={props.errors.durationMinutes === undefined ? undefined : true} id="durationMinutes" name="durationMinutes" onChange={(event) => { setDurationManuallyChanged(true); form.setData("durationMinutes", event.target.value); }} value={form.data.durationMinutes}>
          {[15, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes}分</option>)}
        </select>
      </FormField>
      <FormField {...(props.errors.assignedVeterinarianId === undefined ? {} : { error: props.errors.assignedVeterinarianId })} field="assignedVeterinarianId" label="担当獣医師">
        <select aria-describedby={props.errors.assignedVeterinarianId === undefined ? undefined : "assignedVeterinarianId-error"} aria-invalid={props.errors.assignedVeterinarianId === undefined ? undefined : true} id="assignedVeterinarianId" name="assignedVeterinarianId" onChange={(event) => form.setData("assignedVeterinarianId", event.target.value)} value={form.data.assignedVeterinarianId}>
          <option value="">担当医未定</option>
          {props.veterinarians.map((veterinarian) => <option key={veterinarian.veterinarianId} value={veterinarian.veterinarianId}>{veterinarian.name}</option>)}
        </select>
      </FormField>
      <FormField {...(props.errors.reason === undefined ? {} : { error: props.errors.reason })} field="reason" label="来院理由">
        <textarea aria-describedby={props.errors.reason === undefined ? undefined : "reason-error"} aria-invalid={props.errors.reason === undefined ? undefined : true} id="reason" name="reason" onChange={(event) => form.setData("reason", event.target.value)} value={form.data.reason} />
      </FormField>
      {props.mode === "WalkIn" ? (
        <FormField {...(props.errors.receptionNote === undefined ? {} : { error: props.errors.receptionNote })} field="receptionNote" label="受付メモ">
          <textarea aria-describedby={props.errors.receptionNote === undefined ? undefined : "receptionNote-error"} aria-invalid={props.errors.receptionNote === undefined ? undefined : true} id="receptionNote" name="receptionNote" onChange={(event) => form.setData("receptionNote", event.target.value)} value={form.data.receptionNote} />
        </FormField>
      ) : null}
      <div className="form-actions">
        <Link className={buttonClassName("secondary")} href={props.backHref}>戻る</Link>
        <button aria-busy={form.processing || undefined} className={buttonClassName()} disabled={form.processing} type="submit">{form.processing ? "送信中…" : props.submitLabel}</button>
      </div>
    </form>
  );
};
