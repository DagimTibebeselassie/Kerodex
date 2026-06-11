const API_BASE = localStorage.getItem("kerodexAdminApiBase") || "http://localhost:4100";
const state = {
  token: localStorage.getItem("kerodexAdminToken"),
  admin: null,
  dashboard: null,
  filters: {
    userStatus: "",
    listingStatus: "",
    verificationStatus: ""
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function fmt(value) {
  if (typeof value === "number") return new Intl.NumberFormat("en-US").format(value);
  return value ?? "";
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function titleize(value) {
  return String(value || "").replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(state.token ? { authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

function showApp() {
  $("#loginShell").hidden = true;
  $("#adminShell").hidden = false;
}

function showLogin(message = "") {
  $("#loginShell").hidden = false;
  $("#adminShell").hidden = true;
  if (message) $("#loginMessage").textContent = message;
}

function renderMetricGrid(container, metrics) {
  container.innerHTML = Object.entries(metrics).map(([key, value]) => `
    <article class="metric">
      <span>${titleize(key)}</span>
      <strong>${typeof value === "number" ? fmt(value) : value}</strong>
      <em>Live admin metric</em>
    </article>
  `).join("");
}

function renderBars(container, points, key = "value") {
  const max = Math.max(...points.map((point) => point[key]), 1);
  container.innerHTML = points.map((point) => `<span class="bar" title="${point.date || point.label}: ${fmt(point[key])}" style="height:${Math.max(6, (point[key] / max) * 100)}%"></span>`).join("");
}

function renderFunnel(container, rows) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  container.innerHTML = rows.map((row, index) => {
    const previous = rows[index - 1]?.value || row.value;
    const drop = index === 0 ? 0 : Math.max(0, Math.round((1 - row.value / previous) * 100));
    return `
      <div class="funnel-row">
        <strong>${row.label}</strong>
        <div class="track"><span style="width:${(row.value / max) * 100}%"></span></div>
        <span>${fmt(row.value)}${drop ? ` / ${drop}% drop` : ""}</span>
      </div>
    `;
  }).join("");
}

function renderBreakdown(container, rows) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  container.innerHTML = rows.map((row) => `
    <div class="breakdown-row">
      <strong>${row.label}</strong>
      <div class="track"><span style="width:${(row.value / max) * 100}%"></span></div>
      <span>${fmt(row.value)}</span>
    </div>
  `).join("");
}

function renderNotifications(items) {
  $("#notifications").innerHTML = items.slice(0, 3).map((item) => `
    <article class="${item.priority}">
      <strong>${item.type}</strong>
      <p>${item.message}</p>
      <small>${new Date(item.createdAt).toLocaleString()}</small>
    </article>
  `).join("");
}

function renderTable(table, columns, rows, actions = []) {
  table.innerHTML = `
    <thead>
      <tr>${columns.map((column) => `<th>${column.label}</th>`).join("")}${actions.length ? "<th>Actions</th>" : ""}</tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          ${columns.map((column) => `<td>${column.render ? column.render(row) : fmt(row[column.key])}</td>`).join("")}
          ${actions.length ? `<td><div class="row-actions">${actions.map((action) => `<button data-action="${action.action}" data-id="${row.id}" data-collection="${action.collection}">${action.label}</button>`).join("")}</div></td>` : ""}
        </tr>
      `).join("")}
    </tbody>
  `;
}

async function loadDashboard() {
  state.dashboard = await api("/api/admin/dashboard");
  renderMetricGrid($("#metricGrid"), state.dashboard.cards);
  renderMetricGrid($("#websiteMetrics"), state.dashboard.website);
  renderBars($("#visitorChart"), state.dashboard.charts.visitors);
  renderBars($("#analyticsVisitors"), state.dashboard.charts.visitors);
  renderBars($("#analyticsPages"), state.dashboard.charts.pageViews);
  renderBars($("#analyticsConversions"), state.dashboard.charts.signups);
  renderFunnel($("#funnel"), state.dashboard.funnel);
  renderBreakdown($("#trafficSources"), state.dashboard.charts.geographicDistribution.slice(0, 6));
  renderBreakdown($("#deviceBreakdown"), state.dashboard.charts.deviceBreakdown?.slice(0, 6) || []);
  renderMetricGrid($("#messageMetrics"), {
    messageVolumeToday: state.dashboard.cards.messagesSentToday,
    spamDetection: `${state.dashboard.cards.fraudFlagsTriggered} flags`,
    scamDetection: `${state.dashboard.cards.reportsSubmitted} reports`,
    moderationFlags: state.dashboard.cards.fraudFlagsTriggered
  });
  renderTable($("#revenueTable"), [
    { key: "label", label: "Revenue Area" },
    { key: "enabled", label: "Enabled", render: (row) => row.enabled ? "Enabled" : "Disabled" },
    { key: "projectedMonthly", label: "Current Monthly", render: (row) => money(row.projectedMonthly) }
  ], state.dashboard.futureRevenue);
}

async function loadCollections() {
  const [users, listings, verifications, reports, fraud, audit, notifications, system, flags, tickets] = await Promise.all([
    api(`/api/admin/users?status=${encodeURIComponent(state.filters.userStatus)}&q=${encodeURIComponent($("#userFilter")?.value || "")}`),
    api(`/api/admin/listings?status=${encodeURIComponent(state.filters.listingStatus)}&q=${encodeURIComponent($("#listingFilter")?.value || "")}`),
    api(`/api/admin/verifications?status=${encodeURIComponent(state.filters.verificationStatus)}`),
    api("/api/admin/reports"),
    api("/api/admin/fraud-flags"),
    api("/api/admin/audit-logs"),
    api("/api/admin/notifications"),
    api("/api/admin/system"),
    api("/api/admin/feature-flags"),
    api("/api/admin/tickets")
  ]);

  renderNotifications(notifications.items);
  renderTable($("#usersTable"), [
    { key: "fullName", label: "User", render: (row) => `<strong>${row.fullName}</strong><br><small>${row.email}<br>${row.phone}</small>` },
    { key: "status", label: "Status", render: (row) => `<span class="status ${row.status}">${row.status}</span>` },
    { key: "verificationStatus", label: "Verification", render: (row) => `<span class="status ${row.verificationStatus}">${row.verificationStatus}</span>` },
    { key: "profileCompletion", label: "Profile", render: (row) => `${row.profileCompletion}%` },
    { key: "listingCount", label: "Listings" },
    { key: "messagesSent", label: "Messages" },
    { key: "lastLoginAt", label: "Last Login", render: (row) => new Date(row.lastLoginAt).toLocaleDateString() }
  ], users.items, [
    { collection: "users", action: "approve", label: "Approve" },
    { collection: "users", action: "suspend", label: "Suspend" },
    { collection: "users", action: "unsuspend", label: "Unsuspend" },
    { collection: "users", action: "ban", label: "Ban" },
    { collection: "users", action: "unban", label: "Unban" },
    { collection: "users", action: "shadow_ban", label: "Shadow ban" }
  ]);

  renderTable($("#listingsTable"), [
    { key: "title", label: "Listing", render: (row) => `<strong>${row.title}</strong><br><small>${row.id} / ${row.vin}</small>` },
    { key: "seller", label: "Seller" },
    { key: "price", label: "Price", render: (row) => money(row.price) },
    { key: "location", label: "Location" },
    { key: "status", label: "Status", render: (row) => `<span class="status ${row.status}">${row.status}</span>` },
    { key: "views", label: "Views" },
    { key: "favorites", label: "Favorites" },
    { key: "inquiries", label: "Inquiries" }
  ], listings.items, [
    { collection: "listings", action: "feature", label: "Feature" },
    { collection: "listings", action: "unfeature", label: "Unfeature" },
    { collection: "listings", action: "flag", label: "Flag" },
    { collection: "listings", action: "remove", label: "Remove" },
    { collection: "listings", action: "restore", label: "Restore" },
    { collection: "listings", action: "mark_sold", label: "Sold" }
  ]);

  renderTable($("#verificationTable"), [
    { key: "userName", label: "Submission", render: (row) => `<strong>${row.userName}</strong><br><small>${row.type} / ${row.id}</small>` },
    { key: "status", label: "Status", render: (row) => `<span class="status ${row.status}">${row.status}</span>` },
    { key: "vehicleVin", label: "VIN" },
    { key: "submittedAt", label: "Submitted", render: (row) => new Date(row.submittedAt).toLocaleDateString() },
    { key: "governmentIdFront", label: "Private Files", render: (row) => `${row.governmentIdFront}<br>${row.titleUpload || ""}` }
  ], verifications.items, [
    { collection: "verifications", action: "approve", label: "Approve" },
    { collection: "verifications", action: "reject", label: "Reject" },
    { collection: "verifications", action: "request_resubmission", label: "Resubmit" }
  ]);

  renderRiskBoard(fraud.items);
  renderTable($("#fraudTable"), [
    { key: "reason", label: "Reason", render: (row) => `<strong>${row.reason}</strong><br><small>${row.id}</small>` },
    { key: "riskLevel", label: "Risk", render: (row) => `<span class="risk ${row.riskLevel}">${row.riskLevel}</span>` },
    { key: "confidence", label: "Confidence", render: (row) => `${row.confidence}%` },
    { key: "listingId", label: "Listing" },
    { key: "detectedAt", label: "Detected", render: (row) => new Date(row.detectedAt).toLocaleDateString() }
  ], fraud.items, [
    { collection: "fraudFlags", action: "dismiss", label: "Dismiss" },
    { collection: "fraudFlags", action: "escalate", label: "Escalate" },
    { collection: "fraudFlags", action: "mark_fraud_confirmed", label: "Confirm" }
  ]);

  renderTable($("#reportsTable"), [
    { key: "type", label: "Report", render: (row) => `<strong>${row.type}</strong><br><small>${row.id}</small>` },
    { key: "priority", label: "Priority", render: (row) => `<span class="risk ${row.priority}">${row.priority}</span>` },
    { key: "reporter", label: "Reporter" },
    { key: "reportedUser", label: "Reported User" },
    { key: "listingId", label: "Listing" },
    { key: "conversationId", label: "Conversation" },
    { key: "status", label: "Status", render: (row) => `<span class="status ${row.status}">${row.status}</span>` },
    { key: "description", label: "Notes", render: (row) => row.description || row.evidence || "" }
  ], reports.items, [
    { collection: "reports", action: "resolve", label: "Resolve" },
    { collection: "reports", action: "warn_user", label: "Warn" },
    { collection: "reports", action: "escalate", label: "Escalate" }
  ]);

  renderTable($("#auditTable"), [
    { key: "timestamp", label: "Timestamp", render: (row) => new Date(row.timestamp).toLocaleString() },
    { key: "adminAccount", label: "Admin" },
    { key: "actionType", label: "Action" },
    { key: "targetType", label: "Target" },
    { key: "previousValue", label: "Previous" },
    { key: "newValue", label: "New" }
  ], audit.items);

  renderMetricGrid($("#systemMetrics"), system);
  renderBreakdown($("#featureFlags"), flags.items.map((flag) => ({ label: flag.key, value: flag.enabled ? 100 : 0 })));
  $("#tickets").innerHTML = tickets.items.map((ticket) => `<div class="breakdown-row"><strong>${ticket.subject}</strong><span>${ticket.status}</span><span>${ticket.priority}</span></div>`).join("");
}

function renderRiskBoard(flags) {
  const counts = ["low", "medium", "high", "critical"].map((level) => ({
    level,
    count: flags.filter((flag) => flag.riskLevel === level).length
  }));
  $("#riskBoard").innerHTML = counts.map((item) => `
    <article class="risk-card">
      <span class="risk ${item.level}">${item.level} risk</span>
      <h2>${item.count}</h2>
      <p>${titleize(item.level)} fraud signals awaiting review.</p>
    </article>
  `).join("");
}

async function runAction(button) {
  const label = `${titleize(button.dataset.action)} ${button.dataset.collection} ${button.dataset.id}`;
  const notes = window.prompt(`Reason required for: ${label}`);
  if (!notes || notes.trim().length < 5) return;
  if (!window.confirm(`Apply "${titleize(button.dataset.action)}" to ${button.dataset.id}?`)) return;
  await api(`/api/admin/${button.dataset.collection.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}/${encodeURIComponent(button.dataset.id)}/actions`, {
    method: "PATCH",
    body: JSON.stringify({ action: button.dataset.action, notes })
  });
  await loadCollections();
}

async function reviewConversation() {
  const conversationId = $("#conversationReviewId").value.trim();
  const reason = $("#conversationReviewReason").value.trim();
  if (!conversationId || reason.length < 5) {
    $("#messageReview").innerHTML = "<p>Conversation ID and review reason are required.</p>";
    return;
  }
  const result = await api(`/api/admin/messages/review?conversationId=${encodeURIComponent(conversationId)}&reason=${encodeURIComponent(reason)}`);
  const messages = result.conversation.messages || [];
  $("#messageReview").innerHTML = `
    <h3>${result.conversation.vehicleTitle || result.conversation.listingId}</h3>
    <p><strong>Buyer:</strong> ${result.conversation.buyerName || result.conversation.buyerId} / <strong>Seller:</strong> ${result.conversation.sellerName || result.conversation.sellerId}</p>
    <div class="message-stack">
      ${messages.map((message) => `
        <article>
          <strong>${message.senderId}</strong>
          <p>${message.content}</p>
          <small>${new Date(message.createdAt).toLocaleString()} ${message.scamFlags?.length ? `/ Flags: ${message.scamFlags.join(", ")}` : ""}</small>
        </article>
      `).join("") || "<p>No messages in this conversation.</p>"}
    </div>
  `;
}

async function runSearch() {
  const query = $("#globalSearch").value.trim();
  const panel = $("#searchResults");
  if (!query) {
    panel.hidden = true;
    return;
  }
  const results = await api(`/api/admin/search?q=${encodeURIComponent(query)}`);
  panel.hidden = false;
  panel.innerHTML = `
    <h3>Search results for "${query}"</h3>
    <div class="search-columns">
      ${Object.entries(results).map(([key, items]) => `
        <div>
          <strong>${titleize(key)}</strong>
          ${items.map((item) => `<p>${item.fullName || item.title || item.userName || item.type}<br><small>${item.email || item.vin || item.id}</small></p>`).join("") || "<p>No matches</p>"}
        </div>
      `).join("")}
    </div>
  `;
}

async function init() {
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const session = await api("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: $("#adminEmail").value, accessCode: $("#adminCode").value })
      });
      state.token = session.token;
      state.admin = session.admin;
      localStorage.setItem("kerodexAdminToken", state.token);
      showApp();
      await bootAdmin();
    } catch (error) {
      showLogin(error.message);
    }
  });

  if (state.token) {
    try {
      const session = await api("/api/admin/session");
      state.admin = session.admin;
      showApp();
      await bootAdmin();
    } catch {
      localStorage.removeItem("kerodexAdminToken");
      state.token = null;
      showLogin("Sign in to continue.");
    }
  }
}

async function bootAdmin() {
  $("#adminRole").textContent = `${state.admin.email} / ${titleize(state.admin.role)}`;
  await loadDashboard();
  await loadCollections();
  bindEvents();
  startLiveNotifications();
}

function bindEvents() {
  $("#navTabs").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (!button) return;
    $$("#navTabs button").forEach((item) => item.classList.toggle("active", item === button));
    $$(".view").forEach((view) => view.classList.toggle("active", view.id === `${button.dataset.view}View`));
    $("#viewTitle").textContent = button.textContent;
  });

  document.body.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("button[data-action]");
    if (actionButton) await runAction(actionButton);

    const exportButton = event.target.closest("button[data-export]");
    if (exportButton) {
      window.open(`${API_BASE}/api/admin/export/${exportButton.dataset.export}?token=${encodeURIComponent(state.token)}`, "_blank", "noopener");
    }
  });

  $$(".queue-tabs").forEach((group) => {
    group.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-status]");
      if (!button) return;
      group.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      state.filters[group.dataset.target] = button.dataset.status;
      await loadCollections();
    });
  });

  $("#refreshButton").addEventListener("click", async () => {
    await loadDashboard();
    await loadCollections();
  });
  $("#globalSearch").addEventListener("input", debounce(runSearch, 220));
  $("#userFilter").addEventListener("input", debounce(loadCollections, 220));
  $("#listingFilter").addEventListener("input", debounce(loadCollections, 220));
  $("#userStatus").addEventListener("change", async (event) => {
    state.filters.userStatus = event.target.value;
    await loadCollections();
  });
  $("#themeToggle").addEventListener("click", () => document.body.classList.toggle("dark"));
  $("#reviewConversationButton").addEventListener("click", () => reviewConversation().catch((error) => {
    $("#messageReview").innerHTML = `<p>${error.message}</p>`;
  }));
}

function startLiveNotifications() {
  if (!window.EventSource || !state.token) return;
  const events = new EventSource(`${API_BASE}/api/admin/events?token=${encodeURIComponent(state.token)}`);
  events.addEventListener("admin.notification", (event) => {
    const item = JSON.parse(event.data);
    const current = $("#notifications").innerHTML;
    $("#notifications").innerHTML = `<article class="${item.priority}"><strong>${item.type}</strong><p>${item.message}</p><small>${new Date(item.createdAt).toLocaleString()}</small></article>${current}`;
  });
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

init();
