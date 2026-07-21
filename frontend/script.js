const API_BASE_URL = "/api/queues";

const CURRENT_USER = {
  id: "user-1",
  name: "first user",
  role: "user"
};

let services = [];
let currentQueue = null;
let historyData = [];
let notifications = [];

// this Starts the application
document.addEventListener(
  "DOMContentLoaded",
  async function () {
    setupNavigation();
    setupServiceSelection();
    setupJoinQueueForm();

    document
      .getElementById("leaveQueueBtn")
      .addEventListener("click", leaveQueue);

  
    const statusButton =
      document.getElementById(
        "simulateStatusBtn"
      );

    if (statusButton) {
      statusButton.textContent =
        "Refresh Queue Status";

      statusButton.addEventListener(
        "click",
        function () {
          refreshQueueStatus(true);
        }
      );
    }

    await initializeApplication();
  }
);

async function initializeApplication() {
  try {
    await refreshBackendData();

    const savedServiceId =
      localStorage.getItem(
        "activeQueueServiceId"
      );

    if (savedServiceId) {
      currentQueue = {
        serviceId: savedServiceId,
        serviceName: "",
        position: "-",
        waitTime: 0,
        status: "Waiting"
      };

      await refreshQueueStatus(false);
    }

    updateAllScreens();
  } catch (error) {
    console.error(error);

    displayMessage(
      "Unable to connect to the QueueSmart backend.",
      "error"
    );
  }
}


async function apiRequest(
  endpoint,
  options = {}
) {
  const headers = {
    "x-user-id": CURRENT_USER.id,
    "x-user-role": CURRENT_USER.role,
    ...(options.headers || {})
  };

  if (options.body) {
    headers["Content-Type"] =
      "application/json";
  }

  const response = await fetch(
    API_BASE_URL + endpoint,
    {
      ...options,
      headers: headers
    }
  );

  const responseText =
    await response.text();

  let result = {};

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      result = {
        success: false,
        error: {
          message: responseText
        }
      };
    }
  }

  if (!response.ok) {
    const validationDetails =
      result.error?.details;

    const message =
      Array.isArray(validationDetails)
        ? validationDetails.join(" ")
        : result.error?.message ||
          "The backend request failed.";

    const error = new Error(message);
    error.status = response.status;

    throw error;
  }

  return result.data;
}

// Navigation
function setupNavigation() {
  const navButtons =
    document.querySelectorAll(".nav-btn");

  navButtons.forEach(function (button) {
    button.addEventListener(
      "click",
      function () {
        const screenId =
          button.getAttribute(
            "data-screen"
          );

        showScreen(screenId);
      }
    );
  });
}

// Display selected screen
function showScreen(screenId) {
  const screens =
    document.querySelectorAll(".screen");

  const buttons =
    document.querySelectorAll(".nav-btn");

  screens.forEach(function (screen) {
    screen.classList.remove(
      "active-screen"
    );
  });

  buttons.forEach(function (button) {
    button.classList.remove("active");
  });

  document
    .getElementById(screenId)
    .classList.add("active-screen");

  const activeButton =
    document.querySelector(
      '[data-screen="' +
        screenId +
        '"]'
    );

  if (activeButton) {
    activeButton.classList.add("active");
  }

  if (
    screenId === "queueStatus" &&
    currentQueue
  ) {
    refreshQueueStatus(false);
  }

  if (screenId === "history") {
    loadHistoryFromBackend()
      .then(updateHistory)
      .catch(function (error) {
        console.error(error);
      });
  }
}

// Get services from backend
async function loadServicesFromBackend() {
  services = await apiRequest(
    "/services"
  );
}

// Display services on dashboard and dropdown
function renderServices() {
  const activeServicesDiv =
    document.getElementById(
      "activeServices"
    );

  const serviceSelect =
    document.getElementById(
      "serviceSelect"
    );

  const previousSelection =
    serviceSelect.value;

  activeServicesDiv.innerHTML = "";

  serviceSelect.innerHTML =
    '<option value="">-- Choose a Service --</option>';

  services.forEach(function (service) {
    const serviceCard =
      document.createElement("div");

    serviceCard.className =
      "service-card";

    const estimatedWait =
      service.queueLength *
      service.expectedDuration;

    serviceCard.innerHTML = `
      <h4>${service.name}</h4>
      <p>${service.description}</p>
      <span>
        ${service.queueLength} people waiting
      </span>
      <span>
        ${estimatedWait} min estimated wait
      </span>
    `;

    serviceCard.addEventListener(
      "click",
      function () {
        selectServiceFromCard(
          service.id
        );
      }
    );

    activeServicesDiv.appendChild(
      serviceCard
    );

    const option =
      document.createElement("option");

    option.value = service.id;
    option.textContent = service.name;

    serviceSelect.appendChild(option);
  });

  const previousServiceExists =
    services.some(function (service) {
      return (
        String(service.id) ===
        String(previousSelection)
      );
    });

  if (previousServiceExists) {
    serviceSelect.value =
      previousSelection;
  } else if (currentQueue) {
    serviceSelect.value =
      currentQueue.serviceId;
  }
}

// Click service card
function selectServiceFromCard(
  serviceId
) {
  showScreen("joinQueue");

  const serviceSelect =
    document.getElementById(
      "serviceSelect"
    );

  serviceSelect.value = serviceId;

  serviceSelect.dispatchEvent(
    new Event("change")
  );
}

// Display selected service information
function setupServiceSelection() {
  const serviceSelect =
    document.getElementById(
      "serviceSelect"
    );

  serviceSelect.addEventListener(
    "change",
    function () {
      const selectedService =
        getSelectedService();

      if (selectedService) {
        const estimatedWait =
          selectedService.queueLength *
          selectedService.expectedDuration;

        document.getElementById(
          "estimatedWaitTime"
        ).textContent =
          estimatedWait + " minutes";

        document.getElementById(
          "queueLengthText"
        ).textContent =
          selectedService.queueLength +
          " people are currently waiting for " +
          selectedService.name +
          ".";

        document.getElementById(
          "serviceError"
        ).textContent = "";
      } else {
        document.getElementById(
          "estimatedWaitTime"
        ).textContent =
          "Select a service to view estimated wait time.";

        document.getElementById(
          "queueLengthText"
        ).textContent =
          "Queue length will appear after selecting a service.";
      }
    }
  );
}

// Join Queue form
function setupJoinQueueForm() {
  const joinQueueForm =
    document.getElementById(
      "joinQueueForm"
    );

  joinQueueForm.addEventListener(
    "submit",
    async function (event) {
      event.preventDefault();

      const selectedService =
        getSelectedService();

      if (!selectedService) {
        document.getElementById(
          "serviceError"
        ).textContent =
          "Please select a service before joining the queue.";

        return;
      }

      if (currentQueue !== null) {
        displayMessage(
          "You are already in a queue. Leave your current queue first.",
          "error"
        );

        return;
      }

      const submitButton =
        joinQueueForm.querySelector(
          'button[type="submit"]'
        );

      submitButton.disabled = true;
      submitButton.textContent =
        "Joining...";

      try {
        const result =
          await apiRequest("/join", {
            method: "POST",

            body: JSON.stringify({
              userName:
                CURRENT_USER.name,

              serviceId:
                selectedService.id,

              priority:
                selectedService
                  .priorityLevel ||
                "normal"
            })
          });

        currentQueue = {
          serviceId:
            result.entry.serviceId,

          serviceName:
            selectedService.name,

          position:
            result.position,

          waitTime:
            result
              .estimatedWaitMinutes,

          status:
            result.position <= 2
              ? "Almost Ready"
              : "Waiting"
        };

        localStorage.setItem(
          "activeQueueServiceId",
          result.entry.serviceId
        );

        document.getElementById(
          "serviceError"
        ).textContent = "";

        await refreshBackendData();

        updateAllScreens();

        displayMessage(
          "You successfully joined the " +
            selectedService.name +
            " queue.",
          "success"
        );
      } catch (error) {
        document.getElementById(
          "serviceError"
        ).textContent =
          error.message;

        displayMessage(
          error.message,
          "error"
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent =
          "Join Queue";
      }
    }
  );
}

// Return selected service
function getSelectedService() {
  const selectedId =
    document.getElementById(
      "serviceSelect"
    ).value;

  return services.find(
    function (service) {
      return (
        String(service.id) ===
        String(selectedId)
      );
    }
  );
}

// Leave Queue
async function leaveQueue() {
  if (currentQueue === null) {
    displayMessage(
      "You are not currently in a queue.",
      "error"
    );

    return;
  }

  const serviceName =
    currentQueue.serviceName;

  try {
    await apiRequest(
      "/" +
        encodeURIComponent(
          currentQueue.serviceId
        ) +
        "/leave",
      {
        method: "DELETE"
      }
    );

    currentQueue = null;

    localStorage.removeItem(
      "activeQueueServiceId"
    );

    await refreshBackendData();

    updateAllScreens();

    displayMessage(
      "You left the " +
        serviceName +
        " queue.",
      "info"
    );
  } catch (error) {
    displayMessage(
      error.message,
      "error"
    );
  }
}

// Refresh Queue Status
async function refreshQueueStatus(
  showMessage
) {
  if (!currentQueue) {
    if (showMessage) {
      displayMessage(
        "You are not currently in a queue.",
        "error"
      );
    }

    return;
  }

  try {
    const result =
      await apiRequest(
        "/" +
          encodeURIComponent(
            currentQueue.serviceId
          ) +
          "/status"
      );

    currentQueue = {
      serviceId:
        result.entry.serviceId,

      serviceName:
        result.service.name,

      position:
        result.position,

      waitTime:
        result.estimatedWaitMinutes,

      status:
        result.displayStatus
    };

    localStorage.setItem(
      "activeQueueServiceId",
      currentQueue.serviceId
    );

    await refreshBackendData();

    updateAllScreens();

    if (showMessage) {
      displayMessage(
        "Queue status refreshed.",
        "info"
      );
    }
  } catch (error) {
    // If the queue entry no longer exists,
    // the administrator may have served the user.
    if (error.status === 404) {
      currentQueue = null;

      localStorage.removeItem(
        "activeQueueServiceId"
      );

      await refreshBackendData();

      updateAllScreens();

      if (showMessage) {
        displayMessage(
          "You no longer have an active queue. Check your history and notifications.",
          "info"
        );
      }

      return;
    }

    displayMessage(
      error.message,
      "error"
    );
  }
}

// Get notifications
async function loadNotificationsFromBackend() {
  notifications =
    await apiRequest(
      "/notifications"
    );
}

// Get history
async function loadHistoryFromBackend() {
  historyData =
    await apiRequest("/history");
}

// Get current backend information
async function refreshBackendData() {
  await Promise.all([
    loadServicesFromBackend(),
    loadNotificationsFromBackend(),
    loadHistoryFromBackend()
  ]);
}

// Update all screens
function updateAllScreens() {
  renderServices();
  updateDashboard();
  updateQueueStatus();
  updateHistory();
  updateNotifications();
}

// Dashboard
function updateDashboard() {
  const dashboardQueueStatus =
    document.getElementById(
      "dashboardQueueStatus"
    );

  if (currentQueue === null) {
    dashboardQueueStatus.textContent =
      "You are not currently in a queue.";
  } else {
    dashboardQueueStatus.textContent =
      "You are in the " +
      currentQueue.serviceName +
      " queue. Position: " +
      currentQueue.position +
      ". Estimated wait time: " +
      currentQueue.waitTime +
      " minutes. Status: " +
      currentQueue.status +
      ".";
  }
}

// Queue Status screen
function updateQueueStatus() {
  const statusServiceName =
    document.getElementById(
      "statusServiceName"
    );

  const currentPosition =
    document.getElementById(
      "currentPosition"
    );

  const statusWaitTime =
    document.getElementById(
      "statusWaitTime"
    );

  const queueStatusText =
    document.getElementById(
      "queueStatusText"
    );

  const progressFill =
    document.getElementById(
      "progressFill"
    );

  const progressMessage =
    document.getElementById(
      "progressMessage"
    );

  const statusBadge =
    document.getElementById(
      "statusBadge"
    );

  if (currentQueue === null) {
    statusServiceName.textContent =
      "No Active Queue";

    currentPosition.textContent = "-";
    statusWaitTime.textContent = "-";

    queueStatusText.textContent =
      "Not Joined";

    progressFill.style.width = "0%";

    progressMessage.textContent =
      "Join a queue to see your queue progress.";

    statusBadge.textContent =
      "Not Joined";

    statusBadge.className =
      "status-badge neutral";

    return;
  }

  statusServiceName.textContent =
    currentQueue.serviceName;

  currentPosition.textContent =
    currentQueue.position;

  statusWaitTime.textContent =
    currentQueue.waitTime + " min";

  queueStatusText.textContent =
    currentQueue.status;

  statusBadge.textContent =
    currentQueue.status;

  let progress = 25;

  if (currentQueue.status === "Waiting") {
    statusBadge.className =
      "status-badge waiting";

    if (currentQueue.position <= 3) {
      progress = 55;
    }
  }

  if (
    currentQueue.status ===
    "Almost Ready"
  ) {
    progress = 85;

    statusBadge.className =
      "status-badge ready";
  }

  if (currentQueue.status === "Served") {
    progress = 100;

    statusBadge.className =
      "status-badge served";
  }

  progressFill.style.width =
    progress + "%";

  progressMessage.textContent =
    "Current status: " +
    currentQueue.status;
}

// History table
function updateHistory() {
  const historyTable =
    document.getElementById(
      "historyTable"
    );

  historyTable.innerHTML = "";

  if (historyData.length === 0) {
    historyTable.innerHTML = `
      <tr>
        <td colspan="3">
          No queue history yet.
        </td>
      </tr>
    `;

    return;
  }

  historyData.forEach(
    function (record) {
      const row =
        document.createElement("tr");

      row.innerHTML = `
        <td>
          ${formatDate(
            record.completedAt ||
              record.joinedAt
          )}
        </td>

        <td>
          ${record.serviceName}
        </td>

        <td>
          ${record.outcome}
        </td>
      `;

      historyTable.appendChild(row);
    }
  );
}

// Notifications
function updateNotifications() {
  const notificationList =
    document.getElementById(
      "notificationList"
    );

  notificationList.innerHTML = "";

  if (notifications.length === 0) {
    notificationList.innerHTML =
      "<li>No notifications yet.</li>";

    return;
  }

  notifications
    .slice(0, 10)
    .forEach(function (notification) {
      const li =
        document.createElement("li");

      li.textContent =
        notification.message;

      notificationList.appendChild(li);
    });
}

// Format backend date
function formatDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString();
}

// Display messages
function displayMessage(message, type) {
  if (
    typeof showToast === "function"
  ) {
    showToast(message, type);
  } else {
    alert(message);
  }
}
