import { createInertiaApp, type ResolvedComponent } from "@inertiajs/react";
import type { Page } from "@inertiajs/core";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";

import OwnersForm from "../../src/adaptor/primary/web/pages/Owners/Form.js";
import OwnersIndex from "../../src/adaptor/primary/web/pages/Owners/Index.js";
import PetsForm from "../../src/adaptor/primary/web/pages/Pets/Form.js";
import PetsIndex from "../../src/adaptor/primary/web/pages/Pets/Index.js";
import UsersForm from "../../src/adaptor/primary/web/pages/Users/Form.js";
import UsersIndex from "../../src/adaptor/primary/web/pages/Users/Index.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { UserId } from "../../src/domain/user/userId.js";

const adminId = UserId.schema.parse(
  "76000000-0000-4000-8000-000000000001",
);
const ownerId = OwnerId.schema.parse(
  "73000000-0000-4000-8000-000000000001",
);
const petId = PetId.schema.parse(
  "74000000-0000-4000-8000-000000000001",
);
const sharedProps = {
  auth: { user: { userId: adminId, role: "Admin" as const } },
  flash: {},
} as const;

const renderPage = async (
  component: ResolvedComponent,
  props: Page["props"],
): Promise<string> => {
  const page = {
    component: "Test",
    props,
    url: "/test",
    version: "1",
    rescuedProps: [],
    flash: {},
    rememberedState: {},
  } satisfies Page;
  const result = await createInertiaApp({
    page,
    render: renderToString,
    resolve: () => component,
    setup: ({ App, props: appProps }) => <App {...appProps} />,
  });
  return result.body;
};

const expectAccessibleError = (
  html: string,
  field: string,
  message: string,
): void => {
  expect(html).toContain(`id="${field}-error"`);
  expect(html).toContain(`aria-describedby="${field}-error"`);
  expect(html).toContain("aria-invalid=\"true\"");
  expect(html).toContain(message);
};

describe("management page accessibility", () => {
  test("management indexes expose named tables, edit and delete actions, retained history, and empty states", async () => {
    const usersHtml = await renderPage(UsersIndex, {
      ...sharedProps,
      users: [{ userId: adminId, role: "Admin", name: "Clinic Admin", email: "admin@example.test" }],
      errors: {},
    });
    expect(usersHtml).toContain('aria-label="ユーザー一覧"');
    expect(usersHtml).toContain(`href="/users/${adminId}/edit"`);
    expect(usersHtml).toContain("編集");
    expect(usersHtml).toContain("削除");
    expect(usersHtml).toContain("監査履歴は保持されます");
    expect(usersHtml).toContain("個人情報の完全消去ではありません");
    expect(usersHtml).toContain("disabled");

    const ownersHtml = await renderPage(OwnersIndex, {
      ...sharedProps,
      owners: [{ ownerId, name: "Hanako Owner", email: "hanako@example.test", phone: "090-1234-5678" }],
      errors: {},
    });
    expect(ownersHtml).toContain('aria-label="飼い主一覧"');
    expect(ownersHtml).toContain(`href="/owners/${ownerId}"`);
    expect(ownersHtml).toContain("削除後も監査履歴は保持されます");

    const petsHtml = await renderPage(PetsIndex, {
      ...sharedProps,
      pets: [{ petId, ownerId, name: "Mugi", species: "Cat" }],
      errors: {},
    });
    expect(petsHtml).toContain('aria-label="ペット一覧"');
    expect(petsHtml).toContain(`href="/pets/${petId}"`);
    expect(petsHtml).toContain("診療・監査履歴は保持されます");
    expect(petsHtml).toContain("履歴の消去操作ではありません");

    const emptyUsersHtml = await renderPage(UsersIndex, {
      ...sharedProps,
      users: [],
      errors: {},
    });
    expect(emptyUsersHtml).toContain("ユーザーはいません。");
    expect(emptyUsersHtml).not.toContain('aria-label="ユーザー一覧"');

    const emptyOwnersHtml = await renderPage(OwnersIndex, {
      ...sharedProps,
      owners: [],
      errors: {},
    });
    expect(emptyOwnersHtml).toContain("飼い主はいません。");
    expect(emptyOwnersHtml).not.toContain('aria-label="飼い主一覧"');

    const emptyPetsHtml = await renderPage(PetsIndex, {
      ...sharedProps,
      pets: [],
      errors: {},
    });
    expect(emptyPetsHtml).toContain("ペットはいません。");
    expect(emptyPetsHtml).not.toContain('aria-label="ペット一覧"');
  });

  test("management forms name their modes and expose profile, password, owner, and pet boundaries", async () => {
    const userCreateHtml = await renderPage(UsersForm, {
      ...sharedProps,
      mode: "create",
      user: null,
      errors: {},
    });
    expect(userCreateHtml).toContain('aria-label="ユーザー作成"');
    expect(userCreateHtml).not.toContain("パスワードを再設定");

    const userEditHtml = await renderPage(UsersForm, {
      ...sharedProps,
      mode: "edit",
      user: { userId: adminId, role: "Admin", name: "Clinic Admin", email: "admin@example.test" },
      errors: {},
    });
    expect(userEditHtml).toContain('aria-label="プロフィール"');
    expect(userEditHtml).toContain('aria-label="パスワードを再設定"');

    const ownerEditHtml = await renderPage(OwnersForm, {
      ...sharedProps,
      mode: "edit",
      owner: { ownerId, name: "Hanako Owner", email: "hanako@example.test", phone: "090-1234-5678" },
      errors: {},
    });
    expect(ownerEditHtml).toContain('aria-label="飼い主編集"');
    expect(ownerEditHtml).toContain('id="name"');

    const petEditHtml = await renderPage(PetsForm, {
      ...sharedProps,
      mode: "edit",
      pet: { petId, ownerId, name: "Mugi", species: "Cat" },
      owners: [],
      errors: {},
    });
    expect(petEditHtml).toContain('aria-label="ペット編集"');
    expect(petEditHtml).toContain("飼い主 ID");
    expect(petEditHtml).not.toContain('name="ownerId"');

    const petCreateHtml = await renderPage(PetsForm, {
      ...sharedProps,
      mode: "create",
      pet: null,
      owners: [{ ownerId, name: "Hanako Owner" }],
      errors: {},
    });
    expect(petCreateHtml).toContain('name="ownerId"');
    expect(petCreateHtml).toContain("Hanako Owner");
  });

  test("user create and reset forms connect summaries and field errors to their controls", async () => {
    const createHtml = await renderPage(UsersForm, {
      ...sharedProps,
      mode: "create",
      user: null,
      errors: {
        form: "ユーザーを保存できませんでした。",
        name: "名前を確認してください。",
        email: "メールを確認してください。",
        role: "役割を確認してください。",
        password: "パスワードを確認してください。",
      },
    });
    expect(createHtml).toContain('role="alert"');
    expect(createHtml).toContain('aria-label="入力エラー"');
    expect(createHtml).toContain("ユーザーを保存できませんでした。");
    expectAccessibleError(createHtml, "name", "名前を確認してください。");
    expectAccessibleError(createHtml, "email", "メールを確認してください。");
    expectAccessibleError(createHtml, "role", "役割を確認してください。");
    expectAccessibleError(
      createHtml,
      "password",
      "パスワードを確認してください。",
    );

    const editHtml = await renderPage(UsersForm, {
      ...sharedProps,
      mode: "edit",
      user: {
        userId: adminId,
        role: "Admin",
        name: "Clinic Admin",
        email: "admin@example.test",
      },
      errors: {
        form: "パスワードを再設定できませんでした。",
        password: "新しいパスワードを確認してください。",
      },
    });
    expect(editHtml).toContain("パスワードを再設定できませんでした。");
    expectAccessibleError(
      editHtml,
      "password",
      "新しいパスワードを確認してください。",
    );
  });

  test("owner and pet create/edit forms expose accessible error summaries", async () => {
    const ownerHtml = await renderPage(OwnersForm, {
      ...sharedProps,
      mode: "edit",
      owner: {
        ownerId,
        name: "Hanako Owner",
        email: "hanako@example.test",
        phone: "090-1234-5678",
      },
      errors: {
        form: "この飼い主は削除できません。",
        name: "名前を確認してください。",
        email: "メールを確認してください。",
        phone: "電話番号を確認してください。",
      },
    });
    expect(ownerHtml).toContain('aria-label="入力エラー"');
    expect(ownerHtml).toContain("この飼い主は削除できません。");
    expectAccessibleError(ownerHtml, "name", "名前を確認してください。");
    expectAccessibleError(ownerHtml, "email", "メールを確認してください。");
    expectAccessibleError(ownerHtml, "phone", "電話番号を確認してください。");

    const petCreateHtml = await renderPage(PetsForm, {
      ...sharedProps,
      mode: "create",
      pet: null,
      owners: [{ ownerId, name: "Hanako Owner" }],
      errors: {
        form: "ペットを保存できませんでした。",
        ownerId: "飼い主を確認してください。",
        name: "名前を確認してください。",
        species: "種別を確認してください。",
      },
    });
    expect(petCreateHtml).toContain('aria-label="入力エラー"');
    expect(petCreateHtml).toContain("ペットを保存できませんでした。");
    expectAccessibleError(
      petCreateHtml,
      "ownerId",
      "飼い主を確認してください。",
    );
    expectAccessibleError(petCreateHtml, "name", "名前を確認してください。");
    expectAccessibleError(
      petCreateHtml,
      "species",
      "種別を確認してください。",
    );

    const petEditHtml = await renderPage(PetsForm, {
      ...sharedProps,
      mode: "edit",
      pet: { petId, ownerId, name: "Mugi", species: "Cat" },
      owners: [],
      errors: {
        form: "このペットは削除できません。",
        name: "名前を確認してください。",
        species: "種別を確認してください。",
      },
    });
    expect(petEditHtml).toContain("このペットは削除できません。");
    expectAccessibleError(petEditHtml, "name", "名前を確認してください。");
    expectAccessibleError(
      petEditHtml,
      "species",
      "種別を確認してください。",
    );
  });

  test("user deletion copy distinguishes projection deletion from retained audit history", async () => {
    const html = await renderPage(UsersIndex, {
      ...sharedProps,
      users: [
        {
          userId: adminId,
          role: "Admin",
          name: "Clinic Admin",
          email: "admin@example.test",
        },
      ],
      errors: { form: "自分自身のアカウントは削除できません。" },
    });

    expect(html).toContain("アカウントのプロジェクションを物理削除します");
    expect(html).toContain("監査履歴は保持されます");
    expect(html).toContain("個人情報の完全消去ではありません");
    expect(html).toContain("自分自身のアカウントは削除できません。");
    expect(html).toContain('role="alert"');
  });
});
