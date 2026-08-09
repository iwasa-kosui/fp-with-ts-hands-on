import type { UseFormSubmitOptions } from "@inertiajs/core";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

type FakeFormState = {
  selection: string[];
  options: UseFormSubmitOptions | undefined;
};

const fakeFormState = vi.hoisted<FakeFormState>(() => ({
  selection: ["75000000-0000-4000-8000-000000000001"],
  options: undefined,
}));

vi.mock("@inertiajs/react", () => ({
  Link: () => null,
  useForm: () => ({
    get data() {
      return { appointmentIds: fakeFormState.selection };
    },
    processing: false,
    post: (_url: string, options: UseFormSubmitOptions) => {
      fakeFormState.options = options;
    },
    reset: () => {
      fakeFormState.selection = [];
    },
    setData: (_field: string, selection: string[]) => {
      fakeFormState.selection = selection;
    },
  }),
}));

import FollowUpsIndex from "../../src/adaptor/primary/web/pages/FollowUps/Index.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { UserId } from "../../src/domain/user/userId.js";

type InspectableProps = Readonly<{
  children?: ReactNode;
  disabled?: boolean;
  onSubmit?: (event: Readonly<{ preventDefault: () => void }>) => void;
}>;

const elementsIn = (node: ReactNode): readonly ReactElement<InspectableProps>[] => {
  const elements: ReactElement<InspectableProps>[] = [];
  const collect = (candidate: ReactNode): void => {
    if (!isValidElement<InspectableProps>(candidate)) return;
    elements.push(candidate);
    Children.forEach(candidate.props.children, collect);
  };
  collect(node);
  return elements;
};

const submitAndButton = () => {
  const page = FollowUpsIndex({
    auth: {
      user: {
        userId: UserId.schema.parse("76000000-0000-4000-8000-000000000001"),
        role: "Receptionist",
      },
    },
    errors: {},
    flash: {},
    followUps: [
      {
        appointmentId: AppointmentId.schema.parse(
          "75000000-0000-4000-8000-000000000001",
        ),
        ownerName: "Hanako Owner",
        ownerPhone: "090-1234-5678",
        petId: PetId.schema.parse("74000000-0000-4000-8000-000000000001"),
        requested: false,
      },
    ],
  });
  const elements = elementsIn(page);
  return {
    button: elements.find((element) => element.type === "button"),
    submit: elements.find((element) => element.type === "form")?.props.onSubmit,
  } as const;
};

describe("follow-up batch interaction", () => {
  test("retains the selected action after an error and resets it only after success", () => {
    const initial = submitAndButton();
    expect(initial.button?.props.disabled).toBe(false);
    initial.submit?.({ preventDefault: () => undefined });

    fakeFormState.options?.onError?.({});
    expect(submitAndButton().button?.props.disabled).toBe(false);

    const onSuccess = fakeFormState.options?.onSuccess;
    if (onSuccess !== undefined) Reflect.apply(onSuccess, undefined, []);

    expect(fakeFormState.selection).toEqual([]);
    expect(submitAndButton().button?.props.disabled).toBe(true);
  });
});
