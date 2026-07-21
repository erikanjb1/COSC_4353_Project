const services = [
    {
      id: "service-1",
      name: "Academic Advising",
      description:
        "Students can meet with an advisor to plan classes and discuss degree requirements.",
      expectedDuration: 20,
      priorityLevel: "normal",
      isOpen: true
    },
    {
      id: "service-2",
      name: "Clinic Check-In",
      description:
        "Patients can check in for clinic services and receive wait-time updates.",
      expectedDuration: 15,
      priorityLevel: "high",
      isOpen: true
    },
    {
      id: "service-3",
      name: "Student Service Center",
      description:
        "Help with enrollment, student records, and other general services.",
      expectedDuration: 25,
      priorityLevel: "normal",
      isOpen: true
    },
    {
      id: "service-4",
      name: "IT Help Desk",
      description:
        "Help with login, Wi-Fi, accounts, and software issues.",
      expectedDuration: 10,
      priorityLevel: "low",
      isOpen: true
    }
  ];
  
  const queueEntries = [];
  const notifications = [];
  const history = [];
  
  function resetStore() {
    queueEntries.length = 0;
    notifications.length = 0;
    history.length = 0;
  }
  
  module.exports = {
    services,
    queueEntries,
    notifications,
    history,
    resetStore
  };