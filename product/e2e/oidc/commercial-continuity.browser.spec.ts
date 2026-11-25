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
  const visibleConversation = projection.body.items.find(
    (item: any) => item.conversationId === conversationId,
  );
  expect(visibleConversation.associatedLeads.map((lead: any) => lead.leadId)).toContain(leadId);
  const expectedUtterance = visibleConversation.messages[0].utterance;

  await page.goto("app/#/inbox");
  await page.getByRole("button", { name: /Conversation native/ }).click();
  await expect(page.getByTestId("inbox-page")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: conversationId, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Authority UNVERIFIED.*completeness UNKNOWN/).first(),
  ).toBeVisible();
  const conversationCard = page.locator("article").filter({ has: page.getByRole("heading", { name: conversationId, exact: true }) });
  const associatedLeadLink = conversationCard.getByTestId(`conversation-lead-${leadId}`);
  await expect(associatedLeadLink).toHaveAttribute("href", `#/leads/${leadId}/show`);
  await associatedLeadLink.click();
  await expect(page).toHaveURL(new RegExp(`#?/leads/${leadId}/show`));
  await expect(page.getByText(new RegExp(`Lead ID.*${leadId}`)).last()).toBeVisible();

  // The Lead route is opened directly to prove refresh/deep-link authorization is server enforced.
  await page.goto(`app/#/leads/${leadId}/show`);
  await expect(page.getByText(new RegExp(`Lead ID.*${leadId}`)).last()).toBeVisible();
  await expect(
    page.getByText(/Doanh thu: UNKNOWN|Revenue: UNKNOWN/),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Lịch sử|History/ }).click();
  await expect(page.getByText(/UNVERIFIED|UNKNOWN/).first().last()).toBeVisible();
  const leadEvidence = await api(page, `/v1/pilot/leads/${leadId}/evidence`);
  expect(leadEvidence.status).toBe(200);
  expect(leadEvidence.body.items[0].rawPayload.utterance).toBe(expectedUtterance);
  await page.getByRole("button", { name: /Bằng chứng gốc|source evidence/i }).click();
  await expect(page.locator("pre")).toContainText(expectedUtterance);

  // The source intake is Admin-owned by the canonical synthetic claim. Admin
  // may mutate only while remaining the persisted owner; recipient identity is
  // resolved from its signed session, never guessed from fixture ordering.
  const recipientContext = await browser.newContext();
  const recipient = await recipientContext.newPage();
  await signIn(recipient, "recipient");
  const recipientSession = await recipient.evaluate(async () => (await (await fetch("/v1/auth/session")).json()));
  const recipientId = recipientSession.context.userId as string;
  await page.getByRole("tab", { name: /Ngữ cảnh|Context/ }).click();
  await page.getByRole("button", { name: /Bổ sung|context/i }).click();
  await page.locator("#text").fill("Nhu cầu cần xác minh qua bằng chứng nguồn.");
  await page.locator("#reason").fill("Ghi nhận bối cảnh từ receipt.");
  await page.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  await expect(page.getByRole("status")).toContainText(/ghi nhận|PostgreSQL/i);
  await page.getByRole("button", { name: /Bàn giao Sales|handoff/i }).click();
  await page.locator("#recipient").selectOption(recipientId);
  await page.locator("#context").fill("Bàn giao cùng bằng chứng nguồn đã lưu.");
  await page.locator("#action").fill("Gọi lại và xác minh nhu cầu");
  await page.locator("#reason").fill("Chuyển trách nhiệm cho Sales.");
  await page.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  await expect(page.getByRole("status")).toContainText(/ghi nhận|PostgreSQL/i);
  await recipient.goto(`app/#/leads/${leadId}/show`);
  await recipient.getByRole("tab", { name: /Công việc|Work/ }).click();
  await expect(recipient.getByRole("button", { name: /Nhận bàn giao|Accept/i })).toBeVisible();
  await recipient.getByRole("button", { name: /Nhận bàn giao|Accept/i }).click();
  await recipient.locator("#reason").fill("Recipient accepts responsibility.");
  const acceptResponse = recipient.waitForResponse(response => response.url().includes(`/v1/pilot/leads/${leadId}/commands/accept`) && response.request().method() === "POST");
  await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  const accepted = await acceptResponse;
  expect(accepted.status(), await accepted.text()).toBe(201);
  await expect(recipient.getByRole("button", { name: /Nhận bàn giao|Accept/i })).toHaveCount(0);
  const acceptedRead = await api(recipient, `/v1/pilot/leads/${leadId}`);
  expect(acceptedRead.status).toBe(200);
  expect(acceptedRead.body.lead.owner).toBe(recipientId);
  expect(acceptedRead.body.workItems.some((item: any) => item.actor === recipientId && item.status === "accepted")).toBe(true);
  expect(acceptedRead.body.version).toBeGreaterThan(3);
  const acceptedTimeline = await api(recipient, `/v1/pilot/leads/${leadId}/timeline`);
  expect(acceptedTimeline.status).toBe(200);
  expect(acceptedTimeline.body.history.map((event: any) => event.eventType)).toEqual(expect.arrayContaining(["handoff_created", "lead_transition"]));

  // Stage B: contact attempt, stage follow-up and an independent next action.
  await recipient.getByRole("button", { name: /Bắt đầu liên hệ|start contact/i }).click();
  await recipient.locator("#reason").fill("Bắt đầu giai đoạn liên hệ.");
  const contactingResponse = recipient.waitForResponse(response => response.url().includes(`/v1/pilot/leads/${leadId}/commands/advance`) && response.request().method() === "POST");
  await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  expect((await contactingResponse).status()).toBe(201);
  await recipient.getByRole("button", { name: /Ghi nhận liên hệ|contact/i }).click();
  await recipient.locator("#followUpImplication").fill("Theo dõi sau lần liên hệ.");
  await recipient.locator("#reason").fill("Đã liên hệ theo bàn giao.");
  const contactResponse = recipient.waitForResponse(response => response.url().includes(`/v1/pilot/leads/${leadId}/contact-attempts`) && response.request().method() === "POST");
  await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  expect((await contactResponse).status()).toBe(201);
  await recipient.getByRole("button", { name: /Chuyển sang theo dõi|follow-up/i }).click();
  await recipient.locator("#reason").fill("Cần tiếp tục theo dõi.");
  const followResponse = recipient.waitForResponse(response => response.url().includes(`/v1/pilot/leads/${leadId}/commands/advance`) && response.request().method() === "POST");
  await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  expect((await followResponse).status()).toBe(201);
  await recipient.getByRole("button", { name: /Tạo công việc|next action/i }).click();
  await recipient.locator("#action").fill("Gửi tài liệu tổng hợp");
  await recipient.locator("#reason").fill("Bước tiếp theo đã thống nhất.");
  const workResponse = recipient.waitForResponse(response => response.url().includes(`/v1/pilot/leads/${leadId}/next-actions`) && response.request().method() === "POST");
  await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  expect((await workResponse).status()).toBe(201);
  await recipient.getByRole("tab", { name: /Công việc|Work/ }).click();
  await expect(recipient.getByText("Gửi tài liệu tổng hợp").last()).toBeVisible();

  // Stage C: reschedule, complete and reopen the successor chain.
  await recipient.getByRole("button", { name: /Dời lịch|reschedule/i }).last().click();
  await recipient.locator("#dueAt").fill("2030-01-02T09:00");
  await recipient.locator("#reason").fill("Khách hẹn lại thời gian.");
  const rescheduleResponse = recipient.waitForResponse(response => response.url().includes("/reschedule") && response.request().method() === "POST");
  await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  expect((await rescheduleResponse).status()).toBe(201);
  await recipient.getByRole("tab", { name: /Công việc|Work/ }).click();
  await recipient.getByRole("button", { name: /Hoàn thành|complete/i }).last().click();
  await recipient.locator("#declaration").fill("Tôi đã hoàn tất bước tiếp theo.");
  await recipient.locator('input[name="confirmed"]').check();
  const completeResponse = recipient.waitForResponse(response => response.url().includes("/complete") && response.request().method() === "POST");
  await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  expect((await completeResponse).status()).toBe(201);
  await recipient.getByRole("tab", { name: /Công việc|Work/ }).click();
  await recipient.getByRole("button", { name: /Mở kế tiếp|reopen/i }).last().click();
  await recipient.locator("#reason").fill("Cần mở lại để bổ sung bằng chứng.");
  const reopenResponse = recipient.waitForResponse(response => response.url().includes("/reopen") && response.request().method() === "POST");
  await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  expect((await reopenResponse).status()).toBe(201);

  // Stage D: claim and correction preserve append-only outcome history.
  await recipient.getByRole("button", { name: /Ghi nhận kết quả|outcome/i }).click();
  await recipient.locator("#value").selectOption("Won");
  await recipient.locator("#reason").fill("Claim chưa xác minh doanh thu.");
  const outcomeResponse = recipient.waitForResponse(response => response.url().includes("/commands/outcome") && response.request().method() === "POST");
  await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  expect((await outcomeResponse).status()).toBe(201);
  await recipient.getByRole("tab", { name: /Ngữ cảnh|Context/ }).click();
  await recipient.getByRole("button", { name: /Đính chính|correct/i }).last().click();
  await recipient.locator("#value").selectOption("Unknown");
  await recipient.locator("#reason").fill("Chưa có bằng chứng đủ để giữ claim Won.");
  const correctionResponse = recipient.waitForResponse(response => response.url().includes("/correct") && response.request().method() === "POST");
  await recipient.getByRole("button", { name: /Ghi nhận|Record/i }).click();
  expect((await correctionResponse).status()).toBe(201);
  await recipient.getByRole("tab", { name: /Lịch sử|History/ }).click();
  await expect(recipient.getByText(/UNKNOWN|UNVERIFIED/).first()).toBeVisible();

  const managerContext = await browser.newContext();
  const manager = await managerContext.newPage();
  await signIn(manager, "bystander");
  await manager.goto(`app/#/leads/${leadId}/show`);
  await expect(manager.getByText(new RegExp(`Lead ID.*${leadId}`)).last()).toBeVisible();
  await manager.getByRole("tab", { name: /Lịch sử|History/ }).click();
  await expect(manager.getByText(/UNKNOWN|UNVERIFIED/).first()).toBeVisible();
  await managerContext.close();

  await recipientContext.close();

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
