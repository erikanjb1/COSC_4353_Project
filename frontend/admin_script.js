const API_BASE_URL = "/api/queues";
const CURRENT_ADMIN = {
  id: "admin-1",
  role: "administrator"
};

const state = {
  view: "dashboard",
  selectedServiceId: null,
  services: [],
  queues: {},
  nowServing: {},
  busy: false
};

let $app = null;

// Start the administrator application.
document.addEventListener("DOMContentLoaded", async function () {
  $app = document.getElementById("app");

  setupNavigation();
  setupActionHandlers();

  try {
    await loadServices();

    if (state.services.length > 0) {
      state.selectedServiceId = state.services[0].id;
    }

    updateTopbar();
    updateSidebarActive();
    render();
  } catch (error) {
    handleError(error);
    renderConnectionError();
  }
});


async function apiRequest(endpoint, options = {}) {
  let response;

  try {
    response = await fetch(API_BASE_URL + endpoint, {
      ...options,
      headers: {
        "x-user-id": CURRENT_ADMIN.id,
        "x-user-role": CURRENT_ADMIN.role,
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {})
      }
    });
  } catch (_error) {
    const error = new Error(
      "Could not connect to the backend. Make sure npm start is running."
    );
    error.status = 0;
    throw error;
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message ||
        payload?.message ||
        "The request could not be completed."
    );

    error.status = response.status;
    error.details = payload?.error?.details || [];
    throw error;
  }

  return payload?.data;
}

// Load services and their current queue lengths.
async function loadServices() {
  const result = await apiRequest("/services");
  state.services = Array.isArray(result) ? result : [];

  if (
    state.selectedServiceId &&
    !state.services.some(function (service) {
      return service.id === state.selectedServiceId;
    })
  ) {
    state.selectedServiceId = null;
  }

  if (!state.selectedServiceId && state.services.length > 0) {
    state.selectedServiceId = state.services[0].id;
  }
}

// Administrator requirement: view the current queue.
async function loadQueue(serviceId) {
  if (!serviceId) {
    return null;
  }

  const result = await apiRequest(
    "/" + encodeURIComponent(serviceId)
  );

  state.queues[serviceId] = result;
  return result;
}

// Administrator requirement: serve the next user.
async function serveNext(serviceId) {
  if (!serviceId || state.busy) {
    return;
  }

  state.busy = true;
  render();

  try {
    const result = await apiRequest(
      "/" +
        encodeURIComponent(serviceId) +
        "/serve-next",
      { method: "POST" }
    );

    const servedEntry = result.entry;
    state.nowServing[serviceId] =
      servedEntry.userName || servedEntry.userId;

    await Promise.all([
      loadServices(),
      loadQueue(serviceId)
    ]);

    showNotification(
      "Now serving " +
        (servedEntry.userName || servedEntry.userId) +
        ".",
      "success"
    );
  } catch (error) {
    handleError(error);
  } finally {
    state.busy = false;
    updateTopbar();
    render();
  }
}

// Refresh the selected queue from the backend.
async function refreshSelectedQueue(showMessage = true) {
  if (!state.selectedServiceId || state.busy) {
    return;
  }

  state.busy = true;
  render();

  try {
    await Promise.all([
      loadServices(),
      loadQueue(state.selectedServiceId)
    ]);

    if (showMessage) {
      showNotification("Queue refreshed.", "info");
    }
  } catch (error) {
    handleError(error);
  } finally {
    state.busy = false;
    updateTopbar();
    render();
  }
}

// Sidebar navigation.
function setupNavigation() {
  document
    .querySelectorAll(".nav_item[data-view]")
    .forEach(function (navItem) {
      navItem.addEventListener("click", async function (event) {
        event.preventDefault();
        await setView(navItem.dataset.view);
      });
    });
}

function setupActionHandlers() {
  document.addEventListener("click", async function (event) {
    const actionElement = event.target.closest("[data-action]");

    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.action;
    const serviceId = actionElement.dataset.id;

    if (action === "go_queue") {
      await setView("queue", { serviceId: serviceId });
      return;
    }

    if (action === "refresh_queue") {
      await refreshSelectedQueue(true);
      return;
    }

    if (action === "serve_next") {
      await serveNext(state.selectedServiceId);
    }
  });

  document.addEventListener("change", async function (event) {
    if (event.target.id !== "queue_service_select") {
      return;
    }

    state.selectedServiceId = event.target.value;
    state.busy = true;
    render();

    try {
      await loadQueue(state.selectedServiceId);
    } catch (error) {
      handleError(error);
    } finally {
      state.busy = false;
      updateTopbar();
      render();
    }
  });
}

async function setView(view, options = {}) {
  state.view = view;

  if (options.serviceId) {
    state.selectedServiceId = options.serviceId;
  }

  try {
    await loadServices();

    if (view === "queue" && state.selectedServiceId) {
      await loadQueue(state.selectedServiceId);
    }
  } catch (error) {
    handleError(error);
  }

  updateTopbar();
  updateSidebarActive();
  render();
}

function render() {
  if (!$app) {
    return;
  }

  if (state.view === "dashboard") {
    renderDashboard();
    return;
  }

  if (state.view === "services") {
    renderServices();
    return;
  }

  renderQueue();
}

// Dashboard uses real service and queue-length data from the backend.
function renderDashboard() {
  const cards = state.services
    .map(function (service) {
      return `
        <div class="service_card">
          <div class="service_card_top">
            <div>
              <div class="service_card_name">${escapeHtml(service.name)}</div>
              <div class="service_card_desc">${escapeHtml(service.description)}</div>
            </div>
            <span class="status_pill ${service.isOpen ? "pill_open" : "pill_closed"}">
              <span class="dot"></span>
              ${service.isOpen ? "Open" : "Closed"}
            </span>
          </div>

          <div class="service_card_meta">
            <div class="meta_item">
              <span class="meta_label">Waiting</span>
              <span class="meta_val">${service.queueLength}</span>
            </div>

            <div class="meta_item">
              <span class="meta_label">Avg. time</span>
              <span class="meta_val">${service.expectedDuration}m</span>
            </div>

            <div class="meta_item">
              <span class="meta_label">Est. wait</span>
              <span class="meta_val">${service.queueLength * service.expectedDuration}m</span>
            </div>

            <div class="meta_item">
              <span class="meta_label">Priority</span>
              <span class="priority_badge priority_${priorityClass(service.priorityLevel)}">
                ${capitalize(service.priorityLevel)}
              </span>
            </div>
          </div>

          <div class="service_card_footer">
            <span>Backend service ID: ${escapeHtml(service.id)}</span>
            <button
              class="btn btn_sm btn_primary"
              data-action="go_queue"
              data-id="${escapeHtml(service.id)}"
            >
              Manage queue -&gt;
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  $app.innerHTML = `
    <div class="page_header">
      <div class="page_header_row">
        <div>
          <h1 class="page_title">Dashboard</h1>
          <p class="page_subtitle">Live backend overview</p>
        </div>
      </div>
    </div>

    <div class="stat_grid">
      <div class="stat_card">
        <div class="stat_eyebrow">Services</div>
        <div class="stat_value">
          ${openCount()}<span>/${state.services.length} open</span>
        </div>
        <div class="stat_meta">
          ${state.services.length - openCount()} closed
        </div>
      </div>

      <div class="stat_card">
        <div class="stat_eyebrow">People waiting</div>
        <div class="stat_value">${totalWaiting()}</div>
        <div class="stat_meta">Across all queues</div>
      </div>

      <div class="stat_card">
        <div class="stat_eyebrow">Longest wait</div>
        <div class="stat_value">${longestWait()}<span>min</span></div>
        <div class="stat_meta">Current projection</div>
      </div>
    </div>

    <div class="section_heading">All services</div>
    <div class="service_grid">
      ${
        cards ||
        `<div class="empty_state">
          <div class="empty_title">No services available</div>
          <div class="empty_body">No services were returned by the backend.</div>
        </div>`
      }
    </div>
  `;
}


function renderServices() {
  const rows = state.services
    .map(function (service) {
      return `
        <div class="svc_row">
          <div>
            <div class="svc_row_name">${escapeHtml(service.name)}</div>
            <div class="svc_row_desc">${escapeHtml(service.description)}</div>
          </div>

          <div>
            <span class="priority_badge priority_${priorityClass(service.priorityLevel)}">
              ${capitalize(service.priorityLevel)}
            </span>
          </div>

          <div style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600">
            ${service.expectedDuration}m
          </div>

          <div class="svc_row_actions">
            <button
              class="btn btn_sm btn_primary"
              data-action="go_queue"
              data-id="${escapeHtml(service.id)}"
            >
              View queue
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  $app.innerHTML = `
    <div class="page_header">
      <div class="page_header_row">
        <div>
          <h1 class="page_title">Services</h1>
          <p class="page_subtitle">
            Services loaded from the QueueSmart backend
          </p>
        </div>
      </div>
    </div>

    <div class="svc_table">
      <div class="svc_table_header">
        <div>Service</div>
        <div>Priority</div>
        <div>Duration</div>
        <div>Action</div>
      </div>

      ${
        rows ||
        `<div class="empty_state" style="border-radius: 0; border: none">
          <div class="empty_title">No services available</div>
          <div class="empty_body">No services were returned by the backend.</div>
        </div>`
      }
    </div>
  `;
}

// Queue Management view uses the real administrator queue endpoint.
function renderQueue() {
  const service = getSelectedService();

  if (!service) {
    $app.innerHTML = `
      <div class="page_header">
        <h1 class="page_title">Queue Management</h1>
      </div>
      <div class="empty_state">
        <div class="empty_title">No services available</div>
        <div class="empty_body">The backend did not return any services.</div>
      </div>
    `;
    return;
  }

  const queueData = state.queues[service.id] || {
    service: service,
    totalWaiting: service.queueLength,
    queue: []
  };

  const queue = Array.isArray(queueData.queue)
    ? queueData.queue
    : [];

  const options = state.services
    .map(function (item) {
      return `
        <option
          value="${escapeHtml(item.id)}"
          ${item.id === state.selectedServiceId ? "selected" : ""}
        >
          ${escapeHtml(item.name)} (${item.queueLength} waiting)
        </option>
      `;
    })
    .join("");

  const queueRows = queue
    .map(function (entry) {
      return `
        <div class="queue_row" data-row-id="${escapeHtml(entry.id)}">
          <div class="q_pos">#${entry.position}</div>

          <div class="q_ticket">
            <span class="priority_badge priority_${priorityClass(entry.priority)}">
              ${capitalize(entry.priority)}
            </span>
          </div>

          <div>
            <div class="q_name">${escapeHtml(entry.userName)}</div>
            <div class="q_joined">
              User ID: ${escapeHtml(entry.userId)}
            </div>
          </div>

          <div class="q_wait">
            ~${entry.estimatedWaitMinutes}m
          </div>

          <div class="q_joined">
            ${formatDateTime(entry.joinedAt)}
          </div>
        </div>
      `;
    })
    .join("");

  const lastServed = state.nowServing[service.id] || "-";

  $app.innerHTML = `
    <div class="page_header">
      <div class="page_header_row">
        <div>
          <h1 class="page_title">Queue Management</h1>
          <p class="page_subtitle">
            View the ordered queue and serve the next user.
          </p>
        </div>

        <div class="page_actions">
          <button
            class="btn btn_sm"
            data-action="refresh_queue"
            ${state.busy ? "disabled" : ""}
          >
            ${state.busy ? "Loading..." : "Refresh queue"}
          </button>
        </div>
      </div>
    </div>

    <div class="queue_page_grid">
      <div>
        <div class="queue_select_bar">
          <label for="queue_service_select">Service</label>
          <select id="queue_service_select" ${state.busy ? "disabled" : ""}>
            ${options}
          </select>
        </div>

        <div class="now_serving_banner">
          <div>
            <div class="ns_eyebrow">Now serving</div>
            <div class="ns_value">${escapeHtml(lastServed)}</div>
          </div>

          <button
            class="serve_btn"
            data-action="serve_next"
            ${queue.length === 0 || state.busy ? "disabled" : ""}
          >
            ${state.busy ? "Working..." : "Serve next -&gt;"}
          </button>
        </div>

        <div class="queue_list">
          <div class="queue_list_header">
            <div>#</div>
            <div>Priority</div>
            <div>Visitor</div>
            <div>Est. wait</div>
            <div>Joined</div>
          </div>

          <div class="queue_items">
            ${
              queueRows ||
              `<div class="empty_state" style="border-radius: 0; border: none">
                <div class="empty_title">Queue is empty</div>
                <div class="empty_body">No users are waiting for this service.</div>
              </div>`
            }
          </div>
        </div>
      </div>

      <div class="info_card">
        <div class="info_card_header">
          <div class="info_card_title">Service info</div>
        </div>

        <div class="info_card_body">
          <div class="info_row">
            <span class="info_row_label">Service</span>
            <span class="info_row_val" style="font-family: inherit; font-size: 13px; text-align: right">
              ${escapeHtml(service.name)}
            </span>
          </div>

          <hr class="info_divider" />

          <div class="info_row">
            <span class="info_row_label">Status</span>
            <span class="status_pill ${service.isOpen ? "pill_open" : "pill_closed"}" style="font-size: 11px">
              <span class="dot"></span>
              ${service.isOpen ? "Open" : "Closed"}
            </span>
          </div>

          <div class="info_row">
            <span class="info_row_label">Default priority</span>
            <span class="priority_badge priority_${priorityClass(service.priorityLevel)}" style="font-size: 11px">
              ${capitalize(service.priorityLevel)}
            </span>
          </div>

          <hr class="info_divider" />

          <div class="info_row">
            <span class="info_row_label">Waiting</span>
            <span class="info_row_val">${queue.length}</span>
          </div>

          <div class="info_row">
            <span class="info_row_label">Avg. duration</span>
            <span class="info_row_val">${service.expectedDuration}m</span>
          </div>

          <div class="info_row">
            <span class="info_row_label">Total est. wait</span>
            <span class="info_row_val">${queue.length * service.expectedDuration}m</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderConnectionError() {
  if (!$app) {
    return;
  }

  $app.innerHTML = `
    <div class="empty_state">
      <div class="empty_title">Backend unavailable</div>
      <div class="empty_body">
        Start the backend with npm start and reload this page.
      </div>
    </div>
  `;
}

function getSelectedService() {
  return (
    state.services.find(function (service) {
      return service.id === state.selectedServiceId;
    }) || null
  );
}

function totalWaiting() {
  return state.services.reduce(function (sum, service) {
    return sum + Number(service.queueLength || 0);
  }, 0);
}

function openCount() {
  return state.services.filter(function (service) {
    return service.isOpen;
  }).length;
}

function longestWait() {
  return state.services.reduce(function (maximum, service) {
    const wait =
      Number(service.queueLength || 0) *
      Number(service.expectedDuration || 0);

    return Math.max(maximum, wait);
  }, 0);
}

function updateTopbar() {
  const labels = {
    dashboard: "Dashboard",
    services: "Services",
    queue: "Queue Management"
  };

  const breadcrumb = document.getElementById("breadcrumb_page");
  const badge = document.getElementById("topbar_badge_text");

  if (breadcrumb) {
    breadcrumb.textContent = labels[state.view] || "";
  }

  if (badge) {
    badge.textContent =
      openCount() +
      " service" +
      (openCount() === 1 ? "" : "s") +
      " open · " +
      totalWaiting() +
      " waiting";
  }
}

function updateSidebarActive() {
  document
    .querySelectorAll(".nav_item[data-view]")
    .forEach(function (element) {
      element.classList.toggle(
        "is_active",
        element.dataset.view === state.view
      );
    });
}

function showNotification(message, type = "info") {
  const notification = document.getElementById("notification");

  if (!notification) {
    return;
  }

  notification.textContent = message;
  notification.dataset.type = type;
  notification.classList.add("show");

  window.clearTimeout(notification._timer);
  notification._timer = window.setTimeout(function () {
    notification.classList.remove("show");
  }, 3000);
}

function handleError(error) {
  console.error(error);

  let message = error?.message || "Something went wrong.";

  if (Array.isArray(error?.details) && error.details.length > 0) {
    message += " " + error.details.join(" ");
  }

  showNotification(message, "error");
}

function priorityClass(priority) {
  return priority === "normal" ? "medium" : priority;
}

function capitalize(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    }
  );
}
