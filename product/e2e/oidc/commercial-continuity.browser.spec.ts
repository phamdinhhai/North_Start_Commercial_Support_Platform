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
  test.setTimeout(300000);
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
  const visibleConversation = projection.body.items.find(
    (item: any) => item.conversationId === conversationId,
  );
  expect(visibleConversation.associatedLeads.map((lead: any) => lead.leadId)).toContain(leadId);

  await page.goto("app/#/inbox");
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

  // Admin owns this synthetic Lead, so the canonical owner-only commands are
  // exercised through the actual React dialogs before handing responsibility to Sales.
  await page.getByRole("tab", { name: /Ngữ cảnh|Context/ }).click();
  await page.getByRole("button", { name: /Bổ sung|context/i }).click();
  await page.locator("#text").fill("Nhu cầu cần xác minh qua bằng chứng nguồn.");
  await page.locator("#reason").fill("Ghi nhận bối cảnh từ receipt.");
  await page.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  await expect(page.getByRole("status")).toContainText(/ghi nhận|PostgreSQL/i);

  await page.getByRole("button", { name: /Bàn giao Sales|handoff/i }).click();
  const recipientId = await page.locator("#recipient option").nth(1).getAttribute("value");
  expect(recipientId).toBeTruthy();
  await page.locator("#recipient").selectOption(recipientId!);
  await page.locator("#context").fill("Bàn giao cùng bằng chứng nguồn đã lưu.");
  await page.locator("#action").fill("Gọi lại và xác minh nhu cầu");
  await page.locator("#reason").fill("Chuyển trách nhiệm cho Sales.");
  await page.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  await expect(page.getByRole("status")).toContainText(/ghi nhận|PostgreSQL/i);

  const recipientContext = await browser.newContext();
  try {
    const recipient = await recipientContext.newPage();
    await signIn(recipient, "recipient");
    await recipient.goto(`app/#/leads/${leadId}/show`);
    await recipient.getByRole("tab", { name: /Công việc|Work/ }).click();
    await recipient.getByRole("button", { name: /Nhận bàn giao|Accept/i }).click();
    await expect(recipient.getByRole("status")).toContainText(/ghi nhận|PostgreSQL/i);

    await recipient.getByRole("button", { name: /Bắt đầu liên hệ|start contact/i }).click();
    await recipient.locator("#followUpImplication").fill("Theo dõi sau lần liên hệ.");
    await recipient.locator("#reason").fill("Đã liên hệ theo bàn giao.");
    await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
    await expect(recipient.getByRole("status")).toContainText(/ghi nhận|PostgreSQL/i);

    await recipient.getByRole("button", { name: /Chuyển sang theo dõi|follow-up/i }).click();
    await recipient.locator("#reason").fill("Cần tiếp tục theo dõi.");
    await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();

    await recipient.getByRole("button", { name: /Tạo công việc|next action/i }).click();
    await recipient.locator("#action").fill("Gửi tài liệu tổng hợp");
    await recipient.locator("#reason").fill("Bước tiếp theo đã thống nhất.");
    await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
    await recipient.getByRole("tab", { name: /Công việc|Work/ }).click();
    await expect(recipient.getByText("Gửi tài liệu tổng hợp")).toBeVisible();

    const workCard = recipient.getByText("Gửi tài liệu tổng hợp").locator("..", { has: recipient.getByRole("button", { name: /Dời lịch|reschedule/i }) });
    await workCard.getByRole("button", { name: /Dời lịch|reschedule/i }).click();
    await recipient.locator("#dueAt").fill("2030-01-02T09:00");
    await recipient.locator("#reason").fill("Khách hẹn lại thời gian.");
    await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
    await recipient.getByRole("tab", { name: /Công việc|Work/ }).click();
    await expect(recipient.getByText("Gửi tài liệu tổng hợp")).toBeVisible();

    const replacement = recipient.getByText("Gửi tài liệu tổng hợp").locator("..", { has: recipient.getByRole("button", { name: /Hoàn thành|complete/i }) });
    await replacement.getByRole("button", { name: /Hoàn thành|complete/i }).click();
    await recipient.locator("#declaration").fill("Tôi đã hoàn tất bước tiếp theo.");
    await recipient.locator("#reason").fill("Hoàn tất theo cam kết.");
    await recipient.locator("#confirmed").check();
    await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
    await recipient.getByRole("tab", { name: /Công việc|Work/ }).click();
    await expect(recipient.getByRole("button", { name: /Mở công việc kế tiếp|reopen/i })).toBeVisible();
    await recipient.getByRole("button", { name: /Mở công việc kế tiếp|reopen/i }).click();
    await recipient.locator("#reason").fill("Cần mở lại để bổ sung bằng chứng.");
    await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();

    await recipient.getByRole("button", { name: /Ghi nhận kết quả|outcome/i }).click();
    await recipient.locator("#value").selectOption("Won");
    await recipient.locator("#reason").fill("Khách xác nhận tiếp tục, claim chưa xác minh doanh thu.");
    await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
    await expect(recipient.getByText(/Won/)).toBeVisible();
    await recipient.getByRole("button", { name: /Đính chính|correct/i }).click();
    await recipient.locator("#value").selectOption("Unknown");
    await recipient.locator("#reason").fill("Chưa có bằng chứng đủ để giữ claim Won.");
    await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
    await recipient.getByRole("tab", { name: /Lịch sử|History/ }).click();
    await expect(recipient.getByText(/audit|UNVERIFIED|UNKNOWN/i).first()).toBeVisible();
  } finally {
    await recipientContext.close();
  }

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
