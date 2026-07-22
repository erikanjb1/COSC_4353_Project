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
  busy: false,
  showCreateForm: false,
  editingServiceId: null,
  formErrors: null,
  pendingFormValues: null,
  localQueue: null,
  leavingEntryIds: new Set()
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

// create a new service.
async function createServiceRequest(payload) {
  if (state.busy) {
    return;
  }

  state.formErrors = null;
  state.busy = true;
  render();

  try {
    await apiRequest("/services", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    state.showCreateForm = false;
    state.formErrors = null;
    state.pendingFormValues = null;

    await loadServices();

    showNotification(
      "Service \"" + payload.name + "\" was created.",
      "success"
    );
  } catch (error) {
    state.formErrors = extractFieldErrors(error?.details);
    handleError(error);
  } finally {
    state.busy = false;
    updateTopbar();
    render();
  }
}

// update an existing service.
async function updateServiceRequest(
  serviceId,
  payload,
  { successMessage, isFormSubmit = false } = {}
) {
  if (state.busy) {
    return;
  }

  if (isFormSubmit) {
    state.formErrors = null;
  }

  state.busy = true;
  render();

  try {
    await apiRequest(
      "/services/" + encodeURIComponent(serviceId),
      {
        method: "PUT",
        body: JSON.stringify(payload)
      }
    );

    state.editingServiceId = null;
    state.formErrors = null;
    state.pendingFormValues = null;

    await loadServices();

    showNotification(
      successMessage ||
        "Service \"" + payload.name + "\" was updated.",
      "success"
    );
  } catch (error) {
    if (isFormSubmit) {
      state.formErrors = extractFieldErrors(error?.details);
    }

    handleError(error);
  } finally {
    state.busy = false;
    updateTopbar();
    render();
  }
}

// Administrator requirement: delete a service.
async function deleteServiceRequest(
  serviceId,
  serviceName
) {
  if (state.busy) {
    return;
  }

  const confirmed = await showConfirmModal({
    title: "Delete service",
    body:
      "Delete \"" +
      serviceName +
      "\"? This cannot be undone.",
    confirmLabel: "Delete",
    cancelLabel: "Cancel"
  });

  if (!confirmed) {
    return;
  }

  state.busy = true;
  render();

  try {
    await apiRequest(
      "/services/" + encodeURIComponent(serviceId),
      { method: "DELETE" }
    );

    if (state.editingServiceId === serviceId) {
      state.editingServiceId = null;
    }

    await loadServices();

    showNotification(
      "\"" + serviceName + "\" was deleted.",
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

// Dashboard quick action: flip a service between open and closed without opening the full edit form.
async function quickToggleOpen(serviceId) {
  if (state.busy) {
    return;
  }

  const service = state.services.find(function (item) {
    return item.id === serviceId;
  });

  if (!service) {
    return;
  }

  const nextIsOpen = !service.isOpen;

  await updateServiceRequest(
    serviceId,
    {
      name: service.name,
      description: service.description,
      expectedDuration: service.expectedDuration,
      priorityLevel: service.priorityLevel,
      isOpen: nextIsOpen
    },
    {
      successMessage:
        "\"" +
        service.name +
        "\" is now " +
        (nextIsOpen ? "open" : "closed") +
        "."
    }
  );
}

// Reads the shared name/description/duration/priority/isOpen fields used by both the create and edit service forms.
function readServiceFormPayload(formElement) {
  const formData = new FormData(formElement);

  return {
    name: String(formData.get("name") || "").trim(),
    description: String(
      formData.get("description") || ""
    ).trim(),
    expectedDuration: Number(
      formData.get("expectedDuration")
    ),
    priorityLevel: String(
      formData.get("priorityLevel") || ""
    ),
    isOpen: formData.get("isOpen") === "on"
  };
}

function extractFieldErrors(details) {
  if (!Array.isArray(details) || details.length === 0) {
    return null;
  }

  const fieldErrors = {};

  details.forEach(function (detail) {
    if (detail.startsWith("name")) {
      fieldErrors.name = detail;
    } else if (detail.startsWith("description")) {
      fieldErrors.description = detail;
    } else if (detail.startsWith("expectedDuration")) {
      fieldErrors.expectedDuration = detail;
    } else if (detail.startsWith("priorityLevel")) {
      fieldErrors.priorityLevel = detail;
    } else if (detail.startsWith("isOpen")) {
      fieldErrors.isOpen = detail;
    }
  });

  return Object.keys(fieldErrors).length > 0
    ? fieldErrors
    : null;
}

// view the current queue.
async function loadQueue(serviceId) {
  if (!serviceId) {
    return null;
  }

  const result = await apiRequest(
    "/" + encodeURIComponent(serviceId)
  );

  state.queues[serviceId] = result;

  // Reset the reorder/remove sandbox to match the real backend order.
  state.localQueue = Array.isArray(result.queue)
    ? result.queue.map(function (entry) {
        return { ...entry };
      })
    : [];

  return result;
}

function moveLocalQueueEntry(entryId, direction) {
  if (!Array.isArray(state.localQueue)) {
    return;
  }

  const index = state.localQueue.findIndex(
    function (entry) {
      return entry.id === entryId;
    }
  );

  const targetIndex = index + direction;

  if (
    index === -1 ||
    targetIndex < 0 ||
    targetIndex >= state.localQueue.length
  ) {
    return;
  }

  const reordered = state.localQueue.slice();
  const moved = reordered[index];

  reordered[index] = reordered[targetIndex];
  reordered[targetIndex] = moved;

  state.localQueue = reordered;
  render();
}

function removeLocalQueueEntry(entryId) {
  if (
    !Array.isArray(state.localQueue) ||
    state.leavingEntryIds.has(entryId)
  ) {
    return;
  }

  state.leavingEntryIds.add(entryId);
  render();

  window.setTimeout(function () {
    state.leavingEntryIds.delete(entryId);

    state.localQueue = state.localQueue.filter(
      function (entry) {
        return entry.id !== entryId;
      }
    );

    render();
  }, 200);
}

// Administrator requirement: serve the next user.
async function serveNext(serviceId) {
  if (!serviceId || state.busy) {
    return;
  }

  state.busy = true;

  // A brief visual cue on the entry that's about to be served, using
  // the real backend order (not the local reorder sandbox), since
  // that's who serve-next actually acts on.
  const queueData = state.queues[serviceId];
  const topEntryId =
    queueData &&
    Array.isArray(queueData.queue) &&
    queueData.queue[0]
      ? queueData.queue[0].id
      : null;

  if (topEntryId) {
    state.leavingEntryIds.add(topEntryId);
  }

  render();

  if (topEntryId) {
    await new Promise(function (resolve) {
      window.setTimeout(resolve, 200);
    });
  }

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
    state.leavingEntryIds.clear();
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
    const entryId = actionElement.dataset.entryId;

    if (action === "go_queue") {
      await setView("queue", { serviceId: serviceId });
      return;
    }

    if (action === "toggle_create_form") {
      state.showCreateForm = !state.showCreateForm;
      state.editingServiceId = null;
      state.formErrors = null;
      state.pendingFormValues = null;
      render();
      return;
    }

    if (action === "cancel_create_form") {
      state.showCreateForm = false;
      state.formErrors = null;
      state.pendingFormValues = null;
      render();
      return;
    }

    if (action === "toggle_edit_form") {
      state.editingServiceId =
        state.editingServiceId === serviceId
          ? null
          : serviceId;
      state.showCreateForm = false;
      state.formErrors = null;
      state.pendingFormValues = null;
      render();
      return;
    }

    if (action === "cancel_edit_form") {
      state.editingServiceId = null;
      state.formErrors = null;
      state.pendingFormValues = null;
      render();
      return;
    }

    if (action === "quick_toggle_open") {
      await quickToggleOpen(serviceId);
      return;
    }

    if (action === "edit_service_from_dashboard") {
      state.editingServiceId = serviceId;
      state.showCreateForm = false;
      state.formErrors = null;
      state.pendingFormValues = null;
      await setView("services");
      return;
    }

    if (action === "delete_service") {
      await deleteServiceRequest(
        serviceId,
        actionElement.dataset.name
      );
      return;
    }

    if (action === "queue_move_up") {
      moveLocalQueueEntry(entryId, -1);
      return;
    }

    if (action === "queue_move_down") {
      moveLocalQueueEntry(entryId, 1);
      return;
    }

    if (action === "queue_remove") {
      removeLocalQueueEntry(entryId);
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

  document.addEventListener("submit", async function (event) {
    if (event.target.id === "create_service_form") {
      event.preventDefault();

      const payload = readServiceFormPayload(event.target);
      state.pendingFormValues = payload;

      await createServiceRequest(payload);
      return;
    }

    if (
      event.target.id === "edit_service_form" &&
      state.editingServiceId
    ) {
      event.preventDefault();

      const payload = readServiceFormPayload(event.target);
      state.pendingFormValues = payload;

      await updateServiceRequest(
        state.editingServiceId,
        payload,
        { isFormSubmit: true }
      );
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
                ${priorityLabel(service.priorityLevel)}
              </span>
            </div>
          </div>

          <div class="service_card_footer">
            <span>Backend service ID: ${escapeHtml(service.id)}</span>

            <div class="btn_row">
              <button
                class="btn btn_sm"
                data-action="quick_toggle_open"
                data-id="${escapeHtml(service.id)}"
                ${state.busy ? "disabled" : ""}
              >
                ${service.isOpen ? "Close queue" : "Open queue"}
              </button>

              <button
                class="btn btn_sm"
                data-action="edit_service_from_dashboard"
                data-id="${escapeHtml(service.id)}"
                ${state.busy ? "disabled" : ""}
              >
                Edit
              </button>

              <button
                class="btn btn_sm btn_primary"
                data-action="go_queue"
                data-id="${escapeHtml(service.id)}"
              >
                Manage queue -&gt;
              </button>
            </div>
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


// Shared markup for both the "create service" and "edit service" forms.
function renderServiceForm({
  formId,
  title,
  subtitle,
  values,
  errors,
  submitLabel,
  busyLabel,
  cancelAction
}) {
  const fieldErrors = errors || {};

  const priorityOptions = ["low", "normal", "high"]
    .map(function (level) {
      return `
        <option
          value="${level}"
          ${values.priorityLevel === level ? "selected" : ""}
        >
          ${priorityLabel(level)}
        </option>
      `;
    })
    .join("");

  function fieldError(name) {
    return fieldErrors[name]
      ? `<div class="field_error">${escapeHtml(fieldErrors[name])}</div>`
      : "";
  }

  function hasErrorClass(name) {
    return fieldErrors[name] ? " has_error" : "";
  }

  return `
    <div class="card">
      <div class="card_header">
        <div class="card_title">${escapeHtml(title)}</div>
        <div class="card_sub">${escapeHtml(subtitle)}</div>
      </div>

      <form id="${formId}">
        <div class="card_body">
          <div class="field${hasErrorClass("name")}">
            <label for="${formId}_name">
              <span>Service name <span class="required_marker">*</span></span>
              <span class="hint">max 100 characters</span>
            </label>
            <input
              id="${formId}_name"
              name="name"
              type="text"
              required
              minlength="2"
              maxlength="100"
              placeholder="e.g. IT Help Desk"
              value="${escapeHtml(values.name || "")}"
            />
            ${fieldError("name")}
          </div>

          <div class="field${hasErrorClass("description")}">
            <label for="${formId}_description">
              <span>Description <span class="required_marker">*</span></span>
              <span class="hint">max 300 characters</span>
            </label>
            <textarea
              id="${formId}_description"
              name="description"
              required
              minlength="5"
              maxlength="300"
              rows="2"
              placeholder="What this service is for"
            >${escapeHtml(values.description || "")}</textarea>
            ${fieldError("description")}
          </div>

          <div class="field${hasErrorClass("expectedDuration")}">
            <label for="${formId}_duration">
              <span>Expected duration <span class="required_marker">*</span></span>
              <span class="hint">1-240 minutes</span>
            </label>
            <input
              id="${formId}_duration"
              name="expectedDuration"
              type="number"
              required
              min="1"
              max="240"
              placeholder="e.g. 15"
              value="${values.expectedDuration ?? ""}"
            />
            ${fieldError("expectedDuration")}
          </div>

          <div class="field${hasErrorClass("priorityLevel")}">
            <label for="${formId}_priority">
              <span>Priority level <span class="required_marker">*</span></span>
            </label>
            <select
              id="${formId}_priority"
              name="priorityLevel"
              required
            >
              ${priorityOptions}
            </select>
            ${fieldError("priorityLevel")}
          </div>

          <div class="field${hasErrorClass("isOpen")}">
            <label for="${formId}_open">
              <span>Open for new users</span>
            </label>
            <div style="display: flex; align-items: center; gap: 8px">
              <input
                id="${formId}_open"
                name="isOpen"
                type="checkbox"
                ${values.isOpen ? "checked" : ""}
                style="width: 16px; height: 16px; flex: none; padding: 0; background: white"
              />
              <span class="hint">Users can join this service's queue while open</span>
            </div>
            ${fieldError("isOpen")}
          </div>
        </div>

        <div class="form_footer">
          <button
            type="submit"
            class="btn btn_sm btn_primary"
            ${state.busy ? "disabled" : ""}
          >
            ${state.busy ? busyLabel : submitLabel}
          </button>

          <button
            type="button"
            class="btn btn_sm btn_ghost"
            data-action="${cancelAction}"
            ${state.busy ? "disabled" : ""}
          >
            Cancel
          </button>
        </div>
      </form>
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
              ${priorityLabel(service.priorityLevel)}
            </span>
          </div>

          <div style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600">
            ${service.expectedDuration}m
          </div>

          <div class="svc_row_actions">
            <button
              class="btn btn_sm"
              data-action="toggle_edit_form"
              data-id="${escapeHtml(service.id)}"
            >
              ${state.editingServiceId === service.id ? "Close" : "Edit"}
            </button>

            <button
              class="btn btn_sm"
              data-action="delete_service"
              data-id="${escapeHtml(service.id)}"
              data-name="${escapeHtml(service.name)}"
              ${state.busy ? "disabled" : ""}
              title="Delete service"
            >
              Delete
            </button>

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
  let formPanel;

  if (state.showCreateForm) {
    formPanel = renderServiceForm({
      formId: "create_service_form",
      title: "Add service",
      subtitle: "Create a new queue service",
      values:
        state.pendingFormValues || {
          priorityLevel: "normal",
          isOpen: true
        },
      errors: state.formErrors,
      submitLabel: "Create service",
      busyLabel: "Creating...",
      cancelAction: "cancel_create_form"
    });
  } else if (state.editingServiceId) {
    const editingService = state.services.find(
      function (item) {
        return item.id === state.editingServiceId;
      }
    );

    formPanel = editingService
      ? renderServiceForm({
          formId: "edit_service_form",
          title: "Edit service",
          subtitle: escapeHtml(editingService.name),
          values: state.pendingFormValues || editingService,
          errors: state.formErrors,
          submitLabel: "Save changes",
          busyLabel: "Saving...",
          cancelAction: "cancel_edit_form"
        })
      : "";
  } else {
    formPanel = `
      <div class="card">
        <div class="card_header">
          <div class="card_title">Add or edit a service</div>
          <div class="card_sub">Manage the services shown to users</div>
        </div>

        <div class="card_body" style="text-align: center; padding: 32px 20px">
          <p class="hint" style="display: block; margin-bottom: 14px">
            Select "Edit" on a service, or create a new one.
          </p>

          <button
            class="btn btn_sm btn_primary"
            data-action="toggle_create_form"
          >
            Add service
          </button>
        </div>
      </div>
    `;
  }

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

    <div class="two_col">
      <div>${formPanel}</div>

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

  const backendQueue = Array.isArray(queueData.queue)
    ? queueData.queue
    : [];

  const displayQueue = Array.isArray(state.localQueue)
    ? state.localQueue
    : backendQueue;

  const isReordered =
    displayQueue.length !== backendQueue.length ||
    displayQueue.some(function (entry, index) {
      return (
        !backendQueue[index] ||
        entry.id !== backendQueue[index].id
      );
    });

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

  const queueRows = displayQueue
    .map(function (entry, index) {
      const isLeaving = state.leavingEntryIds.has(entry.id);

      return `
        <div
          class="queue_row${isLeaving ? " is_leaving" : ""}"
          data-row-id="${escapeHtml(entry.id)}"
        >
          <div class="q_pos">#${index + 1}</div>

          <div class="q_ticket">
            <span class="priority_badge priority_${priorityClass(entry.priority)}">
              ${priorityLabel(entry.priority)}
            </span>
          </div>

          <div>
            <div class="q_name">${escapeHtml(entry.userName)}</div>
            <div class="q_joined">
              User ID: ${escapeHtml(entry.userId)}
            </div>
          </div>

          <div class="q_wait">
            ~${index * service.expectedDuration}m
          </div>

          <div class="q_joined">
            ${formatDateTime(entry.joinedAt)}
          </div>

          <div class="q_actions">
            <button
              class="icon_btn"
              data-action="queue_move_up"
              data-entry-id="${escapeHtml(entry.id)}"
              title="Move up (UI only)"
              ${index === 0 ? "disabled" : ""}
            >
              &uarr;
            </button>

            <button
              class="icon_btn"
              data-action="queue_move_down"
              data-entry-id="${escapeHtml(entry.id)}"
              title="Move down (UI only)"
              ${index === displayQueue.length - 1 ? "disabled" : ""}
            >
              &darr;
            </button>

            <button
              class="icon_btn is_danger"
              data-action="queue_remove"
              data-entry-id="${escapeHtml(entry.id)}"
              title="Remove from view (UI only)"
            >
              &times;
            </button>
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
            ${backendQueue.length === 0 || state.busy ? "disabled" : ""}
          >
            ${state.busy ? "Working..." : "Serve next -&gt;"}
          </button>
        </div>

        ${
          isReordered
            ? `<div class="empty_state" style="border-radius: 10px; padding: 10px 16px; margin-bottom: 12px; text-align: left; background: #fffbeb; border: 1px solid #fde68a">
                <div class="empty_body" style="color: #92400e">
                  This order is a local preview only and has not been saved.
                  "Serve next" still uses the real backend queue order.
                  Click "Refresh queue" to discard these changes.
                </div>
              </div>`
            : ""
        }

        <div class="queue_list">
          <div class="queue_list_header">
            <div>#</div>
            <div>Priority</div>
            <div>Visitor</div>
            <div>Est. wait</div>
            <div>Joined</div>
            <div></div>
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
              ${priorityLabel(service.priorityLevel)}
            </span>
          </div>

          <hr class="info_divider" />

          <div class="info_row">
            <span class="info_row_label">Waiting</span>
            <span class="info_row_val">${backendQueue.length}</span>
          </div>

          <div class="info_row">
            <span class="info_row_label">Avg. duration</span>
            <span class="info_row_val">${service.expectedDuration}m</span>
          </div>

          <div class="info_row">
            <span class="info_row_label">Total est. wait</span>
            <span class="info_row_val">${backendQueue.length * service.expectedDuration}m</span>
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

function ensureConfirmModal() {
  let overlay = document.getElementById("confirm_modal");

  if (overlay) {
    return overlay;
  }

  overlay = document.createElement("div");
  overlay.id = "confirm_modal";
  overlay.className = "modal_overlay";

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal_icon" aria-hidden="true" style="font-size: 20px; font-weight: 700">!</div>
      <div>
        <div class="modal_title" id="confirm_modal_title"></div>
        <div class="modal_message" id="confirm_modal_body"></div>
      </div>
      <div class="modal_actions">
        <button type="button" class="btn btn_sm btn_ghost" id="confirm_modal_cancel">Cancel</button>
        <button type="button" class="btn btn_sm btn_danger" id="confirm_modal_confirm">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  return overlay;
}

function showConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel"
}) {
  return new Promise(function (resolve) {
    const overlay = ensureConfirmModal();
    const titleEl = document.getElementById("confirm_modal_title");
    const bodyEl = document.getElementById("confirm_modal_body");
    const confirmBtn = document.getElementById(
      "confirm_modal_confirm"
    );
    const cancelBtn = document.getElementById(
      "confirm_modal_cancel"
    );

    if (
      !overlay ||
      !titleEl ||
      !bodyEl ||
      !confirmBtn ||
      !cancelBtn
    ) {
      // Fallback in case the modal markup somehow fails to build.
      resolve(window.confirm(body));
      return;
    }

    titleEl.textContent = title;
    bodyEl.textContent = body;
    confirmBtn.textContent = confirmLabel;
    cancelBtn.textContent = cancelLabel;

    overlay.classList.add("is_open");

    function cleanup(result) {
      overlay.classList.remove("is_open");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    }

    function onConfirm() {
      cleanup(true);
    }

    function onCancel() {
      cleanup(false);
    }

    function onOverlayClick(event) {
      if (event.target === overlay) {
        cleanup(false);
      }
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        cleanup(false);
      }
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
    document.addEventListener("keydown", onKeydown);
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

function priorityLabel(priority) {
  return priority === "normal"
    ? "Medium"
    : capitalize(priority);
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