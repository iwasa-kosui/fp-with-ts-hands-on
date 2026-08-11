# Session 02: 状態の語彙を固定する

## 事故

予約の状態を任意の文字列で更新すると、会計済みの来院を診察中へ戻せます。まず、チームが同じ状態語彙を使えていないことを問題として扱います。

## 守る不変条件

来院の状態は `Scheduled`、`CheckedIn`、`InExamination` のいずれかとして呼び分けます。状態遷移そのものは、まだこの段階では守りません。

## 採用する技法と限界

文字列リテラルの語彙を一箇所へ固定します。これは用語の揺れを防ぎますが、必要な情報や遷移元の制約は表現できません。次の session で `kind` を持つ状態型へ進みます。

## 検証と振り返り

```bash
pnpm --filter @fp-with-ts/clinic-session-02 typecheck
pnpm --filter @fp-with-ts/clinic-session-02 test
pnpm --filter @fp-with-ts/clinic-session-02 exercise
pnpm --filter @fp-with-ts/clinic-session-02 typecheck:exercise
```

通常の検証は成功します。演習は、次の状態モデルがまだないため意図的に失敗します。自分の業務で、同じ意味なのに複数の状態文字列が使われている箇所を一つ探してください。
