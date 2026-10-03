import { parseAmount, parsePercentage, splitBill } from "./money.mjs";

const storageKey = "commontab.web-demo.expenses.v1";
const categories = { groceries: "Groceries", dining: "Dining", travel: "Travel", shopping: "Shopping", household: "Household", health: "Health", other: "Other" };
const icons = { groceries: "▣", dining: "♨", travel: "✈", shopping: "◇", household: "⌂", health: "+", other: "▤" };
const $ = (id) => document.getElementById(id);
const money = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const dayOffset = (days) => { const date = new Date(); date.setDate(date.getDate() - days); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const sampleExpenses = [
  { id: "sample-1", merchant: "Corner Market", amountCents: 4280, category: "groceries", date: dayOffset(1), notes: "Weekend groceries" },
  { id: "sample-2", merchant: "Bluebird Café", amountCents: 1875, category: "dining", date: dayOffset(3), notes: "Coffee and lunch" },
  { id: "sample-3", merchant: "City Transit", amountCents: 1120, category: "travel", date: dayOffset(5), notes: "" },
];

function loadExpenses() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === null) return [...sampleExpenses];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [...sampleExpenses];
    return parsed.filter((item) => item && typeof item.id === "string" && typeof item.merchant === "string" && Number.isSafeInteger(item.amountCents) && item.amountCents >= 0 && categories[item.category] && /^\d{4}-\d{2}-\d{2}$/.test(item.date));
  } catch { return [...sampleExpenses]; }
}

let expenses = loadExpenses();
let people = 2;
let selectedTip = "15";

function saveExpenses() {
  try { localStorage.setItem(storageKey, JSON.stringify(expenses)); }
  catch { $("form-error").textContent = "We couldn't save your changes on this device. They may disappear when you close this page."; $("form-error").hidden = false; }
}

function navigate(view, scroll = true) {
  if (!["overview", "calculator", "expenses"].includes(view)) view = "overview";
  for (const name of ["overview", "calculator", "expenses"]) $("view-" + name).hidden = name !== view;
  for (const button of document.querySelectorAll("[data-nav]")) {
    if (button.closest(".bottom-nav")) {
      button.classList.toggle("active", button.dataset.nav === view);
      if (button.dataset.nav === view) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  }
  $("page-title").textContent = view === "overview" ? "CommonTab" : view === "calculator" ? "Calculator" : "Expenses";
  history.replaceState(null, "", "#" + view);
  if (scroll) document.querySelector(".app-content").scrollTop = 0;
}

function dateLabel(value) { return new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

function makeRow(expense, editable = false) {
  const row = document.createElement(editable ? "button" : "div");
  row.className = "expense-row" + (editable ? " expense-row-button" : "");
  if (editable) { row.type = "button"; row.addEventListener("click", () => openEditor(expense.id)); row.setAttribute("aria-label", `Edit ${expense.merchant}, ${money(expense.amountCents)}`); }
  const icon = document.createElement("span"); icon.className = "expense-icon"; icon.textContent = icons[expense.category]; icon.setAttribute("aria-hidden", "true");
  const info = document.createElement("span"); info.className = "expense-info";
  const merchant = document.createElement("strong"); merchant.textContent = expense.merchant;
  const detail = document.createElement("small"); detail.textContent = `${categories[expense.category]} · ${dateLabel(expense.date)}`;
  info.append(merchant, detail);
  const amount = document.createElement("span"); amount.className = "expense-value"; amount.textContent = money(expense.amountCents);
  row.append(icon, info, amount);
  return row;
}

function empty(container, title, body) {
  const box = document.createElement("div"); box.className = "empty-state";
  const heading = document.createElement("strong"); heading.textContent = title;
  const description = document.createElement("span"); description.textContent = body;
  box.append(heading, description); container.append(box);
}

function renderExpenses() {
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  $("overview-count").textContent = String(expenses.length);
  const recent = $("recent-expenses"); recent.replaceChildren();
  if (!sorted.length) empty(recent, "No expenses yet", "Add an expense to see it here.");
  else sorted.slice(0, 3).forEach((expense) => recent.append(makeRow(expense)));

  const query = $("expense-search").value.trim().toLocaleLowerCase();
  const category = $("category-filter").value;
  const visible = sorted.filter((expense) => (category === "all" || category === expense.category) && (`${expense.merchant} ${expense.notes}`.toLocaleLowerCase().includes(query)));
  $("expense-total").textContent = money(visible.reduce((sum, expense) => sum + expense.amountCents, 0));
  const list = $("expense-list"); list.replaceChildren();
  if (!visible.length) empty(list, "Nothing to show", expenses.length ? "Try another search or category." : "Add your first expense to get started.");
  else visible.forEach((expense) => list.append(makeRow(expense, true)));
}

function renderCalculator() {
  const billCents = parseAmount($("bill-amount").value);
  const tipBasisPoints = parsePercentage(selectedTip === "other" ? $("custom-tip").value : selectedTip);
  $("bill-error").hidden = billCents !== null || $("bill-amount").value.trim() === "";
  $("tip-error").hidden = tipBasisPoints !== null;
  $("custom-tip-wrap").hidden = selectedTip !== "other";
  $("people-count").textContent = String(people);
  $("people-minus").disabled = people <= 1;
  $("people-plus").disabled = people >= 20;
  const result = $("calc-result"); result.replaceChildren();
  if (billCents === null || tipBasisPoints === null) {
    const message = document.createElement("p"); message.textContent = "Enter a valid bill and tip to see the split."; message.style.margin = "0"; result.append(message); return;
  }
  const calculation = splitBill(billCents, tipBasisPoints, people);
  const top = document.createElement("div"); top.className = "result-top";
  const tipLabel = document.createElement("span"); tipLabel.textContent = "Tip";
  const tipValue = document.createElement("strong"); tipValue.textContent = money(calculation.tipCents);
  top.append(tipLabel, tipValue);
  const main = document.createElement("div"); main.className = "result-main";
  const mainLabel = document.createElement("span"); mainLabel.textContent = "Bill and tip";
  const total = document.createElement("strong"); total.textContent = money(calculation.totalCents);
  main.append(mainLabel, total); result.append(top, main);
  if (people > 1) {
    const title = document.createElement("div"); title.className = "shares-title"; title.textContent = "PER PERSON"; result.append(title);
    calculation.shares.forEach((share, index) => {
      const row = document.createElement("div"); row.className = "share-row";
      const name = document.createElement("span"); name.textContent = `Person ${index + 1}`;
      const value = document.createElement("strong"); value.textContent = money(share);
      row.append(name, value); result.append(row);
    });
  }
}

function openEditor(id = "") {
  const expense = expenses.find((item) => item.id === id);
  $("expense-form").reset();
  $("form-error").hidden = true;
  $("expense-id").value = expense?.id ?? "";
  $("merchant").value = expense?.merchant ?? "";
  $("expense-amount").value = expense ? (expense.amountCents / 100).toFixed(2) : "";
  $("expense-date").value = expense?.date ?? dayOffset(0);
  $("expense-category").value = expense?.category ?? "dining";
  $("expense-notes").value = expense?.notes ?? "";
  $("dialog-title").textContent = expense ? "Edit expense" : "Add expense";
  $("expense-delete").hidden = !expense;
  $("expense-dialog").showModal();
  $("merchant").focus();
}

document.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.nav)));
$("overview-add").addEventListener("click", () => openEditor());
$("expense-add").addEventListener("click", () => openEditor());
$("dialog-close").addEventListener("click", () => $("expense-dialog").close());
$("expense-dialog").addEventListener("click", (event) => { if (event.target === $("expense-dialog")) $("expense-dialog").close(); });
$("expense-search").addEventListener("input", renderExpenses);
$("category-filter").addEventListener("change", renderExpenses);
$("bill-amount").addEventListener("input", renderCalculator);
$("custom-tip").addEventListener("input", renderCalculator);
$("people-minus").addEventListener("click", () => { people = Math.max(1, people - 1); renderCalculator(); });
$("people-plus").addEventListener("click", () => { people = Math.min(20, people + 1); renderCalculator(); });
$("tip-options").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tip]"); if (!button) return;
  selectedTip = button.dataset.tip;
  for (const option of $("tip-options").querySelectorAll("button")) { const active = option === button; option.classList.toggle("selected", active); option.setAttribute("aria-pressed", String(active)); }
  renderCalculator();
  if (selectedTip === "other") $("custom-tip").focus();
});
$("expense-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const merchant = $("merchant").value.trim();
  const amountCents = parseAmount($("expense-amount").value);
  const date = $("expense-date").value;
  if (!merchant || amountCents === null || amountCents <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    $("form-error").textContent = "Enter a merchant, a positive amount with up to two decimals, and a date.";
    $("form-error").hidden = false; return;
  }
  const id = $("expense-id").value || crypto.randomUUID();
  const expense = { id, merchant, amountCents, date, category: $("expense-category").value, notes: $("expense-notes").value.trim() };
  const index = expenses.findIndex((item) => item.id === id);
  if (index >= 0) expenses[index] = expense; else expenses.push(expense);
  saveExpenses(); renderExpenses(); $("expense-dialog").close(); navigate("expenses");
});
$("expense-delete").addEventListener("click", () => {
  const id = $("expense-id").value;
  if (!id || !window.confirm("Delete this expense?")) return;
  expenses = expenses.filter((item) => item.id !== id);
  saveExpenses(); renderExpenses(); $("expense-dialog").close(); navigate("expenses");
});

renderExpenses(); renderCalculator(); navigate(location.hash.slice(1) || "overview", false);
