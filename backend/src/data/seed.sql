USE QueueSmartDB;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE Notification;
TRUNCATE TABLE History;
TRUNCATE TABLE QueueEntry;
TRUNCATE TABLE Queue;
TRUNCATE TABLE Service;

SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE Service AUTO_INCREMENT = 2001;
ALTER TABLE Queue AUTO_INCREMENT = 1001;

INSERT INTO Service
(
    Service_Name,
    Description,
    Expected_Duration,
    Priority_Level,
    Is_Open
)
VALUES
('Academic Advising', 'Students can meet with an advisor to plan classes and discuss degree requirements.', 20, 'normal', TRUE),
('Clinic Check-In', 'Patients can check in for clinic services and receive wait-time updates.', 15, 'high', TRUE),
('Student Service Center', 'Help with enrollment, student records, and other general services.', 25, 'normal', TRUE),
('IT Help Desk', 'Help with login, Wi-Fi, accounts, and software issues.', 10, 'low', TRUE);

INSERT INTO Queue
(
    Service_ID,
    Status
)
VALUES
(2001, 'open'),
(2002, 'open'),
(2003, 'open'),
(2004, 'open');
