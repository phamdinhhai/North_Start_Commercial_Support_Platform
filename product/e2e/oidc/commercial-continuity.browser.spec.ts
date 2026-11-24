import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, account: string) {
  await page.goto("operator");
  await page.locator("#signin").click();
  await expect(page).toHaveURL(/127\.0\.0\.1:3411\/authorize/);
  await page.getByLabel("Account").selectOption(account);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#session-status")).toHaveText("Signed in.");
}

async function api(page: Page, path: string, init: RequestInit = {}) {
  return page.evaluate(
    async ({ path, init }) => {
      const session = await (await fetch("/v1/auth/session")).json();
      const response = await fetch(path, {
        ...init,
        credentials: "same-origin",
        headers: {
          ...(init.body
            ? {
                "content-type": "application/json",
                "X-CSRF-Token": session.csrfToken,
              }
            : {}),
          ...(init.headers ?? {}),
        },
      });
      return { status: response.status, body: await response.json() };
    },
    { path, init },
  );
}

test.skip(
  !process.env.COMMERCIAL_CONTINUITY_E2E,
  "run with playwright.commercial-continuity.config.ts",
);

test("React commercial continuity opens persisted Conversation and authorized Lead evidence", async ({
  page,
  browser,
}) => {
  await signIn(page, "admin");
  const connection = await api(page, "/v1/source-integrations/connections", {
    method: "POST",
    body: JSON.stringify({
      provider: "pancake",
      route: "pancake-synthetic",
      pageId: "commercial-continuity-page",
    }),
  });
  expect(connection.status).toBe(201);
  const connectionId = connection.body.id as string;
  const example = (
    await api(
      page,
      `/v1/source-integrations/connections/${connectionId}/example`,
    )
  ).body.fixture as Record<string, any>;
  const conversationId = `commercial-continuity-${crypto.randomUUID()}`;
  const receiptId = `commercial-continuity-receipt-${crypto.randomUUID()}`;
  const fixture = JSON.parse(JSON.stringify(example));
  fixture.receiptId = receiptId;
  delete fixture.originalMeta;
  fixture.payload.page_id = "commercial-continuity-page";
  fixture.payload.data.conversation = { id: conversationId, type: "INBOX" };
  fixture.payload.data.message = {
    ...fixture.payload.data.message,
    id: `commercial-continuity-message-${crypto.randomUUID()}`,
    page_id: "commercial-continuity-page",
    conversation_id: conversationId,
  };
  const intake = await api(
    page,
    `/v1/source-integrations/connections/${connectionId}/observations`,
    {
      method: "POST",
      body: JSON.stringify({ fixture, claimResponsibility: true }),
    },
  );
  expect(intake.status).toBe(201);
  const leadId = intake.body.leadId as string;
  expect(leadId).toMatch(/^[0-9a-f-]{36}$/i);

  const projection = await api(
    page,
    "/v1/source-integrations/conversations?limit=50",
  );
  expect(projection.status).toBe(200);
  expect(
    projection.body.items.some(
      (item: any) => item.conversationId === conversationId,
    ),
  ).toBe(true);

  await page.goto("app/");
  await page.getByRole("button", { name: /Conversation native/ }).click();
  await expect(page.getByTestId("inbox-page")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: conversationId, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Authority UNVERIFIED.*completeness UNKNOWN/).first(),
  ).toBeVisible();

  // The Lead route is opened directly to prove refresh/deep-link authorization is server enforced.
  await page.goto(`app/#/leads/${leadId}/show`);
  await expect(page.getByText(new RegExp(`Lead ID.*${leadId}`))).toBeVisible();
  await expect(
    page.getByText(/Doanh thu: UNKNOWN|Revenue: UNKNOWN/),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Lịch sử|History/ }).click();
  await expect(page.getByText(/UNVERIFIED|UNKNOWN/).first()).toBeVisible();

  const viewerContext = await browser.newContext();
  try {
    const viewer = await viewerContext.newPage();
    await signIn(viewer, "viewer");
    await viewer.goto(`app/#/leads/${leadId}/show`);
    await expect(
      viewer.getByText(/không có quyền|quyền truy cập|forbidden/i),
    ).toBeVisible();
  } finally {
    await viewerContext.close();
  }
});
