const services = [
    {
      id: 1,
      name: "Academic Advising",
      description: "Students can meet with an advisor to plan for their classes and any degree questions.",
      waitTime: 20,
      queueLength: 5
    },
    {
      id: 2,
      name: "Clinic Check-In",
      description: "Patients can check in for clinic services and receive wait time updates.",
      waitTime: 35,
      queueLength: 9
    },
    {
      id: 3,
      name: "Student Service Center",
      description: "Students and visitors can get help with enrollment, records, and other general services.",
      waitTime: 25,
      queueLength: 7
    },
    {
      id: 4,
      name: "IT Help Desk",
      description: "Users can get help with login, Wi-Fi, accounts, and software issues.",
      waitTime: 10,
      queueLength: 3
    }
  ];
  
  // this displays the Current active queue
  let currentQueue = null;
  
  // this is the History data with current date
  let historyData = [
    {
      date: getTodayDate(),
      serviceName: "IT Help Desk",
      outcome: "Served"
    },
    {
      date: getTodayDate(),
      serviceName: "Academic Advising",
      outcome: "Left Queue"
    }
  ];
  
  // notifications
  let notifications = [];
  
  
  document.addEventListener("DOMContentLoaded", function () {
    setupNavigation();
    setupServiceSelection();
    setupJoinQueueForm();
  
    document.getElementById("leaveQueueBtn").addEventListener("click", leaveQueue);
    document.getElementById("simulateStatusBtn").addEventListener("click", simulateStatusUpdate);
  
    updateAllScreens();
  });
  
  // these are the Navigation buttons
  function setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
  
    navButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const screenId = button.getAttribute("data-screen");
        showScreen(screenId);
      });
    });
  }
  
  // Shows the selected screen
  function showScreen(screenId) {
    const screens = document.querySelectorAll(".screen");
    const buttons = document.querySelectorAll(".nav-btn");
  
    screens.forEach(function (screen) {
      screen.classList.remove("active-screen");
    });
  
    buttons.forEach(function (button) {
      button.classList.remove("active");
    });
  
    document.getElementById(screenId).classList.add("active-screen");
  
    const activeButton = document.querySelector('[data-screen="' + screenId + '"]');
  
    if (activeButton) {
      activeButton.classList.add("active");
    }
  }
  
  // Load services into dashboard cards and dropdown
  function loadServices() {
    const activeServicesDiv = document.getElementById("activeServices");
    const serviceSelect = document.getElementById("serviceSelect");
  
    activeServicesDiv.innerHTML = "";
    serviceSelect.innerHTML = '<option value="">-- Choose a Service --</option>';
  
    services.forEach(function (service) {
      const serviceCard = document.createElement("div");
      serviceCard.className = "service-card";
  
      serviceCard.innerHTML = `
        <h4>${service.name}</h4>
        <p>${service.description}</p>
        <span>${service.queueLength} people waiting</span>
        <span>${service.waitTime} min estimated wait</span>
      `;
  
      // This makes each service card clickable
      serviceCard.onclick = function () {
        selectServiceFromCard(service.id);
      };
  
      activeServicesDiv.appendChild(serviceCard);
  
      const option = document.createElement("option");
      option.value = service.id;
      option.textContent = service.name;
  
      serviceSelect.appendChild(option);
    });
  }
  
  // When user clicks a service card, it goes to the Join Queue screen
  function selectServiceFromCard(serviceId) {
    showScreen("joinQueue");
  
    const serviceSelect = document.getElementById("serviceSelect");
  
    serviceSelect.value = serviceId;
  
    serviceSelect.dispatchEvent(new Event("change"));
  }
  
  // Shows the estimated wait time after service is selected
  function setupServiceSelection() {
    const serviceSelect = document.getElementById("serviceSelect");
  
    serviceSelect.addEventListener("change", function () {
      const selectedService = getSelectedService();
  
      if (selectedService) {
        document.getElementById("estimatedWaitTime").textContent =
          selectedService.waitTime + " minutes";
  
        document.getElementById("queueLengthText").textContent =
          selectedService.queueLength +
          " people are currently waiting for " +
          selectedService.name +
          ".";
  
        document.getElementById("serviceError").textContent = "";
      } else {
        document.getElementById("estimatedWaitTime").textContent =
          "Select a service to view estimated wait time.";
  
        document.getElementById("queueLengthText").textContent =
          "Queue length will appear after selecting a service.";
      }
    });
  }
  
  // Joins the queue form validation
  function setupJoinQueueForm() {
    const joinQueueForm = document.getElementById("joinQueueForm");
  
    joinQueueForm.addEventListener("submit", function (event) {
      event.preventDefault();
  
      const selectedService = getSelectedService();
  
      if (!selectedService) {
        document.getElementById("serviceError").textContent =
          "Please select a service before joining the queue.";
        return;
      }
  
      if (currentQueue !== null) {
        document.getElementById("serviceError").textContent =
          "You are already in a queue. Leave the current queue before joining another one.";
        return;
      }
  
      currentQueue = {
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        position: selectedService.queueLength + 1,
        waitTime: selectedService.waitTime,
        status: "Waiting"
      };

      historyData.unshift({
        date: getTodayDate(),
        serviceName: selectedService.name,
        outcome: "Joined Queue"
      });
  
      selectedService.queueLength++;
  
      addNotification("You joined the " + selectedService.name + " queue.");
  
      updateAllScreens();
  
      alert("You have successfully joined the " + selectedService.name + " queue.");
    });
  }
  
  //  service from dropdown
  function getSelectedService() {
    const selectedId = Number(document.getElementById("serviceSelect").value);
  
    return services.find(function (service) {
      return service.id === selectedId;
    });
  }
  
  // Leaves the queue
  function leaveQueue() {
    if (currentQueue === null) {
      alert("You are not currently in a queue.");
      return;
    }
  
    historyData.unshift({
      date: getTodayDate(),
      serviceName: currentQueue.serviceName,
      outcome: "Left Queue"
    });
  
    const service = services.find(function (item) {
      return item.id === currentQueue.serviceId;
    });
  
    if (service && service.queueLength > 0) {
      service.queueLength--;
    }
  
    addNotification("You left the " + currentQueue.serviceName + " queue.");
  
    currentQueue = null;
  
    updateAllScreens();
  
    alert("You have left the queue.");
  }
  
  // Simulate queue status updates
  function simulateStatusUpdate() {
    if (currentQueue === null) {
      alert("Join a queue first to simulate status updates.");
      return;
    }
  
    if (currentQueue.position > 2) {
      currentQueue.position--;
      currentQueue.waitTime = currentQueue.waitTime - 5;
  
      if (currentQueue.waitTime < 5) {
        currentQueue.waitTime = 5;
      }
  
      currentQueue.status = "Waiting";
  
      addNotification("Queue update: your position moved up.");
    } else if (currentQueue.position === 2) {
      currentQueue.position = 1;
      currentQueue.waitTime = 5;
      currentQueue.status = "Almost Ready";
  
      addNotification("Status update: your turn is almost ready.");
    } else {
      currentQueue.status = "Served";
      currentQueue.waitTime = 0;
  
      historyData.unshift({
        date: getTodayDate(),
        serviceName: currentQueue.serviceName,
        outcome: "Served"
      });
  
      addNotification("You have been served for " + currentQueue.serviceName + ".");
  
      updateAllScreens();
  
      currentQueue = null;
  
      updateAllScreens();
  
      return;
    }
  
    updateAllScreens();
  }
  
  // Update all screens
  function updateAllScreens() {
    loadServices();
    updateDashboard();
    updateQueueStatus();
    updateHistory();
    updateNotifications();
  }
  
  // Update dashboard
  function updateDashboard() {
    const dashboardQueueStatus = document.getElementById("dashboardQueueStatus");
  
    if (currentQueue === null) {
      dashboardQueueStatus.textContent = "You are not currently in a queue.";
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
  
  // Update queue status screen
  function updateQueueStatus() {
    const statusServiceName = document.getElementById("statusServiceName");
    const currentPosition = document.getElementById("currentPosition");
    const statusWaitTime = document.getElementById("statusWaitTime");
    const queueStatusText = document.getElementById("queueStatusText");
    const progressFill = document.getElementById("progressFill");
    const progressMessage = document.getElementById("progressMessage");
    const statusBadge = document.getElementById("statusBadge");
  
    if (currentQueue === null) {
      statusServiceName.textContent = "No Active Queue";
      currentPosition.textContent = "-";
      statusWaitTime.textContent = "-";
      queueStatusText.textContent = "Not Joined";
      progressFill.style.width = "0%";
      progressMessage.textContent = "Join a queue to see your queue progress.";
  
      statusBadge.textContent = "Not Joined";
      statusBadge.className = "status-badge neutral";
  
      return;
    }
  
    statusServiceName.textContent = currentQueue.serviceName;
    currentPosition.textContent = currentQueue.position;
    statusWaitTime.textContent = currentQueue.waitTime + " min";
    queueStatusText.textContent = currentQueue.status;
  
    let progress = 25;
  
    statusBadge.textContent = currentQueue.status;
  
    if (currentQueue.status === "Waiting") {
      statusBadge.className = "status-badge waiting";
    }
  
    if (currentQueue.status === "Waiting" && currentQueue.position <= 3) {
      progress = 55;
    }
  
    if (currentQueue.status === "Almost Ready") {
      progress = 85;
      statusBadge.className = "status-badge ready";
    }
  
    if (currentQueue.status === "Served") {
      progress = 100;
      statusBadge.className = "status-badge served";
    }
  
    progressFill.style.width = progress + "%";
    progressMessage.textContent = "Current status: " + currentQueue.status;
  }
  
  // Update history table
  function updateHistory() {
    const historyTable = document.getElementById("historyTable");
  
    historyTable.innerHTML = "";
  
    historyData.forEach(function (record) {
      const row = document.createElement("tr");
  
      row.innerHTML = `
        <td>${record.date}</td>
        <td>${record.serviceName}</td>
        <td>${record.outcome}</td>
      `;
  
      historyTable.appendChild(row);
    });
  }
  
  // Update notifications
  function updateNotifications() {
    const notificationList = document.getElementById("notificationList");
  
    notificationList.innerHTML = "";
  
    if (notifications.length === 0) {
      notificationList.innerHTML = "<li>No notifications yet.</li>";
      return;
    }
  
    notifications.slice(0, 10).forEach(function (notification) {
      const li = document.createElement("li");
      li.textContent = notification;
      notificationList.appendChild(li);
    });
  }
  
  // Add notification
  function addNotification(message) {
    notifications.unshift(message);
  }
  
  // gets current date
  function getTodayDate() {
    const today = new Date();
    return today.toISOString().split("T")[0];
  }
