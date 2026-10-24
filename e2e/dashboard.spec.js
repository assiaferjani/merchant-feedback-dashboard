import { utils, write } from "xlsx";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

const studentCsv =
  "\uFEFFID Étudiant;Matricule;Nom;Prénom;Formation;Total à payer;Total payé;Reste à payer;Prochaine échéance\nS1;M1;Fictif;Test;Sciences;1200;400;800;2026-09-15\n";
const scheduleCsv =
  "\uFEFFID Échéance;Matricule;Formation;Date d'échéance;Montant prévu;Montant payé;Statut;Date paiement;Mode règlement;Reste échéance;Jours retard\nE1;M1;Sciences;2026-08-01;500;200;Partiellement réglée;2026-08-02;Carte;300;0\n";
const errors = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));

async function connect(page, type, name, content) {
  await page
    .getByRole("button", { name: "Connecter un fichier", exact: true })
    .first()
    .click();
  await page.getByRole("radio", { name: new RegExp(type) }).check();
  await page.getByLabel("Fichier à connecter", { exact: true }).setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(content),
  });
  await expect(
    page.getByRole("dialog", { name: "Connecter une source" }),
  ).not.toBeVisible();
}

test("direct links, reload, browser history, and mobile navigation", async ({
  page,
}) => {
  await page.goto("/#/feedback");
  await expect(page.locator("h1")).toHaveText("Retours commerçants");
  await expect(page.locator(".commercial-metric-value").first()).toHaveText(
    "720",
  );
  await page
    .getByRole("button", { name: "Sources & paramètres", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/data-sources$/);
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Sources & paramètres");
  await page.goBack();
  await expect(page.locator("h1")).toHaveText("Retours commerçants");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Ouvrir la navigation" }).click();
  await page
    .getByRole("button", { name: "Vue d’ensemble", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ouvrir la navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("source hub loads without the chart library", async ({ page }) => {
  const charts = [];
  page.on("request", (request) => {
    if (/\/charts-[^/]+\.js/.test(request.url())) charts.push(request.url());
  });
  await page.goto("/#/data-sources");
  await expect(page.locator(".source-hub-card")).toHaveCount(5);
  expect(charts).toEqual([]);
});

test("worker imports, currency choice, dialog keyboard behavior, and persistence", async ({
  page,
}) => {
  await page.goto("/#/data-sources");
  await page
    .getByLabel("Devise des fichiers financiers", { exact: true })
    .selectOption("TND");
  await connect(page, "Dossiers étudiants", "students.csv", studentCsv);
  await expect(page.locator("h1")).toHaveText("Étudiants & inscriptions");
  await expect(page.locator(".commercial-metric-value").first()).toHaveText(
    "1",
  );
  await expect(page.locator(".commercial-metric-value").nth(1)).toContainText(
    "TND",
  );
  const trigger = page.getByRole("button", { name: "Consulter", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Détail étudiant" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Fermer Détail étudiant" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Fermer Détail étudiant" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await connect(page, "Échéancier des paiements", "schedule.csv", scheduleCsv);
  await expect(page.locator("h1")).toHaveText("Échéancier");
  await page.reload();
  await expect(page.locator(".commercial-metric-value").first()).toHaveText(
    "1",
  );
  await page.goto("/#/students");
  await expect(page.locator(".commercial-metric-value").first()).toHaveText(
    "1",
  );
  await page.goto("/#/data-sources");
  await expect(
    page.getByLabel("Devise des fichiers financiers", { exact: true }),
  ).toHaveValue("TND");
  await expect(page.getByText("students.csv", { exact: true })).toBeVisible();
  await expect(page.getByText("schedule.csv", { exact: true })).toBeVisible();
});

test("feedback search, sort, pagination, distinct exports, and saved filters", async ({
  page,
}) => {
  await page.goto("/#/feedback");
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await page
    .getByRole("button", { name: "Page suivante — Commentaires filtrés" })
    .click();
  await expect(page.locator(".table-pagination")).toContainText("26–50");
  await page
    .getByRole("button", { name: "Trier par Date", exact: true })
    .click();
  await expect(
    page.getByRole("columnheader", { name: /Date/ }),
  ).toHaveAttribute("aria-sort", "ascending");
  await page.getByRole("searchbox").fill("Attente");
  await expect(page.locator("tbody tr").first()).toContainText("Attente");
  await page.getByRole("searchbox").fill("");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: /Exporter tous les 694 commentaires filtrés/ })
    .click();
  const file = await download;
  const lines = readFileSync(await file.path(), "utf8")
    .trim()
    .split("\r\n");
  expect(lines).toHaveLength(695);
  const establishment = page.getByRole("combobox", {
    name: "Établissement",
    exact: true,
  });
  await establishment.selectOption({ index: 1 });
  const selected = await establishment.inputValue();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Établissement", exact: true }),
  ).toHaveValue(selected);
  await page.getByLabel("Date de début", { exact: true }).fill("2026-01-01");
  await page.reload();
  await expect(page.getByLabel("Date de début", { exact: true })).toHaveValue(
    "2026-01-01",
  );
});

test("commercial upload, oversized rejection, and safe deletion", async ({
  page,
}) => {
  await page.goto("/#/feedback");
  await connect(
    page,
    "Avis & activité commerciale",
    "feedback.csv",
    readFileSync("data/merchant_feedback_synthetic.csv", "utf8"),
  );
  await expect(page.locator(".toolbar-sources")).toContainText("Fichier local");
  await page.goto("/#/data-sources");
  await expect(page.getByText("feedback.csv", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Connecter un fichier", exact: true })
    .first()
    .click();
  await page.getByLabel("Fichier à connecter", { exact: true }).setInputFiles({
    name: "oversized.csv",
    mimeType: "text/csv",
    buffer: Buffer.alloc(20 * 1024 * 1024 + 1, "x"),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "20 Mo",
  );
  await page.keyboard.press("Escape");
  await page.getByLabel("Je souhaite effacer les imports enregistrés.").check();
  await page
    .getByRole("button", {
      name: "Effacer les imports enregistrés",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Les imports ont été supprimés de cet appareil.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("feedback.csv", { exact: true }),
  ).not.toBeVisible();
});

test("accessibility and responsive pages in both themes", async ({ page }) => {
  test.setTimeout(150_000);
  for (const theme of ["light", "dark"]) {
    await page.goto("/#/overview");
    if (
      (await page.locator(".commercial-shell").getAttribute("data-theme")) !==
      theme
    )
      await page.getByRole("button", { name: /Activer le mode/ }).click();
    for (const route of [
      "overview",
      "pipeline",
      "followups",
      "report",
      "revenue",
      "students",
      "schedule",
      "formations",
      "data-sources",
      "feedback",
    ]) {
      await page.goto("/#/" + route);
      await expect(page.locator("h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (route === "feedback")
        await expect(page.locator("tbody tr").first()).toBeVisible();
      await page.mouse.move(0, 0);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations, `${theme}/${route}`).toEqual([]);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          `${theme}/${route}/${width}`,
        ).toBe(false);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  }
});

test("larger CSV parsing remains local and restores after reloading", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const header =
    "IDENTITE_LEAD;DATE_AVIS;LIB_AVIS;RESPONSABLE;LIB_SOURCE_LEAD;EST_CLASSER;LIB_ETABLISSEMENT;LIB_REGION;COMMENTAIRE_LEAD_AVIS\n";
  const csv =
    header +
    Array.from(
      { length: 20_000 },
      (_, i) =>
        `ref-${i};2026-01-01;Catégorie A;Responsable test;Web;Brut;Établissement test;Région test;Commentaire fictif`,
    ).join("\n");
  await page.goto("/#/data-sources");
  await connect(page, "Avis & activité commerciale", "large-fixture.csv", csv);
  await expect(page.locator(".commercial-metric-value").first()).toHaveText(
    "20 000",
  );
  await page.reload();
  await expect(page.locator(".commercial-metric-value").first()).toHaveText(
    "20 000",
  );
  await expect(page.locator("tbody tr")).toHaveCount(25);
});

test("populated financial screens and student dialog remain accessible in both themes", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/#/data-sources");
  await connect(page, "Dossiers étudiants", "students.csv", studentCsv);
  await connect(page, "Échéancier des paiements", "schedule.csv", scheduleCsv);
  for (const theme of ["light", "dark"]) {
    if (
      (await page.locator(".commercial-shell").getAttribute("data-theme")) !==
      theme
    )
      await page.getByRole("button", { name: /Activer le mode/ }).click();
    for (const route of [
      "students",
      "schedule",
      "revenue",
      "formations",
      "data-sources",
    ]) {
      await page.goto("/#/" + route);
      await expect(page.locator("h1")).toBeVisible();
      if (route === "students")
        await page
          .getByRole("button", { name: "Consulter", exact: true })
          .click();
      await page.mouse.move(0, 0);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations, `${theme}/${route}/populated`).toEqual([]);
      if (route === "students") await page.keyboard.press("Escape");
    }
  }
});

test("comments without a valid date remain visible and exportable", async ({
  page,
}) => {
  const csv =
    "IDENTITE_LEAD;DATE_AVIS;LIB_AVIS;RESPONSABLE;LIB_SOURCE_LEAD;EST_CLASSER;LIB_ETABLISSEMENT;LIB_REGION;COMMENTAIRE_LEAD_AVIS\nR1;2026-01-01;A;Test;Web;Brut;Établissement;Région;Commentaire daté\nR2;inconnue;A;Test;Web;Brut;Établissement;Région;Commentaire sans date\n";
  await page.goto("/#/data-sources");
  await connect(page, "Avis & activité commerciale", "missing-date.csv", csv);
  await expect(
    page.getByRole("cell", { name: "Commentaire sans date", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Exporter tous les 2 commentaires filtrés/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Date non renseignée", exact: true }),
  ).toBeVisible();
});

test("mobile period controls expand, remain usable, and show an active period", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/feedback");
  const toggle = page.getByRole("button", { name: /Période et sources/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.getByLabel("Date de début", { exact: true }).fill("2026-01-01");
  await expect(page.getByLabel("Date de début", { exact: true })).toHaveValue(
    "2026-01-01",
  );
  await toggle.click();
  await expect(toggle).toContainText("Période active");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("Tabular file requirements are explicit, the native input stays hidden, and unsupported drops are rejected", async ({
  page,
}) => {
  await page.goto("/#/data-sources");
  await page
    .getByRole("button", { name: "Connecter un fichier", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Connecter une source" });
  await expect(
    dialog.getByText(
      "CSV, TSV, TXT, Excel (.xlsx, .xls) et LibreOffice (.ods)",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    dialog.getByText("Compatible avec Windows, macOS et Ubuntu.", {
      exact: true,
    }),
  ).toBeVisible();
  const input = dialog.locator('input[type="file"]');
  await expect(input).toBeHidden();
  await expect(input).toHaveAttribute("hidden", "");
  for (const name of ["report.pdf", "image.png"]) {
    const dataTransfer = await page.evaluateHandle((filename) => {
      const data = new DataTransfer();
      data.items.add(new File(["unsupported content"], filename));
      return data;
    }, name);
    await dialog
      .locator(".import-dropzone")
      .dispatchEvent("drop", { dataTransfer });
    await expect(dialog.getByRole("alert")).toContainText(
      "choisissez un fichier CSV",
    );
    await dataTransfer.dispose();
  }
  await dialog
    .getByRole("button", { name: "Choisir un fichier", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  await expect(dialog.locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog.getByText(/la première feuille visible/)).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  const chooserPromise = page.waitForEvent("filechooser");
  await dialog
    .getByRole("button", { name: "Choisir un fichier", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "mac-export.CSV",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(
      "IDENTITE_LEAD,DATE_AVIS,LIB_AVIS,RESPONSABLE,LIB_SOURCE_LEAD,EST_CLASSER,LIB_ETABLISSEMENT,LIB_REGION\nref-1,2026-01-01,Avis,Équipe,Web,Oui,Site A,Nord\n",
    ),
  });
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".commercial-metric-value").first()).toHaveText(
    "1",
  );
});

for (const extension of ["xlsx", "xls", "ods", "tsv", "txt"]) {
  test(`${extension} imports through the Worker and restores after reload`, async ({
    page,
  }) => {
    await page.goto("/#/data-sources");
    const rows = [
      [
        "IDENTITE_LEAD",
        "DATE_AVIS",
        "LIB_AVIS",
        "RESPONSABLE",
        "LIB_SOURCE_LEAD",
        "EST_CLASSER",
        "LIB_ETABLISSEMENT",
        "LIB_REGION",
      ],
      [
        "00042",
        "2026-10-01",
        "Très bien",
        "Équipe",
        "Web",
        "Oui",
        "Campus",
        "Nord",
      ],
    ];
    let content;
    if (["tsv", "txt"].includes(extension)) {
      content = rows.map((row) => row.join("\t")).join("\r\n");
    } else {
      const workbook = utils.book_new();
      utils.book_append_sheet(
        workbook,
        utils.aoa_to_sheet(rows),
        "Avis clients",
      );
      content = write(workbook, { bookType: extension, type: "buffer" });
    }
    await connect(
      page,
      "Avis & activité commerciale",
      `avis.${extension}`,
      content,
    );
    await page.goto("/#/data-sources");
    await expect(
      page.getByText(`avis.${extension}`, { exact: true }),
    ).toBeVisible();
    if (!["tsv", "txt"].includes(extension)) {
      await expect(
        page.getByText("Avis clients", { exact: true }),
      ).toBeVisible();
    }
    await page.reload();
    await expect(
      page.getByText(`avis.${extension}`, { exact: true }),
    ).toBeVisible();
    await page.goto("/#/feedback");
    await expect(page.locator(".commercial-metric-value").first()).toHaveText(
      "1",
    );
  });
}

test("Excel student records preserve their sheet and financial totals in the dashboard", async ({
  page,
}) => {
  await page.goto("/#/data-sources");
  const workbook = utils.book_new();
  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet([
      [
        "ID Étudiant",
        "Matricule",
        "Nom",
        "Prénom",
        "Formation",
        "Total à payer",
        "Total payé",
        "Reste à payer",
      ],
      ["S1", "M1", "Fictif", "Test", "Sciences", 1200.5, 400.25, 800.25],
    ]),
    "Étudiants",
  );
  await connect(
    page,
    "Dossiers étudiants",
    "students.xlsx",
    write(workbook, { type: "buffer", bookType: "xlsx" }),
  );
  await page.goto("/#/data-sources");
  await expect(page.getByText("Étudiants", { exact: true })).toBeVisible();

  await page.goto("/#/students");
  await expect(page.locator(".commercial-metric-value").nth(1)).toContainText(
    "200,5",
  );
  await expect(page.locator(".commercial-metric-value").nth(2)).toContainText(
    "400,25",
  );
  await expect(page.getByText("Fictif", { exact: true })).toBeVisible();
});
